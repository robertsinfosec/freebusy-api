---
description: "Use when writing, reviewing, or modifying user-facing content, UI components, documentation, or any visible output. Enforces brand consistency by referencing docs/BRAND.md for org-specific standards. Warns if BRAND.md is missing."
applyTo: "**/*.md, **/*.html, **/*.css, **/*.scss, **/*.less, **/*.tsx, **/*.jsx, **/*.vue, **/*.svelte, **/*.hbs, **/*.ejs, **/*.pug, **/*.astro"
generation-source: "generation/instructions/brand-compliance.md"
---

# Brand Compliance

All user-facing content must follow the brand standards defined in `docs/BRAND.md`. This instruction file enforces that brand standards exist and are applied consistently — the actual brand definitions (colors, typography, voice, terminology) live in the per-repository `docs/BRAND.md` file.

## 1. Brand File Requirement

✅ The repository MUST contain a `docs/BRAND.md` file defining the project's brand standards
✅ If `docs/BRAND.md` does not exist, WARN on every change to user-facing content and recommend creating it
✅ `docs/BRAND.md` must define at minimum: color palette (with hex/RGB values), typography choices, voice and tone guidelines, approved terminology, and logo usage rules
⛔ NEVER make brand-related decisions (colors, terminology, tone) without consulting `docs/BRAND.md` first

## 2. Voice and Tone

✅ Follow the voice and tone guidelines defined in `docs/BRAND.md`
✅ When `docs/BRAND.md` is absent, use a clear, professional, and consistent tone as the universal fallback
✅ Error messages must be helpful and actionable — describe what happened and what the user can do next
✅ Use consistent terminology throughout all surfaces — never use different words for the same concept
⛔ NEVER use blaming language in user-facing messages ("You failed to...", "Invalid input")

## 3. Visual Identity

✅ Reference `docs/BRAND.md` for the approved color palette, typography, and spacing system
✅ Use design tokens or CSS custom properties for brand colors — never hardcode hex values directly in components
✅ Logo usage must follow the guidelines in `docs/BRAND.md` (minimum size, clear space, approved color variations)
⛔ NEVER introduce colors, fonts, or visual patterns that are not defined in the brand system

## 4. Terminology and Naming

✅ Use the approved terminology list from `docs/BRAND.md` for all product names, feature names, and UI labels
✅ Follow the capitalization, hyphenation, and abbreviation rules defined in the terminology guide
⛔ NEVER rename or rephrase established product terms without updating the terminology guide
⛔ NEVER use internal code names, abbreviations, or jargon in user-facing content

## 5. Consistency Across Surfaces

✅ Button labels, navigation items, headings, and error messages must use consistent language across all surfaces (UI, docs, emails, CLI)
✅ Date, time, number, and currency formatting must follow a single convention defined in `docs/BRAND.md`
✅ Tone must remain consistent across UI, documentation, error states, and empty states
⛔ NEVER use different formatting conventions for the same data type across different parts of the application
