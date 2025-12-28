export interface Env {
  FREEBUSY_ICAL_URL: string;
  RL_SALT: string;
  RATE_LIMITER: DurableObjectNamespace;
  MAXIMUM_FORWARD_WINDOW_IN_WEEKS: string;
  PREFERRED_TIMEZONE: string;
  WORKING_SCHEDULE_JSON: string;
  FREEBUSY_ENABLED?: string;
  CORS_ALLOWLIST?: string;
  RATE_LIMIT_WINDOW_MS?: string;
  RATE_LIMIT_MAX?: string;
  RATE_LIMIT_GLOBAL_WINDOW_MS?: string;
  RATE_LIMIT_GLOBAL_MAX?: string;
}

export interface WorkingScheduleWeeklyEntry {
  // ISO-8601 day-of-week: 1=Monday ... 7=Sunday
  dayOfWeek: number;
  // 24h local time in HH:MM
  start: string;
  end: string;
}

export interface WorkingSchedule {
  timeZone: string;
  weekly: WorkingScheduleWeeklyEntry[];
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
  if (!env.WORKING_SCHEDULE_JSON || typeof env.WORKING_SCHEDULE_JSON !== "string") {
    throw new Error("missing WORKING_SCHEDULE_JSON");
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

  // Validate working schedule JSON is parseable and consistent.
  try {
    const parsed = JSON.parse(env.WORKING_SCHEDULE_JSON) as unknown;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("not_object");
    }
  } catch {
    throw new Error("invalid WORKING_SCHEDULE_JSON");
  }

  return env as Env;
}

export function preferredTimezoneFromEnv(env: Env): string {
  return env.PREFERRED_TIMEZONE;
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

export function workingScheduleFromEnv(env: Env): WorkingSchedule {
  let parsed: unknown;
  try {
    parsed = JSON.parse(env.WORKING_SCHEDULE_JSON);
  } catch {
    throw new Error("invalid WORKING_SCHEDULE_JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("invalid WORKING_SCHEDULE_JSON");
  }

  const obj = parsed as { timeZone?: unknown; weekly?: unknown };
  const timeZone = typeof obj.timeZone === "string" ? obj.timeZone : undefined;
  if (!timeZone) {
    throw new Error("invalid WORKING_SCHEDULE_JSON");
  }

  // Require schedule timezone to match output timezone to avoid ambiguity.
  if (timeZone !== env.PREFERRED_TIMEZONE) {
    throw new Error("invalid WORKING_SCHEDULE_JSON");
  }

  try {
    // eslint-disable-next-line no-new
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new Error("invalid WORKING_SCHEDULE_JSON");
  }

  if (!Array.isArray(obj.weekly) || obj.weekly.length === 0) {
    throw new Error("invalid WORKING_SCHEDULE_JSON");
  }

  const seenDays = new Set<number>();
  const weekly: WorkingScheduleWeeklyEntry[] = obj.weekly.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new Error("invalid WORKING_SCHEDULE_JSON");
    }

    const e = entry as { dayOfWeek?: unknown; start?: unknown; end?: unknown };
    const dayOfWeek = typeof e.dayOfWeek === "number" ? e.dayOfWeek : NaN;
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
      throw new Error("invalid WORKING_SCHEDULE_JSON");
    }
    if (seenDays.has(dayOfWeek)) {
      throw new Error("invalid WORKING_SCHEDULE_JSON");
    }
    seenDays.add(dayOfWeek);

    const startRaw = typeof e.start === "string" ? e.start : "";
    const endRaw = typeof e.end === "string" ? e.end : "";
    const start = parseLocalTimeHm(startRaw);
    const end = parseLocalTimeHm(endRaw);
    if (!start || !end) {
      throw new Error("invalid WORKING_SCHEDULE_JSON");
    }
    if (end.minutes <= start.minutes) {
      throw new Error("invalid WORKING_SCHEDULE_JSON");
    }

    return { dayOfWeek, start: startRaw, end: endRaw };
  });

  return { timeZone, weekly };
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
