var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-izQrV7/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/ical.ts
var DAY_MS = 24 * 60 * 60 * 1e3;
function unfoldLines(raw) {
  const lines = raw.split(/\r?\n/);
  const unfolded = [];
  for (const line of lines) {
    if (line.startsWith(" ") || line.startsWith("	")) {
      if (unfolded.length === 0)
        continue;
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line.trimEnd());
    }
  }
  return unfolded;
}
__name(unfoldLines, "unfoldLines");
function getOffsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(date);
  const lookup = Object.fromEntries(
    parts.filter((p) => p.type !== "literal").map((p) => [p.type, parseInt(p.value, 10)])
  );
  const asUTC = Date.UTC(
    lookup.year,
    (lookup.month ?? 1) - 1,
    lookup.day ?? 1,
    lookup.hour ?? 0,
    lookup.minute ?? 0,
    lookup.second ?? 0
  );
  return (asUTC - date.getTime()) / 6e4;
}
__name(getOffsetMinutes, "getOffsetMinutes");
function parseICalDate(value, tzid, isDateOnly, warn) {
  const dateOnly = isDateOnly || !value.includes("T");
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!match)
    return null;
  const [, y, mo, d, h = "00", mi = "00", s = "00", z] = match;
  const year = Number(y);
  const month = Number(mo) - 1;
  const day = Number(d);
  const hour = dateOnly ? 0 : Number(h);
  const minute = dateOnly ? 0 : Number(mi);
  const second = dateOnly ? 0 : Number(s);
  if (z) {
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }
  if (tzid) {
    try {
      const utcMillis = Date.UTC(year, month, day, hour, minute, second);
      const offsetMinutes = getOffsetMinutes(new Date(utcMillis), tzid);
      return new Date(utcMillis - offsetMinutes * 6e4);
    } catch (err) {
      warn(`Failed TZ conversion for ${tzid}: ${String(err)}`);
    }
  }
  return new Date(Date.UTC(year, month, day, hour, minute, second));
}
__name(parseICalDate, "parseICalDate");
function parseDuration(value) {
  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match)
    return NaN;
  const [, d, h, m, s] = match;
  const days = d ? Number(d) : 0;
  const hours = h ? Number(h) : 0;
  const minutes = m ? Number(m) : 0;
  const seconds = s ? Number(s) : 0;
  return (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1e3;
}
__name(parseDuration, "parseDuration");
function parseFreeBusyPeriod(part, tzid, warn) {
  const [startRaw, endOrDurationRaw] = part.split("/");
  if (!startRaw || !endOrDurationRaw)
    return null;
  const start = parseICalDate(startRaw, tzid, false, warn);
  if (!start)
    return null;
  const durationMs = parseDuration(endOrDurationRaw);
  if (!Number.isNaN(durationMs)) {
    return { start, end: new Date(start.getTime() + durationMs) };
  }
  const end = parseICalDate(endOrDurationRaw, tzid, false, warn);
  if (!end)
    return null;
  return { start, end };
}
__name(parseFreeBusyPeriod, "parseFreeBusyPeriod");
function parseFreeBusyComponents(unfolded, warn) {
  const busy = [];
  let inComponent = false;
  for (const line of unfolded) {
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VFREEBUSY") {
      inComponent = true;
      continue;
    }
    if (upper === "END:VFREEBUSY") {
      inComponent = false;
      continue;
    }
    if (!inComponent)
      continue;
    if (!upper.startsWith("FREEBUSY"))
      continue;
    const [propPart, valuePart] = line.split(/:(.+)/, 2);
    if (!valuePart)
      continue;
    const params = propPart.split(";").slice(1);
    const tzidParam = params.find((p) => p.toUpperCase().startsWith("TZID="));
    const tzid = tzidParam ? tzidParam.split("=")[1] : void 0;
    const periods = valuePart.split(",");
    for (const periodPart of periods) {
      const parsed = parseFreeBusyPeriod(periodPart, tzid, warn);
      if (parsed && parsed.end > parsed.start) {
        busy.push(parsed);
      }
    }
  }
  return busy;
}
__name(parseFreeBusyComponents, "parseFreeBusyComponents");
function parseEventComponents(unfolded, warn) {
  const events = [];
  let inEvent = false;
  let current = {};
  let currentDuration;
  for (const line of unfolded) {
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
      currentDuration = void 0;
      continue;
    }
    if (upper === "END:VEVENT") {
      if (inEvent && current.start) {
        const isAllDay = Boolean(current.startIsDateOnly);
        const durationMs = currentDuration;
        const defaultEnd = isAllDay ? new Date(current.start.getTime() + DAY_MS) : new Date(current.start.getTime() + 60 * 60 * 1e3);
        const endValue = current.end ? current.end : typeof durationMs === "number" && !Number.isNaN(durationMs) ? new Date(current.start.getTime() + durationMs) : defaultEnd;
        const end = isAllDay && endValue.getTime() === current.start.getTime() ? new Date(current.start.getTime() + DAY_MS) : endValue;
        if (end > current.start) {
          events.push({ start: current.start, end });
        }
      }
      inEvent = false;
      currentDuration = void 0;
      continue;
    }
    if (!inEvent)
      continue;
    if (upper.startsWith("DTSTART")) {
      const tzidMatch = line.match(/TZID=([^;:]+)/);
      const isDateOnly = upper.includes("VALUE=DATE") || !line.includes("T");
      const dateMatch = line.match(/[:;](\d{8}(T\d{6}Z?)?)/);
      if (dateMatch) {
        const parsed = parseICalDate(dateMatch[1], tzidMatch?.[1], isDateOnly, warn);
        if (parsed) {
          current.start = parsed;
          current.startIsDateOnly = isDateOnly;
        }
      }
    } else if (upper.startsWith("DTEND")) {
      const tzidMatch = line.match(/TZID=([^;:]+)/);
      const isDateOnly = upper.includes("VALUE=DATE") || !line.includes("T");
      const dateMatch = line.match(/[:;](\d{8}(T\d{6}Z?)?)/);
      if (dateMatch) {
        const parsed = parseICalDate(dateMatch[1], tzidMatch?.[1], isDateOnly, warn);
        if (parsed) {
          current.end = parsed;
        }
      }
    } else if (upper.startsWith("DURATION")) {
      const dur = parseDuration(line.split(/:(.+)/, 2)[1] ?? "");
      if (!Number.isNaN(dur)) {
        currentDuration = dur;
      }
    }
  }
  return events;
}
__name(parseEventComponents, "parseEventComponents");
function parseFreeBusy(icalText, warn = () => {
}) {
  const unfolded = unfoldLines(icalText);
  const busyFromFreeBusy = parseFreeBusyComponents(unfolded, warn);
  const busyFromEvents = parseEventComponents(unfolded, warn);
  return [...busyFromFreeBusy, ...busyFromEvents];
}
__name(parseFreeBusy, "parseFreeBusy");

