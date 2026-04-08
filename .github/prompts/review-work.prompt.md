---
description: "Review completed work for a GitHub Issue. Full top-down review: security, compliance, code quality, build verification, unit tests, code coverage (75% minimum). Optionally creates new issues for findings."
tools: [read, search, execute]
agent: agent
generation-source: "generation/prompts/review-work.md"
---

Review the completed work described in `{{input}}`.

If `{{input}}` is a GitHub Issue number, run `gh issue view <number>` and `gh pr list --search "<issue number>"` to find the associated PR and diff.

## Procedure

1. **Gather the changeset:**
   - If a PR exists: `gh pr diff <number>`
   - If no PR: `git diff main...HEAD` or inspect the files provided
   - List all changed files

2. **Identify applicable governance:**
   - For each changed file, check which instruction files apply (match `applyTo` patterns)
   - Load ALL applicable instruction files

3. **Review against each governance domain:**

### Security (security-standards)
- Input validation on all external data
- Parameterized queries (no string concatenation in SQL)
- No hardcoded secrets or credentials
- Output encoding for web contexts
- Error handling reveals no internal details
- Authentication/authorization checks present

### Code Quality (coding-standards)
- Functions are small and single-purpose
- Names are descriptive and consistent with codebase
- No dead code, commented-out code, or debug artifacts
- Error handling is explicit, not swallowed
- Dependencies flow in one direction

### Technical Debt (zero-tech-debt)
- No `TODO`, `FIXME`, `HACK` comments added
- No partial migrations or incomplete refactors
- No copy-pasted code that should be extracted
- No stale imports, configs, or artifacts

### Testing (testing-standards)
- Tests exist for all changed behavior
- Tests follow AAA (Arrange-Act-Assert) structure
- Edge cases and error paths are tested
- Run test suite: confirm all pass
- Check coverage: minimum 75% branch coverage on changed files

### Stack-Specific (stack-standards) — if generated
- Technology-specific idioms followed
- Linter/formatter compliance

### Database (database-safety) — if changes touch DB
- Migrations are reversible
- No raw SQL with string interpolation
- Indexes considered for new queries

### API Design (api-design) — if changes touch API
- RESTful resource naming
- Proper HTTP status codes
- Error response format follows standard

### Accessibility (accessibility) — if changes touch UI
- Semantic HTML elements
- Keyboard navigable
- Sufficient color contrast
- ARIA attributes correct

4. **Produce the review report.**

## Output Format

### Summary
| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| Info | 0 |

**Verdict**: PASS / FAIL (FAIL if any Critical or High findings)

### Findings

For each finding:
- **[SEVERITY]** One-line description
- **File**: `path/to/file.ts:42`
- **Rule**: Cites the specific governance rule from the specific instruction file
- **Fix**: Specific remediation action

## Rules

- MUST check against EVERY applicable instruction file — no shortcuts
- MUST run tests and report results
- MUST report coverage numbers for changed files
- NEVER mark a review as PASS if Critical or High findings exist
- Distinguish between governance violations (MUST fix) and suggestions (SHOULD improve)
- If findings require code changes, ask the user if they want issues created for remediation
