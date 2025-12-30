# Copilot instructions (freebusy-api)

## Project shape
- Cloudflare Worker + Durable Object (rate limiter).
- Worker entrypoint: `src/src/index.ts`.
- Core modules:
  - iCal parsing: `src/src/ical.ts`
  - windowing/merge logic: `src/src/freebusy.ts`
  - env parsing/validation: `src/src/env.ts`
  - rate limiting (client + DO): `src/src/rateLimit.ts` (DO class exported from `src/src/index.ts`)

## Developer workflows
- Run everything from repo root using `npm --prefix src …` (the Node project lives in `src/`).
  - Install: `npm --prefix src install`
  - Typecheck: `npm --prefix src run check`
  - Tests: `npm --prefix src test` (Vitest)
  - Coverage: `npm --prefix src run test:coverage` (HTML under `src/coverage/`)
  - Dev server: `npm --prefix src run dev` (Wrangler on `http://localhost:8787`)
  - Deploy: `npm --prefix src run deploy`

## Runtime & configuration conventions
- Treat Workers code as WebWorker runtime (see `src/tsconfig.json`); avoid Node-only APIs in `src/src/**`.
- Validate and parse env through `validateEnv()` + helpers in `src/src/env.ts`; don’t read `env.*` ad-hoc.
  - Required bindings/vars include: `FREEBUSY_ICAL_URL`, `RL_SALT`, `RATE_LIMITER`, `CALENDAR_TIMEZONE`, `WINDOW_WEEKS`, `WORKING_HOURS_JSON`, `CORS_ALLOWLIST`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`.
  - Optional toggles/limits: `FREEBUSY_ENABLED`, `WEEK_START_DAY`, `CACHE_TTL_SECONDS`, `UPSTREAM_MAX_BYTES`, and paired `RATE_LIMIT_GLOBAL_WINDOW_MS` + `RATE_LIMIT_GLOBAL_MAX`.
- When in doubt, treat `src/src/env.ts` + `src/wrangler.toml` as the authoritative env surface; the README includes some legacy naming.
- Local dev secrets: `src/.env` (copied to `.dev.vars` by the `dev` script). Production secrets are set via Wrangler.

## HTTP behavior (keep consistent)
- CORS is enforced via an allowlist early.
  - For JSON endpoints using `jsonResponse()`: disallowed origins return `403` with `{"error":"forbidden_origin"}`.
  - For preflight (`OPTIONS`): `handleOptions()` returns `204` for allowed origins, otherwise `403` with an empty body.
- Standard error codes used by the API: `misconfigured`, `disabled`, `rate_limited`, `upstream_error`, `forbidden_origin`, `not_found`.
- Responses always include strict security headers from `baseHeaders()` in `src/src/index.ts` (notably `Cache-Control: no-store` and `Vary: Origin`).
 - Canonical API spec is `docs/openapi.yaml`; contract tests validate responses against it.

## Time semantics (v2)
- Owner timezone is `CALENDAR_TIMEZONE` (IANA). Window boundaries are anchored to owner-local *dates*, but returned as UTC instants.
  - Window builder: `buildWindowV2()` in `src/src/freebusy.ts` returns `startDate/endDateInclusive` and `[startMsUtc,endMsUtcExclusive)`.
  - Busy intervals returned to clients are UTC ISO strings ending in `Z` (`formatUtcIso()` / `toResponseBusy()`).
- iCal parsing is intentionally strict and DST-safe (TZID, numeric offsets, floating times, all-day events): see `src/src/ical.ts` and `src/test/ical.test.ts`.

## Rate limiting & safety
- Rate limiting is Durable Object-backed:
  - Client call: `enforceRateLimit()` in `src/src/rateLimit.ts` posts scopes to the DO (`https://rate-limit/`).
  - IPs are never stored in plaintext: `hashIp(ip, RL_SALT)` (SHA-256) is the storage key.
- Upstream fetch safety:
  - Limit payload size via `readLimitedText()` in `src/src/logging.ts` (default max is 1.5MB; configurable).
  - Log upstream URL as origin-only via `redactUrl()`; sanitize parse warnings with `sanitizeLogMessage()`.
  - Parsed upstream results are cached in-memory for `CACHE_TTL_SECONDS` in `fetchUpstream()`.

## Testing patterns (Vitest)
- Handler tests commonly:
  - `vi.mock("../src/rateLimit")` / `vi.mock("../src/ical")`
  - `vi.resetModules()` then dynamic `import("../src/index")` to avoid module-level cache state
  - stub `globalThis.fetch` for upstream calls
  - use contract validation against `docs/openapi.yaml` (see `src/test/openapi.contract.test.ts`).

## Versioning
- Build/dev/deploy scripts generate `src/version.txt` and `src/src/version.generated.ts` (see `src/scripts/generate-version.mjs`).
- Don’t hand-edit `src/src/version.generated.ts`; run the npm scripts that regenerate it.
