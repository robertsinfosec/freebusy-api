# TODO (First principles + OSS readiness)

This checklist tracks production-readiness work for the Cloudflare Worker + Durable Object.

## 1) First principles: Worker architecture & modularity

- [ ] Remove/avoid isolate-global mutable config where possible (prefer per-request computed config + dependency injection)
  - Goal: eliminate subtle concurrency hazards and make handlers easier to unit test.
- [ ] Split `src/src/index.ts` into small modules
  - Router/dispatch
  - CORS policy helpers
  - Freebusy handler
  - Upstream fetch + caching
  - Error mapping (`misconfigured`, `forbidden_origin`, `upstream_error`, etc.)
- [ ] Define explicit error types for upstream + parsing failures (instead of `new Error("...")` strings)
  - Goal: tighten observability and prevent accidental error-code drift.
- [ ] Review Worker best-practice headers (e.g. consider `Strict-Transport-Security`)

## 2) Technical debt / correctness / stability

- [ ] Re-evaluate backward-compat logic in Durable Object payload parsing (`RateLimitDurable`)
  - If OSS contract is v2-only, remove legacy/single-scope shape support.
- [ ] Consider upstream caching strategy
  - Keep current in-memory TTL if desired, or switch to `caches.default`/ETag (only if it fits the threat model).
- [ ] Confirm all log lines stay redacted/sanitized and avoid leaking URL paths/query.

## 3) Unit tests & coverage

- [x] Keep global coverage gates passing (Vitest thresholds).
- [ ] Add contract tests for non-200 responses (`403`, `429`, `502`, `503`, `404`) against `docs/openapi.yaml`.
- [ ] Ensure all validation branches (env parsing, request routing, upstream safety checks) are covered where meaningful.

## 4) Documentation vs code (OpenAPI + docs)

- [ ] Keep `docs/openapi.yaml` as the single canonical spec.
- [ ] Re-run contract tests after any response shape change.
- [ ] Ensure README/RUNBOOK/ARCHITECTURE references match the actual spec path and deployment behavior.

## 5) Open source hygiene

- [x] MIT license (`LICENSE`)
- [x] Code of Conduct (`CODE_OF_CONDUCT.md`)
- [x] Contributing guide (`CONTRIBUTING.md`)
- [x] Security policy (`SECURITY.md`)
- [x] PR template (`.github/pull_request_template.md`)
- [x] Issue templates (`.github/ISSUE_TEMPLATE/*`)
- [x] CI workflow (`.github/workflows/ci.yml`)

## 6) Final readiness checks

- [ ] Run `npm --prefix src run check` and `npm --prefix src run test:coverage` cleanly.
- [ ] Confirm Wrangler deploy/dev instructions in README still match `src/wrangler.toml`.
- [ ] Decide on support policy (optional: `SUPPORT.md`).