// src/freebusy.ts
var MINUTE_MS = 6e4;
var WINDOW_DAYS = 28;
function buildWindow(now = /* @__PURE__ */ new Date()) {
  const roundedStart = new Date(Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS);
  const windowEnd = new Date(roundedStart.getTime() + WINDOW_DAYS * 24 * 60 * MINUTE_MS);
  return { windowStart: roundedStart, windowEnd };
}
__name(buildWindow, "buildWindow");
function clipAndMerge(blocks, windowStart, windowEnd) {
  const relevant = blocks.map((block) => {
    const start = block.start < windowStart ? windowStart : block.start;
    const end = block.end > windowEnd ? windowEnd : block.end;
    return { start, end };
  }).filter((block) => block.end > block.start && block.end > windowStart && block.start < windowEnd);
  relevant.sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged = [];
  for (const block of relevant) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push(block);
      continue;
    }
    const lastEnd = last.end.getTime();
    const currentStart = block.start.getTime();
    if (currentStart <= lastEnd) {
      if (block.end.getTime() > lastEnd) {
        last.end = block.end;
      }
    } else if (currentStart === lastEnd) {
      last.end = block.end;
    } else {
      merged.push(block);
    }
  }
  return merged;
}
__name(clipAndMerge, "clipAndMerge");
function toResponseBlocks(blocks) {
  return blocks.map((block) => ({ start: block.start.toISOString(), end: block.end.toISOString() }));
}
__name(toResponseBlocks, "toResponseBlocks");

