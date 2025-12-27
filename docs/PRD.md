# Freebusy API – Product Requirements Document (PRD)

## 1. Purpose
Provide a production-ready, security-first Free/Busy aggregation API backed by a Cloudflare Worker and Durable Object rate limiter. The service fetches a private iCal feed, normalizes busy intervals to UTC, and exposes a minimal JSON API for a public SPA while minimizing data leakage and operational risk.

## 2. Goals
- Deliver a stable, low-latency JSON free/busy API suitable for embedding in a public Vite React SPA on Cloudflare Pages.
- Enforce least-privilege access to the upstream calendar data; never expose raw iCal content or secrets.
- Provide strong abuse controls (CORS allowlist, rate limiting, optional human/nonce checks) without requiring user accounts.
- Maintain observability, operational readiness, and a clear path to incident response.
- Keep the footprint small, dependency-light, and testable locally.

## 3. Non-Goals
- Full calendar CRUD or event metadata exposure (titles, attendees, descriptions are intentionally not exposed).
- User authentication and account management.
- Multi-tenant quota management beyond current rate-limit window.

## 4. Users and Use Cases
- Primary consumer: the public SPA (Cloudflare Pages) needing a free/busy grid for availability display.
- Secondary consumers: internal monitoring/uptime checks hitting `/health`.

## 5. Functional Requirements
- Endpoints (per `openapi.yaml`):
	- `GET /freebusy`: return merged, clipped busy intervals starting at 00:00:00 UTC today through the end of the configured forward window (weeks), in UTC.
	- `GET /health`: liveness signal `{ ok: true }`.
	- `OPTIONS /*`: CORS preflight with allowlist enforcement.
	- Unknown routes return JSON `404 not_found`.
