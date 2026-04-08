---
description: "GRC compliance review workflow. Use when performing a regulatory compliance audit for PCI-DSS, GDPR, CCPA, or other data protection regulations. Produces a compliance matrix with regulatory citations and remediation requirements."
name: "compliance-review"
generation-source: "generation/skills/compliance-review.md"
---

# Compliance Review

## When to Use

- Performing a regulatory compliance audit on the codebase
- Preparing for a compliance assessment or certification
- Reviewing new features that handle personal data, payment data, or health data
- Responding to regulatory inquiry or audit request

## Prerequisites

- Read `.github/instructions/compliance-controls.instructions.md` to understand org-specific regulatory obligations
- If that file is a stub, warn the user and proceed with generic data protection best practices

## Procedure

### Step 1: Identify Applicable Regulations

From `compliance-controls.instructions.md`, determine which frameworks apply:
- PCI-DSS v4.0 — if handling payment card data
- GDPR — if processing EU personal data
- CCPA/CPRA — if processing California consumer data
- HIPAA — if processing protected health information
- SOC 2 — if providing services with trust service criteria
- Other frameworks as specified in compliance-controls

### Step 2: Map Data Flows

Identify how sensitive data moves through the system:
- Where is personal/sensitive data collected?
- Where is it stored? (databases, caches, logs, files)
- Where is it transmitted? (APIs, message queues, third-party services)
- Where is it deleted or retained?
- Document each flow: Source → Processing → Storage → Transmission → Deletion

### Step 3: Evaluate Controls

For each applicable regulation, evaluate:

**Data Protection**
- Encryption at rest (algorithm, key management)
- Encryption in transit (TLS version, certificate validation)
- Data classification enforcement
- Access control granularity

**Privacy**
- Consent collection and management
- Data subject rights implementation (access, deletion, portability)
- Data minimization practices
- Purpose limitation enforcement

**Audit Trail**
- Logging completeness for data access events
- Log tamper-resistance
- Retention period compliance
- Evidence generation for auditors

**Incident Response**
- Breach notification mechanisms
- Emergency access revocation capability
- Forensic logging support

### Step 4: Produce Compliance Matrix

| Control ID | Regulation | Description | Status | Evidence | Finding |
|-----------|-----------|-------------|--------|----------|---------|
| DC-001 | GDPR Art. 32 | PII encrypted at rest | ✅ PASS | AES-256 in UserModel | — |
| DC-002 | PCI-DSS 3.5 | Card data encryption | ❌ FAIL | Plaintext in logs | Log scrubbing needed |

### Step 5: Detail Findings

For each FAIL or PARTIAL:
- **Control**: ID and description
- **Regulation**: Specific section (e.g., "GDPR Article 32(1)(a)")
- **Finding**: What is non-compliant
- **Risk**: Business impact (fine amounts, breach notification obligations)
- **Remediation**: Specific technical fix with priority

## References

- `.github/instructions/compliance-controls.instructions.md` — org-specific controls
- `.github/instructions/security-standards.instructions.md` — technical security controls
