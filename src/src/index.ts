import { parseFreeBusy } from "./ical";
import { buildWindowV2, clipAndMerge, toResponseBusy } from "./freebusy";
import {
  allowedOriginsFromEnv,
  cacheTtlSecondsFromEnv,
  calendarTimezoneFromEnv,
  EnvValidationError,
  Env,
  isFreeBusyEnabled,
  rateLimitConfigFromEnv,
  upstreamMaxBytesFromEnv,
  validateEnv,
  weekStartDayFromEnv,
  windowWeeksFromEnv,
  WorkingHours,
  workingHoursFromEnv,
} from "./env";
import { enforceRateLimit, RateLimitOutcome } from "./rateLimit";
import { readLimitedText, redactUrl, sanitizeLogMessage } from "./logging";
import { getBuildVersion } from "./version";
import { formatUtcIso } from "./time";

interface CachedData {
  fetchedAt: number;
  busy: ReturnType<typeof parseFreeBusy>;
}

const UPSTREAM_FETCH_TIMEOUT_MS = 8_000;

let allowedOriginsCache: Set<string> | null = null;
let rateLimitConfigCache: ReturnType<typeof rateLimitConfigFromEnv> | null = null;
let windowWeeksCache: number | null = null;
let weekStartDayCache: number | null = null;
let calendarTimeZoneCache: string | null = null;
let workingHoursCache: WorkingHours | null = null;
let cacheTtlSecondsCache: number | null = null;
let upstreamMaxBytesCache: number | null = null;

function getAllowedOrigins(): Set<string> {
  if (!allowedOriginsCache) {
    throw new Error("allowed origins not initialized");
  }
  return allowedOriginsCache;
}

function tryGetAllowedOrigins(): Set<string> | null {
  try {
    return getAllowedOrigins();
  } catch {
    return null;
  }
}

function getWorkingHours(): WorkingHours {
  if (!workingHoursCache) {
    throw new Error("working hours not initialized");
  }
  return workingHoursCache;
}

function formatRateLimit(outcome: RateLimitOutcome) {
  const nowIsoUtc = formatUtcIso(Date.now());
  const scopeEntries = Object.entries(outcome.scopes ?? {});
  const throttledResets = scopeEntries
    .filter(([, s]) => s.remaining === 0)
    .map(([, s]) => s.reset);
  const nextAllowedAtUtc = throttledResets.length ? formatUtcIso(Math.max(...throttledResets)) : nowIsoUtc;

  const scopes: Record<string, { remaining: number; resetUtc: string; limit: number; windowMs: number }> = {};
  for (const [label, s] of scopeEntries) {
    scopes[label] = {
      remaining: s.remaining,
      resetUtc: formatUtcIso(s.reset),
      limit: s.limit,
      windowMs: s.windowMs,
    };
  }

  return {
    nextAllowedAtUtc,
    scopes,
  };
}

let cached: CachedData | null = null;

function clearEnvCaches(): void {
  allowedOriginsCache = null;
  rateLimitConfigCache = null;
  windowWeeksCache = null;
  weekStartDayCache = null;
  calendarTimeZoneCache = null;
  workingHoursCache = null;
  cacheTtlSecondsCache = null;
  upstreamMaxBytesCache = null;
}

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

  const allowedOrigins = tryGetAllowedOrigins();
  if (allowedOrigins) {
    const allowed = applyCors(headers, origin, allowedOrigins);
    if (origin && !allowed) {
      return new Response(JSON.stringify({ error: "forbidden_origin" }), { status: 403, headers });
    }
  }
  return new Response(JSON.stringify(body), { status, headers });
}

async function fetchUpstream(env: Env): Promise<ReturnType<typeof parseFreeBusy>> {
  const now = Date.now();

  if (cacheTtlSecondsCache === null) {
    throw new Error("cache ttl not initialized");
  }

  const cacheTtlMs = cacheTtlSecondsCache * 1000;
  if (cached && now - cached.fetchedAt < cacheTtlMs) {
    return cached.busy;
  }

  const calendarTimeZone = calendarTimezoneFromEnv(env);

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

  if (upstreamMaxBytesCache === null) {
    throw new Error("upstream max bytes not initialized");
  }

  const text = await readLimitedText(res, upstreamMaxBytesCache);
  const diagnostics = {
    bytes: text.length,
    hasVfreebusy: /BEGIN:VFREEBUSY/i.test(text),
    freebusyTokens: (text.match(/FREEBUSY/gi) || []).length,
  };
  console.info("[freebusy] upstream ical diagnostics", { target, ...diagnostics });

  const busy = parseFreeBusy(text, (msg) => console.warn("[freebusy] parse warning", sanitizeLogMessage(msg)), calendarTimeZone);
  console.info("[freebusy] parsed busy blocks", { count: busy.length });
  cached = { fetchedAt: now, busy };
  return busy;
}

