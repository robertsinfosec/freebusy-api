---
description: "Use when writing, reviewing, or modifying ANY code. Zero-tolerance policy for introducing technical debt. No deferred cleanup, no untracked workarounds, no incomplete migrations, no stale artifacts, no suppression-based progress."
applyTo: "**"
generation-source: "generation/instructions/zero-tech-debt.md"
---

# Zero Technical Debt

Every change must leave the codebase in an equal or better state than it was found. A change is non-compliant if it introduces deferred cleanup, expands inconsistency, leaves obsolete paths in place, or creates future rework without explicit tracking and removal criteria.

## 1. No Net-New Debt

✅ Leave every touched area equal to or better than its prior state
✅ Reduce existing debt when working in debt-heavy code
⛔ NEVER introduce shortcuts, placeholders, or structural degradation with the expectation of fixing them later
⛔ NEVER make a local change that increases future maintenance cost, review complexity, or migration burden

## 2. No Deferred Cleanup

✅ Complete cleanup, renaming, simplification, and consistency fixes required by the change before considering the work done
✅ Fix obvious debt in the touched scope when it directly affects clarity, correctness, or maintainability
⛔ NEVER defer necessary cleanup to a vague future change or "follow-up PR"
⛔ NEVER leave behind partially updated code paths, stale branches, or half-finished refactors

## 3. No Untracked Temporary Code

✅ Track every temporary workaround, TODO, FIXME, compatibility shim, fallback path, and migration helper in the system of record with owner, rationale, and removal condition
✅ Make the temporary nature of temporary code explicit in code and tracking
⛔ NEVER leave TODO, FIXME, HACK, workaround, or placeholder code without a linked issue and clear retirement criteria
⛔ NEVER merge "temporary" code that has no accountable path to removal

## 4. No Incomplete Migrations

✅ Complete migrations within the scope of the change or isolate them behind an explicitly tracked migration plan
✅ Remove superseded patterns, wrappers, flags, adapters, and call paths when introducing their replacement
⛔ NEVER introduce a new pattern while leaving the old pattern expanded, duplicated, or ambiguously supported in the same scope
⛔ NEVER leave the codebase with two competing ways to solve the same problem when one is intended to replace the other

## 5. No Suppression-Based Progress

✅ Resolve warnings, failing checks, skipped coverage, and deprecated usage introduced or exposed by the change
✅ Treat suppressions and bypasses as debt that require explicit tracking and expiry
⛔ NEVER suppress warnings, lint findings, type errors, tests, or policy checks to make a change appear complete
⛔ NEVER add deprecated dependencies, deprecated APIs, disabled tests, ignored failures, or bypass flags without immediate remediation or tracked retirement

## 6. No Stale Artifacts

✅ Update documentation, examples, comments, generated outputs, configuration references, and migration notes when behavior changes
✅ Remove dead code, dead flags, unused dependencies, and obsolete documentation when they become irrelevant
⛔ NEVER leave stale docs, stale examples, stale comments, or stale configuration after changing implementation or behavior
⛔ NEVER retain obsolete compatibility layers, dead paths, or dead artifacts after their purpose has ended

## 7. No Inconsistency Expansion

✅ Reuse established project patterns when they remain valid
✅ Improve consistency in touched areas when inconsistency is already present
⛔ NEVER introduce a one-off pattern, helper style, structure, naming scheme, or lifecycle model that increases divergence within the codebase
⛔ NEVER solve a local problem by making the overall system less uniform

## 8. Debt Exceptions Must Be Explicit

✅ Record every unavoidable debt item with owner, scope, rationale, impact, and removal trigger
✅ Keep debt items small, isolated, visible, and time-bounded
⛔ NEVER hide debt inside comments, silent suppressions, undocumented workarounds, or ambiguous "temporary" code
⛔ NEVER treat known debt as acceptable merely because it is common, inherited, or inconvenient to fix
