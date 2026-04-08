---
generation-source: "generation/copilot-instructions.md"
---

# Project Guidelines

## Governance Hierarchy

This project uses structured governance files in `.github/`. The rules defined in `.github/instructions/` are **mandatory constraints** — not suggestions, not guidelines, not best practices. You MUST follow them completely when they apply to the current task.

**Priority order when rules conflict:**
1. Security rules (security-standards) — ALWAYS win, no exceptions
2. Scoped instruction files — override general preferences
3. Existing codebase patterns — override your default tendencies
4. User requests — if a request conflicts with a governance rule, surface the conflict explicitly. NEVER silently bypass a governance rule to fulfill a request.

## Project Context Discovery

You MUST check for these project documents before making decisions in their domain. If a document exists, its contents override your defaults.

| Document | Read BEFORE | If missing, WARN the user |
|----------|-------------|---------------------------|
| `docs/PRD.md` | Adding features, making UX decisions, scoping work | "No PRD found — recommend creating `docs/PRD.md` to document product requirements before making feature decisions." |
| `docs/ARCHITECTURE.md` | Creating modules, changing structure, introducing patterns | "No architecture doc found — recommend creating `docs/ARCHITECTURE.md` to document system boundaries and design decisions." |
| `docs/BRAND.md` | Writing any user-facing content, UI text, docs | "No brand guide found — recommend creating `docs/BRAND.md` to ensure consistent voice, tone, and visual identity." |
| `docs/ADR/` | Reversing or contradicting past design decisions | "No ADRs found — recommend `docs/ADR/` to record architecture decisions and prevent future reversals." |
| `CONTRIBUTING.md` | Suggesting PR, commit, or workflow conventions | — |

## Pattern Consistency

⛔ NEVER introduce a new pattern, library, or structural convention without first reading existing code in the affected area
⛔ NEVER silently introduce a competing approach — if an existing pattern is problematic, flag it explicitly
⛔ NEVER add a dependency when the project already has a tool or library that covers the same need
✅ Follow existing patterns even when you would design it differently — consistency outranks individual preference
✅ When you must deviate from an existing pattern, explain why and ensure the deviation is intentional, not accidental

## Change Completeness

A change is NOT finished until ALL of these are true:

- **Tests** are updated or created to cover the changed behavior
- **Documentation** is updated if behavior, APIs, or configuration changed
- **Consistency** is maintained with existing codebase patterns
- **Error handling** covers failure modes, not just the happy path
- **Related files** affected by the change are also updated (types, configs, imports)

## Self-Review

Before presenting ANY code, verify:

1. It follows the patterns already established in this codebase
2. It is the simplest solution that fully satisfies the requirement
3. It would pass the project's automated checks (linting, tests, type checking)
4. Edge cases and failure modes are handled
5. If it touches user-facing behavior, it respects accessibility and brand guidelines
6. It does not introduce technical debt, deferred cleanup, or incomplete migrations

## Communication

- When uncertain about intent, ask — NEVER guess and generate speculative code
- When multiple valid approaches exist, briefly explain the tradeoffs and recommend one
- When a request conflicts with a governance rule, state the conflict clearly and explain what the rule requires
