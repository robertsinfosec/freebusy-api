export interface Env {
  FREEBUSY_ICAL_URL: string;
  RL_SALT: string;
  RATE_LIMITER: DurableObjectNamespace;

  // v2 calendar/time semantics
  CALENDAR_TIMEZONE: string;
  WINDOW_WEEKS: string;
  WEEK_START_DAY?: string;
  WORKING_HOURS_JSON: string;

  // Safety limits / caching
  CACHE_TTL_SECONDS?: string;
  UPSTREAM_MAX_BYTES?: string;

  FREEBUSY_ENABLED?: string;
  CORS_ALLOWLIST?: string;
  RATE_LIMIT_WINDOW_MS?: string;
  RATE_LIMIT_MAX?: string;
  RATE_LIMIT_GLOBAL_WINDOW_MS?: string;
  RATE_LIMIT_GLOBAL_MAX?: string;
}

export interface WorkingHoursWeeklyEntry {
  // ISO-8601 day-of-week: 1=Monday ... 7=Sunday
  dayOfWeek: number;
  // 24h local time in HH:MM
  start: string;
  end: string;
}

export interface WorkingHours {
  weekly: WorkingHoursWeeklyEntry[];
}

export class EnvValidationError extends Error {
  public readonly missing: string[];
  public readonly invalid: string[];

  constructor(message: string, details: { missing?: string[]; invalid?: string[] } = {}) {
    super(message);
    this.name = "EnvValidationError";
    this.missing = details.missing ?? [];
    this.invalid = details.invalid ?? [];
  }
}

const MAX_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // Hard ceiling to prevent runaway windows.
const MAX_FORWARD_WINDOW_WEEKS = 104; // Safety guardrail (two years).
const MAX_CACHE_TTL_SECONDS = 60 * 60; // 1 hour
const DEFAULT_CACHE_TTL_SECONDS = 60;
const DEFAULT_UPSTREAM_MAX_BYTES = 1_500_000;
const MAX_UPSTREAM_BYTES = 10_000_000;

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

function parseOptionalPositiveInt(name: string, raw: string | undefined, defaultValue: number, max: number = Number.MAX_SAFE_INTEGER): number {
  if (raw === undefined || String(raw).trim() === "") {
    return defaultValue;
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
  const missing: string[] = [];
  const invalid: string[] = [];

  if (!env.FREEBUSY_ICAL_URL || typeof env.FREEBUSY_ICAL_URL !== "string") missing.push("FREEBUSY_ICAL_URL");
  if (!env.RL_SALT || typeof env.RL_SALT !== "string") missing.push("RL_SALT");
  if (!env.CALENDAR_TIMEZONE || typeof env.CALENDAR_TIMEZONE !== "string") missing.push("CALENDAR_TIMEZONE");
  if (!env.WINDOW_WEEKS || typeof env.WINDOW_WEEKS !== "string") missing.push("WINDOW_WEEKS");
  if (!env.WORKING_HOURS_JSON || typeof env.WORKING_HOURS_JSON !== "string") missing.push("WORKING_HOURS_JSON");
  if (!isDurableObjectNamespace(env.RATE_LIMITER)) missing.push("RATE_LIMITER(binding)");

  if (missing.length) {
    throw new EnvValidationError("missing required environment bindings", { missing });
  }

  // Basic URL validation without exposing the secret value.
  try {
    new URL(env.FREEBUSY_ICAL_URL!);
  } catch {
    invalid.push("FREEBUSY_ICAL_URL");
  }

  // Validate timezone identifier early so we fail-fast on misconfiguration.
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: env.CALENDAR_TIMEZONE! });
  } catch {
    invalid.push("CALENDAR_TIMEZONE");
  }

  // Validate working hours JSON is parseable.
  try {
    const parsed = JSON.parse(env.WORKING_HOURS_JSON!) as unknown;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("not_object");
    }
  } catch {
    invalid.push("WORKING_HOURS_JSON");
  }

  if (invalid.length) {
    throw new EnvValidationError("invalid environment values", { invalid });
  }

  return env as Env;
}

export function calendarTimezoneFromEnv(env: Env): string {
  return env.CALENDAR_TIMEZONE;
}

function parseLocalTimeHm(value: string): { minutes: number } | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  return { minutes: hour * 60 + minute };
}

export function weekStartDayFromEnv(env: Env): number {
  const raw = env.WEEK_START_DAY;
  if (raw === undefined || String(raw).trim() === "") return 1;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 7) {
    throw new Error("invalid WEEK_START_DAY");
  }
  return parsed;
}

export function cacheTtlSecondsFromEnv(env: Env): number {
  return parseOptionalPositiveInt("CACHE_TTL_SECONDS", env.CACHE_TTL_SECONDS, DEFAULT_CACHE_TTL_SECONDS, MAX_CACHE_TTL_SECONDS);
}

export function upstreamMaxBytesFromEnv(env: Env): number {
  return parseOptionalPositiveInt("UPSTREAM_MAX_BYTES", env.UPSTREAM_MAX_BYTES, DEFAULT_UPSTREAM_MAX_BYTES, MAX_UPSTREAM_BYTES);
}

export function workingHoursFromEnv(env: Env): WorkingHours {
  let parsed: unknown;
  try {
    parsed = JSON.parse(env.WORKING_HOURS_JSON);
  } catch {
    throw new Error("invalid WORKING_HOURS_JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("invalid WORKING_HOURS_JSON");
  }

  const obj = parsed as { weekly?: unknown };

  if (!Array.isArray(obj.weekly) || obj.weekly.length === 0) {
    throw new Error("invalid WORKING_HOURS_JSON");
  }

  const seenDays = new Set<number>();
  const weekly: WorkingHoursWeeklyEntry[] = obj.weekly.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new Error("invalid WORKING_HOURS_JSON");
    }

    const e = entry as { dayOfWeek?: unknown; start?: unknown; end?: unknown };
    const dayOfWeek = typeof e.dayOfWeek === "number" ? e.dayOfWeek : NaN;
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
      throw new Error("invalid WORKING_HOURS_JSON");
    }
    if (seenDays.has(dayOfWeek)) {
      throw new Error("invalid WORKING_HOURS_JSON");
    }
    seenDays.add(dayOfWeek);

    const startRaw = typeof e.start === "string" ? e.start : "";
    const endRaw = typeof e.end === "string" ? e.end : "";
    const start = parseLocalTimeHm(startRaw);
    const end = parseLocalTimeHm(endRaw);
    if (!start || !end) {
      throw new Error("invalid WORKING_HOURS_JSON");
    }
    if (end.minutes <= start.minutes) {
      throw new Error("invalid WORKING_HOURS_JSON");
    }

    return { dayOfWeek, start: startRaw, end: endRaw };
  });

  return { weekly };
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
export function windowWeeksFromEnv(env: Env): number {
  return parseRequiredPositiveInt("WINDOW_WEEKS", env.WINDOW_WEEKS, MAX_FORWARD_WINDOW_WEEKS);
}
