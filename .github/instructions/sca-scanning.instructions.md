---
description: "Use when setting up CI/CD, managing dependencies, creating workflows, or discussing supply chain security. Enforces Dependabot configuration, lockfile management, vulnerability response timelines, and dependency selection criteria."
applyTo: "**/.github/workflows/**, **/package.json, **/package-lock.json, **/requirements*.txt, **/go.mod, **/go.sum, **/Cargo.toml, **/Cargo.lock, **/pom.xml, **/Gemfile, **/Gemfile.lock, **/.github/dependabot.yml, **/pyproject.toml, **/poetry.lock, **/yarn.lock, **/pnpm-lock.yaml"
generation-source: "generation/instructions/sca-scanning.md"
---

# SCA Scanning

Every repository must have Software Composition Analysis (SCA) enabled to detect known vulnerabilities in dependencies. Dependencies are the largest attack surface in most applications.

## 1. SCA Requirement

✅ Every repository MUST have Dependabot security alerts enabled
✅ Every repository MUST have a `.github/dependabot.yml` configuration file covering all package ecosystems in use
✅ Dependabot security updates must be enabled and routed to the responsible team
⛔ NEVER operate a repository without automated dependency vulnerability scanning
<!-- NIST-SSDF: PW.4 | OWASP: A06 | CWE: 1104 -->

## 2. Dependabot Configuration

✅ Configure update schedules for every package ecosystem in the repository (npm, pip, go, cargo, maven, bundler, docker, github-actions, etc.)
✅ Group minor and patch updates to reduce PR noise
✅ Security updates must be configured on a more aggressive schedule than version updates
✅ Target the default branch for all update PRs

### Dependabot Config Template

```yaml
version: 2
updates:
  - package-ecosystem: "npm"          # Adjust per repository
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      minor-and-patch:
        update-types: ["minor", "patch"]
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

## 3. Lockfile Management

✅ Lockfiles MUST be committed to version control
✅ Use lockfile-only install commands in CI: `npm ci`, `pip install --require-hashes`, `go mod verify`
✅ Lockfile changes must be reviewed as part of PR review — they represent actual dependency changes
⛔ NEVER add a lockfile to `.gitignore`
⛔ NEVER use `npm install` (instead of `npm ci`) in CI pipelines

## 4. Vulnerability Response

✅ **Critical**: Remediate within 7 days
✅ **High**: Remediate within 30 days
✅ **Medium**: Track in backlog, remediate during regular maintenance cycles
✅ **Low**: Assess risk, remediate opportunistically
✅ If no fix is available: document the risk, apply mitigating controls, and monitor for fix availability
⛔ NEVER ignore or dismiss Dependabot security alerts without documented justification
⛔ NEVER leave Critical or High vulnerabilities unaddressed beyond the defined SLA

## 5. Dependency Selection

✅ Before adding a dependency, evaluate: maintenance status, known vulnerabilities, license compatibility, and transitive dependency count
✅ Prefer well-maintained packages with active communities and regular releases
✅ Minimize dependency count — every dependency is attack surface
⛔ NEVER install packages from unverified registries or directly from Git URLs without pinning to a specific commit SHA
⛔ NEVER add dependencies with known unpatched Critical or High vulnerabilities

## 6. Supply Chain Integrity

✅ Use package manager integrity verification (npm integrity checks, pip `--require-hashes`, `go.sum`)
✅ Pin GitHub Actions to full commit SHA — never use mutable tags alone
✅ Review new dependencies and major version upgrades before merging
⛔ NEVER use wildcard version specifiers (`*`, `latest`) in production dependencies
<!-- SLSA: v1.0 -->

## 7. Runtime Audit (Supplementary)

✅ Run `npm audit` (or equivalent) as part of CI for package ecosystems that support it
✅ Treat new critical/high audit findings as CI failures
✅ Maintain audit exceptions list with justifications when findings cannot be immediately resolved
