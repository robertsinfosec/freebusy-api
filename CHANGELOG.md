# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v26.127.1400] - 2026-01-27

### Added

- Developer documentation structure in `docs/dev/`
- Comprehensive setup guide ([docs/dev/SETUP.md](docs/dev/SETUP.md))
- Architecture documentation ([docs/dev/ARCHITECTURE.md](docs/dev/ARCHITECTURE.md))
- Testing guide ([docs/dev/TESTING.md](docs/dev/TESTING.md))
- Codecov integration guide ([docs/dev/CODECOV.md](docs/dev/CODECOV.md))
- Separate security scanning workflow ([.github/workflows/security.yml](.github/workflows/security.yml))
- Scheduled Dependabot runs synchronized with security scans (Mondays 6:45 AM UTC)
- Script to automate processing of GitHub Advanced Security PRs
- Repobeats analytics image to README

### Changed

- Reorganized documentation: separated user-facing from developer-facing content
- Enhanced README.md with deployment, rate limiting, CORS, and health check sections
- Updated CONTRIBUTING.md with developer docs references and change management guidelines
- Consolidated CI workflows: merged CodeQL into main CI workflow
- Updated PRD.md with expanded future enhancements roadmap
- Updated devcontainer name to reflect project context
- Enhanced PR merging process with signed commits and timeout handling

### Removed

- RUNBOOK.md (content distributed to README, SETUP.md, CONTRIBUTING.md, PRD.md)
- Separate CodeQL workflow (now part of ci.yml)
- Duplicate CodeQL badges from README

### Security

- Updated @vitest/coverage-v8 from 4.0.16 to 4.0.18
- Updated vitest from 4.0.16 to 4.0.18
- Updated typescript-eslint from 8.52.0 to 8.54.0
- Updated globals from 17.0.0 to 17.2.0
- Updated @cloudflare/workers-types to latest version
- Updated wrangler from 4.54.0 to 4.61.0

## [v26.106.1245] - 2026-01-06

### Changed

- Updated versioning format and scripts
- Removed version.txt generation in favor of generated TypeScript file

## [v26.106.1010] - 2026-01-06

### Changed

- Merged dependency updates from Dependabot

### Security

- Updated typescript-eslint from 8.51.0 to 8.52.0
- Updated @cloudflare/workers-types to 4.20260103.0
- Updated globals from 16.5.0 to 17.0.0
- Updated actions/upload-artifact from 4 to 6
- Updated actions/setup-node from 4 to 6
- Updated actions/checkout from 4 to 6
- Updated github/codeql-action from 3 to 4

## [v25.1231.0134] - 2025-12-31

### Fixed

- Updated Node.js version requirements to v20+ in package.json and ci.yml
- Updated getZonedParts to use hourCycle for 24-hour format
- Updated security reporting links in documentation
- Updated CI environment variables and adjusted coverage thresholds in vitest configuration

## [1.0.0] - 2025-12-30

Initial production release.

### Added

- Core `/freebusy` endpoint with timezone-aware window calculations
- `/health` endpoint for liveness checks
- CORS enforcement with allowlist configuration
- Durable Object-backed rate limiting (hashed IPs)
- Support for VFREEBUSY and VEVENT parsing from iCal feeds
- Working hours schedule support
- Feature flag (`FREEBUSY_ENABLED`) for emergency disable
- Comprehensive threat model template
- Dependabot configuration for automated dependency updates
- Build versioning system with version tracking in responses
- OpenAPI specification (docs/openapi.yaml)
- Comprehensive test suite with Vitest
- GitHub Actions CI/CD workflows
- CodeQL security scanning
- Codecov integration for coverage tracking

### Security

- Strict response headers (CSP, X-Content-Type-Options, Cache-Control)
- IP address hashing with salt (no plaintext storage)
- Upstream payload size limits (1.5MB default)
- Secret redaction in logs
- HTTPS-only upstream feeds
- No raw calendar data exposure

[Unreleased]: https://github.com/robertsinfosec/freebusy-api/compare/v26.127.1400...HEAD
[v26.127.1400]: https://github.com/robertsinfosec/freebusy-api/compare/v26.106.1245...v26.127.1400
[v26.106.1245]: https://github.com/robertsinfosec/freebusy-api/compare/v26.106.1010...v26.106.1245
[v26.106.1010]: https://github.com/robertsinfosec/freebusy-api/compare/v25.1231.0134...v26.106.1010
[v25.1231.0134]: https://github.com/robertsinfosec/freebusy-api/compare/dbbd807...v25.1231.0134
[1.0.0]: https://github.com/robertsinfosec/freebusy-api/releases/tag/v25.1231.0134
