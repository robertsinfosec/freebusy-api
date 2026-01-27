# Architecture Guide

Navigation: [Home](../../README.md) | [Contributing](../../CONTRIBUTING.md) | [Setup](SETUP.md) | [Testing](TESTING.md) | [Style Guide](../../STYLE_GUIDE.md)

Complete architectural overview of the Freebusy API project.

## Table of Contents

- [Project Structure](#project-structure)
- [Module Overview](#module-overview)
- [Data Flow](#data-flow)
- [Design Patterns](#design-patterns)
- [Key Decisions](#key-decisions)
- [Extension Points](#extension-points)

## Project Structure

### Repository Layout

```
freebusy-api/
├── .devcontainer/           # VS Code Dev Container configuration
├── .github/                 # GitHub-specific files
│   ├── copilot-instructions.md
│   ├── workflows/
│   │   └── ci.yml          # CI/CD pipeline
│   ├── ISSUE_TEMPLATE/     # Issue templates
│   └── dependabot.yml      # Dependency updates
├── docs/                    # Documentation
│   ├── dev/                 # Developer documentation
│   │   ├── SETUP.md
│   │   ├── TESTING.md
│   │   ├── ARCHITECTURE.md  # This file
│   │   └── CODECOV.md
│   ├── threatmodel/         # Security documentation
│   ├── PRD.md              # Product Requirements
│   └── openapi.yaml        # API specification
├── src/                     # ALL source code
│   ├── src/                 # TypeScript source files
│   │   ├── index.ts        # Worker entrypoint + DO export
│   │   ├── worker.ts       # Main request handler
│   │   ├── freebusy.ts     # Window/merge logic
│   │   ├── ical.ts         # iCal parsing
│   │   ├── rateLimit.ts    # Rate limiting client
│   │   ├── env.ts          # Environment validation
│   │   ├── config.ts       # Configuration types
│   │   ├── http.ts         # HTTP utilities
│   │   ├── logging.ts      # Logging utilities
│   │   ├── time.ts         # Time utilities
│   │   └── version.ts      # Version handling
│   ├── test/                # Test suite (Vitest)
│   ├── scripts/             # Build/utility scripts
│   ├── coverage/            # Test coverage reports
│   ├── package.json         # Dependencies
│   ├── tsconfig.json        # TypeScript config
│   ├── vitest.config.ts     # Test config
│   ├── wrangler.toml        # Cloudflare config
│   └── eslint.config.js     # ESLint config
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
└── STYLE_GUIDE.md
```

### Why This Structure?

**Root level = GitHub metadata only**

- README, LICENSE, CONTRIBUTING, etc.
- Standard location for repo-wide documentation
- First thing visitors see

**src/ = ALL source code**

- Keeps root clean
- Separates code from documentation
- Follows Cloudflare Workers best practices
- All npm commands run with `--prefix src`

**docs/ = Non-code documentation**

- User guides, API spec, PRD
- Separate from code to avoid clutter
- dev/ subdirectory for developer-specific docs

**src/src/ = TypeScript source**

- Mirrors common Node.js project structure
- Allows for future multi-package projects
- Clear separation from test/ and config files

## Module Overview

### Core Application (src/src/)

```
src/src/
├── index.ts           # Worker entrypoint, Durable Object export
├── worker.ts          # Main request handler logic
├── freebusy.ts        # Window computation, interval merging
├── ical.ts            # iCal parsing (VFREEBUSY, VEVENT)
├── rateLimit.ts       # Rate limiting client + Durable Object
├── env.ts             # Environment variable validation
├── config.ts          # TypeScript configuration types
├── http.ts            # HTTP response utilities
├── logging.ts         # Logging and sanitization
├── time.ts            # Time/date utilities
├── version.ts         # Version handling
└── version.generated.ts  # Auto-generated version (don't edit)
```

### Module Responsibilities

#### index.ts

- Worker fetch handler export
- Durable Object class export (`RateLimiter`)
- Delegates to `worker.ts` for main logic
- Minimal - just the Cloudflare Workers API surface

#### worker.ts

- Main request handling orchestration
- CORS preflight (OPTIONS) handling
- Environment validation
- Routing (`/health`, `/freebusy`, 404)
- Feature flag (`FREEBUSY_ENABLED`)
- Delegates to specialized modules

#### freebusy.ts

- Window boundary computation
  - `buildWindowV2()`: Anchors to owner-local dates in `CALENDAR_TIMEZONE`
  - Returns both local dates and UTC instants
- Interval merging (`mergeIntervals()`)
- Clipping busy times to window
- Working hours logic
- Pure functions - no side effects

#### ical.ts

- iCal parsing (RFC 5545)
- Handles VFREEBUSY and VEVENT
- TZID resolution (IANA timezones)
- All-day event handling
- Floating time interpretation
- Duration parsing
- Unfolds long lines
- Normalizes to UTC instants

#### rateLimit.ts

- Client-side rate limiting logic
  - `enforceRateLimit()`: Checks limits via Durable Object
  - IP hashing with salt (SHA-256)
- Durable Object implementation (`RateLimiter` class)
  - Per-IP counters (windowed)
  - Optional global counters
  - Scoped storage (separate keys for per-IP vs global)

#### env.ts

- Environment variable validation
- `validateEnv()`: Fails fast on missing/invalid config
- Parses complex types (WORKING_HOURS_JSON, CORS_ALLOWLIST)
- Type-safe environment object
- No business logic - just validation

#### config.ts

- TypeScript types and interfaces
- `Env`: Cloudflare Worker environment
- `ValidatedEnv`: Parsed/validated configuration
- `FreebusyConfig`, `WorkingHours`, etc.
- Shared types across modules

#### http.ts

- HTTP response helpers
- `jsonResponse()`: JSON with security headers
- `jsonError()`: Standardized error responses
- `baseHeaders()`: Common security headers
  - `Cache-Control: no-store`
  - `Content-Security-Policy: default-src 'none'`
  - `X-Content-Type-Options: nosniff`
  - `Vary: Origin`

#### logging.ts

- Structured logging utilities
- `redactUrl()`: Masks URL paths (origin-only logging)
- `sanitizeLogMessage()`: Removes sensitive data
- `readLimitedText()`: Size-limited fetch with logging
- No console.log wrappers - just utilities

#### time.ts

- Date/time conversion utilities
- Timezone handling (IANA)
- ISO 8601 formatting
- UTC normalization
- Helper functions for freebusy.ts and ical.ts

#### version.ts

- Version metadata export
- Reads from `version.generated.ts`
- Used in API responses (`/freebusy`)

## Data Flow

### /health Request Flow

```
1. Client makes GET /health

2. worker.ts
   ├─> CORS preflight check (if OPTIONS)
   ├─> Env validation
   ├─> Route to /health handler
   └─> Return { "ok": true }

3. Response with security headers
```

### /freebusy Request Flow

```
1. Client makes GET /freebusy

2. worker.ts
   ├─> CORS preflight check (if OPTIONS)
   │   └─> Disallowed origin → 403 forbidden_origin
   ├─> Env validation
   │   └─> Failure → 500 misconfigured
   ├─> Feature flag check (FREEBUSY_ENABLED)
   │   └─> Disabled → 503 disabled
   └─> Route to /freebusy handler

3. rateLimit.ts
   ├─> Hash client IP with RL_SALT
   ├─> Call Durable Object with hashed IP
   │   ├─> Check per-IP counter
   │   ├─> Check global counter (if enabled)
   │   └─> Return decision + metadata
   └─> Exceeded → 429 rate_limited

4. Upstream fetch (via logging.readLimitedText)
   ├─> GET FREEBUSY_ICAL_URL
   ├─> Validate content-type (text/calendar or text/plain)
   ├─> Limit payload size (UPSTREAM_MAX_BYTES)
   └─> Failure → 502 upstream_error

5. ical.ts
   ├─> Unfold iCal lines
   ├─> Parse VFREEBUSY blocks
   ├─> Parse VEVENT blocks
   ├─> Handle TZID (IANA timezones)
   ├─> Handle all-day events
   ├─> Handle floating times (assume owner TZ)
   ├─> Normalize all times to UTC instants
   └─> Return array of busy intervals

6. freebusy.ts
   ├─> buildWindowV2() - Compute window bounds
   │   ├─> Anchor to owner-local dates (CALENDAR_TIMEZONE)
   │   ├─> Return startDate/endDateInclusive (local)
   │   └─> Return startUtc/endUtcExclusive (UTC instants)
   ├─> Clip intervals to window
   ├─> mergeIntervals() - Merge overlapping/adjacent
   └─> Return normalized busy times

7. worker.ts
   ├─> Build JSON response
   │   ├─> version (from version.ts)
   │   ├─> generatedAtUtc (current time)
   │   ├─> calendar { timeZone, weekStartDay }
   │   ├─> window { dates, UTC instants }
   │   ├─> workingHours
   │   ├─> busy[] array
   │   └─> rateLimit metadata
   └─> Return 200 with security headers

8. Cache result (in-memory, CACHE_TTL_SECONDS)
```

### Rate Limiting Flow (Durable Object)

```
1. Client request arrives with IP

2. rateLimit.ts (client)
   ├─> hashIp(ip, RL_SALT) → hashed key
   ├─> Create DO stub (RATE_LIMITER binding)
   └─> POST to https://rate-limit/

3. RateLimiter Durable Object
   ├─> Receive scopes: ['ip:<hash>', 'global'] (if global enabled)
   ├─> For each scope:
   │   ├─> Get counter from storage
   │   ├─> Check if window expired
   │   │   └─> Reset counter if expired
   │   ├─> Increment counter
   │   ├─> Compare to limit
   │   └─> Store updated counter
   ├─> Determine overall decision (any scope exceeded → denied)
   └─> Return { allowed, per-scope metadata }

4. rateLimit.ts (client)
   └─> Return decision to worker.ts

5. worker.ts
   └─> If denied → 429 with rateLimit metadata
```

## Design Patterns

### Dependency Injection

Instead of hard-coding dependencies, pass them as arguments or use environment:

```typescript
// worker.ts
export async function handleRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const config = validateEnv(env);  // Injectable via env
  // ...
}

// freebusy.ts
export function buildWindowV2(
  config: FreebusyConfig,
  now: Date = new Date()  // Injectable for testing
): TimeWindow {
  // ...
}
```

**Benefits:**

- Easy to test (inject mocks)
- Flexible (swap implementations)
- Clear dependencies

### Fail Fast Validation

Validate environment at the start of every request:

```typescript
// env.ts
export function validateEnv(env: Env): ValidatedEnv {
  if (!env.FREEBUSY_ICAL_URL) {
    throw new Error('FREEBUSY_ICAL_URL is required');
  }
  if (!env.RL_SALT) {
    throw new Error('RL_SALT is required');
  }
  // ... more validation
  return validatedEnv;
}
```

**Benefits:**

- Catches config errors immediately
- Clear error messages
- Type-safe throughout application

### Explicit Error Codes

Never throw raw errors to clients - use standardized codes:

```typescript
// http.ts
type ApiErrorCode =
  | 'misconfigured'
  | 'disabled'
  | 'rate_limited'
  | 'upstream_error'
  | 'forbidden_origin'
  | 'not_found';

function jsonError(code: ApiErrorCode, status: number): Response {
  return jsonResponse({ error: code }, status);
}
```

**Benefits:**

- Consistent API contract
- Client-friendly error handling
- Easy to test and document

### Separation of Concerns

Each module has a single responsibility:

- **ical.ts** - iCal parsing only
- **freebusy.ts** - Window computation and merging only
- **rateLimit.ts** - Rate limiting only
- **worker.ts** - Orchestration (uses all above)

**Benefits:**

- Easy to understand
- Easy to test
- Easy to modify
- Reusable components

### Privacy by Design

Never store or log sensitive data:

```typescript
// rateLimit.ts
async function hashIp(ip: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  // ... return hex hash
}

// logging.ts
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.origin;  // Only log origin, not path/query
  } catch {
    return '[invalid URL]';
  }
}
```

**Benefits:**

- GDPR/privacy compliance
- No PII leakage
- Secure by default

### Durable Object Pattern

Rate limiting uses Cloudflare Durable Objects for global consistency:

```typescript
// index.ts - Export DO class
export { RateLimiter } from './rateLimit';

// rateLimit.ts - DO implementation
export class RateLimiter implements DurableObject {
  constructor(private state: DurableObjectState) {}
  
  async fetch(request: Request): Promise<Response> {
    // Windowed counter logic
    // Per-scope storage (ip:<hash>, global)
    // Return decision + metadata
  }
}
```

**Benefits:**

- Globally consistent counters
- Low latency (edge-located)
- Automatic persistence
- Scales horizontally

## Key Decisions

### Why Cloudflare Workers?

- **Edge deployment** - Low latency worldwide
- **Serverless** - No infrastructure management
- **Free tier** - Generous limits for personal use
- **Durable Objects** - Built-in state management
- **WebWorker runtime** - Standard APIs, fast cold starts

### Why TypeScript?

- **Type safety** - Catch errors at compile time
- **Better IDE support** - Autocomplete, refactoring
- **Self-documenting** - Types serve as inline docs
- **Cloudflare Workers support** - First-class TS support

### Why Vitest?

- **Fast** - Vite-powered, instant feedback
- **ESM-native** - Modern JavaScript modules
- **Compatible** - Jest-like API, easy migration
- **Good Workers support** - Works well with WebWorker runtime

### Why Durable Objects for Rate Limiting?

**Problem:** Need globally consistent rate limiting across edge locations.

**Alternatives considered:**

- KV storage: Eventually consistent, race conditions
- In-memory: Per-instance only, not global
- External service: Added latency, cost

**Solution:** Durable Objects provide:

- Strong consistency
- Low latency (edge-colocated)
- Built-in persistence
- Automatic scaling

### Why Hash IPs?

**Problem:** Need to track per-IP rate limits without storing PII.

**Solution:** SHA-256 hash with random salt:

```typescript
hashedIp = SHA256(ip + RL_SALT)
```

**Benefits:**

- Not reversible (one-way hash)
- Unique per IP (with good salt)
- GDPR compliant (not PII)
- Rotation-friendly (change salt)

### Why UTC for All Timestamps?

**Problem:** Timezones are complex and error-prone.

**Solution:** Normalize all times to UTC instants:

- Parse iCal with timezone awareness
- Convert to UTC immediately
- Store/return/log only UTC
- Clients convert to viewer timezone as needed

**Benefits:**

- No DST bugs
- No timezone confusion
- Easy to sort/compare
- Standard ISO 8601 format

### Why Anchor Window to Owner-Local Dates?

**Problem:** Users think in calendar dates, not UTC timestamps.

**Solution:** Window boundaries use owner-local dates:

- Start: 00:00 on Monday in owner's timezone
- End: 23:59:59.999 on Sunday N weeks later
- Convert to UTC for API responses

**Benefits:**

- Stable date columns in UI
- Matches user mental model
- Handles DST correctly

### Why No Database?

**Problem:** Storing calendar data creates privacy and security risks.

**Solution:** Ephemeral processing only:

- Fetch upstream on demand
- Cache in-memory (60s default)
- No persistent storage of calendar data
- Only rate-limit counters persist (hashed IPs)

**Benefits:**

- No data breach risk
- No backup/restore needed
- Simple deployment
- GDPR friendly

## Extension Points

### Adding New Endpoints

1. **Define route in worker.ts:**

   ```typescript
   const url = new URL(request.url);
   if (url.pathname === '/new-endpoint') {
     return handleNewEndpoint(request, config);
   }
   ```

2. **Add handler function:**

   ```typescript
   async function handleNewEndpoint(
     request: Request,
     config: ValidatedEnv
   ): Promise<Response> {
     // Implementation
     return jsonResponse({ data: 'result' });
   }
   ```

3. **Update openapi.yaml** with new endpoint spec

4. **Add tests** in `src/test/`

### Adding New Configuration Options

1. **Add to Env interface (config.ts):**

   ```typescript
   export interface Env {
     NEW_OPTION?: string;
   }
   ```

2. **Validate in env.ts:**

   ```typescript
   const newOption = env.NEW_OPTION || 'default';
   // Validate if needed
   ```

3. **Use in application:**

   ```typescript
   const config = validateEnv(env);
   doSomething(config.newOption);
   ```

4. **Document in README.md** (configuration section)

### Supporting Additional Calendar Formats

Currently supports iCal (VFREEBUSY, VEVENT). To add new formats:

1. **Create new parser module:**

   ```typescript
   // src/src/google-calendar.ts
   export function parseGoogleCalendar(data: string): BusyInterval[] {
     // Parse Google Calendar JSON format
   }
   ```

2. **Add content-type handling:**

   ```typescript
   // worker.ts
   if (contentType.includes('application/json')) {
     busy = parseGoogleCalendar(upstreamData);
   }
   ```

3. **Add tests** for new format

### Adding Webhooks/Notifications

Idea: Notify when calendar is updated.

1. **Create notification module:**

   ```typescript
   // src/src/notify.ts
   export async function sendWebhook(
     url: string,
     payload: unknown
   ): Promise<void> {
     await fetch(url, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(payload),
     });
   }
   ```

2. **Add config option:**

   ```typescript
   WEBHOOK_URL?: string;
   ```

3. **Call after processing:**

   ```typescript
   if (config.webhookUrl && busyIntervals.length > 0) {
     await sendWebhook(config.webhookUrl, {
       message: 'Calendar updated',
       count: busyIntervals.length,
     });
   }
   ```

### Adding Authentication

Currently unauthenticated (relies on CORS). To add auth:

1. **Add API key validation:**

   ```typescript
   // worker.ts
   const apiKey = request.headers.get('X-API-Key');
   if (apiKey !== config.apiKey) {
     return jsonError('unauthorized', 401);
   }
   ```

2. **Or use Cloudflare Access:**

   - Configure in Cloudflare dashboard
   - Add policy for `/freebusy`
   - No code changes needed

## Code Organization Best Practices

### Imports

Always organize imports:

```typescript
// 1. Standard library / Web APIs
// (Usually none for Workers, as globals are available)

// 2. Third-party packages (alphabetical)
import { parse } from 'some-package';

// 3. Local modules (alphabetical)
import { buildWindowV2, mergeIntervals } from './freebusy';
import { parseIcal } from './ical';
import { validateEnv } from './env';
```

### Functions

Keep functions focused and small:

```typescript
// Good - Single responsibility
export function formatUtcIso(date: Date): string {
  return date.toISOString();
}

// Good - Clear purpose
export function isAllowedOrigin(
  origin: string,
  allowlist: string[]
): boolean {
  return allowlist.includes(origin);
}
```

### Type Hints

Use type hints everywhere:

```typescript
export function mergeIntervals(
  intervals: BusyInterval[]
): BusyInterval[] {
  // Implementation
}

export async function enforceRateLimit(
  request: Request,
  env: ValidatedEnv
): Promise<RateLimitDecision> {
  // Implementation
}
```

### Error Handling

Be specific and informative:

```typescript
// Good
try {
  const data = await fetchUpstream(url);
} catch (error) {
  console.error('Upstream fetch failed', {
    origin: redactUrl(url),
    error: error instanceof Error ? error.message : 'Unknown',
  });
  return jsonError('upstream_error', 502);
}
```

## Further Reading

- [Setup Guide](SETUP.md) - Development environment setup
- [Testing Guide](TESTING.md) - Writing and running tests
- [Codecov Guide](CODECOV.md) - Code coverage tracking
- [Style Guide](../../STYLE_GUIDE.md) - Code quality standards
- [Contributing Guide](../../CONTRIBUTING.md) - How to contribute
- [PRD](../PRD.md) - Product requirements

---

Navigation: [Home](../../README.md) | [Contributing](../../CONTRIBUTING.md) | [Setup](SETUP.md) | [Testing](TESTING.md) | [Style Guide](../../STYLE_GUIDE.md)
