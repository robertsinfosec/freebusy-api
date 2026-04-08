---
description: "Plan work from a braindump. Organizes ideas, identifies dependencies, and creates GitHub Issues (features, enhancements, bugfixes) using the gh CLI."
tools: [read, search, execute]
agent: agent
generation-source: "generation/prompts/plan-work.md"
---

Take the braindump provided in `{{input}}` and convert it into well-structured GitHub Issues.

## Procedure

1. **Gather context:**
   - Read `docs/PRD.md` if it exists — understand product goals
   - Read `docs/ARCHITECTURE.md` if it exists — understand system structure
   - Run `gh issue list --state open --limit 50` — avoid creating duplicates

2. **Decompose the braindump:**
   - Identify discrete work items — each issue should be completable in a single `/execute-work` invocation
   - If an item requires >300 lines of changes, split it into smaller issues
   - Identify dependencies between items

3. **Create issues in dependency order** (foundational first):
   ```
   gh issue create --title "<title>" --body "<body>" --label "<type>"
   ```

4. **Each issue body MUST include:**
   - **Problem**: What and why
   - **Acceptance Criteria**: Numbered list of testable outcomes
   - **Technical Approach**: Brief implementation strategy referencing specific files/modules
   - **Dependencies**: Links to other issues if any
   - **Governance Notes**: Which instruction files are most relevant

## Rules

- MUST read existing issues before creating new ones
- MUST create issues in dependency order
- MUST label each issue: `feature`, `enhancement`, `bug`, or `chore`
- NEVER create issues with vague acceptance criteria like "works correctly"
- If the braindump is ambiguous, list assumptions and ask the user to confirm before creating issues

## Output

After creating all issues, print a summary table:

| # | Issue | Type | Dependencies |
|---|-------|------|--------------|
| 1 | Title | feature | None |
| 2 | Title | enhancement | #1 |
