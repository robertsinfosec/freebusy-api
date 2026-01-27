# Contributing

Thanks for helping improve freebusy-api!

## Getting Started

Before contributing, please review:

- [Setup Guide](docs/dev/SETUP.md) - Detailed environment setup and development workflow
- [Architecture](docs/dev/ARCHITECTURE.md) - Technical design and key patterns
- [Testing Guide](docs/dev/TESTING.md) - Writing and running tests
- [Style Guide](STYLE_GUIDE.md) - Code and documentation standards

## Quick Start

### Development Setup

Prereqs: Node.js 20+ and npm.

From repo root:

```bash
# Install dependencies
npm --prefix src install

# Create local secrets file
cp src/.env.example src/.env
# Edit src/.env with non-production values

# Start dev server
npm --prefix src run dev
# Visit http://localhost:8787
```

### Common Commands

```bash
# Type checking
npm --prefix src run check

# Run tests
npm --prefix src test

# Coverage report
npm --prefix src run test:coverage

# Lint code
npm --prefix src run lint
```

For detailed setup instructions, see the [Setup Guide](docs/dev/SETUP.md).

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
The build/dev/deploy scripts generate `src/src/version.generated.ts`.
- Don’t hand-edit these files.
- In most cases, don’t include version bumps in PRs unless the change explicitly requires it.

## Change Management

### Pull Request Guidelines

- **Keep PRs small and focused** - One logical change per PR
- **Provide context** - Include rationale and security implications
- **Update documentation** - Keep [openapi.yaml](docs/openapi.yaml), [PRD](docs/PRD.md), and [Architecture](docs/dev/ARCHITECTURE.md) in sync with behavior changes
- **Add tests** - All behavior changes must include tests (minimum 80% coverage)
- **Run CI checks locally** - Ensure tests, type check, and linting pass before pushing

### Pre-Commit Checklist

Before committing code:

- [ ] Tests pass: `npm --prefix src test`
- [ ] Type check passes: `npm --prefix src run check`
- [ ] Linting passes: `npm --prefix src run lint`
- [ ] Coverage ≥80%: `npm --prefix src run test:coverage`
- [ ] Documentation updated (if behavior changed)
- [ ] [openapi.yaml](docs/openapi.yaml) reflects API changes (if applicable)

### Review Process

All PRs must:

1. Pass all CI checks (tests, type check, linting, CodeQL)
2. Maintain or improve code coverage (no coverage decreases)
3. Have clear commit messages following [Git workflow](STYLE_GUIDE.md#7-git-workflow)
4. Be reviewed and approved before merging

## Code Quality Standards

This project follows a **zero technical debt** philosophy:

- Refactor as you go, never leave TODO comments without GitHub issues
- No shortcuts - do it right the first time
- Test everything - minimum 80% coverage required
- Document everything - code is read more than written
- Security first - validate inputs, sanitize outputs, protect secrets

See [Style Guide](STYLE_GUIDE.md) for comprehensive coding standards.

## Security Considerations

When contributing, always consider:

- **Input validation** - Never trust user input
- **Secret management** - Never log or commit secrets
- **CORS enforcement** - Maintain strict origin allowlist
- **Rate limiting** - Consider abuse scenarios
- **Logging** - Sanitize and redact sensitive data

See [Security Policy](SECURITY.md) for reporting vulnerabilities.
