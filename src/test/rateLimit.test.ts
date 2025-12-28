import { describe, expect, it } from "vitest";
import { enforceRateLimit, RateLimitDurable } from "../src/rateLimit";
import { Env, rateLimitConfigFromEnv } from "../src/env";

function makeStubNamespace(handler: (body: any) => Promise<Response>): DurableObjectNamespace {
  return {
    idFromName: () => ("stub-id" as unknown) as DurableObjectId,
    get: () => ({ fetch: (_url: string, init?: RequestInit) => handler(JSON.parse((init?.body as string) ?? "{}")) }) as any,
  } as unknown as DurableObjectNamespace;
}

describe("enforceRateLimit", () => {
  it("returns per-scope details and aggregates remaining/reset", async () => {
    const now = Date.now();
    const handler = async (body: any) => {
      expect(body.scopes).toHaveLength(2);
      return new Response(
        JSON.stringify({
          allowed: false,
          scopes: [
            { label: "perIp", allowed: false, remaining: 0, reset: now + 1000, limit: 2, windowMs: 1000 },
            { label: "global", allowed: true, remaining: 10, reset: now + 5000, limit: 100, windowMs: 5000 },
          ],
        })
      );
    };

    const env = {
      RL_SALT: "salt",
      FREEBUSY_ICAL_URL: "https://example.com",
      RATE_LIMITER: makeStubNamespace(handler),
    } as unknown as Env;

    const config = rateLimitConfigFromEnv({
      FREEBUSY_ICAL_URL: "https://example.com",
      RL_SALT: "salt",
      RATE_LIMITER: makeStubNamespace(handler),
      CALENDAR_TIMEZONE: "America/New_York",
      WINDOW_WEEKS: "4",
      WORKING_HOURS_JSON: JSON.stringify({ weekly: [{ dayOfWeek: 1, start: "09:00", end: "17:00" }] }),
      RATE_LIMIT_MAX: "2",
      RATE_LIMIT_WINDOW_MS: "1000",
      RATE_LIMIT_GLOBAL_MAX: "100",
      RATE_LIMIT_GLOBAL_WINDOW_MS: "5000",
    } as unknown as Env);
    const result = await enforceRateLimit(env, "1.2.3.4", config);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.scopes.perIp.remaining).toBe(0);
    expect(result.scopes.global.remaining).toBe(10);
    expect(result.reset).toBeGreaterThanOrEqual(now + 5000 - 10); // close enough, accepts within drift
  });

  it("throws when response is missing required fields", async () => {
    const handler = async () => new Response(JSON.stringify({ allowed: true, scopes: [{ label: "perIp" }] }));

    const env = {
      RL_SALT: "salt",
      FREEBUSY_ICAL_URL: "https://example.com",
      RATE_LIMITER: makeStubNamespace(handler),
    } as unknown as Env;

    const config = rateLimitConfigFromEnv({
      FREEBUSY_ICAL_URL: "https://example.com",
      RL_SALT: "salt",
      RATE_LIMITER: makeStubNamespace(handler),
      CALENDAR_TIMEZONE: "America/New_York",
      WINDOW_WEEKS: "4",
      WORKING_HOURS_JSON: JSON.stringify({ weekly: [{ dayOfWeek: 1, start: "09:00", end: "17:00" }] }),
      RATE_LIMIT_MAX: "5",
      RATE_LIMIT_WINDOW_MS: "1000",
    } as unknown as Env);

    await expect(enforceRateLimit(env, "1.2.3.4", config)).rejects.toThrow();
  });
});

describe("RateLimitDurable", () => {
  function makeStorage() {
    const map = new Map<string, any>();
    const storage: DurableObjectStorage = {
      get: async (key: string) => map.get(key),
      put: async (key: string, value: any) => {
        map.set(key, value);
      },
    } as DurableObjectStorage;
    return { storage, map };
  }

  it("enforces counts per scope and returns remaining/reset", async () => {
    const { storage } = makeStorage();
    const state = { storage } as unknown as DurableObjectState;
    const durable = new RateLimitDurable(state);

    const body = {
      scopes: [
        { key: "ip1", label: "perIp", limit: 2, windowMs: 10_000 },
        { key: "global", label: "global", limit: 3, windowMs: 10_000 },
      ],
    };

    const req = () => new Request("https://rate-limit/", { method: "POST", body: JSON.stringify(body) });

    const res1 = await durable.fetch(req());
    const data1 = (await res1.json()) as any;
    expect(data1.allowed).toBe(true);
    expect(data1.scopes.find((s: any) => s.label === "perIp").remaining).toBe(1);

    const res2 = await durable.fetch(req());
    const data2 = (await res2.json()) as any;
    expect(data2.allowed).toBe(true);
    expect(data2.scopes.find((s: any) => s.label === "perIp").remaining).toBe(0);

    const res3 = await durable.fetch(req());
    const data3 = (await res3.json()) as any;
    expect(data3.allowed).toBe(false);
    const perIp = data3.scopes.find((s: any) => s.label === "perIp");
    expect(perIp.remaining).toBe(0);
    expect(perIp.reset).toBeGreaterThan(Date.now());
  });

  it("returns 400 on bad payload", async () => {
    const { storage } = makeStorage();
    const state = { storage } as unknown as DurableObjectState;
    const durable = new RateLimitDurable(state);
    const res = await durable.fetch(new Request("https://rate-limit/", { method: "POST", body: JSON.stringify({}) }));
    expect(res.status).toBe(400);
  });
});
