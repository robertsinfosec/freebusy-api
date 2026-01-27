# Codecov Integration

Navigation: [Home](../../README.md) | [Contributing](../../CONTRIBUTING.md) | [Setup](SETUP.md) | [Architecture](ARCHITECTURE.md) | [Testing](TESTING.md)

Guide to understanding and using Codecov for code coverage tracking.

## Table of Contents

- [What is Codecov?](#what-is-codecov)
- [Setup](#setup)
- [Viewing Coverage](#viewing-coverage)
- [Configuration](#configuration)
- [Local Coverage Workflow](#local-coverage-workflow)
- [CI/CD Integration](#cicd-integration)
- [Understanding Reports](#understanding-reports)
- [Badge Setup](#badge-setup)
- [Pull Request Comments](#pull-request-comments)
- [Troubleshooting](#troubleshooting)

## What is Codecov?

Codecov is a service that tracks code coverage metrics over time. It integrates with GitHub to:

- Show coverage trends across commits
- Comment on PRs with coverage changes
- Display coverage badges
- Identify uncovered code in diffs
- Track coverage by component/module

### Why Use Codecov?

- **Visibility:** See coverage at a glance with badges
- **PR feedback:** Automatic comments show coverage impact
- **Trend tracking:** Monitor coverage over time
- **Team accountability:** Everyone sees coverage goals
- **Quality gates:** Block PRs that reduce coverage

## Setup

### 1. Link GitHub Repository

Codecov automatically detects GitHub repositories. When you first push coverage data, Codecov creates a project.

If not automatic:

1. Go to https://codecov.io/
2. Sign in with GitHub
3. Add repository: `robertsinfosec/freebusy-api`

### 2. Get Upload Token

For public repos, no token required. For private repos:

1. Visit https://codecov.io/gh/robertsinfosec/freebusy-api
2. Navigate to **Settings** → **General**
3. Copy **Repository Upload Token**
4. Add to GitHub Secrets as `CODECOV_TOKEN`

### 3. Configure GitHub Actions

Already configured in `.github/workflows/ci.yml`:

```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: ./src/coverage/lcov.info
    flags: unittests
    name: codecov-umbrella
    fail_ci_if_error: true
    token: ${{ secrets.CODECOV_TOKEN }}
```

### 4. Enable GitHub App (Optional)

For PR comments and status checks:

1. Visit https://github.com/apps/codecov
2. Click **Install**
3. Select `robertsinfosec/freebusy-api`
4. Grant permissions

## Viewing Coverage

### Codecov Dashboard

Visit: https://codecov.io/gh/robertsinfosec/freebusy-api

Dashboard shows:

- **Overall coverage percentage** (current)
- **Coverage trend graph** (over time)
- **Recent commits** with coverage changes
- **File browser** showing coverage by file
- **Pull requests** with coverage diffs

### Coverage by Commit

1. Go to **Commits** tab
2. Click any commit
3. View:
   - Coverage percentage
   - Files changed
   - Coverage diff (+/- %)
   - Uncovered lines highlighted

### Coverage by Pull Request

1. Go to **Pulls** tab
2. Select PR
3. View:
   - Coverage change (e.g., `-0.5%`)
   - Files affected
   - New uncovered lines
   - Coverage sunburst diagram

### File-Level Coverage

1. Go to **Files** tab
2. Click file name
3. View:
   - Line-by-line coverage
   - Green = covered
   - Red = not covered
   - Partial coverage highlighted

## Configuration

### codecov.yml

Configuration file (if needed): `codecov.yml` in repo root.

Example minimal config:

```yaml
coverage:
  status:
    project:
      default:
        target: 80%          # Coverage target
        threshold: 1%        # Allow 1% drop
    patch:
      default:
        target: 80%          # New code must be 80% covered

comment:
  layout: "reach, diff, flags, files"
  behavior: default
  require_changes: false

ignore:
  - "src/scripts/**"
  - "src/coverage/**"
```

For this project, default settings work well. Add `codecov.yml` only if customization is needed.

### Coverage Targets

Current goals (from PRD):

- **Overall:** 80% minimum
- **New code:** 80% minimum
- **Patch coverage:** 80% for PR diffs

Codecov enforces these via status checks.

## Local Coverage Workflow

### 1. Run Tests with Coverage

```bash
cd src/
npm run test:coverage
```

### 2. View Terminal Report

Immediate summary in terminal:

```
File                | % Stmts | % Branch | % Funcs | % Lines | Uncovered Lines
--------------------|---------|----------|---------|---------|------------------
All files           |   85.23 |    78.45 |   90.12 |   85.67 |
 src/freebusy.ts    |   92.34 |    85.67 |   95.23 |   92.89 | 45-47,102
 src/ical.ts        |   78.45 |    65.34 |   82.12 |   79.12 | 23,56-59,89
 ...
```

### 3. Open HTML Report

```bash
open coverage/index.html
```

Interactive browser view:

- Click file names to see line coverage
- Red lines = not covered
- Green lines = covered
- Yellow lines = partially covered

### 4. Identify Gaps

Look for:

- Red/yellow files (low coverage)
- Specific uncovered lines
- Missing branch coverage
- Untested error paths

### 5. Write Missing Tests

Add tests for uncovered code, then re-run:

```bash
npm test
npm run test:coverage
```

### 6. Verify Improvement

Compare new coverage percentage to previous run.

## CI/CD Integration

### Automated Upload

Every push/PR triggers:

1. Run tests with coverage
2. Generate `lcov.info` report
3. Upload to Codecov
4. Codecov processes report
5. Posts PR comment (if configured)
6. Updates status check

### Viewing CI Results

**In GitHub Actions:**

1. Go to **Actions** tab
2. Click workflow run
3. Expand "Upload coverage to Codecov" step
4. See upload confirmation

**In Codecov:**

1. Visit dashboard
2. Check recent commits
3. View coverage for that commit

## Understanding Reports

### Coverage Metrics

- **% Stmts:** Percentage of statements executed
- **% Branch:** Percentage of if/else branches tested
- **% Funcs:** Percentage of functions called
- **% Lines:** Percentage of lines executed

### Color Coding

- **Green (≥80%):** Good coverage
- **Yellow (60-79%):** Needs improvement
- **Red (<60%):** Priority for testing

### Coverage Diff

Shows coverage change from base branch:

- `+2.5%` = Coverage increased
- `-1.3%` = Coverage decreased
- `0.0%` = No change

### Sunburst Diagram

Visual representation of coverage by module:

- **Inner ring:** Top-level directories
- **Outer rings:** Nested files
- **Color:** Coverage level (red/yellow/green)
- **Size:** Relative file size

Click segments to drill down.

## Badge Setup

### Adding Badge to README

Badge already in README.md:

```markdown
[![codecov](https://codecov.io/gh/robertsinfosec/freebusy-api/branch/main/graph/badge.svg)](https://codecov.io/gh/robertsinfosec/freebusy-api)
```

Shows current coverage percentage on `main` branch.

### Badge Customization

Get custom badge URL from Codecov:

1. Visit dashboard
2. Go to **Settings** → **Badge**
3. Copy markdown or URL
4. Customize with query parameters:
   - `?flag=unittests` - Filter by flag
   - `?token=<token>` - For private repos

### Badge Updates

Badge auto-updates after each coverage upload. No manual refresh needed.

## Pull Request Comments

### Enabling PR Comments

Automatic if Codecov GitHub App is installed.

Comment includes:

- Coverage change (e.g., `-0.5%`)
- Diff coverage (new code coverage %)
- File-by-file breakdown
- Link to full report

### Example Comment

```
## Codecov Report
Coverage: 85.23% (+0.45%) from main

| Files Changed | Coverage Δ | Complexity Δ |
|---------------|------------|--------------|
| freebusy.ts   | 92.34% (+2.1%) | 12 (+1) |
| ical.ts       | 78.45% (-0.3%) | 8 (ø) |

📣 View full report at Codecov
```

### Interpreting Comments

- **Coverage Δ:** Change from base branch
- **Patch coverage:** Coverage of lines changed in PR
- **Project coverage:** Overall coverage after merge
- **Status:** ✅ Pass / ❌ Fail based on targets

## Troubleshooting

### Coverage Not Uploading

**Check CI logs:**

```bash
# In GitHub Actions
# Expand "Upload coverage to Codecov" step
# Look for errors
```

**Common issues:**

- Missing `lcov.info` file
- Wrong file path in workflow
- Token expired (private repos)
- Network timeout

**Fix:**

```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: ./src/coverage/lcov.info  # Verify path
    fail_ci_if_error: true            # Fail if upload fails
    verbose: true                     # More logging
```

### No PR Comments

**Ensure GitHub App is installed:**

1. Visit https://github.com/apps/codecov
2. Check if installed on repository
3. Verify permissions granted

**Check Codecov settings:**

1. Go to dashboard → **Settings** → **General**
2. Enable "Pull Request Comments"
3. Save changes

### Coverage Lower Than Expected

**Local coverage differs from CI:**

- Ensure same Node version
- Check for skipped tests (`.skip()`)
- Verify coverage config in `vitest.config.ts`

**View missing coverage:**

```bash
npm run test:coverage
open coverage/index.html
# Click file name → see red lines
```

**Fix by adding tests for red lines.**

### Badge Not Updating

**Clear browser cache:**

```bash
# Force badge refresh
https://codecov.io/gh/robertsinfosec/freebusy-api/branch/main/graph/badge.svg?timestamp=12345
```

**Check badge URL:**

- Must point to correct repo
- Must specify correct branch
- Token required for private repos

**Verify latest commit uploaded:**

Go to Codecov dashboard, check recent commits.

### Token Issues (Private Repos)

**Invalid or expired token:**

1. Get new token from Codecov dashboard
2. Update GitHub secret: `CODECOV_TOKEN`
3. Re-run workflow

**Token not being used:**

```yaml
# Ensure token is passed in workflow
with:
  token: ${{ secrets.CODECOV_TOKEN }}
```

## Best Practices

### 1. Monitor Coverage Trends

- Check dashboard weekly
- Address coverage drops immediately
- Set coverage goals per sprint

### 2. Review PR Coverage

- Always check Codecov comment on PRs
- Don't merge if coverage drops significantly
- Aim for ≥80% patch coverage

### 3. Target High-Risk Code

- Prioritize testing complex logic
- Focus on error handling paths
- Test edge cases thoroughly

### 4. Use Coverage as a Guide

- Coverage is a metric, not a goal
- 100% coverage ≠ perfect tests
- Focus on meaningful test cases

### 5. Keep Config Simple

- Start with defaults
- Add `codecov.yml` only when needed
- Document custom settings

## Additional Resources

- Codecov Documentation: https://docs.codecov.com/
- GitHub App: https://github.com/apps/codecov
- Codecov Action: https://github.com/codecov/codecov-action
- Coverage Best Practices: https://docs.codecov.com/docs/common-recipe-list

---

Navigation: [Home](../../README.md) | [Contributing](../../CONTRIBUTING.md) | [Setup](SETUP.md) | [Architecture](ARCHITECTURE.md) | [Testing](TESTING.md)
