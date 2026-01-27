# Copilot Instructions (freebusy-api)

## Project Overview

This is the Freebusy API, a professional Cloudflare Workers application that provides free/busy calendar availability information. It fetches iCal data, parses events, enforces rate limits, and returns busy intervals while respecting working hours and timezone constraints.

## Code Quality Standards

### Zero Technical Debt

- Refactor as you go, never leave TODO comments without GitHub issues
- No shortcuts - do it right the first time
- Test everything - minimum 80% coverage required
- Document everything - code is read more than written
- Security first - validate inputs, sanitize outputs, protect secrets

### TypeScript Code

- Always use strict type safety (no implicit `any`)
- Type hints required on all function signatures
- Follow conventions in STYLE_GUIDE.md
- Prefer interfaces for object shapes, type aliases for unions
- Use `unknown` at boundaries, narrow before use

## Project Structure

```
Root: GitHub metadata only (README, CONTRIBUTING, STYLE_GUIDE, LICENSE, etc.)
src/: ALL source code and configuration
  - src/: TypeScript source files
  - test/: Test suite (Vitest)
  - scripts/: Build/utility scripts
  - coverage/: Test coverage reports
  - package.json, tsconfig.json, vitest.config.ts, wrangler.toml, eslint.config.js
docs/: All documentation
  - openapi.yaml: API specification
  - PRD.md: Product requirements
  - dev/: Developer-facing documentation
    - SETUP.md: Environment setup and deployment (includes operational procedures)
    - ARCHITECTURE.md: Technical design and patterns
    - TESTING.md: Testing guide
    - CODECOV.md: Coverage tracking
  - threatmodel/: Security threat model
.github/: GitHub-specific configs, workflows, templates
```

## Core Modules

- Worker entrypoint: `src/src/index.ts`
- iCal parsing: `src/src/ical.ts`
- Windowing/merge logic: `src/src/freebusy.ts`
- Env parsing/validation: `src/src/env.ts`
- Rate limiting (client + DO): `src/src/rateLimit.ts` (DO class exported from `src/src/index.ts`)
- HTTP utilities: `src/src/http.ts`
- Logging utilities: `src/src/logging.ts`
- Time utilities: `src/src/time.ts`
- Version handling: `src/src/version.ts` (generated: `version.generated.ts`)

## Developer Workflows

Run everything from repo root using `npm --prefix src …` (the Node project lives in `src/`):

- **Install**: `npm --prefix src install`
- **Typecheck**: `npm --prefix src run check`
- **Tests**: `npm --prefix src test` (Vitest)
- **Coverage**: `npm --prefix src run test:coverage` (HTML under `src/coverage/`)
- **Dev server**: `npm --prefix src run dev` (Wrangler on `http://localhost:8787`)
- **Deploy**: `npm --prefix src run deploy`

## Runtime & Configuration Conventions

- Treat Workers code as WebWorker runtime (see `src/tsconfig.json`); avoid Node-only APIs in `src/src/**`
- Validate and parse env through `validateEnv()` + helpers in `src/src/env.ts`; don't read `env.*` ad-hoc
- Required bindings/vars include: `FREEBUSY_ICAL_URL`, `RL_SALT`, `RATE_LIMITER`, `CALENDAR_TIMEZONE`, `WINDOW_WEEKS`, `WORKING_HOURS_JSON`, `CORS_ALLOWLIST`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`
- Optional toggles/limits: `FREEBUSY_ENABLED`, `WEEK_START_DAY`, `CACHE_TTL_SECONDS`, `UPSTREAM_MAX_BYTES`, and paired `RATE_LIMIT_GLOBAL_WINDOW_MS` + `RATE_LIMIT_GLOBAL_MAX`
- When in doubt, treat `src/src/env.ts` + `src/wrangler.toml` as the authoritative env surface
- Local dev secrets: `src/.env` (copied to `.dev.vars` by the `dev` script). Production secrets are set via Wrangler

## HTTP Behavior (Keep Consistent)

- CORS is enforced via an allowlist early
  - For JSON endpoints using `jsonResponse()`: disallowed origins return `403` with `{"error":"forbidden_origin"}`
  - For preflight (`OPTIONS`): `handleOptions()` returns `204` for allowed origins, otherwise `403` with an empty body
- Standard error codes used by the API: `misconfigured`, `disabled`, `rate_limited`, `upstream_error`, `forbidden_origin`, `not_found`
- Responses always include strict security headers from `baseHeaders()` in `src/src/index.ts` (notably `Cache-Control: no-store` and `Vary: Origin`)
- Canonical API spec is `docs/openapi.yaml`; contract tests validate responses against it

## Time Semantics (v2)

- Owner timezone is `CALENDAR_TIMEZONE` (IANA). Window boundaries are anchored to owner-local dates, but returned as UTC instants
  - Window builder: `buildWindowV2()` in `src/src/freebusy.ts` returns `startDate/endDateInclusive` and `[startMsUtc,endMsUtcExclusive)`
  - Busy intervals returned to clients are UTC ISO strings ending in `Z` (`formatUtcIso()` / `toResponseBusy()`)
- iCal parsing is intentionally strict and DST-safe (TZID, numeric offsets, floating times, all-day events): see `src/src/ical.ts` and `src/test/ical.test.ts`

## Rate Limiting & Safety

- Rate limiting is Durable Object-backed:
  - Client call: `enforceRateLimit()` in `src/src/rateLimit.ts` posts scopes to the DO (`https://rate-limit/`)
  - IPs are never stored in plaintext: `hashIp(ip, RL_SALT)` (SHA-256) is the storage key
