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
  RATE_LIMITER: {
    idFromName: vi.fn(() => ({})),
    get: vi.fn(() => ({ fetch: vi.fn(async () => new Response(JSON.stringify({ allowed: true, scopes: [] }))) } as any)),
  } as any,
  CORS_ALLOWLIST: ALLOWLIST,
  MAXIMUM_FORWARD_WINDOW_IN_WEEKS: "4",
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
  vi.resetModules();
  const mod = await import("../src/index");
  return mod.default as { fetch: (req: Request, env: any) => Promise<Response> };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
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

  it("rejects disallowed origins with 403", async () => {
    const worker = await loadWorker();
    const res = await worker.fetch(new Request("https://api.test/health", { headers: { Origin: "https://bad.com" } }), baseEnv as any);
    expect(res.status).toBe(403);
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
      { start, end },
    ]);

    (globalThis as any).fetch = vi.fn(async () => new Response("BEGIN:VFREEBUSY\nEND:VFREEBUSY", { headers: { "content-type": "text/calendar", "content-length": "30" } }));

    const worker = await loadWorker();
    const res = await worker.fetch(request("/freebusy"), baseEnv as any);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body.busy)).toBe(true);
    expect(body.busy.length).toBe(1);
    expect(body.window.start.endsWith("T00:00:00.000Z")).toBe(true);
    expect(body.rateLimit.scopes.perIp.limit).toBe(60);
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
  });
});
