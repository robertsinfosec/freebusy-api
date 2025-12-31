# freebusy-api

Cloudflare Worker that proxies a **secret** iCalendar (iCal) free/busy feed and returns a **minimal JSON** payload suitable for a public availability UI.

[![CI](https://github.com/robertsinfosec/freebusy-api/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/robertsinfosec/freebusy-api/actions/workflows/ci.yml)
[![tests](https://img.shields.io/github/actions/workflow/status/robertsinfosec/freebusy-api/ci.yml?branch=main&label=tests&logo=githubactions&logoColor=white)](https://github.com/robertsinfosec/freebusy-api/actions/workflows/ci.yml)
[![coverage](https://codecov.io/gh/robertsinfosec/freebusy-api/branch/main/graph/badge.svg)](https://codecov.io/gh/robertsinfosec/freebusy-api)
[![CodeQL](https://github.com/robertsinfosec/freebusy-api/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/robertsinfosec/freebusy-api/actions/workflows/codeql.yml)
[![code scanning](https://img.shields.io/github/actions/workflow/status/robertsinfosec/freebusy-api/codeql.yml?branch=main&label=code%20scanning&logo=github&logoColor=white)](https://github.com/robertsinfosec/freebusy-api/security/code-scanning)
[![node](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Frobertsinfosec%2Ffreebusy-api%2Fmain%2Fsrc%2Fpackage.json&query=%24.engines.node&label=node&logo=node.js&logoColor=white)](https://github.com/robertsinfosec/freebusy-api/blob/main/src/package.json)
[![license](https://img.shields.io/github/license/robertsinfosec/freebusy-api?label=license)](https://github.com/robertsinfosec/freebusy-api/blob/main/LICENSE)
[![release](https://img.shields.io/github/v/release/robertsinfosec/freebusy-api?display_name=tag&label=release)](https://github.com/robertsinfosec/freebusy-api/releases)
[![last commit](https://img.shields.io/github/last-commit/robertsinfosec/freebusy-api?label=last%20commit)](https://github.com/robertsinfosec/freebusy-api/commits/main)
[![issues](https://img.shields.io/github/issues/robertsinfosec/freebusy-api?label=issues)](https://github.com/robertsinfosec/freebusy-api/issues)
[![PRs](https://img.shields.io/github/issues-pr/robertsinfosec/freebusy-api?label=pull%20requests)](https://github.com/robertsinfosec/freebusy-api/pulls)
[![Dependabot](https://img.shields.io/badge/dependabot-enabled-025E8C?logo=dependabot&logoColor=white)](https://github.com/robertsinfosec/freebusy-api/security/dependabot)

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

## Docs
- API contract: `docs/openapi.yaml`
- Architecture: `docs/ARCHITECTURE.md`
- Operations: `docs/RUNBOOK.md`

## License
MIT. See `LICENSE`.
