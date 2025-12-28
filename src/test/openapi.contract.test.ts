import { describe, expect, it, vi, beforeAll, afterEach } from "vitest";
import SwaggerParser from "@apidevtools/swagger-parser";
import Ajv from "ajv";
import addFormats from "ajv-formats";

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

function request(pathname: string, init: RequestInit = {}) {
  return new Request(`https://api.test${pathname}`, {
    headers: { Origin: ALLOWLIST, ...(init.headers as Record<string, string> | undefined) },
    ...init,
  });
}

async function loadWorker() {
  vi.resetModules();
  const mod = await import("../src/index");
  return mod.default as { fetch: (req: Request, env: any) => Promise<Response> };
}

type OpenApiDoc = any;
let doc: OpenApiDoc;

function getResponseSchema(openapi: OpenApiDoc, route: string, method: string, status: string) {
  const m = method.toLowerCase();
  const schema = openapi?.paths?.[route]?.[m]?.responses?.[status]?.content?.["application/json"]?.schema;
  if (!schema) {
    throw new Error(`missing schema for ${method.toUpperCase()} ${route} ${status}`);
  }
  return schema;
}

describe("openapi contract", () => {
  beforeAll(async () => {
    const specUrl = new URL("../../docs/openapi.yaml", import.meta.url);
    doc = await SwaggerParser.dereference(specUrl.href);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (globalThis as any).fetch;
  });

  it("validates GET /health 200 response", async () => {
    const worker = await loadWorker();
    const res = await worker.fetch(request("/health"), baseEnv as any);
    expect(res.status).toBe(200);
    const body = await res.json();

    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(getResponseSchema(doc, "/health", "get", "200"));
    const ok = validate(body);
    expect(ok, ajv.errorsText(validate.errors, { separator: "\n" })).toBe(true);
  });

  it("validates GET /freebusy 200 response", async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 59,
      reset: Date.now() + 1000,
      scopes: { perIp: { label: "perIp", allowed: true, remaining: 59, reset: Date.now() + 1000, limit: 60, windowMs: 300000 } },
    });

    const start = new Date(Date.now() + 60_000);
    const end = new Date(start.getTime() + 3_600_000);
    vi.mocked(parseFreeBusy).mockReturnValue([{ startMsUtc: start.getTime(), endMsUtc: end.getTime(), kind: "time" }]);

    (globalThis as any).fetch = vi.fn(async () => new Response("BEGIN:VFREEBUSY\nEND:VFREEBUSY", { headers: { "content-type": "text/calendar" } }));

    const worker = await loadWorker();
    const res = await worker.fetch(request("/freebusy"), baseEnv as any);
    expect(res.status).toBe(200);
    const body = await res.json();

    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(getResponseSchema(doc, "/freebusy", "get", "200"));
    const ok = validate(body);
    expect(ok, ajv.errorsText(validate.errors, { separator: "\n" })).toBe(true);
  });

  it("validates GET /freebusy 429 response", async () => {
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
    const body = await res.json();

    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(getResponseSchema(doc, "/freebusy", "get", "429"));
    const ok = validate(body);
    expect(ok, ajv.errorsText(validate.errors, { separator: "\n" })).toBe(true);
  });
});
