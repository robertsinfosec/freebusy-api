---
description: "Use when writing, reviewing, or modifying ANY code that handles data. This repository currently has no mandatory PCI-DSS, GDPR, or CCPA obligations; security baseline controls still apply and regulated-data scope changes require explicit governance updates."
applyTo: "**"
generation-source: "generation/instructions/compliance-controls.md"
---

# Compliance Controls

This repository currently has no mandatory external GRC obligations.

## Approved Scope

- Regulatory scope status: no required PCI-DSS, GDPR, or CCPA controls for this repository at this time.
- Approval context: maintainer direction captured while implementing issue #70 on 2026-04-08.
- This is a scope statement only, not a waiver of secure engineering requirements.

## Mandatory Baseline Controls

- Security controls remain mandatory through `.github/instructions/security-standards.instructions.md`.
- Engineering quality controls remain mandatory through `.github/instructions/coding-standards.instructions.md` and `.github/instructions/zero-tech-debt.instructions.md`.

## Regulated Data Guardrails

- Do not add handling of payment card data, regulated personal data, or protected health data unless governance scope is updated first.
- If a change introduces regulated-data obligations, stop and update this file in the same change with explicit controls before merge.
- Do not claim certification or compliance posture that is not formally approved and documented.

## Required Format For Future Compliance Scope Changes

Any future compliance obligations added to this file must include all of the following:

- Framework or regulation name.
- Explicit required controls for this repository.
- Approval source (issue/PR link and approver role).
- Effective date and review cadence.
