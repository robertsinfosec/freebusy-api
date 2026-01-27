# Testing Guide

Navigation: [Home](../../README.md) | [Contributing](../../CONTRIBUTING.md) | [Setup](SETUP.md) | [Architecture](ARCHITECTURE.md) | [Codecov](CODECOV.md)

Complete guide for writing and running tests in the Freebusy API.

## Table of Contents

- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Code Coverage](#code-coverage)
- [Test Organization](#test-organization)
- [Best Practices](#best-practices)
- [Continuous Integration](#continuous-integration)
- [Troubleshooting](#troubleshooting)

## Running Tests

### Quick Test Run

```bash
# From repo root
npm --prefix src test

# Or from src/ directory
cd src/
npm test
```

### With Coverage

```bash
# From repo root
npm --prefix src run test:coverage

# Or from src/
cd src/
npm run test:coverage
```

### Generate HTML Coverage Report

```bash
cd src/
npm run test:coverage

# Open HTML report
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

### Run Specific Tests

```bash
# Single test file
npm test -- env.test.ts

# Test matching pattern
npm test -- freebusy

# Watch mode (re-run on file changes)
npm test -- --watch

# Verbose output
npm test -- --reporter=verbose

# Run tests in UI mode
npm test -- --ui
```

### Common Test Commands

```bash
# Type check first, then test
npm run check && npm test

# Lint, type check, and test
npm run lint && npm run check && npm test

# Coverage with minimum threshold check
npm run test:coverage
```

## Writing Tests

### Test File Structure

```
src/test/
├── env.test.ts              # Environment validation tests
├── freebusy.test.ts         # Window/merge logic tests
├── ical.test.ts             # iCal parsing tests
├── index.test.ts            # Worker handler tests
├── rateLimit.test.ts        # Rate limiting tests
├── security.test.ts         # Security headers/CORS tests
├── time.test.ts             # Time utility tests
├── version.test.ts          # Version handling tests
└── openapi.contract.test.ts # Contract tests (OpenAPI validation)
```

### Basic Test Pattern

```typescript
import { describe, it, expect } from 'vitest';
import { mergeIntervals } from '../src/freebusy';

describe('mergeIntervals', () => {
  it('merges overlapping intervals', () => {
    const intervals = [
      { start: '2026-01-27T10:00:00Z', end: '2026-01-27T11:00:00Z', kind: 'time' as const },
      { start: '2026-01-27T10:30:00Z', end: '2026-01-27T12:00:00Z', kind: 'time' as const },
    ];
    
    const result = mergeIntervals(intervals);
    
    expect(result).toHaveLength(1);
    expect(result[0].start).toBe('2026-01-27T10:00:00Z');
    expect(result[0].end).toBe('2026-01-27T12:00:00Z');
  });
});
```

### Using Fixtures and Setup

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('parseIcal', () => {
  let sampleIcal: string;
  
  beforeEach(() => {
    // Setup before each test
    sampleIcal = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VFREEBUSY
DTSTART:20260127T100000Z
DTEND:20260127T110000Z
END:VFREEBUSY
END:VCALENDAR`;
  });
  
  afterEach(() => {
    // Cleanup after each test (if needed)
  });
  
  it('parses VFREEBUSY blocks', () => {
    const result = parseIcal(sampleIcal);
    expect(result).toHaveLength(1);
  });
});
```

### Mocking External Dependencies

Mock `fetch` for upstream calls:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('fetchUpstream', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
  });
  
  it('fetches upstream iCal feed', async () => {
    // Mock global fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/calendar' }),
      text: () => Promise.resolve('BEGIN:VCALENDAR...'),
    });
    
    const result = await fetchUpstream('https://example.com/cal.ics');
    
    expect(global.fetch).toHaveBeenCalledWith('https://example.com/cal.ics');
    expect(result).toContain('BEGIN:VCALENDAR');
  });
});
```

Mock modules:

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock the rateLimit module
vi.mock('../src/rateLimit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

describe('handleRequest', () => {
  it('allows request when not rate limited', async () => {
    const { enforceRateLimit } = await import('../src/rateLimit');
    const { handleRequest } = await import('../src/worker');
    
    const response = await handleRequest(mockRequest, mockEnv, mockCtx);
    
    expect(enforceRateLimit).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });
});
```

### Testing Error Conditions

```typescript
import { describe, it, expect } from 'vitest';

describe('validateEnv', () => {
  it('throws when FREEBUSY_ICAL_URL is missing', () => {
    const invalidEnv = {} as Env;
    
    expect(() => validateEnv(invalidEnv)).toThrow('FREEBUSY_ICAL_URL is required');
  });
  
  it('throws when RL_SALT is missing', () => {
    const invalidEnv = {
      FREEBUSY_ICAL_URL: 'https://example.com/cal.ics',
    } as Env;
    
    expect(() => validateEnv(invalidEnv)).toThrow('RL_SALT is required');
  });
});
```

### Parametrized Tests

Test multiple inputs with `it.each`:

```typescript
import { describe, it, expect } from 'vitest';

describe('sanitizeLogMessage', () => {
  it.each([
    ['Normal message', 'Normal message'],
    ['Message with\nnewline', 'Message with newline'],
    ['Very long message'.repeat(100), expect.stringMatching(/^Very long/)],
  ])('sanitizes: %s', (input, expected) => {
    const result = sanitizeLogMessage(input);
    
    if (typeof expected === 'string') {
      expect(result).toBe(expected);
    } else {
      expect(result).toEqual(expected);
    }
  });
});
```

### Testing Worker Handlers

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Worker /freebusy endpoint', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });
  
  it('returns 403 for disallowed origin', async () => {
    const request = new Request('http://localhost:8787/freebusy', {
      headers: { Origin: 'https://evil.com' },
    });
    
    const mockEnv = {
      CORS_ALLOWLIST: 'http://localhost:3000',
      // ... other required env vars
    };
    
    const { handleRequest } = await import('../src/worker');
    const response = await handleRequest(request, mockEnv, {} as ExecutionContext);
    
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe('forbidden_origin');
  });
  
  it('returns 429 when rate limited', async () => {
    // Mock enforceRateLimit to return denied
    vi.mock('../src/rateLimit', () => ({
      enforceRateLimit: vi.fn().mockResolvedValue({ allowed: false }),
    }));
    
    const request = new Request('http://localhost:8787/freebusy', {
      headers: { Origin: 'http://localhost:3000' },
    });
    
    const { handleRequest } = await import('../src/worker');
    const response = await handleRequest(request, mockEnv, mockCtx);
    
    expect(response.status).toBe(429);
  });
});
```

### Contract Testing (OpenAPI Validation)

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'yaml';

describe('OpenAPI Contract', () => {
  const openApiSpec = parse(
    readFileSync(resolve(__dirname, '../../docs/openapi.yaml'), 'utf-8')
  );
  
  it('GET /freebusy response matches schema', async () => {
    const response = await handleFreebusyRequest(mockRequest, mockEnv);
    const json = await response.json();
    
    // Validate structure matches OpenAPI schema
    expect(json).toHaveProperty('version');
    expect(json).toHaveProperty('generatedAtUtc');
    expect(json).toHaveProperty('calendar');
    expect(json).toHaveProperty('window');
    expect(json).toHaveProperty('workingHours');
    expect(json).toHaveProperty('busy');
    expect(json).toHaveProperty('rateLimit');
    
    // Validate types
    expect(typeof json.version).toBe('string');
    expect(Array.isArray(json.busy)).toBe(true);
  });
});
```

## Code Coverage

### Understanding Coverage

Coverage measures what percentage of your code is executed during tests. Higher coverage generally means better tested code.

Coverage is tracked via:

- **Terminal reports** (run locally)
- **HTML reports** (browse locally)
- **LCOV reports** (uploaded to Codecov)
- **Codecov dashboard** (online, with trends)

### Viewing Coverage Locally

```bash
cd src/

# Terminal summary
npm run test:coverage

# HTML (interactive, most detailed)
npm run test:coverage
open coverage/index.html
```

### Coverage Badge

The README shows current coverage via Codecov badge:

[![codecov](https://codecov.io/gh/robertsinfosec/freebusy-api/branch/main/graph/badge.svg)](https://codecov.io/gh/robertsinfosec/freebusy-api)

Always refer to the live badge or Codecov dashboard for current numbers.

### Coverage Goals

- **Target:** 80% overall coverage (per PRD)
- **Minimum:** No PR should decrease coverage
- **New code:** Should be ≥80% covered

Check current coverage:

- Visit [Codecov Dashboard](https://codecov.io/gh/robertsinfosec/freebusy-api)
- Click on branch or PR to see detailed breakdown

### Improving Coverage

1. **Identify gaps:**

   ```bash
   npm run test:coverage
   open coverage/index.html
   ```

2. **Focus on red/yellow files:**
   - Red = <60% coverage (priority)
   - Yellow = 60-79% coverage (needs work)
   - Green = 80-100% coverage (good!)

3. **Write tests for uncovered code:**
   - Look at "missing lines" in HTML report
   - Write tests that execute those lines
   - Verify with another coverage run

4. **Don't game coverage:**
   - Tests must have meaningful assertions
   - Cover both success and error paths
   - Test edge cases, not just happy path

See [Codecov Guide](CODECOV.md) for detailed coverage tracking setup.

## Test Organization

### Directory Structure

```
src/
├── src/                    # Source code
│   ├── index.ts
│   ├── worker.ts
│   ├── freebusy.ts
│   └── ...
└── test/                   # Test suite
    ├── env.test.ts        # Tests for env.ts
    ├── freebusy.test.ts   # Tests for freebusy.ts
    └── ...
```

### Naming Conventions

- **Test files:** `*.test.ts`
- **Test suites:** `describe('moduleName', ...)`
- **Test cases:** `it('does something specific', ...)`
- **Descriptive names:** Use clear, action-oriented descriptions

### Co-locating Tests

Tests are in `src/test/` directory, matching source structure:

- `src/src/freebusy.ts` → `src/test/freebusy.test.ts`
- `src/src/ical.ts` → `src/test/ical.test.ts`
- `src/src/env.ts` → `src/test/env.test.ts`

## Best Practices

### 1. One Concept Per Test

❌ **Bad:** Testing multiple things in one test

```typescript
it('does everything', () => {
  const result1 = function1();
  expect(result1).toBe(expected1);
  const result2 = function2();
  expect(result2).toBe(expected2);
});
```

✅ **Good:** Separate tests for each concept

```typescript
it('function1 returns expected value', () => {
  const result = function1();
  expect(result).toBe(expected);
});

it('function2 returns expected value', () => {
  const result = function2();
  expect(result).toBe(expected);
});
```

### 2. Descriptive Test Names

❌ **Bad:** Vague names

```typescript
it('works', () => ...);
it('handles error', () => ...);
```

✅ **Good:** Clear, descriptive names

```typescript
it('returns busy intervals for valid iCal feed', () => ...);
it('throws error when FREEBUSY_ICAL_URL is missing', () => ...);
it('merges overlapping time intervals correctly', () => ...);
```

### 3. Arrange-Act-Assert Pattern

```typescript
it('clips intervals to window bounds', () => {
  // Arrange: Set up test data
  const intervals = [
    { start: '2026-01-27T08:00:00Z', end: '2026-01-27T18:00:00Z', kind: 'time' as const },
  ];
  const window = {
    startUtc: new Date('2026-01-27T10:00:00Z').getTime(),
    endUtcExclusive: new Date('2026-01-27T16:00:00Z').getTime(),
  };
  
  // Act: Execute function being tested
  const result = clipToWindow(intervals, window);
  
  // Assert: Verify expected outcome
  expect(result).toHaveLength(1);
  expect(result[0].start).toBe('2026-01-27T10:00:00Z');
  expect(result[0].end).toBe('2026-01-27T16:00:00Z');
});
```

### 4. Mock External Dependencies

Always mock:

- HTTP requests (use `vi.fn()` for global `fetch`)
- Durable Object calls
- External processes
- Time/dates (use fixed dates in tests)
- Random values

### 5. Test Both Success and Failure

```typescript
describe('parseIcal', () => {
  it('parses valid iCal feed', () => {
    const result = parseIcal(validIcal);
    expect(result).toHaveLength(1);
  });
  
  it('handles malformed iCal gracefully', () => {
    const result = parseIcal('INVALID');
    expect(result).toEqual([]);
  });
  
  it('handles missing timezone', () => {
    const result = parseIcal(icalWithoutTz);
    expect(result).toBeDefined();
  });
});
```

### 6. Keep Tests Fast

- Mock slow operations (network, external services)
- Use fixed dates instead of `new Date()`
- Avoid `setTimeout()` in tests
- Keep test data minimal

### 7. Avoid Test Interdependence

Each test should be independent and runnable in any order:

```typescript
// Good - Each test is self-contained
it('test A', () => {
  const data = setupData();
  expect(processData(data)).toBe(expected);
});

it('test B', () => {
  const data = setupData();
  expect(processData(data)).toBe(expected);
});
```

## Continuous Integration

### GitHub Actions

Every push and PR triggers automated testing via GitHub Actions.

Workflow: `.github/workflows/ci.yml`

What happens:

1. Checkout code
2. Set up Node.js
3. Install dependencies
4. Run type check (`npm run check`)
5. Run linting (`npm run lint`)
6. Run tests with coverage (`npm run test:coverage`)
7. Upload coverage to Codecov
8. Upload coverage artifacts

### Viewing CI Results

On GitHub:

1. Go to **Actions** tab
2. Click on workflow run
3. Expand "Unit tests + coverage" step
4. View test results and coverage report

On Codecov:

1. Visit [Codecov Dashboard](https://codecov.io/gh/robertsinfosec/freebusy-api)
2. Click on commit or PR
3. View detailed coverage breakdown

### PR Requirements

Before merging:

- ✅ All tests must pass
- ✅ Coverage must not decrease
- ✅ Type check must pass
- ✅ Linting must pass
- ✅ All checks must be green

## Troubleshooting

### Tests Failing Locally

**Check you're in the right directory:**

```bash
cd src/
npm test
```

**Clear Vitest cache:**

```bash
rm -rf node_modules/.vite
npm test
```

**Reinstall dependencies:**

```bash
rm -rf node_modules package-lock.json
npm install
npm test
```

### Import Errors

**Ensure TypeScript is configured:**

```bash
cat tsconfig.json  # Verify config exists
npm run check      # Type check
```

**Check Node version:**

```bash
node --version  # Should be 20+
```

### Coverage Report Not Generating

**Install dependencies:**

```bash
npm install --save-dev @vitest/coverage-v8
```

**Check vitest.config.ts:**

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
```

### Mock Not Working

**Ensure correct import path:**

```typescript
// If module does: import { foo } from './module'
vi.mock('../src/module', () => ({
  foo: vi.fn(),
}));
```

**Reset mocks between tests:**

```typescript
beforeEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});
```

### Tests Pass Locally, Fail in CI

Common causes:

- **Timezone differences** - Use UTC in tests
- **File path differences** - Use relative paths
- **Environment variables** - Mock env in tests
- **Different Node versions** - Check CI uses same version

Debug CI:

```yaml
# Add to workflow for debugging
- name: Debug environment
  run: |
    pwd
    ls -la
    node --version
    npm --version
```

## Pre-Commit Checklist

Before committing code:

- [ ] Run tests: `npm test`
- [ ] Check coverage: `npm run test:coverage`
- [ ] Type check: `npm run check`
- [ ] Lint code: `npm run lint`
- [ ] All tests pass locally
- [ ] Added tests for new code
- [ ] Updated docs if behavior changed

## Additional Resources

- Vitest Documentation: https://vitest.dev/
- Cloudflare Workers Testing: https://developers.cloudflare.com/workers/testing/
- TypeScript Testing: https://www.typescriptlang.org/docs/handbook/testing.html

---

Navigation: [Home](../../README.md) | [Contributing](../../CONTRIBUTING.md) | [Setup](SETUP.md) | [Architecture](ARCHITECTURE.md) | [Codecov](CODECOV.md)
