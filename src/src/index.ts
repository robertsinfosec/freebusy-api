import { parseFreeBusy } from "./ical";
import { buildWindow, clipAndMerge, toResponseBlocks } from "./freebusy";
import { allowedOriginsFromEnv, Env, forwardWindowWeeksFromEnv, isFreeBusyEnabled, rateLimitConfigFromEnv, validateEnv } from "./env";
import { preferredTimezoneFromEnv } from "./env";
import { enforceRateLimit, RateLimitOutcome } from "./rateLimit";
import { readLimitedText, redactUrl, sanitizeLogMessage } from "./logging";
import { getBuildVersion } from "./version";
import { formatIsoInTimeZone } from "./time";

interface CachedData {
  fetchedAt: number;
  busy: ReturnType<typeof parseFreeBusy>;
}

const CACHE_TTL_MS = 60_000;
const UPSTREAM_FETCH_TIMEOUT_MS = 8_000;
const MAX_UPSTREAM_BYTES = 1_500_000; // Cap upstream payload to avoid memory/CPU exhaustion.

let allowedOriginsCache: Set<string> | null = null;
let rateLimitConfigCache: ReturnType<typeof rateLimitConfigFromEnv> | null = null;
let forwardWindowWeeksCache: number | null = null;

function getAllowedOrigins(): Set<string> {
  if (!allowedOriginsCache) {
    throw new Error("allowed origins not initialized");
  }
  return allowedOriginsCache;
}

function formatRateLimit(outcome: RateLimitOutcome, timeZone: string) {
  const nowIso = formatIsoInTimeZone(new Date(), timeZone);
  const scopeEntries = Object.entries(outcome.scopes ?? {});
  const throttledResets = scopeEntries
    .filter(([, s]) => s.remaining === 0)
    .map(([, s]) => s.reset);
  const nextAllowedAt = throttledResets.length ? formatIsoInTimeZone(new Date(Math.max(...throttledResets)), timeZone) : nowIso;

  const scopes: Record<string, { remaining: number; reset: string; limit: number; windowMs: number }> = {};
  for (const [label, s] of scopeEntries) {
    scopes[label] = {
      remaining: s.remaining,
      reset: formatIsoInTimeZone(new Date(s.reset), timeZone),
      limit: s.limit,
      windowMs: s.windowMs,
    };
  }

  return {
    nextAllowedAt,
    scopes,
  };
}

let cached: CachedData | null = null;

function baseHeaders(): Headers {
  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  headers.set("X-Robots-Tag", "noindex");
  headers.set("Content-Security-Policy", "default-src 'none'");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "geolocation=(),microphone=(),camera=()");
  headers.set("Vary", "Origin");
  return headers;
}

function applyCors(headers: Headers, origin: string | null, allowedOrigins: Set<string>): boolean {
  if (!origin) return true;
  if (!allowedOrigins.has(origin)) return false;
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "600");
  return true;
}

function jsonResponse(request: Request, body: unknown, status = 200): Response {
  const origin = request.headers.get("Origin");
  const headers = baseHeaders();
  headers.set("Content-Type", "application/json");
  const allowed = applyCors(headers, origin, getAllowedOrigins());
  if (origin && !allowed) {
    return new Response(JSON.stringify({ error: "forbidden_origin" }), { status: 403, headers });
  }
  return new Response(JSON.stringify(body), { status, headers });
}

async function fetchUpstream(env: Env): Promise<ReturnType<typeof parseFreeBusy>> {
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.busy;
  }

  const target = redactUrl(env.FREEBUSY_ICAL_URL);
  console.info("[freebusy] fetching upstream iCal", { target });

  const res = await fetch(env.FREEBUSY_ICAL_URL, {
    headers: {
      Accept: "text/calendar,text/plain",
    },
    // Abort if the upstream stalls to avoid burning worker time.
    signal: AbortSignal.timeout(UPSTREAM_FETCH_TIMEOUT_MS),
  });

  console.info("[freebusy] upstream response", { target, status: res.status, ok: res.ok });
  if (!res.ok) {
    throw new Error("upstream_fetch_failed");
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("text/calendar") && !contentType.includes("text/plain")) {
    throw new Error("unexpected_content_type");
  }

  const text = await readLimitedText(res, MAX_UPSTREAM_BYTES);
  const diagnostics = {
    bytes: text.length,
    hasVfreebusy: /BEGIN:VFREEBUSY/i.test(text),
    freebusyTokens: (text.match(/FREEBUSY/gi) || []).length,
  };
  console.info("[freebusy] upstream ical diagnostics", { target, ...diagnostics });

  const busy = parseFreeBusy(text, (msg) => console.warn("[freebusy] parse warning", sanitizeLogMessage(msg)));
  console.info("[freebusy] parsed busy blocks", { count: busy.length });
  cached = { fetchedAt: now, busy };
  return busy;
}