async function handleFreeBusy(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "0.0.0.0";

  if (calendarTimeZoneCache === null || weekStartDayCache === null || windowWeeksCache === null) {
    throw new Error("calendar config not initialized");
  }
  const calendarTimeZone = calendarTimeZoneCache;

  let rateLimitOutcome: RateLimitOutcome | null = null;
  try {
    if (!rateLimitConfigCache) {
      throw new Error("rate limit config not initialized");
    }
    rateLimitOutcome = await enforceRateLimit(env, ip, rateLimitConfigCache);
    if (!rateLimitOutcome.allowed) {
      return jsonResponse(request, { error: "rate_limited", rateLimit: formatRateLimit(rateLimitOutcome) }, 429);
    }
  } catch (err) {
    console.error("rate limit failure", err);
    return jsonResponse(request, { error: "upstream_error" }, 502);
  }

  let busy;
  try {
    busy = await fetchUpstream(env);
  } catch (err) {
    console.error("upstream fetch error", err);
    return jsonResponse(request, { error: "upstream_error" }, 502);
  }

  const now = new Date();

  const window = buildWindowV2(windowWeeksCache, now, calendarTimeZone);

  let merged;
  try {
    merged = clipAndMerge(busy, window.startMsUtc, window.endMsUtcExclusive);
  } catch (err) {
    console.error("parse/merge error", err);
    return jsonResponse(request, { error: "upstream_error" }, 502);
  }

  const responseBody = {
    version: getBuildVersion(),
    generatedAtUtc: formatUtcIso(now),
    calendar: {
      timeZone: calendarTimeZone,
      weekStartDay: weekStartDayCache,
    },
    window: {
      startDate: window.startDate,
      endDateInclusive: window.endDateInclusive,
      startUtc: formatUtcIso(window.startMsUtc),
      endUtcExclusive: formatUtcIso(window.endMsUtcExclusive),
    },
    workingHours: getWorkingHours(),
    busy: toResponseBusy(merged),
    rateLimit: rateLimitOutcome ? formatRateLimit(rateLimitOutcome) : undefined,
  };

  return jsonResponse(request, responseBody, 200);
}

function handleHealth(request: Request): Response {
  return jsonResponse(request, { ok: true }, 200);
}

async function handleOptions(request: Request): Promise<Response> {
  const origin = request.headers.get("Origin");
  const headers = baseHeaders();

  const allowedOrigins = tryGetAllowedOrigins();
  if (allowedOrigins) {
    const allowed = applyCors(headers, origin, allowedOrigins);
    if (!allowed) {
      return new Response(null, { status: 403, headers });
    }
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
      clearEnvCaches();
      if (err instanceof EnvValidationError) {
        console.error("env validation failed", { message: err.message, missing: err.missing, invalid: err.invalid });
      } else {
        console.error("env validation failed", err);
      }
      return jsonResponse(request, { error: "misconfigured" }, 500);
    }

    try {
      allowedOriginsCache = allowedOriginsFromEnv(validatedEnv);
      rateLimitConfigCache = rateLimitConfigFromEnv(validatedEnv);
      windowWeeksCache = windowWeeksFromEnv(validatedEnv);
      weekStartDayCache = weekStartDayFromEnv(validatedEnv);
      calendarTimeZoneCache = calendarTimezoneFromEnv(validatedEnv);
      workingHoursCache = workingHoursFromEnv(validatedEnv);
      cacheTtlSecondsCache = cacheTtlSecondsFromEnv(validatedEnv);
      upstreamMaxBytesCache = upstreamMaxBytesFromEnv(validatedEnv);
    } catch (err) {
      clearEnvCaches();
      console.error("env parsing failed", err);
      return jsonResponse(request, { error: "misconfigured" }, 500);
    }

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
