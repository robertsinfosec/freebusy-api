# Freebusy API – Engineering Style Guide

## Language and Framework
- TypeScript for all Worker code; keep runtime-safe (no implicit any, prefer explicit types).
- Target Cloudflare Workers runtime; avoid Node-only APIs.
- Keep dependencies minimal; prefer standard APIs.

## Code Organization
- Single-responsibility modules: routing in `index.ts`; parsing/logic in `freebusy.ts`/`ical.ts`; rate limiting in `rateLimit.ts`; env validation in `env.ts`.
- Avoid large functions; favor small, pure helpers where practical.
- Keep exports minimal and intentional.

## Type and Interface Conventions
- Prefer interfaces/types over classes unless stateful behavior is required (e.g., Durable Object).
- Use `unknown` at boundaries; narrow/validate before use.
- Date handling: use `Date` objects internally, emit ISO UTC strings externally.

## Error Handling
- Fail fast on config errors; return explicit JSON error codes (`misconfigured`, `disabled`, `upstream`, `parse`, `rate_limited`, `forbidden_origin`, `not_found`).
- Do not throw raw errors to callers; normalize responses via helpers.
- Log with context but never secrets or raw IPs.

## Logging
- Structured logs with concise keys; keep noise low.
- Redact sensitive values (e.g., upstream URL path suffix masked).
- Avoid logging entire request/response bodies.

## Security Practices
- Enforce CORS allowlist early; respond 403 before business logic.
- Maintain strict headers: `Cache-Control: no-store`, `CSP default-src 'none'`, `X-Content-Type-Options: nosniff`, `Vary: Origin`.
- Hash IPs with `RL_SALT` for rate limiting; never persist plaintext IPs.
- Validate env via `validateEnv`; do not bypass checks.
- Treat all upstream input as untrusted; validate content types.

## Testing
- Unit tests for parsing, merging, windowing, rate limiting, and env validation.
- Integration tests for endpoint behaviors and error codes (403/429/502/503/500/404).
- Contract tests against `openapi.yaml` where feasible.
- Keep tests deterministic; avoid network in unit tests.

## Documentation
- Keep `openapi.yaml` in sync with behavior. The canonical spec lives at `docs/openapi.yaml`; do not add or edit copies elsewhere.
- Update `docs/PRD.md` and `docs/ARCHITECTURE.md` when behavior or constraints change.
- Document new flags/config in README and PRD.

## Style and Formatting
- Use Prettier-compatible formatting (2 spaces) and ESLint defaults for TS.
- Prefer early returns to reduce nesting.
- Name things descriptively; avoid abbreviations unless common.
- Keep comments minimal and value-adding; explain intent, not the obvious.

## Dependency Management
- Avoid heavy libs; prefer stdlib and small utilities.
- Pin versions in `package-lock.json` (npm). Review transitive risk before adding deps.

## Performance
- Mind cold start size; keep bundle lean.
- Cache where safe (current 60s cache of parsed upstream data).
- Avoid unnecessary allocations in hot paths.

## Deployment Hygiene
- Secrets via Wrangler; never commit secrets.
- Durable Object migrations must be deliberate and documented.
- Validate `wrangler.toml` changes in review.

## Reviews and PRs
- Small, focused PRs with tests and docs updates when behavior changes.
- Include rationale for security-impacting changes.
- Ensure CI passes (lint, tests). Provide manual test notes when relevant.
