import { parseFreeBusy } from "./ical";
import { buildWindow, clipAndMerge, toResponseBlocks } from "./freebusy";
import { Env, validateEnv } from "./env";
import { enforceRateLimit } from "./rateLimit";

interface CachedData {
  fetchedAt: number;
  busy: ReturnType<typeof parseFreeBusy>;
}

const CACHE_TTL_MS = 60_000;
const ALLOWED_ORIGINS = new Set([
  "https://freebusy.robertsinfosec.com",
  "http://localhost:5173",
]);

let cached: CachedData | null = null;

function baseHeaders(): Headers {
  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  headers.set("X-Robots-Tag", "noindex");
  headers.set("Content-Security-Policy", "default-src 'none'");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Vary", "Origin");
  return headers;
}

function applyCors(headers: Headers, origin: string | null): boolean {
  if (!origin) return true;
  if (!ALLOWED_ORIGINS.has(origin)) return false;
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
  const allowed = applyCors(headers, origin);
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

  const res = await fetch(env.FREEBUSY_ICAL_URL, {
    headers: {
      Accept: "text/calendar,text/plain",
    },
  });

  if (!res.ok) {
    throw new Error("upstream_fetch_failed");
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("text/calendar") && !contentType.includes("text/plain")) {
    throw new Error("unexpected_content_type");
  }

  const text = await res.text();
  const busy = parseFreeBusy(text, (msg) => console.warn(msg));
  cached = { fetchedAt: now, busy };
  return busy;
}

async function handleFreeBusy(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "0.0.0.0";

  try {
    const result = await enforceRateLimit(env, ip);
    if (!result.allowed) {
      return jsonResponse(request, { error: "rate_limited" }, 429);
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
  const { windowStart, windowEnd } = buildWindow(now);

  let merged;
  try {
    merged = clipAndMerge(busy, windowStart, windowEnd);
  } catch (err) {
    console.error("parse/merge error", err);
    return jsonResponse(request, { error: "parse" }, 502);
  }

  const responseBody = {
    generatedAt: now.toISOString(),
    window: { start: windowStart.toISOString(), end: windowEnd.toISOString() },
    timezone: "Etc/UTC",
    busy: toResponseBlocks(merged),
  };

  return jsonResponse(request, responseBody, 200);
}

function handleHealth(request: Request): Response {
  return jsonResponse(request, { ok: true }, 200);
}

async function handleOptions(request: Request): Promise<Response> {
  const origin = request.headers.get("Origin");
  const headers = baseHeaders();
  const allowed = applyCors(headers, origin);
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

    const { pathname } = new URL(request.url);
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    if (pathname === "/health") {
      return handleHealth(request);
    }

    if (pathname === "/freebusy" && request.method === "GET") {
      return handleFreeBusy(request, validatedEnv);
    }

    return jsonResponse(request, { error: "not_found" }, 404);
  },
};

export { RateLimitDurable } from "./rateLimit";