async function handleFreeBusy(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "0.0.0.0";

  const preferredTimeZone = preferredTimezoneFromEnv(env);

  let rateLimitOutcome: RateLimitOutcome | null = null;
  try {
    if (!rateLimitConfigCache) {
      throw new Error("rate limit config not initialized");
    }
    rateLimitOutcome = await enforceRateLimit(env, ip, rateLimitConfigCache);
    if (!rateLimitOutcome.allowed) {
      return jsonResponse(request, { error: "rate_limited", rateLimit: formatRateLimit(rateLimitOutcome, preferredTimeZone) }, 429);
    }
  } catch (err) {
    console.error("rate limit failure", err);
    return jsonResponse(request, { error: "upstream" }, 502);
  }

  let busy;
  try {
    busy = await fetchUpstream(env);
  } catch (err) {
    console.error("upstream fetch error", err);
    return jsonResponse(request, { error: "upstream" }, 502);
  }

  const now = new Date();
  if (forwardWindowWeeksCache === null) {
    throw new Error("forward window not initialized");
  }

  const { windowStart, windowEnd } = buildWindow(forwardWindowWeeksCache, now, preferredTimeZone);

  let merged;
  try {
    merged = clipAndMerge(busy, windowStart, windowEnd);
  } catch (err) {
    console.error("parse/merge error", err);
    return jsonResponse(request, { error: "parse" }, 502);
  }

  const responseBody = {
    version: getBuildVersion(),
    generatedAt: formatIsoInTimeZone(now, preferredTimeZone),
    window: {
      start: formatIsoInTimeZone(windowStart, preferredTimeZone),
      end: formatIsoInTimeZone(windowEnd, preferredTimeZone),
    },
    timezone: preferredTimeZone,
    busy: toResponseBlocks(merged, preferredTimeZone),
    rateLimit: rateLimitOutcome ? formatRateLimit(rateLimitOutcome, preferredTimeZone) : undefined,
  };

  return jsonResponse(request, responseBody, 200);
}

function handleHealth(request: Request): Response {
  return jsonResponse(request, { ok: true }, 200);
}

async function handleOptions(request: Request): Promise<Response> {
  const origin = request.headers.get("Origin");
  const headers = baseHeaders();
  const allowed = applyCors(headers, origin, getAllowedOrigins());
  if (!allowed) {
    return new Response(null, { status: 403, headers });
  }
  headers.set("Content-Length", "0");
  return new Response(null, { status: 204, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let validatedEnv: Env;
    try {
      validatedEnv = validateEnv(env);
    } catch (err) {
      console.error("env validation failed", err);
      return jsonResponse(request, { error: "misconfigured" }, 500);
    }

    allowedOriginsCache = allowedOriginsFromEnv(validatedEnv);
    rateLimitConfigCache = rateLimitConfigFromEnv(validatedEnv);
    forwardWindowWeeksCache = forwardWindowWeeksFromEnv(validatedEnv);

    const { pathname } = new URL(request.url);
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    if (pathname === "/health") {
      return handleHealth(request);
    }

    if (pathname === "/freebusy" && request.method === "GET") {
      if (!isFreeBusyEnabled(validatedEnv)) {
        console.info("[freebusy] disabled via FREEBUSY_ENABLED flag");
        return jsonResponse(request, { error: "disabled" }, 503);
      }
      return handleFreeBusy(request, validatedEnv);
    }

    return jsonResponse(request, { error: "not_found" }, 404);
  },
};

export { RateLimitDurable } from "./rateLimit";
