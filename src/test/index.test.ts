import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mocks
vi.mock("../src/rateLimit", () => {
  return {
    enforceRateLimit: vi.fn(),
  };
});

vi.mock("../src/ical", () => {
  return {
    parseFreeBusy: vi.fn(),
  };
});

import { enforceRateLimit } from "../src/rateLimit";
import { parseFreeBusy } from "../src/ical";

const ALLOWLIST = "https://example.com";

const baseEnv = {
  FREEBUSY_ICAL_URL: "https://upstream.example.com/feed.ics",
  RL_SALT: "salt",
  CALENDAR_TIMEZONE: "America/New_York",
  WINDOW_WEEKS: "4",
  WEEK_START_DAY: "1",
  WORKING_HOURS_JSON: JSON.stringify({
    weekly: [
      { dayOfWeek: 1, start: "08:00", end: "18:00" },
      { dayOfWeek: 2, start: "08:00", end: "18:00" },
      { dayOfWeek: 3, start: "08:00", end: "18:00" },
      { dayOfWeek: 4, start: "08:00", end: "18:00" },
      { dayOfWeek: 5, start: "08:00", end: "18:00" },
    ],
  }),
  RATE_LIMITER: {
    idFromName: vi.fn(() => ({})),
    get: vi.fn(() => ({ fetch: vi.fn(async () => new Response(JSON.stringify({ allowed: true, scopes: [] }))) } as any)),
  } as any,
  CORS_ALLOWLIST: ALLOWLIST,
  RATE_LIMIT_WINDOW_MS: "300000",
  RATE_LIMIT_MAX: "60",
};

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://api.test${path}`, {
    headers: { Origin: ALLOWLIST, ...(init.headers as Record<string, string> | undefined) },
    ...init,
  });
}

async function loadWorker() {
  // Some tests use `vi.doMock` for env/freebusy; ensure a clean baseline.
  vi.doUnmock("../src/env");
  vi.doUnmock("../src/freebusy");
  vi.resetModules();
  const mod = await import("../src/index");
  return mod.default as { fetch: (req: Request, env: any) => Promise<Response> };
}

async function loadWorkerWithEnvMock(validateEnvImpl: (env: any) => any) {
  vi.resetModules();
  vi.doMock("../src/env", async () => {
    const actual = await vi.importActual<typeof import("../src/env")>("../src/env");
    return { ...actual, validateEnv: validateEnvImpl };
  });
  const mod = await import("../src/index");
  return mod.default as { fetch: (req: Request, env: any) => Promise<Response> };
}

async function loadWorkerWithClipAndMergeThrow() {
  vi.resetModules();
  vi.doMock("../src/freebusy", async () => {
    const actual = await vi.importActual<typeof import("../src/freebusy")>("../src/freebusy");
    return {
      ...actual,
      clipAndMerge: () => {
        throw new Error("boom");
      },
    };
  });
  const mod = await import("../src/index");
  return mod.default as { fetch: (req: Request, env: any) => Promise<Response> };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  // Ensure no dangling global fetch mock state between tests.
  delete (globalThis as any).fetch;
});

