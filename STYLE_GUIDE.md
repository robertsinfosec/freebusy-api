# Style Guide

Navigation: [Home](README.md) > [Contributing](CONTRIBUTING.md) > Style Guide

This document defines the coding standards, documentation practices, and best practices for the Freebusy API project.

## Table of Contents

- [1. General Principles](#1-general-principles)
- [2. Project Structure](#2-project-structure)
- [3. TypeScript Standards](#3-typescript-standards)
- [4. Markdown Documentation](#4-markdown-documentation)
- [5. Security Practices](#5-security-practices)
- [6. Testing Standards](#6-testing-standards)
- [7. Git Workflow](#7-git-workflow)
- [8. Code Review Checklist](#8-code-review-checklist)

## 1. General Principles

Core quality standards for all contributions to the Freebusy API project.

### 1.1 Code Quality

Maintain the highest standards in all code:

- **Zero tolerance for technical debt** - Refactor as you go
- **No shortcuts** - Do it right the first time
- **Test everything** - Minimum 80% coverage
- **Document everything** - Code is read more than written
- **Review everything** - No code merges without review

### 1.2 Best Practices

Core development practices to follow:

- **DRY (Don't Repeat Yourself)** - Extract common logic
- **SOLID principles** - Single responsibility, Open/closed, etc.
- **KISS (Keep It Simple)** - Simplest solution that works
- **YAGNI (You Aren't Gonna Need It)** - Don't over-engineer
- **Security First** - Validate inputs, sanitize outputs, protect secrets

## 2. Project Structure

Understanding and maintaining the project organization.

### 2.1 Directory Layout

```
Root: GitHub metadata and documentation
├── README.md              # Project overview
├── CONTRIBUTING.md        # Contribution guidelines
├── STYLE_GUIDE.md        # This file
├── CODE_OF_CONDUCT.md    # Community standards
├── SECURITY.md           # Security policies
├── LICENSE               # License text
└── .gitignore            # Git ignore patterns

src/                      # ALL source code and configuration
├── src/                  # TypeScript source files
│   ├── index.ts         # Worker entrypoint
│   ├── worker.ts        # Main worker logic
│   ├── freebusy.ts      # Window/merge logic
│   ├── ical.ts          # iCal parsing
│   ├── rateLimit.ts     # Rate limiting
│   ├── env.ts           # Environment validation
│   ├── config.ts        # Configuration types
│   ├── http.ts          # HTTP utilities
│   ├── logging.ts       # Logging utilities
│   ├── time.ts          # Time utilities
│   └── version.ts       # Version handling
├── test/                 # Test suite (Vitest)
├── scripts/              # Build/utility scripts
├── coverage/             # Test coverage reports
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
├── vitest.config.ts      # Test config
├── wrangler.toml         # Cloudflare config
└── eslint.config.js      # ESLint config

docs/                     # Documentation
├── PRD.md               # Product requirements
├── openapi.yaml         # API specification
├── dev/                 # Developer docs
│   ├── SETUP.md        # Setup and deployment
│   ├── ARCHITECTURE.md # System architecture
│   ├── TESTING.md      # Testing guide
│   └── CODECOV.md      # Coverage tracking
└── threatmodel/         # Security documentation

.github/                  # GitHub configuration
├── copilot-instructions.md
└── workflows/           # CI/CD workflows
```

### 2.2 File Naming

Naming conventions for different file types:

- **TypeScript modules**: `camelCase.ts` (e.g., `rateLimit.ts`, `freebusy.ts`)
- **Test files**: `*.test.ts` (e.g., `env.test.ts`, `ical.test.ts`)
- **Documentation**: `UPPERCASE.md` for root, `Title_Case.md` for docs/
- **Configuration**: Lowercase with extension (e.g., `wrangler.toml`, `tsconfig.json`)

## 3. TypeScript Standards

All code must follow TypeScript best practices for the Cloudflare Workers runtime.

### 3.1 Runtime and Framework

Target the Cloudflare Workers runtime with strict type safety:

- **TypeScript for all Worker code** - Keep runtime-safe (no implicit any)
- **Target Cloudflare Workers runtime** - Avoid Node-only APIs
- **Keep dependencies minimal** - Prefer standard Web APIs
- **Use WebWorker globals** - See `tsconfig.json` for runtime types

### 3.2 Type Conventions

Maintain strict type safety throughout the codebase:

#### 3.2.1 Type Definitions

```typescript
// Prefer interfaces for object shapes
interface FreebusyConfig {
  windowWeeks: number;
  calendarTimezone: string;
  workingHours: WorkingHours;
}

// Use type aliases for unions and complex types
type ApiErrorCode = 
  | 'misconfigured'
  | 'disabled'
  | 'rate_limited'
  | 'upstream_error'
  | 'forbidden_origin'
  | 'not_found';

// Use unknown at boundaries, narrow before use
function parseResponse(data: unknown): FreebusyResponse {
  if (!isValidResponse(data)) {
    throw new Error('Invalid response');
  }
  return data as FreebusyResponse;
}
```

#### 3.2.2 Date Handling

```typescript
// Use Date objects internally
const now = new Date();
const windowStart = new Date(startMsUtc);

// Emit ISO UTC strings externally
function formatUtcIso(date: Date): string {
  return date.toISOString(); // Ends with 'Z'
}

// Response format
interface BusyInterval {
  start: string; // ISO UTC, e.g., "2026-01-27T10:00:00Z"
  end: string;   // ISO UTC, e.g., "2026-01-27T11:00:00Z"
}
```

### 3.3 Naming Conventions

Consistent naming across the codebase:

```typescript
// Interfaces and types: PascalCase
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

// Functions and variables: camelCase
function buildWindowV2(config: FreebusyConfig): TimeWindow {
  const windowWeeks = config.windowWeeks;
  return calculateWindow(windowWeeks);
}

// Constants: UPPER_SNAKE_CASE
const MAX_UPSTREAM_BYTES = 1_572_864; // 1.5MB
const DEFAULT_CACHE_TTL = 60;

// Private/internal: leading underscore (use sparingly)
function _internalHelper(): void {
  // Implementation
}

// Enums: PascalCase for enum name, UPPER_CASE for values
enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}
```

### 3.4 Import Organization

Organize imports in three sections, alphabetically sorted:

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

### 3.5 Error Handling

Handle errors explicitly and provide meaningful context:

#### 3.5.1 Fail Fast

```typescript
// Good - Fail fast on config errors
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

#### 3.5.2 Explicit Error Codes

```typescript
// Good - Return explicit JSON error codes
function jsonError(code: ApiErrorCode, status: number): Response {
  return new Response(
    JSON.stringify({ error: code }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

// Usage
if (rateLimited) {
  return jsonError('rate_limited', 429);
}

// Bad - Throwing raw errors to callers
if (rateLimited) {
  throw new Error('Rate limited'); // ❌ Don't do this
}
```

### 3.6 Code Organization

Write focused modules with single responsibilities:

#### 3.6.1 Module Structure

```typescript
// Good - Single responsibility, focused module
// freebusy.ts exports only windowing and merging logic
export function buildWindowV2(config: FreebusyConfig): TimeWindow { /* ... */ }
export function mergeIntervals(intervals: BusyInterval[]): BusyInterval[] { /* ... */ }

// Bad - Kitchen sink module with multiple unrelated concerns
// utils.ts exports everything
export function parseIcal() { /* ... */ }  // ❌ Should be in ical.ts
export function hashIp() { /* ... */ }      // ❌ Should be in rateLimit.ts
export function validateEnv() { /* ... */ } // ❌ Should be in env.ts
```

#### 3.6.2 Function Size

Keep functions focused and readable:

```typescript
// Good - Single responsibility, ~20 lines
function parseWorkingHours(json: string): WorkingHours {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid WORKING_HOURS_JSON');
  }
  
  if (!isWorkingHoursShape(parsed)) {
    throw new Error('WORKING_HOURS_JSON has invalid shape');
  }
  
  return parsed;
}

// Bad - Too long, multiple responsibilities
function processEverything(data: unknown) {  // ❌ 100+ line function
  // Parse data
  // Validate data
  // Transform data
  // Merge intervals
  // Format response
  // Apply rate limits
  // Log results
  // This should be split into multiple focused functions!
}
```

#### 3.6.3 Early Returns

Prefer early returns to reduce nesting:

```typescript
// Good - Early returns
function handleRequest(request: Request): Response {
  if (!isAllowedOrigin(request)) {
    return jsonError('forbidden_origin', 403);
  }
  
  if (!config.enabled) {
    return jsonError('disabled', 503);
  }
  
  // Main logic here
  return processRequest(request);
}

// Bad - Deep nesting
function handleRequest(request: Request): Response {
  if (isAllowedOrigin(request)) {
    if (config.enabled) {
      // Main logic deeply nested
      return processRequest(request);
    } else {
      return jsonError('disabled', 503);
    }
  } else {
    return jsonError('forbidden_origin', 403);
  }
}
```

### 3.7 Logging

Use structured logging with redaction for sensitive data:

```typescript
// Good - Structured logs with redaction
console.log('Fetching upstream', {
  origin: redactUrl(upstreamUrl), // Only log origin, not full URL
  cacheHit: false,
});

console.warn('Parse warning', {
  message: sanitizeLogMessage(warning),
});

// Bad - Logging sensitive data
console.log('Fetching', upstreamUrl); // ❌ May contain sensitive path
console.log('IP address', clientIp);  // ❌ Never log raw IPs
console.log('API key', env.API_KEY);  // ❌ Never log secrets
```

## 4. Markdown Documentation

All markdown documentation must follow professional formatting standards for consistency and readability.

### 4.1 Section Headers

Use proper markdown headers, never simulate them with bold text.

#### 4.1.1 Correct Usage

```markdown
### Configuration Options

The following environment variables control application behavior.
```

#### 4.1.2 Incorrect Usage

```markdown
**Configuration Options:**

The following environment variables...
```

> [!IMPORTANT]
> If content is important enough to stand out, it deserves a real header (`###`), not bolded text.

### 4.2 Section Descriptions

Every section header must have at least one sentence explaining what the section contains.

#### 4.2.1 Correct Example

```markdown
### Rate Limiting

The API enforces per-IP and global rate limits using Cloudflare Durable Objects.

| Setting | Default | Description |
|---------|---------|-------------|
...
```

#### 4.2.2 Incorrect Example

```markdown
### Rate Limiting

| Setting | Default | Description |
|---------|---------|-------------|
...
```

> [!IMPORTANT]
> Readers need context before diving into details. Every header must have explanatory text.

### 4.3 Blank Lines

All markdown elements MUST have blank lines above and below them for proper rendering.

#### 4.3.1 Elements Requiring Blank Lines

- Headings
- Code blocks
- Lists
- Tables
- Block quotes
- Admonitions

#### 4.3.2 Correct Example

```markdown
This is a paragraph.

### Heading

This is another paragraph.

```typescript
const example = 'code';
```

And more text.
```

#### 4.3.3 Incorrect Example

```markdown
This is a paragraph.
### Heading
More text with no spacing.
```typescript
code here
```
And more text.
```

> [!IMPORTANT]
> GitHub-Flavored Markdown requires blank lines above and below all structural elements for proper rendering.

### 4.4 No Horizontal Rules

Do NOT use `---` horizontal rules in documentation.

Section headers already create visual separation when rendered. Adding `---` creates unnecessary double lines.

#### 4.4.1 Incorrect Example

```markdown
## Section One

Content here.

---

## Section Two

More content.
```

#### 4.4.2 Correct Example

```markdown
## Section One

Content here.

## Section Two

More content.
```

> [!IMPORTANT]
> Headers provide sufficient visual separation. Horizontal rules create double lines and visual clutter.

### 4.5 No Emoji in Headers

Do NOT use emoji in section headers for professional appearance.

#### 4.5.1 Correct Example

```markdown
### Production Ready

Built for reliable operation in production environments.
```

#### 4.5.2 Incorrect Example

```markdown
### 🐳 Production Ready

Built for reliable operation...
```

> [!IMPORTANT]
> Professional documentation avoids decorative emoji in structural elements like headers.

### 4.6 List Item Descriptors

Bolded list items with colons are acceptable for describing options or examples within content.

#### 4.6.1 Correct Example

```markdown
Configuration requirements:

- **Required:** `FREEBUSY_ICAL_URL` for upstream calendar
- **Optional:** `CACHE_TTL_SECONDS` for caching duration (default: 60)
```

#### 4.6.2 Example Code Usage

```markdown
Run the development server:

```bash
npm --prefix src run dev
```
```

> [!NOTE]
> Bolded descriptors in lists (like `**Required:**`) are content labels, not section headers, and are acceptable.

### 4.7 GitHub Admonitions

Use GitHub-Flavored Markdown admonitions to highlight important information without breaking document flow.

#### 4.7.1 Available Admonition Types

```markdown
> [!NOTE]
> Useful information that users should know.

> [!TIP]
> Helpful advice for doing things better.

> [!IMPORTANT]
> Key information users need to know.

> [!WARNING]
> Urgent info that needs immediate attention.

> [!CAUTION]
> Advises about risks or negative outcomes.
```

> [!TIP]
> Use admonitions to emphasize rules, warnings, or key concepts without adding extra headers.

### 4.8 Code Comments

Explain WHY, not WHAT:

```typescript
// Good - Explain WHY, not WHAT
// Use UTC to avoid timezone issues with DST transitions
const timestamp = new Date().toISOString();

// Hash IPs to comply with privacy policy and GDPR
const hashedIp = await hashIp(clientIp, env.RL_SALT);

// Skip already-removed trailers to avoid re-downloading
if (removedSet.has(trailerId)) {
  continue;
}

// Bad - Stating the obvious
counter += 1;  // ❌ Increment counter
const x = 5;   // ❌ Set x to 5
```

## 5. Security Practices

Security is a first-class concern in all aspects of the codebase.

### 5.1 Never Commit Secrets

Always use environment variables and Wrangler secrets:

```typescript
// Good - Use environment variables
const apiKey = env.TMDB_API_KEY;
const salt = env.RL_SALT;

// Bad - Hardcoded secrets
const apiKey = "abc123...";  // ❌ NEVER!
```

### 5.2 CORS Enforcement

Enforce CORS allowlist early in the request flow:

```typescript
// Good - Check CORS before business logic
export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const config = validateEnv(env);
  
  // CORS check happens first
  if (!isAllowedOrigin(request, config.corsAllowlist)) {
    return jsonError('forbidden_origin', 403);
  }
  
  // Business logic only after CORS validation
  return processRequest(request, config);
}
```

### 5.3 Input Validation

Validate and sanitize all inputs:

```typescript
// Good - Validate environment configuration
export function validateEnv(env: Env): ValidatedEnv {
  const required = [
    'FREEBUSY_ICAL_URL',
    'RL_SALT',
    'CALENDAR_TIMEZONE',
    'WINDOW_WEEKS',
    'WORKING_HOURS_JSON',
    'CORS_ALLOWLIST',
    'RATE_LIMIT_WINDOW_MS',
    'RATE_LIMIT_MAX',
  ];
  
  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }
  
  // Parse and validate complex types
  const workingHours = parseWorkingHours(env.WORKING_HOURS_JSON);
  const corsAllowlist = parseCorsAllowlist(env.CORS_ALLOWLIST);
  
  return { workingHours, corsAllowlist, /* ... */ };
}
```

### 5.4 IP Privacy

Never store or log IP addresses in plaintext:

```typescript
// Good - Hash IPs with salt
async function hashIp(ip: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Usage
const hashedIp = await hashIp(clientIp, env.RL_SALT);

// Bad - Storing raw IPs
const userIp = request.headers.get('CF-Connecting-IP'); // ❌ Don't persist this
await storage.put(userIp, data); // ❌ GDPR violation
```

### 5.5 Security Headers

Maintain strict security headers on all responses:

```typescript
// Always include these headers (from baseHeaders())
const headers = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Vary': 'Origin',
};
```

### 5.6 Upstream Safety

Treat all upstream data as untrusted:

```typescript
// Good - Validate content type and limit size
async function fetchUpstream(url: string, maxBytes: number): Promise<string> {
  const response = await fetch(url);
  
  const contentType = response.headers.get('Content-Type');
  if (!contentType?.includes('text/calendar')) {
    throw new Error('Invalid content type');
  }
  
  // Limit payload size to prevent memory exhaustion
  return await readLimitedText(response, maxBytes);
}
```

## 6. Testing Standards

Maintain comprehensive test coverage with deterministic, reliable tests.

### 6.1 Test Structure

Organize tests with descriptive names:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('buildWindowV2', () => {
  it('returns correct UTC bounds for owner timezone', () => {
    const config = {
      calendarTimezone: 'America/New_York',
      windowWeeks: 2,
      weekStartDay: 1, // Monday
    };
    
    const window = buildWindowV2(config, new Date('2026-01-27T00:00:00Z'));
    
    expect(window.startDate).toBe('2026-01-27');
    expect(window.endDateInclusive).toBe('2026-02-09');
  });
  
  it('handles DST transitions correctly', () => {
    // Test DST edge cases
  });
});
```

### 6.2 Test Coverage

Coverage requirements and best practices:

- **Minimum 80% coverage** for all new code
- **Test both success and failure paths**
- **Mock external dependencies** (HTTP calls, Durable Objects)
- **Use Vitest fixtures** for common test setup
- **Keep tests deterministic** - No actual network calls in unit tests

```typescript
// Good - Mock external dependencies
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/rateLimit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

describe('handleRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });
  
  it('returns 429 when rate limited', async () => {
    const { enforceRateLimit } = await import('../src/rateLimit');
    vi.mocked(enforceRateLimit).mockResolvedValueOnce({ allowed: false });
    
    const { handleRequest } = await import('../src/index');
    const response = await handleRequest(mockRequest, mockEnv);
    
    expect(response.status).toBe(429);
  });
});
```

### 6.3 Contract Testing

Validate responses against OpenAPI spec:

```typescript
// Contract tests ensure API behavior matches openapi.yaml
import { validateResponse } from './openapi-validator';

describe('GET /v2/freebusy', () => {
  it('returns response matching OpenAPI schema', async () => {
    const response = await handleRequest(mockRequest, mockEnv);
    const validation = await validateResponse(response, 'openapi.yaml', '/v2/freebusy');
    
    expect(validation.valid).toBe(true);
  });
});
```

## 7. Git Workflow

Follow consistent Git practices for clarity and traceability.

### 7.1 Commit Messages

Format for commit messages:

```
type: Short description (50 chars max)

Longer explanation if needed (wrap at 72 chars).
Explain WHY the change was made, not what was changed
(the diff shows what changed).

- Bullet points are okay
- Reference issues: Fixes #123, Related to #456
```

#### 7.1.1 Commit Types

Available commit types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `test`: Adding/updating tests
- `refactor`: Code restructuring (no functional changes)
- `style`: Formatting, whitespace
- `chore`: Maintenance (dependencies, CI, etc.)
- `perf`: Performance improvement
- `security`: Security-related changes

#### 7.1.2 Commit Examples

Example commit messages:

```
feat: Add global rate limiting support

Implements global rate limiting across all IPs in addition
to per-IP limits. Useful for protecting against distributed
attacks or excessive legitimate traffic.

Adds RATE_LIMIT_GLOBAL_WINDOW_MS and RATE_LIMIT_GLOBAL_MAX
environment variables.

Fixes #45
```

```
fix: Handle missing TZID in floating iCal events

Some iCal files use floating times without TZID. Now falls
back to CALENDAR_TIMEZONE for interpretation instead of
treating as UTC, which caused incorrect busy intervals.

Fixes #67
```

```
security: Hash IPs before rate limit storage

Store SHA-256 hashed IPs instead of plaintext to comply
with privacy policies and GDPR requirements.

Related to #89
```

### 7.2 Branch Naming

Naming convention for branches:

```
feature/add-global-rate-limits
fix/floating-time-parsing
docs/update-api-examples
refactor/extract-time-utilities
security/hash-ip-addresses
```

### 7.3 Pull Requests

PR best practices:

- **Small, focused PRs** - One feature or fix per PR
- **Tests included** - All new code must have tests
- **Documentation updated** - Update README, PRD, or ARCHITECTURE if behavior changes
- **Security rationale** - Explain security-impacting changes
- **CI must pass** - All lint, type checks, and tests must pass

## 8. Code Review Checklist

Before submitting code for review:

- [ ] Follows TypeScript best practices
- [ ] Has proper type annotations (no implicit `any`)
- [ ] No hardcoded values (use config/constants)
- [ ] Error handling is appropriate and explicit
- [ ] Logging uses structured format, no sensitive data
- [ ] Tests are included and pass (≥80% coverage)
- [ ] Documentation is updated (README, PRD, ARCHITECTURE, openapi.yaml)
- [ ] No secrets or sensitive data committed
- [ ] Security headers maintained
- [ ] CORS enforcement intact
- [ ] Markdown follows style guide (blank lines, no HRs, real headers)
- [ ] Git commit messages follow format
- [ ] CI passes (lint, typecheck, tests)

## 9. Tools and Automation

Tools that help maintain code quality:

### 9.1 Recommended Tools

- **ESLint**: Linting for TypeScript
- **Vitest**: Testing framework
- **Wrangler**: Cloudflare Workers CLI
- **npm scripts**: Automation (see `package.json`)

### 9.2 Running Checks

Commands for code quality checks:

```bash
# Type check
npm --prefix src run check

# Lint
npm --prefix src run lint

# Test
npm --prefix src test

# Coverage
npm --prefix src run test:coverage

# Dev server
npm --prefix src run dev

# Deploy
npm --prefix src run deploy
```

## Questions?

When in doubt, follow this hierarchy:

1. Check this style guide
2. Look at existing code for patterns
3. Ask in PR review
4. Reference TypeScript docs: https://www.typescriptlang.org/docs/
5. Reference Cloudflare Workers docs: https://developers.cloudflare.com/workers/

Remember: **Quality over speed. Security first. Do it right the first time.**