- Upstream ingest: fetch private `FREEBUSY_ICAL_URL` over HTTPS; reject non-2xx or non-calendar content types.
- Upstream ingest: fetch private `FREEBUSY_ICAL_URL` over HTTPS; reject non-2xx or non-calendar content types; enforce payload cap (1.5 MB) before parsing.
- Parsing: support `VFREEBUSY/FREEBUSY` and `VEVENT` with `DTSTART/DTEND/DURATION`, line unfolding, TZID handling, and all-day events.
- Normalization: clip to `today 00:00:00Z → end of configured forward window (weeks)`; merge overlapping/adjacent blocks; emit ISO UTC strings.
- Caching: cache upstream parse results for 60 seconds to reduce load.
- Feature flag: `FREEBUSY_ENABLED` disables `/freebusy` with 503.
- Rate limit: configured per hashed IP via Durable Object; window/limit are required via env (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`). Optional global limit via `RATE_LIMIT_GLOBAL_WINDOW_MS`, `RATE_LIMIT_GLOBAL_MAX` (both required together). Responses include rate-limit metadata (`nextAllowedAt`, per-scope remaining/reset) so clients can back off UI actions.
- CORS: allowlist is required via env (`CORS_ALLOWLIST`); disallowed origins get 403 without executing business logic.

## 6. Non-Functional Requirements
- Performance: p95 < 300ms for cache hits; p95 < 1s for upstream fetches under normal conditions; forward window size is configurable and bounded.
- Availability: target 99.9% (SLO) for `GET /freebusy` over a rolling 30 days.
- Scalability: burst handling via Cloudflare edge; rate limiting ensures fairness.
- Security: zero exposure of secrets or raw calendar data; strict headers (CSP default-src 'none', X-Content-Type-Options, no-store caching).
- Observability: structured logs for upstream fetch, parse warnings, rate-limit outcomes, and CORS denials; ready for Logpush export.
- Privacy: store no PII; hash IPs with salt for rate limiting; avoid logging raw IPs beyond operational necessity.

## 7. Dependencies
- Cloudflare Workers runtime (JavaScript/TypeScript).
- Durable Objects for rate limiting (`RATE_LIMITER`).
- Secret bindings: `FREEBUSY_ICAL_URL`, `RL_SALT`.
- Tooling: Wrangler CLI, Node 18+ for local dev/tests.

## 8. Configuration
- `FREEBUSY_ICAL_URL`: required, HTTPS iCal feed.
- `RL_SALT`: required, random secret for IP hashing.
- `MAXIMUM_FORWARD_WINDOW_IN_WEEKS`: required, integer > 0.
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`: required per-IP rate-limit window and max.
- `RATE_LIMIT_GLOBAL_WINDOW_MS`, `RATE_LIMIT_GLOBAL_MAX`: optional global limit (all requests); must be provided together to enable.
- `CORS_ALLOWLIST`: required comma-separated origins.
- `FREEBUSY_ENABLED`: optional toggle (defaults to enabled).
- `RATE_LIMITER`: required Durable Object namespace.

## 9. Security and Abuse Mitigations (Security-First)
- CORS allowlist with fail-fast 403 for disallowed origins.
- Rate limit per hashed IP (no plaintext IP storage), 60 req / 5 min window; return 429 when exceeded.
- Strict response headers: `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `CSP: default-src 'none'`, `X-Content-Type-Options: nosniff`, `Vary: Origin`.
- Upstream validation: only accept `text/calendar` or `text/plain`; reject others with 502.
- Secret redaction: log redacted upstream URL (path suffix masked).
- Optional defenses (future hardening encouraged):
	- Turnstile token requirement for `/freebusy` with server-side verification.
	- Short-lived signed nonce issued via Pages Function/DO, validated per request.
	- Per-origin keys stored in KV/DO with revocation.
- Principle of least privilege: no data persisted beyond rate-limit counters; no calendar content stored.

## 10. Reliability and Operations
- Health: `/health` lightweight, CORS-aware.
- Caching: 60s in-memory cache at edge; tolerate transient upstream blips.
- Error handling: 5xx for upstream/parse/misconfig; 4xx for CORS/rate limit/not found.
- Logging: info for fetch diagnostics, warn for parse issues, error for upstream/parse/misconfig. Avoid logging secrets or raw IPs.
- Logging: info for fetch diagnostics (origin-only, path/query redacted), warn for sanitized parse issues (truncated), error for upstream/parse/misconfig. Avoid logging secrets or raw IPs.
- Incident response: ability to disable via `FREEBUSY_ENABLED`; adjust rate-limit window/limit via code redeploy; expand/contract allowlist quickly.

## 11. Data Handling and Privacy
- No user identifiers or event metadata are returned; only time ranges.
- IPs are hashed with salt before storage in Durable Object.
- No long-term storage of responses or upstream data; cache is memory-only and short-lived.

## 12. Observability
- Metrics (future): request counts, rate-limit hits, upstream latency, cache hit ratio, error rates.
- Logs: structured key/value; ensure redaction of sensitive fields.
- Traces: optional via Workers Trace Events (future).

## 13. Testing and Quality
- Unit tests: parsing (VEVENT, VFREEBUSY, TZID, all-day, duration), merging, clipping, rate limiting.
- Integration tests: `/freebusy` happy path, 429 on limit, 403 CORS, 503 disabled flag, 500 misconfig, 502 upstream failure.
- Contract tests: validate responses against `openapi.yaml` using schema validation.
- Static checks: eslint/tsc.
- Load tests (target): sustain expected RPS with cache hits; observe rate-limit correctness under burst.

## 14. Performance
- Cache TTL: 60s; window computation and merging in-memory only.
- Avoid heavy dependencies; keep bundle small for fast cold starts.
- Monitor p95 latency; optimize parsing if upstream grows large.

## 15. Deployment
- Environments: local (`wrangler dev`), staging (optional), production (Cloudflare Workers).
- Secrets: provision via `wrangler secret put` for prod/stage; `.env` for local (untracked).
- Durable Object migration tag `v1` present in `wrangler.toml`.
- Rollback: redeploy previous build; disable feature flag if needed.

## 16. Risks and Mitigations
- Upstream unavailability: mitigated by short cache; surface 502; consider adding backoff and alerting.
- Abuse via allowed origins: mitigated by rate limits; future add Turnstile/nonces.
- Misconfiguration: validated at startup; returns 500; add deployment checks.
- Large/complex iCal: parsing performance risk; mitigate with size checks and parsing warnings.

## 17. Roadmap (future enhancements)
- Add Turnstile verification and/or signed nonce requirement for `/freebusy`.
- Add per-origin API keys with KV-backed revocation.
- Add metrics export (Logpush/Workers Analytics) and alerting on error rates/latency/rate-limit hits.
- Add configurable allowed-origins via env binding.
- Add staged rollout (canary) and synthetic monitoring.

## 18. Definition of Done
- All functional and non-functional requirements implemented.
- OpenAPI spec (`openapi.yaml`) up to date with deployed behavior.
- Tests passing (unit + integration); linters/tsc clean.
- Secrets configured in target environment; DO migration applied.
- Security headers and CORS verified in responses.
- Performance smoke tests meet p95 targets.
- Runbook/operations notes updated; logging verified for redaction and signal.
