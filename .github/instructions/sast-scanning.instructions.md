---
description: "Use when setting up CI/CD, creating GitHub Actions workflows, or configuring static analysis. Enforces that every repository MUST have SAST scanning via GitHub Actions. CodeQL for repos with GitHub Advanced Security, Semgrep as alternative."
applyTo: "**/.github/workflows/**, **/ci/**, **/pipeline/**, **/.semgrep/**, **/codeql/**"
generation-source: "generation/instructions/sast-scanning.md"
---

# SAST Scanning

Every repository must have Static Application Security Testing (SAST) enabled. No exceptions. SAST catches vulnerability patterns in source code before they reach production.

## 1. SAST Requirement

✅ Every repository MUST have at least one SAST tool configured and running
✅ SAST must run on every pull request targeting the default branch
✅ SAST must run on push to the default branch to establish a baseline and catch direct pushes
✅ Schedule a weekly full-repository scan in addition to PR-triggered scans
⛔ NEVER merge a pull request if SAST has not completed successfully
⛔ NEVER disable SAST workflows to unblock a merge
<!-- NIST-SSDF: PW.7, PW.8 | NIST: SA-11 -->

## 2. Tool Selection and Configuration

✅ **CodeQL** (preferred): Enable for all supported languages in the repo; use `security-extended` query suite
✅ **Semgrep** (alternative): Use `p/default`, `p/security-audit`, and `p/owasp-top-ten` rulesets at minimum
✅ Configure scanning for ALL languages present in the repository — not just the primary language
✅ Upload results to GitHub Security tab in SARIF format for centralized finding management

### CodeQL Workflow Template

```yaml
name: "CodeQL"
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: "0 6 * * 1" # Weekly Monday 6 AM UTC
jobs:
  analyze:
    name: Analyze
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    strategy:
      matrix:
        language: [] # Add your languages: javascript, python, go, java, etc.
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          queries: security-extended
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

## 3. Quality Gates

✅ High and Critical severity findings MUST block PR merge
✅ New findings introduced by a PR are the responsibility of the PR author to resolve before merge
✅ Medium findings must be triaged and either fixed or tracked within a defined timeframe
⛔ NEVER merge a PR that introduces new High or Critical SAST findings

## 4. Finding Management

✅ Every finding must be triaged: fix, suppress with justification, or mark as false positive
✅ Suppressions require an inline code comment explaining why the finding is not applicable
✅ Review and re-validate existing suppressions periodically
⛔ NEVER dismiss or suppress findings without a documented justification
⛔ NEVER allow suppression count to grow without corresponding audits
