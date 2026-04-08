# Freebusy API Brand Standards

Navigation: [Home](../README.md) | [Product Requirements](PRD.md) | [Architecture](dev/ARCHITECTURE.md) | [Style Guide](../STYLE_GUIDE.md)

This document is the source of truth for user-facing language and visual guidance in this repository.

> [!NOTE]
> Freebusy API is primarily an API service, not a consumer UI product. These standards still apply to documentation, API-facing copy, issue templates, and any future UI surfaces.

## 1. Brand Identity

- Product name: Freebusy API
- Repository/service slug: freebusy-api
- Organization name: Roberts InfoSec
- Primary positioning: Security-first availability API for calendar free/busy data

Use `Freebusy API` in user-facing prose. Use `freebusy-api` only for technical identifiers such as repository names, URLs, and CLI commands.

## 2. Color Palette

Use these tokens for diagrams, docs callouts, and future UI elements.

| Token | Hex | RGB | Usage |
|------|-----|-----|-------|
| `brand.primary` | `#0B5FFF` | `11, 95, 255` | Primary links, primary action accents |
| `brand.accent` | `#0A8F6A` | `10, 143, 106` | Positive status, success accents |
| `brand.warning` | `#B86A00` | `184, 106, 0` | Warnings and cautions |
| `brand.danger` | `#A12622` | `161, 38, 34` | Errors and high-risk states |
| `brand.neutral.900` | `#1F2328` | `31, 35, 40` | Primary text |
| `brand.neutral.600` | `#57606A` | `87, 96, 106` | Secondary text |
| `brand.surface` | `#F6F8FA` | `246, 248, 250` | Background and surface blocks |

Accessibility baseline:

- Maintain WCAG 2.2 AA contrast for text and UI states.
- Never use color as the only indicator for state.

## 3. Typography

Preferred typography for documentation and future UI:

- Headings: `Segoe UI`, `Inter`, `Helvetica Neue`, `Arial`, sans-serif
- Body text: `Segoe UI`, `Inter`, `Helvetica Neue`, `Arial`, sans-serif
- Code and technical snippets: `Consolas`, `SFMono-Regular`, `Menlo`, `Monaco`, monospace

Typography rules:

- Use sentence case for headings and labels.
- Keep line length readable (target 80-110 characters in prose).
- Use monospace formatting only for code, paths, commands, and literal config keys.

## 4. Voice and Tone

Voice attributes:

- Clear
- Practical
- Security-aware
- Direct, not alarmist

Tone by context:

- Documentation: instructional and concise
- Errors: factual, actionable, non-blaming
- Security notes: explicit about risk and mitigation

Write in active voice and explain what to do next whenever an operation can fail.

## 5. Approved Terminology

Use these terms consistently across docs and UI copy.

| Preferred | Avoid | Notes |
|----------|------|-------|
| Freebusy API | FreeBusy API, free busy API | Product name in prose |
| freebusy-api | Freebusy-API | Repository/service slug |
| free/busy data | availability feed dump | Use standards-based language |
| upstream iCal feed | source calendar dump | Avoid ambiguous wording |
| owner timezone | local timezone | Clarifies calendar owner context |
| UTC instant | UTC time string | Prefer precise terminology |
| rate limited | blocked | Use HTTP semantics |
| misconfigured | broken config | Keep neutral and actionable |

## 6. Logo Usage Rules

There is currently no standalone logo asset in this repository.

Until an approved logo is added:

- Use the text mark `Freebusy API` for user-facing branding.
- Do not create or introduce unofficial logos, icons, or wordmarks.
- If a logo is introduced later, update this file with approved assets, clear-space rules, and minimum size.

## 7. Copy Examples

Preferred:

- `The request was rate limited. Retry after the indicated window.`
- `FREEBUSY_ICAL_URL is required and must be an https URL.`

Avoid:

- `You did this wrong.`
- `Bad request.`

## 8. Review Checklist

Before merging user-facing content changes, confirm:

- Product and repo names follow Section 1.
- Terminology matches Section 5.
- Tone follows Section 4 and includes actionable language.
- Any visual additions use Section 2 tokens and meet accessibility requirements.