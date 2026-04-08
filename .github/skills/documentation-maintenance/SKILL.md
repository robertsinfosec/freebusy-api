---
description: "Documentation maintenance and audit workflow. Use when reviewing documentation freshness, auditing README accuracy, updating API docs, refreshing changelogs, or verifying that documentation reflects the current codebase state."
name: "documentation-maintenance"
generation-source: "generation/skills/documentation-maintenance.md"
---

# Documentation Maintenance

## When to Use

- README, API docs, or architecture docs may be stale
- After significant code changes to verify documentation accuracy
- Before a release to ensure docs reflect current state
- When onboarding documentation needs verification

## Procedure

### Step 1: Inventory Documentation

Scan for all documentation files:
- `README.md` — project overview, setup, usage
- `docs/` directory — PRD, ARCHITECTURE, BRAND, ADR, CONTRIBUTING, API docs
- `CHANGELOG.md` — version history
- Inline API docs (JSDoc, docstrings, GoDoc comments)
- Configuration file comments explaining non-obvious settings

### Step 2: Audit README.md

Verify each section against actual code:
- **Description**: Does it match current functionality?
- **Setup instructions**: Do they work? Check against actual package.json/requirements/go.mod/etc.
- **Usage examples**: Are they syntactically valid? Do they use current APIs?
- **Badges**: Do URLs resolve? Do they show current status? (use readme-badges.instructions.md)
- **Links**: Are all links valid (no 404s)?
- **Technology list**: Does it match the actual stack?

### Step 3: Audit API Documentation

For each public endpoint/function:
- Is it documented?
- Do request/response examples match current schema?
- Are error codes and messages documented?
- Are authentication requirements stated?
- Are deprecated endpoints marked?

### Step 4: Audit Architecture Documentation

If `docs/ARCHITECTURE.md` exists:
- Does it reflect the current module structure?
- Do dependency descriptions match actual imports?
- Are data flow descriptions accurate?
- Are ADRs (Architecture Decision Records) up to date?

### Step 5: Audit Changelog

If `CHANGELOG.md` exists:
- Are recent changes documented?
- Does the format follow Keep a Changelog or Conventional Changelog?
- Do version numbers match package manifests?

### Step 6: Fix or Report

For each stale section:
1. If the correct information can be determined from code → fix it directly
2. If human input is needed → report what's stale and what information is needed

## Writing Standards

- Clear, concise, active voice
- Code examples MUST be syntactically valid
- Never add aspirational content (“coming soon”, “planned”)
- Follow `brand-compliance.instructions.md` for tone
- Follow `readme-badges.instructions.md` for badge formatting

## References

- `.github/instructions/brand-compliance.instructions.md`
- `.github/instructions/readme-badges.instructions.md`
