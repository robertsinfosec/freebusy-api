import { parseFreeBusy } from "./ical";
import { buildWindowV2, clipAndMerge, toResponseBusy } from "./freebusy";
import { Env, EnvValidationError, isFreeBusyEnabled, validateEnv } from "./env";
import { enforceRateLimit, RateLimitOutcome } from "./rateLimit";
import { readLimitedText, redactUrl, sanitizeLogMessage } from "./logging";
import { getBuildVersion } from "./version";
import { formatUtcIso } from "./time";
import { jsonResponse, optionsResponse } from "./http";
import { parseWorkerConfig, WorkerConfig } from "./config";

interface CachedData {
  fetchedAt: number;
  busy: ReturnType<typeof parseFreeBusy>;
}

const UPSTREAM_FETCH_TIMEOUT_MS = 8_000;

export interface WorkerDeps {
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
  nowDate?: () => Date;
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

export function createWorker(deps: WorkerDeps = {}) {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const nowMs = deps.nowMs ?? (() => Date.now());
  const nowDate = deps.nowDate ?? (() => new Date());

  let cached: CachedData | null = null;

  async function fetchUpstream(env: Env, config: WorkerConfig): Promise<ReturnType<typeof parseFreeBusy>> {
    const now = nowMs();

    const cacheTtlMs = config.cacheTtlSeconds * 1000;
    if (cached && now - cached.fetchedAt < cacheTtlMs) {
      return cached.busy;
    }

    const target = redactUrl(env.FREEBUSY_ICAL_URL);
    console.info("[freebusy] fetching upstream iCal", { target });

    const res = await fetchImpl(env.FREEBUSY_ICAL_URL, {
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

    const text = await readLimitedText(res, config.upstreamMaxBytes);
    const diagnostics = {
      bytes: text.length,
      hasVfreebusy: /BEGIN:VFREEBUSY/i.test(text),
      freebusyTokens: (text.match(/FREEBUSY/gi) || []).length,
    };
    console.info("[freebusy] upstream ical diagnostics", { target, ...diagnostics });

    const busy = parseFreeBusy(text, (msg) => console.warn("[freebusy] parse warning", sanitizeLogMessage(msg)), config.calendarTimeZone);
    console.info("[freebusy] parsed busy blocks", { count: busy.length });

    cached = { fetchedAt: now, busy };
    return busy;
  }

  async function handleFreeBusy(request: Request, env: Env, config: WorkerConfig): Promise<Response> {
    const ip = request.headers.get("CF-Connecting-IP") ?? "0.0.0.0";

    let rateLimitOutcome: RateLimitOutcome | null = null;
    try {
      rateLimitOutcome = await enforceRateLimit(env, ip, config.rateLimitConfig);
      if (!rateLimitOutcome.allowed) {
        return jsonResponse(request, { error: "rate_limited", rateLimit: formatRateLimit(rateLimitOutcome) }, 429, config.allowedOrigins);
      }
    } catch (err) {
      console.error("rate limit failure", err);
      return jsonResponse(request, { error: "upstream_error" }, 502, config.allowedOrigins);
    }

    let busy;
    try {
      busy = await fetchUpstream(env, config);
    } catch (err) {
      console.error("upstream fetch error", err);
      return jsonResponse(request, { error: "upstream_error" }, 502, config.allowedOrigins);
    }

    const now = nowDate();
    const window = buildWindowV2(config.windowWeeks, now, config.calendarTimeZone);

    let merged;
    try {
      merged = clipAndMerge(busy, window.startMsUtc, window.endMsUtcExclusive);
    } catch (err) {
      console.error("parse/merge error", err);
      return jsonResponse(request, { error: "upstream_error" }, 502, config.allowedOrigins);
    }

    const responseBody = {
      version: getBuildVersion(),
      generatedAtUtc: formatUtcIso(now),
      calendar: {
        timeZone: config.calendarTimeZone,
        weekStartDay: config.weekStartDay,
      },
      window: {
        startDate: window.startDate,
        endDateInclusive: window.endDateInclusive,
        startUtc: formatUtcIso(window.startMsUtc),
        endUtcExclusive: formatUtcIso(window.endMsUtcExclusive),
      },
      workingHours: config.workingHours,
      busy: toResponseBusy(merged),
      rateLimit: rateLimitOutcome ? formatRateLimit(rateLimitOutcome) : undefined,
    };

    return jsonResponse(request, responseBody, 200, config.allowedOrigins);
  }

  function handleHealth(request: Request, allowedOrigins: Set<string>): Response {
    return jsonResponse(request, { ok: true }, 200, allowedOrigins);
  }

  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      let validatedEnv: Env;
      try {
        validatedEnv = validateEnv(env);
      } catch (err) {
        if (err instanceof EnvValidationError) {
          console.error("env validation failed", { message: err.message, missing: err.missing, invalid: err.invalid });
        } else {
          console.error("env validation failed", err);
        }
        // Important behavior: do not enforce CORS when env is misconfigured.
        return jsonResponse(request, { error: "misconfigured" }, 500);
      }

      let config: WorkerConfig;
      try {
        config = parseWorkerConfig(validatedEnv);
      } catch (err) {
        console.error("env parsing failed", err);
        // Important behavior: do not enforce CORS when env is misconfigured.
        return jsonResponse(request, { error: "misconfigured" }, 500);
      }

      const { pathname } = new URL(request.url);
      if (request.method === "OPTIONS") {
        return optionsResponse(request, config.allowedOrigins);
      }

      if (pathname === "/health") {
        return handleHealth(request, config.allowedOrigins);
      }

      if (pathname === "/freebusy" && request.method === "GET") {
        if (!isFreeBusyEnabled(validatedEnv)) {
          console.info("[freebusy] disabled via FREEBUSY_ENABLED flag");
          return jsonResponse(request, { error: "disabled" }, 503, config.allowedOrigins);
        }
        return handleFreeBusy(request, validatedEnv, config);
      }

      return jsonResponse(request, { error: "not_found" }, 404, config.allowedOrigins);
    },
  };
}
