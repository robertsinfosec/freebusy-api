---
description: "Use when writing, reviewing, or modifying UI components, HTML, CSS, templates, CLI output, email templates, or any code producing user-facing interaction or content. Enforces WCAG 2.2 AA, WAI-ARIA Authoring Practices Guide, semantic HTML, keyboard operability, and inclusive design."
applyTo: "**/*.tsx, **/*.jsx, **/*.html, **/*.vue, **/*.svelte, **/*.astro, **/*.css, **/*.scss, **/*.ejs, **/*.hbs, **/*.njk, **/*.cshtml, **/*.razor"
generation-source: "generation/instructions/accessibility.md"
---

# Accessibility Standards

WCAG 2.2 AA is the baseline. All user-facing code must conform. This file implements the technical baseline commonly used to satisfy accessibility obligations (ADA, Section 508, EN 301 549, EAA) — project-specific legal requirements may impose stricter or additional obligations.

## 1. Semantic Structure and Native Elements

✅ Use the correct HTML element for its purpose — `<button>` for actions, `<a>` for navigation, `<input>` for data entry
⛔ NEVER use `<div>` or `<span>` with click handlers as interactive controls
✅ Use `type="button"` on buttons inside forms that are not submit buttons
✅ Maintain a logical heading hierarchy — one `<h1>` per page, no skipped levels
✅ Use landmark regions: `<nav>`, `<main>`, `<header>`, `<footer>`, `<aside>`, `<section>` with accessible label
✅ Set document language with `lang` attribute on `<html>`
✅ Provide descriptive, unique `<title>` for each page or view
✅ Use `<table>`, `<th>`, `<td>` for tabular data — associate headers with `scope` or `headers`, provide `<caption>`
⛔ NEVER use table markup for layout
<!-- WCAG: 1.3.1, 1.3.2, 1.3.6, 2.4.1, 2.4.2, 2.4.6, 3.1.1 -->

## 2. Accessible Names, Labels, and Instructions

✅ Every interactive control must have a programmatically determinable accessible name
✅ Visible labels must match or be contained in the accessible name
✅ Icon-only buttons and controls must have `aria-label` or visually hidden text
✅ Links and buttons must describe their action or destination without relying on surrounding context
⛔ NEVER use `placeholder` as the sole label for an input
⛔ NEVER use vague link text: "Click here", "Read more", "Learn more" without distinguishing context
<!-- WCAG: 1.3.1, 2.4.4, 2.4.6, 2.5.3, 4.1.2 -->

## 3. Keyboard Operability and Logical Navigation

✅ All interactive elements must be operable via keyboard alone
✅ Tab order must follow a logical sequence matching the visual layout
✅ Implement standard keyboard patterns: Enter/Space for activation, Escape for dismissal, Arrow keys within composite widgets
✅ Every pointer, gesture, and drag interaction must have a keyboard-equivalent alternative
⛔ NEVER create keyboard traps — the user must always be able to navigate away
⛔ NEVER implement hover-only or pointer-only interactions with no keyboard path
<!-- WCAG: 2.1.1, 2.1.2, 2.4.3, 2.5.7 -->

## 4. Focus Visibility and Focus Management

✅ All focusable elements must have a visible focus indicator meeting contrast requirements
✅ Focus indicator must not be fully obscured by other content
✅ Move focus to modal/dialog on open — return focus to the trigger element on close
✅ SPA route/view changes must update `document.title`, move focus to new content or announce the change
⛔ NEVER remove or suppress focus indicators for aesthetic reasons
⛔ NEVER allow focus to be stolen unexpectedly by dynamic content updates
<!-- WCAG: 2.4.7, 2.4.11, 3.2.1 -->

## 5. ARIA: Only When Necessary, APG-Compliant When Used

✅ Use native HTML semantics FIRST — do not add ARIA to recreate what native elements already provide
✅ When ARIA IS required for custom widgets: follow WAI-ARIA Authoring Practices Guide (APG) patterns for that widget type (tabs, combobox, dialog, menu, tree, etc.)
✅ All custom ARIA widgets must have complete keyboard interaction support per APG
⛔ NEVER apply `aria-hidden="true"` to elements that contain focusable content
⛔ NEVER use invalid role/state/property combinations
⛔ NEVER add `role="button"` to a `<div>` without also adding keyboard event handling (keydown Enter/Space) and `tabindex="0"`
<!-- WCAG: 4.1.2 | APG -->