describe("index handler", () => {
  it("serves health", async () => {
    const worker = await loadWorker();
    const res = await worker.fetch(request("/health"), baseEnv as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it("serves health without Origin header (no CORS applied)", async () => {
    const worker = await loadWorker();
    const res = await worker.fetch(new Request("https://api.test/health"), baseEnv as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("rejects disallowed origins with 403", async () => {
    const worker = await loadWorker();
    const res = await worker.fetch(new Request("https://api.test/health", { headers: { Origin: "https://bad.com" } }), baseEnv as any);
    expect(res.status).toBe(403);
  });

  it("handles OPTIONS preflight for allowed origin", async () => {
    const worker = await loadWorker();
    const res = await worker.fetch(
      new Request("https://api.test/freebusy", { method: "OPTIONS", headers: { Origin: ALLOWLIST } }),
      baseEnv as any
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWLIST);
  });

  it("rejects OPTIONS preflight for disallowed origin with 403 and empty body", async () => {
    const worker = await loadWorker();
    const res = await worker.fetch(
      new Request("https://api.test/freebusy", { method: "OPTIONS", headers: { Origin: "https://bad.com" } }),
      baseEnv as any
    );
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).toBe("");
  });

  it("handles OPTIONS with no Origin header", async () => {
    const worker = await loadWorker();
    const res = await worker.fetch(new Request("https://api.test/freebusy", { method: "OPTIONS" }), baseEnv as any);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(res.headers.get("Content-Length")).toBe("0");
  });

  it("returns freebusy data and rate limit when allowed", async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 1,
      reset: Date.now() + 1000,
      scopes: { perIp: { label: "perIp", allowed: true, remaining: 1, reset: Date.now() + 1000, limit: 60, windowMs: 300000 } },
    });
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    vi.mocked(parseFreeBusy).mockReturnValue([
      { startMsUtc: start.getTime(), endMsUtc: end.getTime(), kind: "time" },
    ]);

    (globalThis as any).fetch = vi.fn(async () => new Response("BEGIN:VFREEBUSY\nEND:VFREEBUSY", { headers: { "content-type": "text/calendar", "content-length": "30" } }));

    const worker = await loadWorker();
    const res = await worker.fetch(request("/freebusy"), baseEnv as any);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(typeof body.version).toBe("string");
    expect(body.version.length).toBeGreaterThan(0);
    expect(Array.isArray(body.busy)).toBe(true);
    expect(body.busy.length).toBe(1);
    expect(body.generatedAtUtc).toMatch(/Z$/);
    expect(body.calendar.timeZone).toBe("America/New_York");
    expect(body.calendar.weekStartDay).toBe(1);
    expect(body.window.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.window.endDateInclusive).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.window.startUtc).toMatch(/Z$/);
    expect(body.window.endUtcExclusive).toMatch(/Z$/);
    expect(Array.isArray(body.workingHours.weekly)).toBe(true);
    expect(body.busy[0].startUtc).toMatch(/Z$/);
    expect(body.busy[0].endUtc).toMatch(/Z$/);
    expect(body.busy[0].kind).toBe("time");
    expect(body.rateLimit.scopes.perIp.limit).toBe(60);
    expect(body.rateLimit.scopes.perIp.resetUtc).toMatch(/Z$/);
  });

  it("caches upstream iCal within CACHE_TTL_SECONDS", async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 1,
      reset: Date.now() + 1000,
      scopes: { perIp: { label: "perIp", allowed: true, remaining: 1, reset: Date.now() + 1000, limit: 60, windowMs: 300000 } },
    });

    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    vi.mocked(parseFreeBusy).mockReturnValue([{ startMsUtc: start.getTime(), endMsUtc: end.getTime(), kind: "time" }]);

    const fetchSpy = vi.fn(async () =>
      new Response("BEGIN:VFREEBUSY\nEND:VFREEBUSY", {
        headers: { "content-type": "text/calendar", "content-length": "30" },
      })
    );
    (globalThis as any).fetch = fetchSpy;

    const worker = await loadWorker();
    const env = { ...baseEnv, CACHE_TTL_SECONDS: "60" };

    const res1 = await worker.fetch(request("/freebusy"), env as any);
    expect(res1.status).toBe(200);
    const res2 = await worker.fetch(request("/freebusy"), env as any);
    expect(res2.status).toBe(200);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      reset: Date.now() + 1000,
      scopes: { perIp: { label: "perIp", allowed: false, remaining: 0, reset: Date.now() + 1000, limit: 60, windowMs: 300000 } },
    });

    (globalThis as any).fetch = vi.fn(async () => new Response("BEGIN:VFREEBUSY\nEND:VFREEBUSY", { headers: { "content-type": "text/calendar" } }));

    const worker = await loadWorker();
    const res = await worker.fetch(request("/freebusy"), baseEnv as any);
    expect(res.status).toBe(429);
    const body = (await res.json()) as any;
    expect(body.error).toBe("rate_limited");
    expect(body.rateLimit.nextAllowedAtUtc).toMatch(/Z$/);
  });

  it("returns 503 when FREEBUSY_ENABLED disables endpoint", async () => {
    const worker = await loadWorker();
    const env = { ...baseEnv, FREEBUSY_ENABLED: "false" };
    const res = await worker.fetch(request("/freebusy"), env as any);
    expect(res.status).toBe(503);
    const body = (await res.json()) as any;
    expect(body.error).toBe("disabled");
  });

  it("returns 500 misconfigured when required env is missing", async () => {
    const worker = await loadWorker();
    const env = { ...baseEnv } as any;
    delete env.RL_SALT;
    const res = await worker.fetch(request("/health"), env);
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe("misconfigured");
  });

  it("returns 500 misconfigured when env validation throws unexpected error", async () => {
    const worker = await loadWorkerWithEnvMock(() => {
      throw new Error("boom");
    });

    const res = await worker.fetch(request("/health"), baseEnv as any);
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe("misconfigured");
  });

  it("does not enforce CORS when env is misconfigured (no allowlist loaded)", async () => {
    const worker = await loadWorker();
    const env = { ...baseEnv } as any;
    delete env.RL_SALT;

    const res = await worker.fetch(new Request("https://api.test/health", { headers: { Origin: "https://bad.com" } }), env);
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe("misconfigured");
  });

  it("returns 500 misconfigured when env parsing fails", async () => {
    const worker = await loadWorker();
    const res = await worker.fetch(request("/health"), { ...baseEnv, WEEK_START_DAY: "99" } as any);
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe("misconfigured");
  });

  it("returns 502 upstream_error when rate limiter call throws", async () => {
    vi.mocked(enforceRateLimit).mockRejectedValueOnce(new Error("boom"));
    const worker = await loadWorker();
    const res = await worker.fetch(request("/freebusy"), baseEnv as any);
    expect(res.status).toBe(502);
    const body = (await res.json()) as any;
    expect(body.error).toBe("upstream_error");
  });

  it("returns 502 upstream_error when upstream returns non-OK", async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 1,
      reset: Date.now() + 1000,
      scopes: { perIp: { label: "perIp", allowed: true, remaining: 1, reset: Date.now() + 1000, limit: 60, windowMs: 300000 } },
    });

    (globalThis as any).fetch = vi.fn(async () => new Response("nope", { status: 500, headers: { "content-type": "text/plain" } }));
    const worker = await loadWorker();
    const res = await worker.fetch(request("/freebusy"), baseEnv as any);
    expect(res.status).toBe(502);
    const body = (await res.json()) as any;
    expect(body.error).toBe("upstream_error");
  });

  it("returns 502 upstream_error when upstream content-type is unexpected", async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 1,
      reset: Date.now() + 1000,
      scopes: { perIp: { label: "perIp", allowed: true, remaining: 1, reset: Date.now() + 1000, limit: 60, windowMs: 300000 } },
    });
    (globalThis as any).fetch = vi.fn(async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
    const worker = await loadWorker();
    const res = await worker.fetch(request("/freebusy"), baseEnv as any);
    expect(res.status).toBe(502);
    const body = (await res.json()) as any;
    expect(body.error).toBe("upstream_error");
  });

  it("returns 502 upstream_error when upstream payload exceeds limit", async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 1,
      reset: Date.now() + 1000,
      scopes: { perIp: { label: "perIp", allowed: true, remaining: 1, reset: Date.now() + 1000, limit: 60, windowMs: 300000 } },
    });
    vi.mocked(parseFreeBusy).mockReturnValue([]);

    (globalThis as any).fetch = vi.fn(async () =>
      new Response("BEGIN:VFREEBUSY\nEND:VFREEBUSY", {
        status: 200,
        headers: { "content-type": "text/calendar", "content-length": "100" },
      })
    );

    const worker = await loadWorker();
    const env = { ...baseEnv, UPSTREAM_MAX_BYTES: "10" };
    const res = await worker.fetch(request("/freebusy"), env as any);
    expect(res.status).toBe(502);
    const body = (await res.json()) as any;
    expect(body.error).toBe("upstream_error");
  });

  it("returns 502 upstream_error when parse/merge throws", async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 1,
      reset: Date.now() + 1000,
      scopes: { perIp: { label: "perIp", allowed: true, remaining: 1, reset: Date.now() + 1000, limit: 60, windowMs: 300000 } },
    });
    vi.mocked(parseFreeBusy).mockReturnValue([{ startMsUtc: Date.now(), endMsUtc: Date.now() + 1000, kind: "time" }]);

    (globalThis as any).fetch = vi.fn(async () => new Response("BEGIN:VFREEBUSY\nEND:VFREEBUSY", { headers: { "content-type": "text/calendar" } }));

    const worker = await loadWorkerWithClipAndMergeThrow();
    const res = await worker.fetch(request("/freebusy"), baseEnv as any);
    expect(res.status).toBe(502);
    const body = (await res.json()) as any;
    expect(body.error).toBe("upstream_error");
  });

  it("uses CALENDAR_TIMEZONE but always returns UTC instants", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00.000Z"));

    vi.mocked(enforceRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 1,
      reset: Date.now() + 1000,
      scopes: { perIp: { label: "perIp", allowed: true, remaining: 1, reset: Date.now() + 1000, limit: 60, windowMs: 300000 } },
    });

    const start = new Date("2025-01-16T00:30:00.000Z");
    const end = new Date("2025-01-16T01:30:00.000Z");
    vi.mocked(parseFreeBusy).mockReturnValue([{ startMsUtc: start.getTime(), endMsUtc: end.getTime(), kind: "time" }]);

    (globalThis as any).fetch = vi.fn(async () => new Response("BEGIN:VFREEBUSY\nEND:VFREEBUSY", { headers: { "content-type": "text/calendar", "content-length": "30" } }));

    const worker = await loadWorker();
    const env = {
      ...baseEnv,
      CALENDAR_TIMEZONE: "America/Los_Angeles",
      WORKING_HOURS_JSON: JSON.stringify({
        weekly: [
          { dayOfWeek: 1, start: "08:00", end: "18:00" },
          { dayOfWeek: 2, start: "08:00", end: "18:00" },
          { dayOfWeek: 3, start: "08:00", end: "18:00" },
          { dayOfWeek: 4, start: "08:00", end: "18:00" },
          { dayOfWeek: 5, start: "08:00", end: "18:00" },
        ],
      }),
    };
    const res = await worker.fetch(request("/freebusy"), env as any);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.calendar.timeZone).toBe("America/Los_Angeles");
    expect(body.busy[0].startUtc.endsWith("Z")).toBe(true);

    vi.useRealTimers();
  });

  it("returns 404 not_found for unknown routes", async () => {
    const worker = await loadWorker();
    const res = await worker.fetch(request("/nope"), baseEnv as any);
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error).toBe("not_found");
  });
});
