---
description: "Technical debt triage and elimination workflow. Use when you want to systematically find, prioritize, and remediate technical debt across the codebase. Produces a debt inventory, priority matrix, and executes safe remediations."
name: "tech-debt-elimination"
generation-source: "generation/skills/tech-debt-elimination.md"
---

# Tech Debt Elimination

## When to Use

- Systematic debt cleanup sprint
- Before a major refactor to assess baseline debt
- After a security/quality audit reveals debt
- Periodic codebase hygiene

## Prerequisites

- Read `.github/instructions/zero-tech-debt.instructions.md` for the debt-free standard

## Procedure

### Step 1: Scan for Explicit Debt Markers

Search the entire codebase for:
- `TODO`, `FIXME`, `HACK`, `XXX`, `TEMP`, `WORKAROUND` comments
- `@deprecated` annotations without migration paths
- Suppressed linter rules: `eslint-disable`, `noqa`, `#[allow(...)]`, `@SuppressWarnings`

Record each with file path, line number, and surrounding context.

### Step 2: Detect Structural Debt

- **Dead code**: Unused functions, unreachable branches, commented-out code blocks
- **Duplication**: Copy-pasted logic (>10 lines of near-identical code in different locations)
- **Complexity**: Functions >40 lines, nesting >3 levels deep, cyclomatic complexity >10
- **Stale dependencies**: Outdated packages (check with `npm outdated`, `pip list --outdated`, etc.)
- **Incomplete migrations**: Mixed old/new patterns in the same domain

### Step 3: Detect Architecture Debt

- Circular dependencies between modules
- Wrong dependency direction (detail knows about abstraction's internals)
- God objects or modules with too many responsibilities
- Missing abstractions (same concept implemented differently in multiple places)

### Step 4: Prioritize

Rate each item on two axes:
- **Risk**: What breaks if this debt compounds? (Critical / High / Medium / Low)
- **Effort**: How long to fix? (Small <30min / Medium <2hr / Large >2hr)

Priority matrix:
| | Small Effort | Medium Effort | Large Effort |
|---|---|---|---|
| **Critical Risk** | Fix NOW | Fix NOW | Plan + Fix |
| **High Risk** | Fix NOW | Plan + Fix | Plan |
| **Medium Risk** | Fix | Plan | Backlog |
| **Low Risk** | Fix if touching | Backlog | Backlog |

### Step 5: Remediate

For items marked "Fix NOW" or "Fix":
1. Fix the issue
2. Run tests to confirm nothing broke
3. Move to next item

For items marked "Plan":
- Document the finding with full context
- Suggest a remediation approach
- Report to user for scheduling

### Step 6: Report

**Debt Inventory**:
| # | Type | Location | Risk | Effort | Status |
|---|------|----------|------|--------|--------|

**Summary**: Items found, items fixed, items planned, items backlogged.

## References

- `.github/instructions/zero-tech-debt.instructions.md`
- `.github/instructions/coding-standards.instructions.md`
