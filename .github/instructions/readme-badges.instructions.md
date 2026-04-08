---
description: "Use when creating or modifying README.md files. Enforces a standard set of badges at the top of every README for project health visibility: build status, tests, coverage, SAST, SCA, license, issues, PRs, and releases."
applyTo: "**/README.md, **/readme.md"
generation-source: "generation/instructions/readme-badges.md"
---

# README Badges

Every README.md must display a standard set of badges at the top as an at-a-glance project health dashboard. Badges provide immediate visibility into CI/CD status, security posture, and project activity.

## 1. Required Badge Set

✅ The following badges MUST appear at the top of every README.md, BEFORE any other content (title comes after badges):

### Row 1: CI/CD and Quality
| Badge | Source |
|-------|--------|
| Build Status | GitHub Actions workflow badge for the main CI workflow |
| Tests | GitHub Actions workflow badge for the test suite |
| Code Coverage | Codecov, Coveralls, or equivalent coverage service |

### Row 2: Security
| Badge | Source |
|-------|--------|
| SAST | CodeQL or Semgrep workflow status |
| Dependabot | SCA/dependency scanning status |

### Row 3: Project Info
| Badge | Source |
|-------|--------|
| License | shields.io — repo license |
| Open Issues | shields.io — open issue count |
| Open PRs | shields.io — open PR count |
| Latest Release | shields.io — latest release/tag |

⛔ NEVER omit the security badges (SAST, Dependabot) — they prove scanning compliance
⛔ NEVER place badges below the project title or description — badges come first

## 2. Badge Formatting

✅ Use Markdown image-link syntax: `[![Label](badge-url)](link-url)`
✅ Every badge MUST link to its detail page (workflow run, coverage report, shields.io detail)
✅ Group badges by row as defined above — separate rows with a line break or space
✅ Use consistent badge label names across all repositories

## 3. Badge Template

✅ Use this template as the starting point — replace `{owner}`, `{repo}`, and workflow filenames:

```markdown
[![Build](https://github.com/{owner}/{repo}/actions/workflows/ci.yml/badge.svg)](https://github.com/{owner}/{repo}/actions/workflows/ci.yml)
[![Tests](https://github.com/{owner}/{repo}/actions/workflows/tests.yml/badge.svg)](https://github.com/{owner}/{repo}/actions/workflows/tests.yml)
[![Coverage](https://codecov.io/gh/{owner}/{repo}/branch/main/graph/badge.svg)](https://codecov.io/gh/{owner}/{repo})

[![CodeQL](https://github.com/{owner}/{repo}/actions/workflows/codeql.yml/badge.svg)](https://github.com/{owner}/{repo}/actions/workflows/codeql.yml)
[![Dependabot](https://img.shields.io/badge/dependabot-enabled-025e8c)](https://github.com/{owner}/{repo}/security/dependabot)

[![License](https://img.shields.io/github/license/{owner}/{repo})](LICENSE)
[![Issues](https://img.shields.io/github/issues/{owner}/{repo})](https://github.com/{owner}/{repo}/issues)
[![PRs](https://img.shields.io/github/issues-pr/{owner}/{repo})](https://github.com/{owner}/{repo}/pulls)
[![Release](https://img.shields.io/github/v/release/{owner}/{repo})](https://github.com/{owner}/{repo}/releases)
```

✅ Adapt workflow file names (`ci.yml`, `tests.yml`, `codeql.yml`) to match the actual workflow filenames in the repository
⛔ NEVER use placeholder badge URLs — always resolve to the actual repository values
