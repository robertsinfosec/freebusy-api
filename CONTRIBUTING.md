# Contributing

Thanks for helping improve freebusy-api.

## Development setup
Prereqs: Node.js 20+ and npm.

From repo root:
- Install: `npm --prefix src install`
- Typecheck: `npm --prefix src run check`
- Tests: `npm --prefix src test`
- Coverage: `npm --prefix src run test:coverage`
- Dev server: `npm --prefix src run dev` (Wrangler on `http://localhost:8787`)

Local secrets:
- Copy `src/.env.example` to `src/.env` and fill in non-production values.
- The dev script copies `src/.env` to `src/.dev.vars` for Wrangler.

## Project conventions (important)
- Worker runtime is WebWorker (see `src/tsconfig.json`): avoid Node-only APIs in `src/src/**`.
- Do not read env ad-hoc; always validate/parse through `validateEnv()` and helpers in `src/src/env.ts`.
- Time semantics are v2: owner timezone dates (`CALENDAR_TIMEZONE`) but all timestamps returned to clients are UTC instants (`...Z`). See `docs/openapi.yaml`.
- CORS is allowlist-only. Disallowed origins:
  - JSON routes return `403` `{ "error": "forbidden_origin" }`
  - OPTIONS preflight returns `403` with empty body

## Tests and coverage
This repo aims for very high unit-test coverage.

When adding features or bug fixes:
- Add/adjust unit tests under `src/test/**`.
- Keep `docs/openapi.yaml` in sync with runtime behavior; contract tests validate responses.

## Generated files
The build/dev/deploy scripts generate `src/version.txt` and `src/src/version.generated.ts`.
- Don’t hand-edit these files.
- In most cases, don’t include version bumps in PRs unless the change explicitly requires it.

## Pull requests
- Keep PRs small and focused.
- Include a short rationale and any security implications.
- Include tests for behavior changes and update docs if the API contract changes.
