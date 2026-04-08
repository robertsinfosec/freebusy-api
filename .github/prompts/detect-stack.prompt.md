---
description: "Scan this repository to detect the technology stack, research current best practices for each technology, and generate stack-standards.instructions.md with tech-specific conventions and rules."
agent: agent
tools: [read, search, execute, web]
generation-source: "generation/prompts/detect-stack.md"
---

Scan this repository to detect all technologies, frameworks, package managers, and tools in use. For each detected technology, research its current best practices. Then generate or update `.github/instructions/stack-standards.instructions.md` with tech-specific coding standards.

## Phase 1: Detection

Scan for technology signals in this order:

1. **Package managers and manifests:**
   - `package.json` (npm/yarn/pnpm — check `packageManager` field and lockfile type)
   - `requirements.txt`, `pyproject.toml`, `setup.py`, `Pipfile` (Python)
   - `go.mod` (Go)
   - `Cargo.toml` (Rust)
   - `pom.xml`, `build.gradle` (Java/Kotlin)
   - `Gemfile` (Ruby)
   - `composer.json` (PHP)
   - `*.csproj`, `*.fsproj` (C#/F#)

2. **Frameworks** (check dependencies and config files):
   - JS/TS: React, Next.js, Vue, Nuxt, Svelte, Angular, Express, Fastify, Hono, Astro, Remix, NestJS
   - Python: Django, Flask, FastAPI, SQLAlchemy
   - Config files: `next.config.*`, `vite.config.*`, `nuxt.config.*`, `angular.json`, `svelte.config.*`, `astro.config.*`, `tailwind.config.*`

3. **Tooling:**
   - Linters: `.eslintrc*`, `eslint.config.*`, `.pylintrc`, `pyproject.toml [tool.ruff]`, `.golangci.yml`, `clippy.toml`
   - Formatters: `.prettierrc*`, `pyproject.toml [tool.black]`, `rustfmt.toml`
   - Type checkers: `tsconfig.json`, `mypy.ini`, `pyproject.toml [tool.mypy]`
   - Test frameworks: Jest, Vitest, pytest, Go test, RSpec, PHPUnit

4. **Infrastructure:**
   - `Dockerfile`, `docker-compose.yml` (Docker)
   - `terraform/`, `*.tf` (Terraform)
   - `.github/workflows/` (GitHub Actions)
   - `serverless.yml`, `sam-template.yaml` (Serverless)

Note the **exact versions** where visible (package.json engines, go.mod go directive, Cargo.toml edition, etc.). Version matters — best practices differ between React 18 and React 19, Next.js 14 and Next.js 15, Python 3.10 and Python 3.13.

## Phase 2: Research Best Practices

For EACH detected technology, research its current best practices:

1. **Start with your training data** — you already know established conventions (Effective Go, Rules of Hooks, PEP 8, Rust idioms, etc.)
2. **Use web search to verify and update** — search for `"<technology> <version> best practices <current year>"` to catch:
   - New features that change best practices (e.g., React Server Components, Python 3.12 type syntax)
   - Deprecated patterns that should be avoided
   - Security advisories affecting coding patterns
   - Community consensus shifts (e.g., Prettier vs. dprint, Jest vs. Vitest)
3. **Prioritize authoritative sources**: Official docs, RFCs, style guides from the technology's maintainers, widely-adopted community style guides
4. **Cross-reference**: If your training data and web search disagree, prefer the more recent authoritative source

For each technology, identify:
- **Idioms**: Language/framework-specific patterns that experienced developers expect (Go error handling, Rust ownership, React hooks rules)
- **Conventions**: Code organization, naming, file structure patterns specific to this technology
- **Pitfalls**: Common mistakes that are easy to make and hard to debug in this technology
- **Security considerations**: Technology-specific security best practices (e.g., SQL injection patterns in ORMs, XSS in template engines)
- **Performance patterns**: Technology-specific performance practices (e.g., React memo, Go goroutine patterns, Python async)
- **Tooling expectations**: Which linters/formatters/checkers should be enabled and how

## Phase 3: Generate Stack Standards

Write the results to `.github/instructions/stack-standards.instructions.md`.

### Output Rules

- Preserve the existing frontmatter (description, applyTo, generation-source)
- Replace the body with the researched best practices
- Use ⛔/✅ format consistent with other instruction files
- Organize by technology — one `##` section per detected technology
- Add a "Detected Stack" summary at the top listing all found technologies with versions
- Only include rules that ADD to or DIFFER FROM `coding-standards.instructions.md` — read that file first to avoid duplication
- Target 5-15 rules per technology, prioritized by impact
- Each rule should be specific and actionable, not vague ("write clean code" is useless; "use `unknown` instead of `any` and narrow with type guards" is useful)

### Example Output Section

```markdown
## Detected Stack

- TypeScript 5.x (via tsconfig.json)
- React 19 (via package.json)
- Next.js 15 — App Router (via next.config.ts)
- Tailwind CSS 4 (via tailwind.config.ts)
- Vitest (via vitest.config.ts)

## TypeScript 5.x

<!-- Source: TypeScript official docs, ts-reset community conventions -->

✅ Enable `strict: true` in `tsconfig.json` — all strict checks active
✅ Use `satisfies` operator for type-safe object literals with inferred types
✅ Use `unknown` instead of `any` — narrow with type guards or assertion functions
✅ Use `interface` for object shapes that may be extended; `type` for unions and intersections
⛔ NEVER use `any` as a type annotation
⛔ NEVER use `require()` — use ES module `import` syntax
⛔ NEVER use `@ts-ignore` — use `@ts-expect-error` with explanation if suppression is unavoidable

## React 19

<!-- Source: React 19 docs, Rules of Hooks -->

✅ Use Server Components by default — add `'use client'` only when component needs browser APIs or state
...
```
