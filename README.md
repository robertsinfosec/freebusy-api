[![Build](https://github.com/robertsinfosec/freebusy-api/actions/workflows/ci.yml/badge.svg)](https://github.com/robertsinfosec/freebusy-api/actions/workflows/ci.yml)
[![Tests](https://github.com/robertsinfosec/freebusy-api/actions/workflows/ci.yml/badge.svg)](https://github.com/robertsinfosec/freebusy-api/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/robertsinfosec/freebusy-api/branch/main/graph/badge.svg)](https://codecov.io/gh/robertsinfosec/freebusy-api)

[![CodeQL](https://github.com/robertsinfosec/freebusy-api/actions/workflows/codeql.yml/badge.svg)](https://github.com/robertsinfosec/freebusy-api/actions/workflows/codeql.yml)
[![Dependabot](https://img.shields.io/badge/dependabot-enabled-025e8c)](https://github.com/robertsinfosec/freebusy-api/security/dependabot)

[![License](https://img.shields.io/github/license/robertsinfosec/freebusy-api)](https://github.com/robertsinfosec/freebusy-api/blob/main/LICENSE)
[![Issues](https://img.shields.io/github/issues/robertsinfosec/freebusy-api)](https://github.com/robertsinfosec/freebusy-api/issues)
[![PRs](https://img.shields.io/github/issues-pr/robertsinfosec/freebusy-api)](https://github.com/robertsinfosec/freebusy-api/pulls)
[![Release](https://img.shields.io/github/v/release/robertsinfosec/freebusy-api)](https://github.com/robertsinfosec/freebusy-api/releases)

# freebusy-api

Cloudflare Worker that proxies a **secret** iCalendar (iCal) free/busy feed and returns a **minimal JSON** payload suitable for a public availability UI.

<img src="docs/images/freebusy-social-be.png" height="200"/>

## What it does
- `GET /freebusy`: fetches the upstream iCal feed (`FREEBUSY_ICAL_URL`), parses `VFREEBUSY/FREEBUSY` and `VEVENT`, merges and clips busy intervals to a forward-looking window, and returns only **busy** time ranges.
- `GET /health`: returns `{ "ok": true }` (CORS enforced).

This service is intentionally security-first:
- Strict CORS allowlist
- Durable Object-backed rate limiting (hashed IP keys; no plaintext IP storage)
- No raw calendar data returned or persisted
- Strict response headers (`Cache-Control: no-store`, `CSP default-src 'none'`, etc.)

## Time semantics (v2)
The “owner timezone” is configured via `CALENDAR_TIMEZONE` (IANA).

- **Window boundaries** are anchored to owner-local *dates* (for a stable “date column” UI), and returned as:
	- `window.startDate` / `window.endDateInclusive` (owner dates), and
	- `window.startUtc` / `window.endUtcExclusive` (UTC instants)
- **Busy intervals are always returned as UTC instants** (ISO strings ending in `Z`). Clients can render in any viewer timezone by converting from UTC using IANA timezone rules.
- **All-day events** are treated as busy for the entire owner-day (local 00:00 → next-day 00:00), returned as UTC instants.

## Prerequisites
- Node.js 20+ (matches devcontainer)
- `npm`
- Cloudflare account with Workers + Durable Objects enabled

> The Worker project lives under `src/`. Run commands from repo root using `npm --prefix src …`.

## Setup
Install deps:
```bash
npm --prefix src install
```

Create local secrets (not committed):
```bash
cp src/.env.example src/.env
```

Then start the dev server:
```bash
npm --prefix src run dev
```

## API
Canonical spec: `docs/openapi.yaml`.

### Example
```bash
curl -i http://localhost:8787/freebusy
```

### Response fields (high level)
Successful `GET /freebusy` returns JSON like:
- `version`: build identifier
- `generatedAtUtc`: when the response was generated (UTC `Z`)
- `calendar.timeZone`: the configured owner timezone (`CALENDAR_TIMEZONE`)
- `calendar.weekStartDay`: ISO day-of-week 1..7 (defaults to 1)
- `window`: `{ startDate, endDateInclusive, startUtc, endUtcExclusive }`
- `workingHours`: weekly schedule from `WORKING_HOURS_JSON`
- `busy[]`: `{ startUtc, endUtc, kind }` where `kind` is `time` or `allDay`
- `rateLimit`: present for `/freebusy` responses (including 429)

### CORS behavior
- JSON endpoints (e.g. `/health`, `/freebusy`): disallowed `Origin` → `403` with `{ "error": "forbidden_origin" }`.
- Preflight (`OPTIONS`): allowed origin → `204` with CORS headers; disallowed origin → `403` with an empty body.

## Configuration
The authoritative env surface is `src/src/env.ts` and `src/wrangler.toml`.

Required:
- `FREEBUSY_ICAL_URL` (secret): HTTPS upstream iCal free/busy feed
- `RL_SALT` (secret): random hex used to hash IPs for rate limiting
- `RATE_LIMITER` (binding): Durable Object namespace (see `src/wrangler.toml`)
- `CALENDAR_TIMEZONE`: owner IANA timezone (e.g. `America/New_York`)
- `WINDOW_WEEKS`: integer > 0 (forward window size)
- `WORKING_HOURS_JSON`: JSON like `{ "weekly": [{"dayOfWeek": 1, "start": "08:00", "end": "18:00"}, ...] }`
- `CORS_ALLOWLIST`: comma-separated origins
- `RATE_LIMIT_WINDOW_MS`: integer > 0
- `RATE_LIMIT_MAX`: integer > 0

Optional:
- `WEEK_START_DAY`: integer 1..7 (defaults to 1)
- `CACHE_TTL_SECONDS`: upstream parse cache TTL in seconds (default 60)
- `UPSTREAM_MAX_BYTES`: upstream payload cap in bytes (default 1_500_000)
- `FREEBUSY_ENABLED`: set to `false` / `0` / `off` to disable `/freebusy` (returns 503)
- `RATE_LIMIT_GLOBAL_WINDOW_MS` + `RATE_LIMIT_GLOBAL_MAX`: set both to enable a global cap

## Developer workflows
From repo root:
- Typecheck: `npm --prefix src run check`
- Tests: `npm --prefix src test`
- Coverage: `npm --prefix src run test:coverage`
- Dev server: `npm --prefix src run dev` (Wrangler on `http://localhost:8787`)
- Deploy: `npm --prefix src run deploy`

## Deploy
Secrets are set via Wrangler (do not commit them):
```bash
cd src
wrangler secret put FREEBUSY_ICAL_URL
wrangler secret put RL_SALT
```

Deploy from repo root:
```bash
npm --prefix src run deploy
```

## Documentation

### User Documentation

- [API Specification](docs/openapi.yaml) - OpenAPI 3.0 contract
- [Product Requirements](docs/PRD.md) - Features and requirements
- [Security](SECURITY.md) - Security policy and reporting
- [Support](SUPPORT.md) - Getting help

### Developer Documentation

- [Setup Guide](docs/dev/SETUP.md) - Environment setup and deployment
- [Architecture](docs/dev/ARCHITECTURE.md) - Technical design and patterns
- [Testing Guide](docs/dev/TESTING.md) - Writing and running tests
- [Codecov Integration](docs/dev/CODECOV.md) - Coverage tracking
- [Contributing](CONTRIBUTING.md) - Development guidelines
- [Style Guide](STYLE_GUIDE.md) - Code and documentation standards

## Deployment

### Setting Secrets

Secrets are managed via Wrangler. **Never commit secrets to version control.**

```bash
cd src

# Required secrets
wrangler secret put FREEBUSY_ICAL_URL
wrangler secret put RL_SALT

# Generate RL_SALT with: openssl rand -hex 32
```

All other configuration values are set in [wrangler.toml](src/wrangler.toml) as environment variables.

### Deploy to Production

```bash
# From repo root
npm --prefix src run deploy
```

**Pre-deployment checklist:**

- [ ] All tests pass: `npm --prefix src test`
- [ ] Type check passes: `npm --prefix src run check`
- [ ] Secrets configured in Cloudflare
- [ ] [wrangler.toml](src/wrangler.toml) updated with correct values
- [ ] [openapi.yaml](docs/openapi.yaml) reflects any API changes

### Rollback

To rollback after a problematic deployment:

1. **Quick disable:** Set `FREEBUSY_ENABLED=false` (returns 503 for `/freebusy`)
2. **Full rollback:** Redeploy from previous known-good commit

```bash
# Emergency disable
cd src
wrangler secret put FREEBUSY_ENABLED
# Enter: false

# Then redeploy to apply
npm run deploy
```

## Rate Limiting

### Configuration

Rate limiting is enforced per-IP (hashed) and optionally globally:

**Per-IP limits (required):**

- `RATE_LIMIT_MAX` - Maximum requests per window (e.g., `100`)
- `RATE_LIMIT_WINDOW_MS` - Window duration in milliseconds (e.g., `60000` = 1 minute)

**Global limits (optional, must set both):**

- `RATE_LIMIT_GLOBAL_MAX` - Maximum total requests per window
- `RATE_LIMIT_GLOBAL_WINDOW_MS` - Global window duration

Leave global limits unset to disable global cap.

### Adjusting Limits

1. Update values in [wrangler.toml](src/wrangler.toml)
2. Redeploy: `npm --prefix src run deploy`
3. Verify: Trigger rate limit, expect `429` response with `{"error":"rate_limited"}`

### How Rate Limiting Works

- IP addresses are **hashed** using `RL_SALT` (never stored in plaintext)
- Enforced via Cloudflare Durable Objects (distributed state)
- Clients receive `rateLimit` object in responses showing remaining quota

## CORS Configuration

### Setting Allowed Origins

`CORS_ALLOWLIST` is a **comma-separated** list of allowed origins:

```bash
cd src
wrangler secret put CORS_ALLOWLIST
# Example: https://example.com,https://app.example.com
```

**CORS behavior:**

- **Allowed origins:** Receive proper CORS headers, `OPTIONS` returns `204`, requests succeed
- **Disallowed origins:**
  - JSON endpoints (`/health`, `/freebusy`) return `403` with `{"error":"forbidden_origin"}`
  - `OPTIONS` preflight returns `403` with empty body

### Best Practices

- Keep allowlist **minimal** (only trusted origins)
- Prefer **HTTPS** origins
- After updating, test both allowed and disallowed origins

## Health Checks

### Quick Validation

```bash
# Health check (from allowed origin)
curl -H "Origin: https://yourdomain.com" https://freebusy.yourdomain.workers.dev/health
# Expected: {"ok":true}

# Freebusy endpoint
curl -H "Origin: https://yourdomain.com" https://freebusy.yourdomain.workers.dev/freebusy
# Expected: 200 with busy array, UTC timestamps ending in Z

# Test CORS rejection
curl -H "Origin: https://evil.com" https://freebusy.yourdomain.workers.dev/health
# Expected: 403 {"error":"forbidden_origin"}
```

### Monitoring

Monitor your Worker via Cloudflare Dashboard:

- **Metrics:** Request rate, error rate, latency percentiles
- **Logs:** Real-time logs (errors, warnings, diagnostics)
- **Alerts:** (Optional) Set up Cloudflare alerts for error rate thresholds

Key metrics to watch:

- Elevated `5xx` errors (upstream issues)
- Surge in `429` responses (rate limiting triggered)
- Surge in `403` responses (CORS violations or blocked origins)
- Latency p95 above expected thresholds

## License
MIT. See `LICENSE`.

---

![Alt](https://repobeats.axiom.co/api/embed/1b554046e870e1855a3830d153b6960749d4c288.svg "Repobeats analytics image")
