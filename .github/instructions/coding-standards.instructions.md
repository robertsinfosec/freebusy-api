---
description: "Use when writing, reviewing, or modifying ANY code. Enforces universal software engineering principles: simplicity, modularity, explicit contracts, controlled state, predictable failure, diagnosable behavior, and safe change. Applies to all languages, frameworks, and artifact types."
applyTo: "**"
generation-source: "generation/instructions/coding-standards.md"
---

# Coding Standards

These standards apply to all code unless a stricter project-specific rule exists.
_Stack-specific rules (React, PEP-8, Go idioms, Redis, Terraform, etc.) are in `stack-standards.instructions.md`._

## 1. Simplicity and Clarity

✅ Choose the simplest design that satisfies the requirement
✅ Optimize for clarity, predictability, and maintainability over cleverness
✅ Keep control flow straightforward and easy to trace
✅ Reduce branching depth and hidden behavior
⛔ NEVER introduce indirection, abstraction, or genericity that does not solve a real and current need
⛔ NEVER hide critical behavior behind surprising side effects, implicit defaults, or non-obvious execution paths

## 2. Modularity and Separation of Concerns

✅ Organize code into small, focused units with a single clear responsibility
✅ Keep business logic, orchestration, I/O, persistence, presentation, and environment concerns separated
✅ Define clear boundaries between components and layers
⛔ NEVER combine unrelated responsibilities in the same function, class, module, script, or resource
⛔ NEVER allow cross-layer leakage that couples core logic to delivery, storage, or infrastructure details

## 3. Dependency Boundaries

✅ Make all dependencies explicit
✅ Isolate external systems, frameworks, tools, and runtime services behind clear boundaries
✅ Program against stable contracts and replaceable interfaces native to the stack
⛔ NEVER hard-wire business logic directly to specific infrastructure, vendor APIs, global state, or process environment when a boundary can be defined
⛔ NEVER hide dependencies through ambient context, implicit globals, or non-local side effects

## 4. Data Contracts and Type Discipline

✅ Make inputs, outputs, invariants, and assumptions explicit
✅ Prefer strongly defined data structures, types, and schemas over loosely shaped data
✅ Validate data at boundaries and normalize before core processing
⛔ NEVER overload one structure, field, or parameter with multiple unrelated meanings
⛔ NEVER pass opaque, weakly defined data through multiple layers when a domain model or explicit contract can be defined

## 5. State and Side-Effect Control

✅ Minimize mutable state
✅ Keep state transitions explicit and localized
✅ Isolate side effects from pure decision logic and data transformation
✅ Prefer immutable values, readonly references, and pure functions when supported by the stack
⛔ NEVER spread shared mutable state across unrelated components
⛔ NEVER mix mutation, I/O, and business rules in ways that make behavior hard to reason about

## 6. Naming and Readability

✅ Use names that reveal purpose, scope, and behavior
✅ Apply naming conventions consistently within the codebase
✅ Write code that is readable without requiring tribal knowledge
⛔ NEVER use misleading, overloaded, vague, or throwaway names for production code
⛔ NEVER encode hidden assumptions in abbreviations, magic values, or undocumented conventions

## 7. Duplication and Abstraction Discipline

✅ Eliminate repeated logic that creates maintenance risk
✅ Extract shared behavior only when the abstraction is clearer and more stable than the duplication
✅ Keep abstractions narrow, purposeful, and easy to understand
⛔ NEVER duplicate logic across multiple locations when one authoritative implementation is possible
⛔ NEVER introduce speculative abstractions for hypothetical future needs

## 8. Configuration and Environment Isolation

✅ Keep environment-specific behavior in configuration, not business logic
✅ Centralize configuration access and validate configuration at startup or entry
✅ Replace magic numbers and hidden defaults with named constants or explicit configuration
⛔ NEVER hardcode deploy-time values, environment-specific endpoints, ports, flags, or operational settings into core logic
⛔ NEVER scatter configuration lookup across the codebase

## 9. Error and Failure Semantics

✅ Handle expected failure modes explicitly
✅ Propagate errors with actionable context for developers and operators
✅ Use structured error types, result models, or failure mechanisms native to the stack
✅ Keep failure behavior consistent within a component
✅ Fail fast on invalid internal state
⛔ NEVER swallow errors, ignore return values, or continue after an invalid state without explicit handling
⛔ NEVER use stringly-typed error handling when the stack supports structured alternatives

## 10. Diagnostics and Observability

✅ Make runtime behavior diagnosable
✅ Emit structured diagnostics using the standard mechanisms of the platform
✅ Include enough context to trace execution, decisions, and failures
✅ Surface meaningful operational signals at component boundaries and critical paths
⛔ NEVER bury important behavior in silent branches, implicit retries, or opaque background work
⛔ NEVER emit diagnostics that are inconsistent, context-free, or operationally useless

## 11. Code Hygiene and Lifecycle Discipline

✅ Remove dead code, obsolete branches, stale feature paths, and unused dependencies
✅ Keep warnings, suppressions, and ignores explicit, minimal, and justified
✅ Track deferred work in the system of record defined by the project — not unlinked TODO comments
✅ Leave the codebase in a clearer state than you found it
⛔ NEVER leave commented-out code in place of version control
⛔ NEVER suppress warnings, lint violations, or static analysis findings without a documented reason

## 12. Resource and Concurrency Discipline

✅ Bound resource usage explicitly
✅ Acquire and release resources predictably
✅ Make concurrency, parallelism, retries, and scheduling explicit
✅ Design loops, tasks, and background work to terminate, back off, or fail safely
⛔ NEVER create unbounded work, unbounded retries, or unbounded memory, file, connection, or queue growth
⛔ NEVER leak resources, locks, handles, tasks, or temporary artifacts

## 13. Change Safety and Compatibility

✅ Preserve existing behavior unless a change is intentional and explicit
✅ Make breaking changes visible in code, review, and documentation
✅ Keep migrations, transitions, and compatibility boundaries explicit
✅ Refactor in ways that preserve semantics
⛔ NEVER introduce silent behavioral drift during cleanup, optimization, or abstraction work
⛔ NEVER change public, shared, or downstream-consumed behavior without updating the contract and migration path

## 14. Documentation of Intent

✅ Document non-obvious constraints, invariants, tradeoffs, and edge cases
✅ Write comments and interface documentation that explain why, not what
✅ Keep entry points, extension points, and public contracts discoverable
⛔ NEVER add comments that merely restate the code
⛔ NEVER leave complex behavior, hidden assumptions, or important limitations undocumented
