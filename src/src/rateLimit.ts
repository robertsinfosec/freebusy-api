import { Env } from "./env";

const DO_NAME = "rate-limiter";
const RATE_LIMIT_DO_TIMEOUT_MS = 3_000;

export interface RateLimitScopeOutcome {
  label: string;
  allowed: boolean;
  remaining: number;
  reset: number;
  limit: number;
  windowMs: number;
}

export interface RateLimitOutcome {
  allowed: boolean;
  remaining: number;
  reset: number;
  scopes: Record<string, RateLimitScopeOutcome>;
}

export interface RateLimitPair {
  windowMs: number;
  limit: number;
}

export interface RateLimitConfig {
  perIp: RateLimitPair;
  global?: RateLimitPair;
}

/**
 * Produces a stable hash of IP + salt to avoid leaking caller IPs to storage.
 */
export async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${ip}${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Calls the Durable Object rate limiter for the provided scopes.
 */
export async function enforceRateLimit(env: Env, ip: string, config: RateLimitConfig): Promise<RateLimitOutcome> {
  const scopes: { label: string; key: string; limit: number; windowMs: number }[] = [];

  const ipKey = await hashIp(ip, env.RL_SALT);
  scopes.push({ label: "perIp", key: ipKey, limit: config.perIp.limit, windowMs: config.perIp.windowMs });

  if (config.global) {
    const globalKey = await hashIp("global", env.RL_SALT);
    scopes.push({ label: "global", key: globalKey, limit: config.global.limit, windowMs: config.global.windowMs });
  }

  const id = env.RATE_LIMITER.idFromName(DO_NAME);
  const stub = env.RATE_LIMITER.get(id);
  const res = await stub.fetch("https://rate-limit/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scopes }),
    signal: AbortSignal.timeout(RATE_LIMIT_DO_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`rate_limit_error: ${res.status}`);
  }

  let data: { allowed?: boolean; scopes?: RateLimitScopeOutcome[] };
  try {
    data = (await res.json()) as { allowed?: boolean; scopes?: RateLimitScopeOutcome[] };
  } catch (err) {
    throw new Error(`rate_limit_error: invalid response: ${String(err)}`);
  }

  const scopeOutcomesArray: RateLimitScopeOutcome[] = Array.isArray(data.scopes) ? data.scopes : [];
  const scopesMap: Record<string, RateLimitScopeOutcome> = {};
  for (const scope of scopeOutcomesArray) {
    if (!scope || !scope.label) {
      throw new Error("rate_limit_error: missing scope label");
    }
    if (!Number.isFinite(scope.limit) || scope.limit! <= 0) {
      throw new Error("rate_limit_error: invalid scope limit");
    }
    if (!Number.isFinite(scope.windowMs) || scope.windowMs! <= 0) {
      throw new Error("rate_limit_error: invalid scope windowMs");
    }
    if (!Number.isFinite(scope.remaining) || scope.remaining! < 0) {
      throw new Error("rate_limit_error: invalid scope remaining");
    }
    if (!Number.isFinite(scope.reset) || scope.reset! <= 0) {
      throw new Error("rate_limit_error: invalid scope reset");
    }

    scopesMap[scope.label] = {
      label: scope.label,
      allowed: Boolean(scope.allowed),
      remaining: scope.remaining as number,
      reset: scope.reset as number,
      limit: scope.limit as number,
      windowMs: scope.windowMs as number,
    };
  }

  if (!scopeOutcomesArray.length) {
    throw new Error("rate_limit_error: empty scope outcomes");
  }

  const overallAllowed = data.allowed ?? scopeOutcomesArray.every((s) => Boolean(s?.allowed));
  const scopeValues = Object.values(scopesMap);
  const aggregatedRemaining = Math.min(...scopeValues.map((s) => s.remaining));
  const aggregatedReset = Math.max(...scopeValues.map((s) => s.reset));

  return {
    allowed: Boolean(overallAllowed),
    remaining: aggregatedRemaining,
    reset: aggregatedReset,
    scopes: scopesMap,
  };
}

interface StoredCounter {
  count: number;
  windowStart: number;
}

export class RateLimitDurable {
  private storage: DurableObjectStorage;

  constructor(state: DurableObjectState) {
    this.storage = state.storage;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }

    let body: { scopes?: { key?: string; label?: string; limit?: number; windowMs?: number }[] } | { key?: string; limit?: number; windowMs?: number };
    try {
      body = (await request.json()) as { scopes?: { key?: string; label?: string; limit?: number; windowMs?: number }[] };
    } catch {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }

    // Backward-compatible single-scope payload
    const scopes = Array.isArray((body as { scopes?: unknown }).scopes)
      ? ((body as { scopes?: { key?: string; label?: string; limit?: number; windowMs?: number }[] }).scopes as {
          key?: string;
          label?: string;
          limit?: number;
          windowMs?: number;
        }[])
      : (body as { key?: string; limit?: number; windowMs?: number }).key
        ? [
            {
              key: (body as { key?: string }).key,
              label: "default",
              limit: (body as { limit?: number }).limit,
              windowMs: (body as { windowMs?: number }).windowMs,
            },
          ]
        : [];

    if (!scopes.length || scopes.some((s) => !s.key || typeof s.key !== "string")) {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }

    const now = Date.now();
    const results: RateLimitScopeOutcome[] = [];

    for (const scope of scopes) {
      if (!Number.isFinite(scope.limit) || (scope.limit as number) <= 0) {
        return Response.json({ error: "bad_request" }, { status: 400 });
      }
      if (!Number.isFinite(scope.windowMs) || (scope.windowMs as number) <= 0) {
        return Response.json({ error: "bad_request" }, { status: 400 });
      }

      const parsedLimit = scope.limit as number;
      const parsedWindow = scope.windowMs as number;

      const current = (await this.storage.get<StoredCounter>(scope.key as string)) ?? { count: 0, windowStart: now };

      let { count, windowStart } = current;
      if (now - windowStart >= parsedWindow) {
        count = 0;
        windowStart = now;
      }

      count += 1;
      const allowed = count <= parsedLimit;
      const remaining = allowed ? parsedLimit - count : 0;

      await this.storage.put(scope.key as string, { count, windowStart });

      results.push({
        label: scope.label || "default",
        allowed,
        remaining,
        reset: windowStart + parsedWindow,
        limit: parsedLimit,
        windowMs: parsedWindow,
      });
    }

    const overallAllowed = results.every((r) => r.allowed);
    return Response.json({ allowed: overallAllowed, scopes: results });
  }
}
