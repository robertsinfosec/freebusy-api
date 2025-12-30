import { describe, expect, it } from "vitest";
import {
  EnvValidationError,
  allowedOriginsFromEnv,
  cacheTtlSecondsFromEnv,
  rateLimitConfigFromEnv,
  upstreamMaxBytesFromEnv,
  validateEnv,
  weekStartDayFromEnv,
  windowWeeksFromEnv,
  workingHoursFromEnv,
} from "../src/env";

function makeEnv(overrides: Record<string, any> = {}) {
  return {
    FREEBUSY_ICAL_URL: "https://example.com/feed.ics",
    RL_SALT: "salt",
    RATE_LIMITER: { idFromName: () => ({}), get: () => ({ fetch: async () => new Response("{}") }) },
    CALENDAR_TIMEZONE: "America/New_York",
    WINDOW_WEEKS: "4",
    WORKING_HOURS_JSON: JSON.stringify({ weekly: [{ dayOfWeek: 1, start: "09:00", end: "17:00" }] }),
    CORS_ALLOWLIST: "https://a.example",
    RATE_LIMIT_WINDOW_MS: "1000",
    RATE_LIMIT_MAX: "10",
    ...overrides,
  };
}

describe("env validation and parsing", () => {
  it("validateEnv throws EnvValidationError with missing list", () => {
    try {
      validateEnv({} as any);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const e = err as EnvValidationError;
      expect(e.missing).toContain("FREEBUSY_ICAL_URL");
      expect(e.missing).toContain("RL_SALT");
      expect(e.missing).toContain("CALENDAR_TIMEZONE");
      expect(e.missing).toContain("WINDOW_WEEKS");
      expect(e.missing).toContain("WORKING_HOURS_JSON");
      expect(e.missing.join(",")).toMatch(/RATE_LIMITER/);
    }
  });

  it("validateEnv throws EnvValidationError with invalid list", () => {
    const env = makeEnv({
      FREEBUSY_ICAL_URL: "not-a-url",
      CALENDAR_TIMEZONE: "Not/A_Time_Zone",
      WORKING_HOURS_JSON: "not-json",
    });

    try {
      validateEnv(env as any);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const e = err as EnvValidationError;
      expect(e.invalid).toContain("FREEBUSY_ICAL_URL");
      expect(e.invalid).toContain("CALENDAR_TIMEZONE");
      expect(e.invalid).toContain("WORKING_HOURS_JSON");
    }
  });

  it("validateEnv treats non-object WORKING_HOURS_JSON as invalid", () => {
    try {
      validateEnv(makeEnv({ WORKING_HOURS_JSON: "null" }) as any);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const e = err as EnvValidationError;
      expect(e.invalid).toContain("WORKING_HOURS_JSON");
    }
  });

  it("weekStartDayFromEnv defaults to 1 and rejects out-of-range", () => {
    expect(weekStartDayFromEnv(makeEnv({ WEEK_START_DAY: undefined }) as any)).toBe(1);
    expect(() => weekStartDayFromEnv(makeEnv({ WEEK_START_DAY: "0" }) as any)).toThrow();
    expect(() => weekStartDayFromEnv(makeEnv({ WEEK_START_DAY: "8" }) as any)).toThrow();
    expect(() => weekStartDayFromEnv(makeEnv({ WEEK_START_DAY: "nope" }) as any)).toThrow();
  });

  it("allowedOriginsFromEnv trims and parses a non-empty set", () => {
    const set = allowedOriginsFromEnv(makeEnv({ CORS_ALLOWLIST: " https://a.com , https://b.com " }) as any);
    expect(set.has("https://a.com")).toBe(true);
    expect(set.has("https://b.com")).toBe(true);
    expect(set.size).toBe(2);
  });

  it("allowedOriginsFromEnv rejects empty/blank allowlists", () => {
    expect(() => allowedOriginsFromEnv(makeEnv({ CORS_ALLOWLIST: " ,  , " }) as any)).toThrow();
  });

  it("allowedOriginsFromEnv rejects missing allowlist", () => {
    expect(() => allowedOriginsFromEnv(makeEnv({ CORS_ALLOWLIST: undefined }) as any)).toThrow(/missing CORS_ALLOWLIST/);
  });

  it("cacheTtlSecondsFromEnv defaults and caps", () => {
    expect(cacheTtlSecondsFromEnv(makeEnv({ CACHE_TTL_SECONDS: undefined }) as any)).toBe(60);
    expect(cacheTtlSecondsFromEnv(makeEnv({ CACHE_TTL_SECONDS: "999999" }) as any)).toBe(3600);
    expect(() => cacheTtlSecondsFromEnv(makeEnv({ CACHE_TTL_SECONDS: "-1" }) as any)).toThrow();
  });

  it("upstreamMaxBytesFromEnv defaults and caps", () => {
    expect(upstreamMaxBytesFromEnv(makeEnv({ UPSTREAM_MAX_BYTES: undefined }) as any)).toBe(1_500_000);
    expect(upstreamMaxBytesFromEnv(makeEnv({ UPSTREAM_MAX_BYTES: "999999999" }) as any)).toBe(10_000_000);
    expect(() => upstreamMaxBytesFromEnv(makeEnv({ UPSTREAM_MAX_BYTES: "0" }) as any)).toThrow();
  });

  it("workingHoursFromEnv rejects invalid payloads", () => {
    expect(() => workingHoursFromEnv(makeEnv({ WORKING_HOURS_JSON: "no" }) as any)).toThrow();
    expect(() => workingHoursFromEnv(makeEnv({ WORKING_HOURS_JSON: "null" }) as any)).toThrow();
    expect(() => workingHoursFromEnv(makeEnv({ WORKING_HOURS_JSON: JSON.stringify({}) }) as any)).toThrow();
    expect(() => workingHoursFromEnv(makeEnv({ WORKING_HOURS_JSON: JSON.stringify({ weekly: [] }) }) as any)).toThrow();
    expect(() => workingHoursFromEnv(makeEnv({ WORKING_HOURS_JSON: JSON.stringify({ weekly: [null] }) }) as any)).toThrow();
    expect(() =>
      workingHoursFromEnv(
        makeEnv({ WORKING_HOURS_JSON: JSON.stringify({ weekly: [{ dayOfWeek: "1", start: "09:00", end: "17:00" }] }) }) as any
      )
    ).toThrow();
    expect(() =>
      workingHoursFromEnv(
        makeEnv({
          WORKING_HOURS_JSON: JSON.stringify({
            weekly: [
              { dayOfWeek: 1, start: "09:00", end: "17:00" },
              { dayOfWeek: 1, start: "10:00", end: "18:00" },
            ],
          }),
        }) as any
      )
    ).toThrow();
    expect(() =>
      workingHoursFromEnv(
        makeEnv({
          WORKING_HOURS_JSON: JSON.stringify({ weekly: [{ dayOfWeek: 1, start: "18:00", end: "17:00" }] }),
        }) as any
      )
    ).toThrow();
    expect(() =>
      workingHoursFromEnv(
        makeEnv({
          WORKING_HOURS_JSON: JSON.stringify({ weekly: [{ dayOfWeek: 1, start: "xx", end: "17:00" }] }),
        }) as any
      )
    ).toThrow();
  });

  it("rateLimitConfigFromEnv requires global pair", () => {
    expect(() => rateLimitConfigFromEnv(makeEnv({ RATE_LIMIT_GLOBAL_MAX: "10" }) as any)).toThrow();
    expect(() => rateLimitConfigFromEnv(makeEnv({ RATE_LIMIT_GLOBAL_WINDOW_MS: "1000" }) as any)).toThrow();
  });

  it("rateLimitConfigFromEnv rejects missing required values", () => {
    expect(() => rateLimitConfigFromEnv(makeEnv({ RATE_LIMIT_MAX: undefined }) as any)).toThrow(/missing RATE_LIMIT_MAX/);
    expect(() => rateLimitConfigFromEnv(makeEnv({ RATE_LIMIT_WINDOW_MS: undefined }) as any)).toThrow(/missing RATE_LIMIT_WINDOW_MS/);
    expect(() => rateLimitConfigFromEnv(makeEnv({ RATE_LIMIT_MAX: "0" }) as any)).toThrow(/invalid RATE_LIMIT_MAX/);
  });

  it("windowWeeksFromEnv caps to safety limit", () => {
    expect(windowWeeksFromEnv(makeEnv({ WINDOW_WEEKS: "999" }) as any)).toBe(104);
  });

  it("windowWeeksFromEnv rejects missing required value", () => {
    expect(() => windowWeeksFromEnv(makeEnv({ WINDOW_WEEKS: undefined }) as any)).toThrow(/missing WINDOW_WEEKS/);
  });
});
