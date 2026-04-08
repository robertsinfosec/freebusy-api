---
description: "SCA scanning setup workflow. Use when adding software composition analysis to a repository, configuring Dependabot, setting up npm audit in CI, or when a repo is missing dependency vulnerability scanning. Produces working Dependabot config and CI checks."
name: "sca-setup"
generation-source: "generation/skills/sca-setup.md"
---

# SCA Setup

## When to Use

- Repository has no dependency vulnerability scanning
- Configuring Dependabot for automated dependency updates
- Adding `npm audit`, `pip-audit`, or similar checks to CI
- After detecting missing SCA in a security audit

## Prerequisites

- Read `.github/instructions/sca-scanning.instructions.md` for SCA governance rules
- Identify package managers in use (npm, yarn, pnpm, pip, poetry, go mod, cargo, etc.)

## Procedure

### Step 1: Detect Package Ecosystems

Scan for manifests and determine ecosystems:
- `package.json` / `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml` → npm
- `requirements.txt` / `pyproject.toml` / `Pipfile.lock` → pip
- `go.mod` / `go.sum` → gomod
- `Cargo.toml` / `Cargo.lock` → cargo
- `Gemfile` / `Gemfile.lock` → bundler
- `composer.json` / `composer.lock` → composer
- `Dockerfile` → docker
- `.github/workflows/*.yml` → github-actions

### Step 2: Generate Dependabot Configuration

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "<ecosystem>"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
    commit-message:
      prefix: "deps"
```

Generate one entry per detected ecosystem. Include `github-actions` ecosystem to keep workflow actions updated.

### Step 3: Add CI Audit Check

Create or update CI workflow to include dependency audit:

**npm/yarn/pnpm**: Add `npm audit --audit-level=high` step
**pip**: Add `pip-audit` step
**Go**: Add `govulncheck ./...` step
**Rust**: Add `cargo audit` step

### Step 4: Configure Security Alerts

Verify GitHub repository settings:
- Dependabot alerts enabled
- Dependabot security updates enabled
- Secret scanning enabled (if available)

If these can’t be set programmatically, report the required settings to the user.

### Step 5: Verify

- Confirm `dependabot.yml` is valid YAML
- Confirm CI audit step uses correct package manager commands
- Check that all detected ecosystems have Dependabot entries

## References

- `.github/instructions/sca-scanning.instructions.md`
- `.github/instructions/security-standards.instructions.md`
- Dependabot docs: https://docs.github.com/en/code-security/dependabot
