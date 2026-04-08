---
description: "Structured threat modeling workflow using STRIDE methodology. Use when designing new features, reviewing architecture, or assessing security posture of a component. Produces threat tables, data flow diagrams, and mitigation checklists."
name: "threat-modeling"
generation-source: "generation/skills/threat-modeling.md"
---

# Threat Modeling

## When to Use

- Designing a new feature or component
- Reviewing architecture of an existing system
- Assessing security posture before a release
- After a security incident to identify missed threats
- When `docs/ARCHITECTURE.md` is updated with new data flows

## Prerequisites

- Read `.github/instructions/security-standards.instructions.md` for security governance
- Read `docs/ARCHITECTURE.md` if it exists — understand system structure and data flows

## Procedure

### Step 1: Define Scope

Identify the system or component to model:
- What are its boundaries?
- What data does it process?
- Who are the actors (users, services, external systems)?
- What are the trust boundaries?

### Step 2: Build Data Flow Diagram

Map how data moves through the system:

```
[External User] --HTTPS--> [Web Server] --SQL--> [Database]
                                |                    |
                          [Auth Service]     [Backup Storage]
```

Identify for each flow:
- Protocol and transport security
- Authentication mechanism
- Data classification (public, internal, confidential, restricted)
- Trust boundary crossings

### Step 3: Apply STRIDE Analysis

For each component and data flow, evaluate all six STRIDE categories:

| Threat | Question | Example |
|--------|----------|---------|
| **S**poofing | Can an attacker impersonate a legitimate actor? | Forged JWT, stolen session cookie |
| **T**ampering | Can an attacker modify data in transit or at rest? | Man-in-the-middle, SQL injection |
| **R**epudiation | Can an actor deny performing an action? | Missing audit logs, unsigned transactions |
| **I**nformation Disclosure | Can an attacker access unauthorized data? | Error messages leaking internals, IDOR |
| **D**enial of Service | Can an attacker make the system unavailable? | Resource exhaustion, algorithmic complexity |
| **E**levation of Privilege | Can an attacker gain higher access? | Privilege escalation, insecure defaults |

### Step 4: Produce Threat Table

| # | Component | Threat (STRIDE) | Description | Likelihood | Impact | Risk | Mitigation |
|---|-----------|-----------------|-------------|-----------|--------|------|------------|
| T-001 | Auth API | Spoofing | Brute-force login | High | High | Critical | Rate limiting, account lockout |
| T-002 | Database | Tampering | SQL injection via search | Medium | Critical | High | Parameterized queries |

### Step 5: Mitigation Checklist

For each identified threat:
- [ ] Mitigation implemented or planned
- [ ] Mitigation verified in code
- [ ] Test coverage for the threat scenario
- [ ] Monitoring/alerting configured

### Step 6: Document

Produce a threat model document containing:
1. Scope and assumptions
2. Data flow diagram
3. STRIDE analysis table
4. Risk-ranked threat inventory
5. Mitigation status and gaps

Store as `docs/THREAT-MODEL.md` or as an ADR in `docs/adr/`.

## References

- `.github/instructions/security-standards.instructions.md`
- `docs/ARCHITECTURE.md` — system architecture and data flows
- STRIDE methodology: Microsoft Threat Modeling
