---
description: "README badge bar generation workflow. Use when creating or updating a README.md, adding CI/CD status badges, coverage badges, or shields.io badges. Inspects the repo for workflows, generates the correct badge URLs, and inserts a formatted badge bar at the top of the README."
name: "readme-badge-bar"
generation-source: "generation/skills/readme-badge-bar.md"
---

# README Badge Bar

## When to Use

- Creating a new README.md
- Adding or updating CI/CD, coverage, or status badges
- After adding new GitHub Actions workflows
- When badge URLs are broken or outdated

## Prerequisites

- Read `.github/instructions/readme-badges.instructions.md` for badge formatting rules
- Need the GitHub repository owner and name (from `git remote -v` or `.git/config`)

## Procedure

### Step 1: Detect Repository Info

Extract from git config:
- Repository owner (org or user)
- Repository name
- Default branch name

### Step 2: Scan for Badge Sources

Detect what badges are applicable:

**CI/CD Workflows** (scan `.github/workflows/`):
- For each workflow file, generate a GitHub Actions status badge:
  `![Workflow Name](https://github.com/{owner}/{repo}/actions/workflows/{filename}/badge.svg)`

**Coverage** (scan for coverage tooling):
- Codecov: `![Coverage](https://codecov.io/gh/{owner}/{repo}/branch/{default_branch}/graph/badge.svg)`
- Coveralls: `![Coverage](https://coveralls.io/repos/github/{owner}/{repo}/badge.svg?branch={default_branch})`

**Package Registries** (scan manifests):
- npm: `![npm](https://img.shields.io/npm/v/{package_name})`
- PyPI: `![PyPI](https://img.shields.io/pypi/v/{package_name})`
- Crates.io: `![Crates.io](https://img.shields.io/crates/v/{crate_name})`

**License** (scan for LICENSE file):
- `![License](https://img.shields.io/github/license/{owner}/{repo})`

### Step 3: Generate Badge Bar

Format badges as a single-line block at the top of README.md, after the `# Title` heading:

```markdown
# Project Name

![CI](badge_url) ![Coverage](badge_url) ![License](badge_url)
```

### Step 4: Insert or Update

- If README.md has an existing badge bar (line of consecutive badge images), replace it
- If no badge bar exists, insert after the first `#` heading
- Preserve all other README content

## Rules

- Only generate badges for tools/services actually configured in the repo
- Never generate badges for services not in use
- Use shields.io for consistent styling where possible
- Badge order: CI status → Coverage → Package version → License

## References

- `.github/instructions/readme-badges.instructions.md`
