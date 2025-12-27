export interface Env {
  FREEBUSY_ICAL_URL: string;
  RL_SALT: string;
  RATE_LIMITER: DurableObjectNamespace;
  MAXIMUM_FORWARD_WINDOW_IN_WEEKS: string;
  PREFERRED_TIMEZONE: string;
  FREEBUSY_ENABLED?: string;
  CORS_ALLOWLIST?: string;
  RATE_LIMIT_WINDOW_MS?: string;
  RATE_LIMIT_MAX?: string;
  RATE_LIMIT_GLOBAL_WINDOW_MS?: string;
  RATE_LIMIT_GLOBAL_MAX?: string;
}

const MAX_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // Hard ceiling to prevent runaway windows.
const MAX_FORWARD_WINDOW_WEEKS = 104; // Safety guardrail (two years).

function isDurableObjectNamespace(value: unknown): value is DurableObjectNamespace {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { idFromName?: unknown }).idFromName === "function" &&
    typeof (value as { get?: unknown }).get === "function"
  );
}

function parseRequiredPositiveInt(name: string, raw: string | undefined, max: number = Number.MAX_SAFE_INTEGER): number {
  if (raw === undefined) {
    throw new Error(`missing ${name}`);
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`invalid ${name}`);
  }
  return Math.min(parsed, max);
}

function parseRequiredList(name: string, raw: string | undefined): Set<string> {
  if (!raw) {
    throw new Error(`missing ${name}`);
  }
  const parsed = raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (!parsed.length) {
    throw new Error(`invalid ${name}`);
  }
  return new Set(parsed);
}

/**
 * Validates and narrows the worker environment bindings, throwing on any missing or malformed values.
 */
export function validateEnv(env: Partial<Env>): Env {
  if (!env.FREEBUSY_ICAL_URL || typeof env.FREEBUSY_ICAL_URL !== "string") {
    throw new Error("missing FREEBUSY_ICAL_URL");
  }
  if (!env.RL_SALT || typeof env.RL_SALT !== "string") {
    throw new Error("missing RL_SALT");
  }
  if (!env.MAXIMUM_FORWARD_WINDOW_IN_WEEKS || typeof env.MAXIMUM_FORWARD_WINDOW_IN_WEEKS !== "string") {
    throw new Error("missing MAXIMUM_FORWARD_WINDOW_IN_WEEKS");
  }
  if (!env.PREFERRED_TIMEZONE || typeof env.PREFERRED_TIMEZONE !== "string") {
    throw new Error("missing PREFERRED_TIMEZONE");
  }
  if (!isDurableObjectNamespace(env.RATE_LIMITER)) {
    throw new Error("missing RATE_LIMITER binding");
  }

  // Basic URL validation without exposing the secret value.
  try {
    // eslint-disable-next-line no-new
    new URL(env.FREEBUSY_ICAL_URL);
  } catch {
    throw new Error("invalid FREEBUSY_ICAL_URL");
  }

  // Validate timezone identifier early so we fail-fast on misconfiguration.
  try {
    // eslint-disable-next-line no-new
    new Intl.DateTimeFormat("en-US", { timeZone: env.PREFERRED_TIMEZONE });
  } catch {
    throw new Error("invalid PREFERRED_TIMEZONE");
  }

  return env as Env;
}

export function preferredTimezoneFromEnv(env: Env): string {
  return env.PREFERRED_TIMEZONE;
}

/**
 * Returns true when free/busy endpoint is enabled; defaults to enabled when unset.
 */
export function isFreeBusyEnabled(env: Partial<Env>): boolean {
  const flag = env.FREEBUSY_ENABLED;
  if (flag === undefined) return true;
  const normalized = String(flag).trim().toLowerCase();
  return normalized !== "false" && normalized !== "0" && normalized !== "off";
}

/**
 * Builds an allowlist set from env, requiring a non-empty list.
 */
export function allowedOriginsFromEnv(env: Env): Set<string> {
  return parseRequiredList("CORS_ALLOWLIST", env.CORS_ALLOWLIST);
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
 * Parses rate limit configuration with sane defaults and upper bounds.
 */
export function rateLimitConfigFromEnv(env: Env): RateLimitConfig {
  const parsedWindow = parseRequiredPositiveInt("RATE_LIMIT_WINDOW_MS", env.RATE_LIMIT_WINDOW_MS, MAX_RATE_LIMIT_WINDOW_MS);
  const parsedLimit = parseRequiredPositiveInt("RATE_LIMIT_MAX", env.RATE_LIMIT_MAX);

  const perIp: RateLimitPair = { windowMs: parsedWindow, limit: parsedLimit };

  const hasGlobalWindow = env.RATE_LIMIT_GLOBAL_WINDOW_MS !== undefined;
  const hasGlobalLimit = env.RATE_LIMIT_GLOBAL_MAX !== undefined;
  if (hasGlobalWindow !== hasGlobalLimit) {
    throw new Error("global rate limit requires both RATE_LIMIT_GLOBAL_WINDOW_MS and RATE_LIMIT_GLOBAL_MAX");
  }

  const global: RateLimitPair | undefined = hasGlobalWindow
    ? {
        windowMs: parseRequiredPositiveInt("RATE_LIMIT_GLOBAL_WINDOW_MS", env.RATE_LIMIT_GLOBAL_WINDOW_MS, MAX_RATE_LIMIT_WINDOW_MS),
        limit: parseRequiredPositiveInt("RATE_LIMIT_GLOBAL_MAX", env.RATE_LIMIT_GLOBAL_MAX),
      }
    : undefined;

  return { perIp, global };
}

/**
 * Parses the forward-looking window (in weeks) for free/busy responses.
 */
export function forwardWindowWeeksFromEnv(env: Env): number {
  return parseRequiredPositiveInt("MAXIMUM_FORWARD_WINDOW_IN_WEEKS", env.MAXIMUM_FORWARD_WINDOW_IN_WEEKS, MAX_FORWARD_WINDOW_WEEKS);
}
