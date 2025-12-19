# freebusy-api

Cloudflare Worker that proxies a private calendar free/busy iCal URL and returns a sanitized JSON free/busy window for the next 28 days.

## What it does
- `GET /freebusy` – fetches a secret free/busy feed, parses `VFREEBUSY`/`FREEBUSY` blocks, merges/normalizes to UTC, clips to `now → now+28 days`, and returns only busy blocks.
- `GET /health` – returns `{ "ok": true }` for simple uptime checks.

## Prerequisites
- Node.js 18+ (for local tests and Wrangler CLI)
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
Edit `src/.env` with your calendar free/busy URL and a random rate-limit salt.

## Local development
- Start dev server (from repo root):
```bash
npm --prefix src run dev
```

## Testing
```bash
npm --prefix src test
```

## Deploy
Set secrets in Cloudflare (do not commit them):
```bash
cd src
wrangler secret put FREEBUSY_ICAL_URL
wrangler secret put RL_SALT
```

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
- Allowed CORS origins: `https://freebusy.robertsinfosec.com`, `http://localhost:5173`.
- Times without a `Z` or `TZID` are treated as UTC. If a `TZID` is present, it is logged and treated as UTC (minimal dependency approach).
- Responses are always UTC and include merged/adjacent busy blocks only.
