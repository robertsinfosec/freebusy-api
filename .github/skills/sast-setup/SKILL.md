---
description: "SAST scanning setup workflow. Use when adding static analysis to a repository, creating or updating GitHub Actions workflows for CodeQL or Semgrep, or when a repo is missing SAST scanning. Produces a working GitHub Actions SAST workflow."
name: "sast-setup"
generation-source: "generation/skills/sast-setup.md"
---

# SAST Setup

## When to Use

- Repository has no SAST scanning configured
- Adding CodeQL or Semgrep to a project
- Updating an existing SAST workflow
- After detecting missing SAST in a security audit

## Prerequisites

- Read `.github/instructions/sast-scanning.instructions.md` for SAST governance rules
- Identify the project's programming languages (check package manifests, file extensions)

## Procedure

### Step 1: Detect Languages

Scan the repository to identify languages that need SAST coverage:
- JavaScript/TypeScript (package.json, tsconfig.json)
- Python (requirements.txt, pyproject.toml)
- Go (go.mod)
- Java/Kotlin (pom.xml, build.gradle)
- C/C++ (CMakeLists.txt, Makefile)
- Ruby (Gemfile)
- C# (*.csproj)

### Step 2: Choose SAST Tool

**CodeQL** (default for GitHub repos):
- Supported: JavaScript, TypeScript, Python, Go, Java, Kotlin, C, C++, C#, Ruby
- Free for public repos, included with GitHub Advanced Security for private

**Semgrep** (alternative/complement):
- Broader language support
- Custom rule authoring
- Free tier available

### Step 3: Generate GitHub Actions Workflow

Create `.github/workflows/codeql.yml`:

```yaml
name: "CodeQL"

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'  # Weekly Monday 6 AM UTC

jobs:
  analyze:
    name: Analyze
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      contents: read
    strategy:
      matrix:
        language: [<detected_languages>]
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

### Step 4: Configure Custom Queries (if applicable)

If the project has specific security concerns:
- Create `codeql-config.yml` with custom query packs
- Add Semgrep rules for patterns not covered by CodeQL

### Step 5: Verify

- Confirm the workflow file is valid YAML
- Check that detected languages are CodeQL-supported
- Verify the workflow triggers on the correct branches

## References

- `.github/instructions/sast-scanning.instructions.md`
- `.github/instructions/security-standards.instructions.md`
- CodeQL documentation: https://codeql.github.com/docs/