- Upstream fetch safety:
  - Limit payload size via `readLimitedText()` in `src/src/logging.ts` (default max is 1.5MB; configurable)
  - Log upstream URL as origin-only via `redactUrl()`; sanitize parse warnings with `sanitizeLogMessage()`
  - Parsed upstream results are cached in-memory for `CACHE_TTL_SECONDS` in `fetchUpstream()`

## Testing Patterns (Vitest)

- Handler tests commonly:
  - `vi.mock("../src/rateLimit")` / `vi.mock("../src/ical")`
  - `vi.resetModules()` then dynamic `import("../src/index")` to avoid module-level cache state
  - stub `globalThis.fetch` for upstream calls
  - use contract validation against `docs/openapi.yaml` (see `src/test/openapi.contract.test.ts`)
- Keep tests deterministic; avoid actual network calls in unit tests
- Test both success and failure paths
- Minimum 80% coverage for all new code

## Versioning

- Build/dev/deploy scripts generate `src/src/version.generated.ts` (see `src/scripts/generate-version.mjs`)
- Don't hand-edit `src/src/version.generated.ts`; run the npm scripts that regenerate it

## Common Patterns

### Import Organization

```typescript
// 1. Standard library / Web APIs (if any explicit imports)
// (Usually none for Workers, as globals are available)

// 2. Third-party packages (alphabetical)
import { parse } from 'some-package';

// 3. Local modules (alphabetical)
import { buildWindowV2, mergeIntervals } from './freebusy';
import { validateEnv } from './env';
import { parseIcal } from './ical';
import { enforceRateLimit } from './rateLimit';
```

### Error Handling Pattern

```typescript
// Fail fast on config errors
export function validateEnv(env: Env): ValidatedEnv {
  if (!env.FREEBUSY_ICAL_URL) {
    throw new Error('FREEBUSY_ICAL_URL is required');
  }
  // ... more validation
  return validatedEnv;
}

// Return explicit JSON error codes
function jsonError(code: ApiErrorCode, status: number): Response {
  return new Response(
    JSON.stringify({ error: code }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
```

### Logging Pattern

```typescript
// Structured logs with redaction
console.log('Fetching upstream', {
  origin: redactUrl(upstreamUrl), // Only log origin, not full URL
  cacheHit: false,
});

console.warn('Parse warning', {
  message: sanitizeLogMessage(warning),
});

// Never log sensitive data
// ❌ Don't log: raw IPs, API keys, full URLs with sensitive paths
```

## What NOT to Do

- ❌ Don't put source code or config files in repo root (only GitHub metadata)
- ❌ Don't use implicit `any` - always specify types
- ❌ Don't hardcode paths, secrets, or config values
- ❌ Don't throw raw errors to callers - use explicit error codes
- ❌ Don't log sensitive data (IPs, secrets, full URLs)
- ❌ Don't leave commented-out code or TODO comments without issues
- ❌ Don't bypass env validation - always use `validateEnv()`
- ❌ Don't write functions longer than 50 lines - refactor into smaller pieces
- ❌ Don't make network calls in unit tests - mock them
- ❌ Don't edit `version.generated.ts` by hand

## Markdown Documentation Standards

All markdown files must follow professional formatting standards.

### Required Practices

1. **Use real headers, not bold text**: Never use `**Header:**` as a simulated section header. Use proper `###` markdown headers instead
2. **Add section descriptions**: Every header needs at least one sentence explaining what the section contains
3. **Blank lines everywhere**: All headings, code blocks, lists, and tables MUST have blank lines above and below
4. **No horizontal rules**: Never use `---` separators. Headers provide sufficient visual separation
5. **No emoji in headers**: Keep section headers professional without decorative emoji
6. **Use GitHub admonitions**: For callouts, use `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!IMPORTANT]`, `> [!CAUTION]`

### Examples

CORRECT:

```markdown
### Configuration Options

The following environment variables control behavior.

| Variable | Description |
|----------|-------------|
...
```

INCORRECT:

```markdown
### Configuration Options
---
**Environment Variables:**
| Variable | Description |
```

See STYLE_GUIDE.md for complete documentation standards.

## Git Commit Messages

Format:

```
type: Short description (50 chars max)

Longer explanation if needed (wrap at 72 chars).
- Bullet points okay
- Reference issues: Fixes #123
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `style`, `chore`, `perf`, `security`

## When Suggesting Changes

1. **Read existing code first** - Understand current patterns
2. **Follow existing style** - Match what's already there
3. **Test your suggestions** - Provide test cases
4. **Update documentation** - Keep docs in sync with code (README, PRD, ARCHITECTURE, openapi.yaml)
5. **Consider security impact** - Validate inputs, maintain CORS, preserve headers
6. **Maintain contract** - Don't break API compatibility without versioning
7. **Think about edge cases** - Handle errors gracefully, consider DST, timezones, malformed input

## Repository Philosophy

- **GitHub-first**: Follow GitHub conventions and standards
- **Quality over speed**: Take time to do it right
- **No technical debt**: Refactor as you go
- **Test everything**: No untested code in production
- **Document everything**: Code is read more than written
- **Security first**: Validate inputs, sanitize outputs, protect secrets
- **Privacy by design**: Hash IPs, redact logs, minimize data retention

## Helpful Resources

- TypeScript Docs: https://www.typescriptlang.org/docs/
- Cloudflare Workers Docs: https://developers.cloudflare.com/workers/
- Vitest Docs: https://vitest.dev/
- Project README: See root README.md
- Style Guide: See STYLE_GUIDE.md
- Architecture: See docs/ARCHITECTURE.md
- API Spec: See docs/openapi.yaml