// src/env.ts
function isDurableObjectNamespace(value) {
  return typeof value === "object" && value !== null && "idFromName" in value;
}
__name(isDurableObjectNamespace, "isDurableObjectNamespace");
function validateEnv(env) {
  if (!env.FREEBUSY_ICAL_URL || typeof env.FREEBUSY_ICAL_URL !== "string") {
    throw new Error("missing FREEBUSY_ICAL_URL");
  }
  if (!env.RL_SALT || typeof env.RL_SALT !== "string") {
    throw new Error("missing RL_SALT");
  }
  if (!isDurableObjectNamespace(env.RATE_LIMITER)) {
    throw new Error("missing RATE_LIMITER binding");
  }
  try {
    new URL(env.FREEBUSY_ICAL_URL);
  } catch {
    throw new Error("invalid FREEBUSY_ICAL_URL");
  }
  return env;
}
__name(validateEnv, "validateEnv");

// src/rateLimit.ts
var WINDOW_MS = 5 * 60 * 1e3;
var LIMIT = 60;
var DO_NAME = "rate-limiter";
async function hashIp(ip, salt) {
  const data = new TextEncoder().encode(`${ip}${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashIp, "hashIp");
async function enforceRateLimit(env, ip) {
  const key = await hashIp(ip, env.RL_SALT);
  const id = env.RATE_LIMITER.idFromName(DO_NAME);
  const stub = env.RATE_LIMITER.get(id);
  const res = await stub.fetch("https://rate-limit/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key })
  });
  if (!res.ok) {
    throw new Error("rate_limit_error");
  }
  const data = await res.json();
  return {
    allowed: Boolean(data.allowed),
    remaining: Number.isFinite(data.remaining) ? data.remaining : 0,
    reset: Number.isFinite(data.reset) ? data.reset : Date.now() + WINDOW_MS
  };
}
__name(enforceRateLimit, "enforceRateLimit");
var RateLimitDurable = class {
  storage;
  constructor(state) {
    this.storage = state.storage;
  }
  async fetch(request) {
    if (request.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }
    if (!body.key || typeof body.key !== "string") {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }
    const now = Date.now();
    const current = await this.storage.get(body.key) ?? { count: 0, windowStart: now };
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
};
__name(RateLimitDurable, "RateLimitDurable");

// src/index.ts
var CACHE_TTL_MS = 6e4;
var ALLOWED_ORIGINS = /* @__PURE__ */ new Set([
  "https://freebusy.robertsinfosec.com",
  "http://localhost:5000"
]);
var cached = null;
function baseHeaders() {
  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  headers.set("X-Robots-Tag", "noindex");
  headers.set("Content-Security-Policy", "default-src 'none'");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Vary", "Origin");
  return headers;
}
__name(baseHeaders, "baseHeaders");
function applyCors(headers, origin) {
  if (!origin)
    return true;
  if (!ALLOWED_ORIGINS.has(origin))
    return false;
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "600");
  return true;
}
__name(applyCors, "applyCors");
function jsonResponse(request, body, status = 200) {
  const origin = request.headers.get("Origin");
  const headers = baseHeaders();
  headers.set("Content-Type", "application/json");
  const allowed = applyCors(headers, origin);
  if (origin && !allowed) {
    return new Response(JSON.stringify({ error: "forbidden_origin" }), { status: 403, headers });
  }
  return new Response(JSON.stringify(body), { status, headers });
}
__name(jsonResponse, "jsonResponse");
function redactUrl(secretUrl) {
  try {
    const url = new URL(secretUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length > 0) {
      parts[parts.length - 1] = "***";
    }
    const redactedPath = parts.length ? `/${parts.join("/")}` : "/";
    return `${url.origin}${redactedPath}`;
  } catch {
    return "<invalid-url>";
  }
}
__name(redactUrl, "redactUrl");
async function fetchUpstream(env) {
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.busy;
  }
  const target = redactUrl(env.FREEBUSY_ICAL_URL);
  console.info("[freebusy] fetching upstream iCal", { target });
  const res = await fetch(env.FREEBUSY_ICAL_URL, {
    headers: {
      Accept: "text/calendar,text/plain"
    }
  });
  console.info("[freebusy] upstream response", { target, status: res.status, ok: res.ok });
  if (!res.ok) {
    throw new Error("upstream_fetch_failed");
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("text/calendar") && !contentType.includes("text/plain")) {
    throw new Error("unexpected_content_type");
  }
  const text = await res.text();
  const diagnostics = {
    bytes: text.length,
    hasVfreebusy: /BEGIN:VFREEBUSY/i.test(text),
    freebusyTokens: (text.match(/FREEBUSY/gi) || []).length
  };
  console.info("[freebusy] upstream ical diagnostics", { target, ...diagnostics });
  const busy = parseFreeBusy(text, (msg) => console.warn("[freebusy] parse warning", msg));
  console.info("[freebusy] parsed busy blocks", { count: busy.length });
  cached = { fetchedAt: now, busy };
  return busy;
}
__name(fetchUpstream, "fetchUpstream");
async function handleFreeBusy(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") ?? "0.0.0.0";
  try {
    const result = await enforceRateLimit(env, ip);
    if (!result.allowed) {
      return jsonResponse(request, { error: "rate_limited" }, 429);
    }
  } catch (err) {
    console.error("rate limit failure", err);
    return jsonResponse(request, { error: "upstream" }, 502);
  }
  let busy;
  try {
    busy = await fetchUpstream(env);
  } catch (err) {
    console.error("upstream fetch error", err);
    return jsonResponse(request, { error: "upstream" }, 502);
  }
  const now = /* @__PURE__ */ new Date();
  const { windowStart, windowEnd } = buildWindow(now);
  let merged;
  try {
    merged = clipAndMerge(busy, windowStart, windowEnd);
  } catch (err) {
    console.error("parse/merge error", err);
    return jsonResponse(request, { error: "parse" }, 502);
  }
  const responseBody = {
    generatedAt: now.toISOString(),
    window: { start: windowStart.toISOString(), end: windowEnd.toISOString() },
    timezone: "Etc/UTC",
    busy: toResponseBlocks(merged)
  };
  return jsonResponse(request, responseBody, 200);
}
__name(handleFreeBusy, "handleFreeBusy");
function handleHealth(request) {
  return jsonResponse(request, { ok: true }, 200);
}
__name(handleHealth, "handleHealth");
async function handleOptions(request) {
  const origin = request.headers.get("Origin");
  const headers = baseHeaders();
  const allowed = applyCors(headers, origin);
  if (!allowed) {
    return new Response(null, { status: 403, headers });
  }
  headers.set("Content-Length", "0");
  return new Response(null, { status: 204, headers });
}
__name(handleOptions, "handleOptions");
var src_default = {
  async fetch(request, env) {
    let validatedEnv;
    try {
      validatedEnv = validateEnv(env);
    } catch (err) {
      console.error("env validation failed", err);
      return jsonResponse(request, { error: "misconfigured" }, 500);
    }
    const { pathname } = new URL(request.url);
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }
    if (pathname === "/health") {
      return handleHealth(request);
    }
    if (pathname === "/freebusy" && request.method === "GET") {
      return handleFreeBusy(request, validatedEnv);
    }
    return jsonResponse(request, { error: "not_found" }, 404);
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-izQrV7/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-izQrV7/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  RateLimitDurable,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
