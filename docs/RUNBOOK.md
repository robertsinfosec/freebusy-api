# Freebusy API – Operations Runbook

## Scope
Operational steps for routine maintenance and incident response for the Freebusy Cloudflare Worker and Durable Object.

## 1) Secrets and Env Management
- Prod/Stage: set via `wrangler secret put` in the `src` directory:
  - Required: `FREEBUSY_ICAL_URL`, `RL_SALT`, `PREFERRED_TIMEZONE`, `MAXIMUM_FORWARD_WINDOW_IN_WEEKS`, `CORS_ALLOWLIST`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`
  - Optional (must be paired): `RATE_LIMIT_GLOBAL_WINDOW_MS`, `RATE_LIMIT_GLOBAL_MAX`
  - Optional flag: `FREEBUSY_ENABLED`
- Local: copy `src/.env.example` to `src/.env` and fill with non-prod values; keep required vars populated.
- Rotation:
  1. Generate new salt: `openssl rand -hex 32`.
  2. Update secret in environment (`wrangler secret put RL_SALT`).
  3. Redeploy Worker. No data migration needed.
  4. Verify `/health` and `/freebusy`.
- Do not commit real secrets. Verify logs do not contain secret values.

# 2) Adjust Rate Limits
- Required per-IP settings: `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`.
- Optional global cap: set both `RATE_LIMIT_GLOBAL_MAX` and `RATE_LIMIT_GLOBAL_WINDOW_MS` to enable; leave both unset to disable.
- Change by setting env values and redeploying; update docs if thresholds change.
- After change, validate:
  - Expected limit hit returns 429 with `rate_limited`.
  - Normal traffic still succeeds.

## 3) Toggle Feature Flag
- `FREEBUSY_ENABLED` (secret/env). Set to `false`/`0`/`off` to disable `/freebusy` (returns 503 `disabled`).
- For emergency disable: update secret and redeploy; confirm `/freebusy` returns 503 and `/health` still 200.

# 4) Update CORS Allowlist
- Provide `CORS_ALLOWLIST` (comma-separated) via secret/env; there are no code defaults.
- Steps:
  1. Update env with new origins.
  2. Run tests/lint.
  3. Redeploy.
  4. Validate preflight (OPTIONS) and GET from allowed and disallowed origins (expect 204/200 vs 403).
-. Keep allowlist minimal; prefer HTTPS origins.

## 5) Deploy
- From repo root: `npm --prefix src run deploy` (assumes secrets and bindings exist).
- Ensure `wrangler.toml` has `RATE_LIMITER` binding and migration tag `v1` present.
- Pre-deploy checklist: tests pass, `openapi.yaml` matches behavior, docs updated if behavior changed.

## 6) Rollback
- Redeploy previous known-good build (prior git commit or release artifact).
- If impact is high, temporarily disable via `FREEBUSY_ENABLED=false` while preparing rollback.

# 7) Health and Smoke Tests
- `/health` returns `{ ok: true }` with 200 for allowed origins; 403 for disallowed origins.
- `/freebusy` happy path returns 200 with `busy` array; check timestamps are in `PREFERRED_TIMEZONE` and window starts at today 00:00:00 (local) and ends at 23:59:59.999 on the last day of the configured forward window.
- Rate limit: exceed configured per-IP window/limit; expect 429.
- Payload cap: ensure oversized upstream feeds (>1.5 MB) return 502, not partial data.
- CORS: OPTIONS from disallowed origin returns 403; allowed origin returns 204.

## 8) Monitoring and Logging
  - Upstream failure rate > threshold.
  - Surge in 429 or 403 responses.
  - Latency p95 above targets.
- Logging: info for fetch diagnostics (origin-only redaction), warn for sanitized/trimmed parse issues, error for upstream/parse/misconfig. Avoid logging secrets or raw IPs.
## 9) Incident Response Playbook
- Symptom: elevated 5xx
  - Check logs for `upstream` or `parse` errors.
  - Validate upstream URL reachability (from a safe environment; do not log content).
  - If upstream flaky: consider temporarily increasing cache TTL or toggling feature flag.
- Symptom: unexpected 4xx surge (403/429)
  - Verify allowlist; ensure client origin matches.
  - Check rate-limit thresholds; adjust if legitimate traffic is throttled.
- Symptom: suspected abuse
  - Tighten rate limits; add origin restriction; consider enabling Turnstile/nonce.
  - Monitor for continued abuse; rotate `RL_SALT` if needed.
- Communication: document issue, timeline, actions taken, and follow-up tasks.

## 10) Change Management
- Small, reviewable PRs with tests and doc updates (PRD/Architecture/OpenAPI) when behavior changes.
- Verify CI (lint/tests) before deploy.

## 11) Future Hardening (optional steps)
- Add Turnstile verification for `/freebusy` and rate-limit per token + IP.
- Add signed nonce issuance (Pages Function/DO) and require nonce on requests.
- Add metrics export (Logpush/Workers Analytics) and alerting on errors/latency/rate-limit hits.
- Add upstream payload size guardrails.
