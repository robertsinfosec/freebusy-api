# freebusy-api

Cloudflare Worker that proxies a private calendar free/busy iCal URL and returns a sanitized JSON free/busy window starting at today 00:00:00 UTC and extending a configurable number of weeks.

![coverage](badges/coverage.svg) ![tests](badges/tests.svg)

## What it does
- `GET /freebusy` – fetches a secret free/busy feed, parses `VFREEBUSY`/`FREEBUSY` blocks, merges/normalizes to UTC, clips to `today 00:00:00Z → end of configured forward window (weeks)`, and returns only busy blocks.
- `GET /health` – returns `{ "ok": true }` for simple uptime checks.

## Prerequisites
- Node.js 20+ (matches devcontainer)
- `npm`
- Cloudflare account with Workers + Durable Objects enabled

> App lives under `src/`. Run commands from that directory or use `npm --prefix src`.

## Setup
1) Install deps (from repo root):
```bash
npm --prefix src install
```

2) Create local secrets file (not committed):
```bash
cp src/.env.example src/.env
```
Edit `src/.env` with your calendar free/busy URL, forward window, CORS allowlist, rate-limit values, and a random rate-limit salt. See `src/.env.example` for annotated placeholders.

### Configuration (env vars)
- `FREEBUSY_ICAL_URL` (required): HTTPS free/busy iCal feed to proxy.
- `RL_SALT` (required): random hex string used to hash IPs for rate limiting.
- `MAXIMUM_FORWARD_WINDOW_IN_WEEKS` (required): integer > 0; window starts at today 00:00:00 UTC and ends 23:59:59.999 on the final day.
- `CORS_ALLOWLIST` (required): comma-separated origins allowed for CORS (e.g., `https://example.com,http://localhost:5000`).
- `RATE_LIMIT_WINDOW_MS` (required): per-IP rate-limit window in milliseconds.
- `RATE_LIMIT_MAX` (required): max requests per-IP per window.
- `RATE_LIMIT_GLOBAL_WINDOW_MS` (optional, with `RATE_LIMIT_GLOBAL_MAX`): global window in milliseconds; set both to enable.
- `RATE_LIMIT_GLOBAL_MAX` (optional, with `RATE_LIMIT_GLOBAL_WINDOW_MS`): global limit per window.
- `FREEBUSY_ENABLED` (optional): feature flag; set to `false/0/off` to disable `/freebusy`.
- `RATE_LIMITER` (required binding): Durable Object namespace (configured in `src/wrangler.toml`).

## Local development
- Start dev server (from repo root):
```bash
npm --prefix src run dev
```

## Testing
```bash
npm --prefix src test
```

Coverage (CLI summary and HTML report in `coverage/`):
```bash
npm --prefix src run test:coverage
```
- For badges, wire a CI job (e.g., GitHub Actions) to run `npm --prefix src run test:coverage` and publish coverage/test status to a badge service (e.g., shields.io or Codecov); badges aren’t auto-generated locally.

Static badges (local, from last coverage run):
```bash
npm --prefix src run test:coverage
npm --prefix src run badge:coverage
```
Generated under `badges/`:
- Coverage: `badges/coverage.svg`
- Tests (static "passing"): `badges/tests.svg`

To display in the README, add for example:

![coverage](badges/coverage.svg) ![tests](badges/tests.svg)

## API Specification
- Canonical OpenAPI spec: `docs/openapi.yaml`. Use this for previews (e.g., 42Crunch) and contract tests. Avoid maintaining copies elsewhere.

## Deploy
Set secrets in Cloudflare (do not commit them):
```bash
cd src
wrangler secret put FREEBUSY_ICAL_URL
wrangler secret put RL_SALT
```

Required env/secrets:
- `FREEBUSY_ICAL_URL` (HTTPS iCal free/busy feed)
- `RL_SALT` (random salt for hashed IPs)
- `MAXIMUM_FORWARD_WINDOW_IN_WEEKS` (integer > 0)
- `CORS_ALLOWLIST` (comma-separated origins)
- `RATE_LIMIT_WINDOW_MS` (integer > 0)
- `RATE_LIMIT_MAX` (integer > 0)
- `RATE_LIMITER` Durable Object binding (in `wrangler.toml`)

Optional:
- `RATE_LIMIT_GLOBAL_WINDOW_MS`, `RATE_LIMIT_GLOBAL_MAX` (both required together to enable global limit)
- `FREEBUSY_ENABLED` (toggle feature flag)

Deploy the worker (from repo root):
```bash
npm --prefix src run deploy
```

Durable Object binding is defined in `src/wrangler.toml` as `RATE_LIMITER` (migration tag `v1`).

## Example request
```bash
curl -i http://localhost:8787/freebusy
```

## Notes
- Window starts at 00:00:00 UTC today and ends 23:59:59.999 on the final day of the configured forward window (weeks).
- Times without a `Z` or `TZID` are treated as UTC. If a `TZID` is present, it is logged and treated as UTC (minimal dependency approach).
- Responses are always UTC and include merged/adjacent busy blocks only.
- Rate limit metadata is returned with `/freebusy` responses (including 429) so clients can back off (fields: `nextAllowedAt`, per-scope `remaining/reset`).
- CORS allowlist must be provided via env; requests from disallowed origins receive 403.
- Logging: upstream URLs are redacted to origin-only; parse warnings are sanitized and truncated to avoid leaking feed contents.
- Safety limits: upstream iCal payloads larger than 1.5 MB are rejected with a 502 to prevent resource exhaustion.
