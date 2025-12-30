# Threat Model

This folder contains the project threat model and related security design notes. It exists to keep security-relevant architecture and risks versioned alongside code.

The goal is to make it easy to find the current published threat model, understand what it covers, and keep it updated as the system evolves.

Publishing a threat model under `docs/` is a common OSS practice because it keeps the analysis versioned alongside code changes. Some projects prefer `docs/security/` or `SECURITY/` - the key is that it’s easy to find, reviewed like code, and kept in sync.

- **Primary document:** `THREATMODEL.md` (the current, published threat model)
- **Template:** `THREATMODEL_TEMPLATE.md` (the standard structure for future updates)
- **Scope:** Freebusy API (Cloudflare Worker + Durable Object + upstream iCal fetch)

Note: This is a threat model / security design document, not a penetration test report. It is intended to guide engineering mitigations and to focus any future OWASP-aligned pentest.

## Document roles

This section explains what each file in this folder is for. The goal is to make it obvious where to find the published threat model versus folder-level guidance.

If you are new to the repo, start with `THREATMODEL.md`. If you are updating the threat model, use `THREATMODEL_TEMPLATE.md` to keep structure consistent.

- **`THREATMODEL.md`:** The published threat model (includes both the summary and the detailed threat analysis).
- **`README.md`:** Folder index and update guidance (this file).
- **`THREATMODEL_TEMPLATE.md`:** Starter template for new threat models.

## How to update

This section describes how to keep the threat model current as the codebase evolves. Updates should be made as part of normal engineering work and reviewed like code.

If a security-relevant assumption changes, update the threat model in the same pull request so the reasoning stays in sync with implementation.

1. Update the diagrams and risks in `THREATMODEL.md` as behavior changes.
2. If the API contract changes, update `docs/openapi.yaml` and ensure tests stay in sync.
3. Add mitigations as code/infra changes (Cloudflare WAF/bot rules, Turnstile, deploy controls), and mark risks as reduced/accepted.

Note: When you update the threat model, also update the “Last reviewed” and “As of” fields in `THREATMODEL.md` so readers can see exactly when the analysis was last validated.
