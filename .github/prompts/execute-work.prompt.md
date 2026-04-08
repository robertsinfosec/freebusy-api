---
description: "Execute work from a GitHub Issue or ad-hoc task. Reads the issue, understands requirements, implements the solution following all project standards, and creates a PR-ready changeset."
agent: agent
generation-source: "generation/prompts/execute-work.md"
---

Implement the work described in `{{input}}`.

If `{{input}}` is a GitHub Issue number, run `gh issue view <number>` to read the full issue.

## Procedure

1. **Understand the task:**
   - Read the issue/task description completely
   - Read `docs/ARCHITECTURE.md` if it exists
   - Identify all files that will be affected
   - Read ALL instruction files that apply to those files (check `applyTo` patterns)

2. **Plan the implementation:**
   - List the files to create/modify
   - Identify tests to create/update
   - Identify documentation to update
   - If the approach is unclear, ask the user before writing code

3. **Implement:**
   - Follow ALL applicable instruction files — they are non-negotiable
   - Governance priority: security-standards > all other instructions > existing patterns > task requirements
   - Write tests alongside implementation — not after
   - Update documentation if behavior, APIs, or configuration changed

4. **Verify:**
   - Run the test suite and confirm all tests pass
   - Run linters/formatters if configured
   - Check that no instruction file rules were violated

## Change Completeness Checklist

Before reporting completion, verify:
- [ ] All acceptance criteria from the issue are met
- [ ] Tests cover the changed behavior
- [ ] Documentation updated if needed
- [ ] No new lint errors or warnings
- [ ] No hardcoded secrets, no `TODO` left behind
- [ ] Related files updated (imports, exports, configs, types)

## Rules

- MUST read the issue fully before writing any code
- MUST follow ALL scoped instruction files
- MUST run tests before reporting completion
- NEVER skip tests with "will add later"
- NEVER introduce `TODO`, `FIXME`, or `HACK` comments
- If a governance rule conflicts with the task requirements, follow the governance rule and explain why to the user