## 6. Color, Contrast, and Non-Visual Communication

✅ Normal text: minimum 4.5:1 contrast ratio against background
✅ Large text (18pt+ or 14pt+ bold): minimum 3:1 contrast ratio
✅ UI components and graphical objects: minimum 3:1 contrast against adjacent colors
✅ Use text, icons, patterns, or shape as secondary indicators alongside color
⛔ NEVER convey information by color alone — required fields, errors, statuses, states must have non-color indicators
⛔ NEVER embed meaningful text in images without an equivalent text alternative
<!-- WCAG: 1.4.1, 1.4.3, 1.4.11 -->

## 7. Forms, Validation, Status, and Error Prevention

✅ Every `<input>`, `<select>`, `<textarea>` must have a visible, programmatically associated `<label>`
✅ Group related controls with `<fieldset>` and `<legend>`
✅ Validation errors must identify the field AND the problem, and be programmatically associated (`aria-describedby` or `aria-errormessage`)
✅ For critical or destructive actions: provide confirmation, review, or undo mechanisms
✅ Auto-complete suggestions and date pickers must be keyboard operable and announced
⛔ NEVER rely solely on color, placeholder text, or timing for validation feedback
<!-- WCAG: 1.3.1, 3.3.1, 3.3.2, 3.3.3, 3.3.4, 3.3.7, 3.3.8 -->

## 8. Dynamic Content, Live Regions, and SPA Transitions

✅ Status messages must be announced without moving focus — use `aria-live="polite"` or `role="status"`
✅ Async operations (loading, saving, submitting) must expose loading, success, and failure states to assistive tech
✅ Toast and snackbar notifications must use live regions (`aria-live` or `role="alert"` as appropriate)
✅ SPA route changes must: update `document.title`, manage focus, and announce navigation
⛔ NEVER insert or remove dynamic content in ways that break reading order or lose focus
⛔ NEVER use visual-only indicators (spinners, color changes) for loading or status without a programmatic announcement
<!-- WCAG: 4.1.3, 3.2.1, 3.2.2 -->

## 9. Media, Motion, Flashing, and Timed Content

✅ Respect `prefers-reduced-motion` — disable or reduce animations and transitions
✅ Provide immediate pause, stop, or hide controls for any auto-playing audio, video, or animation
✅ Auto-advancing content (carousels, slideshows) must have pause/stop and manual navigation controls
✅ Provide captions for video and transcripts for audio content
✅ Provide accommodation for time limits (extend, disable, or warn before expiry)
⛔ NEVER produce content that flashes more than 3 times per second
⛔ NEVER force time limits on interactions without an accommodation mechanism
<!-- WCAG: 1.2.1, 1.2.2, 2.2.1, 2.2.2, 2.3.1 -->

## 10. Reflow, Zoom, Spacing, and Target Size

✅ Content must reflow at 320px viewport width without horizontal scrolling (except data tables, maps, toolbars)
✅ Content and functionality must be preserved at 200% browser zoom
✅ Text must be resizable up to 200% without loss of content or function
✅ User spacing overrides (line-height, paragraph spacing, word/letter spacing) must not break content or hide information
✅ Interactive targets: minimum 24x24 CSS pixels with adequate spacing between adjacent targets
✅ Dragging interactions must have a single-pointer, non-drag alternative
⛔ NEVER build pixel-tight layouts that clip or overflow-hide content under zoom or spacing changes
<!-- WCAG: 1.4.4, 1.4.10, 1.4.12, 2.5.5, 2.5.7, 2.5.8 -->

## 11. Images and Non-Text Content

✅ Meaningful images must have descriptive `alt` text conveying their purpose
✅ Decorative images must have `alt=""`
✅ Complex images (charts, diagrams) must have extended descriptions
⛔ NEVER omit `alt` attributes on `<img>` elements — choose meaningful text or empty string, never absent
<!-- WCAG: 1.1.1 -->

## 12. Testing and Verification

✅ Run automated accessibility testing in CI (axe-core, Lighthouse, or equivalent) — catches ~30-40% of issues
✅ Manually test keyboard navigation for all interactive components
✅ Test with at least one screen reader (NVDA, VoiceOver, or JAWS) for critical user flows
✅ Verify focus management, live region announcements, and heading navigation manually
✅ Test at 200% zoom and 320px viewport width
⛔ NEVER treat automated scan results as proof of accessibility — manual testing is required
