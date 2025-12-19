import { Env } from "./env";

const WINDOW_MS = 5 * 60 * 1000;
const LIMIT = 60;
const DO_NAME = "rate-limiter";

export interface RateLimitOutcome {
  allowed: boolean;
  remaining: number;
  reset: number;
}

export async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${ip}${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function enforceRateLimit(env: Env, ip: string): Promise<RateLimitOutcome> {
  const key = await hashIp(ip, env.RL_SALT);
  const id = env.RATE_LIMITER.idFromName(DO_NAME);
  const stub = env.RATE_LIMITER.get(id);
  const res = await stub.fetch("https://rate-limit/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });

  if (!res.ok) {
    throw new Error("rate_limit_error");
  }

  const data = (await res.json()) as Partial<RateLimitOutcome>;
  return {
    allowed: Boolean(data.allowed),
    remaining: Number.isFinite(data.remaining) ? (data.remaining as number) : 0,
    reset: Number.isFinite(data.reset) ? (data.reset as number) : Date.now() + WINDOW_MS,
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

    let body: { key?: string };
    try {
      body = (await request.json()) as { key?: string };
    } catch {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }

    if (!body.key || typeof body.key !== "string") {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }

    const now = Date.now();
    const current = (await this.storage.get<StoredCounter>(body.key)) ?? { count: 0, windowStart: now };

    let { count, windowStart } = current;
    if (now - windowStart >= WINDOW_MS) {
      count = 0;
      windowStart = now;
    }

    count += 1;
    const allowed = count <= LIMIT;
    const remaining = allowed ? LIMIT - count : 0;

    await this.storage.put(body.key, { count, windowStart });

    return Response.json({ allowed, remaining, reset: windowStart + WINDOW_MS });
  }
}
