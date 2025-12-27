# Freebusy API – Architecture

## Overview
Cloudflare Worker that fetches a private iCal free/busy feed, normalizes busy intervals, and serves a minimal JSON API to a public SPA. Security-first posture: no raw calendar data exposed, strict CORS, rate limiting via Durable Object, and no persistent storage beyond counters.

## Components
- Worker entry (`src/src/index.ts`): request routing, env validation, CORS, responses, error handling.
- Free/busy processing (`freebusy.ts`, `ical.ts`): window computation, clipping/merging, iCal parsing.
- Rate limiting (`rateLimit.ts`): Durable Object-backed per-IP windowed limiter, hashing IPs with salt; window and limit configurable via env. Optional global limiter shares the same DO with separate counters.
- Env validation (`env.ts`): required bindings and feature flag handling.
- Configuration: `wrangler.toml` for bindings; secrets via Wrangler; `.env` for local only. Required env: `FREEBUSY_ICAL_URL`, `RL_SALT`, `MAXIMUM_FORWARD_WINDOW_IN_WEEKS`, `CORS_ALLOWLIST`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`. Optional global rate limit requires both `RATE_LIMIT_GLOBAL_WINDOW_MS` and `RATE_LIMIT_GLOBAL_MAX`.
- Docs: `docs/PRD.md`, `openapi.yaml`, this file.

## Request Flow
1) Incoming request hits Worker.
2) CORS preflight handled for OPTIONS; disallowed origins get 403.
3) Env validated; failures return 500 `misconfigured`.
4) Routing:
   - `/health`: returns `{ ok: true }`.
   - `/freebusy`: proceed; others 404 `not_found`.
5) Feature flag: `FREEBUSY_ENABLED` can short-circuit with 503 `disabled`.
6) Rate limit: hash IP with `RL_SALT`, check Durable Object; 429 if exceeded.
7) Upstream fetch: retrieve `FREEBUSY_ICAL_URL` (HTTPS), accept `text/calendar|text/plain`; non-OK or wrong type → 502; payloads over 1.5 MB are rejected before parsing.
8) Parse and normalize: unfold lines, parse VFREEBUSY/VEVENT, handle TZID/all-day/duration, clip to window (today 00:00:00Z → end of configured forward window in weeks), merge overlapping/adjacent blocks, convert to ISO UTC strings.
9) Response: JSON with strict headers (`no-store`, CSP default-src 'none', nosniff, vary Origin). CORS allowed only for configured origins.

## Data Handling
- No storage of calendar content; 60s in-memory cache for parsed busy blocks to reduce upstream load.
- Rate-limit state stored in Durable Object (hashed keys only). No PII persisted.
- Logs redact upstream URL to origin-only; parse warnings are sanitized and truncated; avoid logging secrets or raw IPs.

## Security Posture
- CORS allowlist enforced early; disallowed origins get 403.
- Rate limiting per hashed IP; window/limit required via env. Optional global cap only when both globals are set. Responses include rate-limit metadata (`nextAllowedAt`, per-scope remaining/reset) for client backoff.
- Strict headers to reduce leak surface; responses are JSON only.
- Upstream URL validated; feature flag allows emergency disable.
- Future hardening: Turnstile/nonce enforcement, per-origin keys, size limits on upstream payload.

## Performance
- Cache TTL 60s; minimal dependencies for fast cold starts.
- p95 targets: <300ms cache-hit, <1s with upstream under normal conditions.

## Deployment
- Wrangler-managed Worker and Durable Object (`RATE_LIMITER`, migration tag v1).
- Secrets set via `wrangler secret put` (prod/stage). Local `.env` for dev only.
- SPA hosted on Cloudflare Pages; calls Worker via configured allowlist origin.

## Observability and Ops
- Structured logs for fetch diagnostics, parse warnings, rate-limit outcomes, CORS denials.
- Suggested metrics (future): request counts, rate-limit hits, upstream latency, cache hit ratio, error rates.
- Runbooks should cover: updating allowlist, rotating secrets, adjusting rate limits, toggling `FREEBUSY_ENABLED`, redeploy/rollback.

## Testing Notes
- Unit: parsing (VEVENT/VFREEBUSY, TZID, all-day, duration), merge/clipping, rate-limit hashing.
- Integration: `/freebusy` happy path, 403 CORS, 429 rate limit, 503 disabled, 500 misconfig, 502 upstream failure.
- Contract: validate responses against `openapi.yaml`.
