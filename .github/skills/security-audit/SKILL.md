---
description: "Full security audit workflow. Use when performing a comprehensive security review of the codebase or a specific module. Walks through OWASP Top 10, API Top 10, NIST 800-53 controls, and produces a structured audit report with findings and remediations."
name: "security-audit"
generation-source: "generation/skills/security-audit.md"
---

# Security Audit

## When to Use

- Performing a comprehensive security review of the codebase
- Auditing a specific module or feature for vulnerabilities
- Pre-release security assessment
- Responding to a security incident or vulnerability report

## Prerequisites

- Read `.github/instructions/security-standards.instructions.md` for project security governance
- Determine audit scope: full codebase or specific module/files

## Procedure

### Step 1: Scope the Audit

Identify:
- Files/modules in scope
- Technology stack (affects which vulnerability patterns to check)
- External integrations (APIs, databases, third-party services)
- Authentication/authorization boundaries

### Step 2: OWASP Top 10 Review

For each OWASP category, systematically scan the codebase:

| Category | What to Look For |
|----------|------------------|
| A01 Broken Access Control | Missing auth checks, IDOR, privilege escalation, CORS misconfiguration |
| A02 Cryptographic Failures | Weak algorithms, hardcoded keys, missing encryption, improper certificate validation |
| A03 Injection | SQL/NoSQL injection, command injection, LDAP injection, XSS |
| A04 Insecure Design | Missing rate limiting, business logic flaws, missing threat model |
| A05 Security Misconfiguration | Default credentials, verbose errors, unnecessary features enabled |
| A06 Vulnerable Components | Known CVEs in dependencies (cross-reference with SCA results) |
| A07 Authentication Failures | Weak password policies, missing MFA, session fixation, credential stuffing |
| A08 Data Integrity Failures | Insecure deserialization, missing integrity checks, unsigned updates |
| A09 Logging Failures | Missing security event logs, log injection, PII in logs |
| A10 SSRF | Unvalidated URL fetches, internal network access, cloud metadata access |

### Step 3: API Security Review (if applicable)

If the codebase exposes APIs, additionally check OWASP API Security Top 10:
- Broken object-level authorization
- Broken authentication
- Broken object property-level authorization
- Unrestricted resource consumption
- Broken function-level authorization
- Server-side request forgery
- Security misconfiguration
- Lack of protection from automated threats
- Improper asset management
- Unsafe consumption of APIs

### Step 4: Secrets Scan

- Search for hardcoded secrets, API keys, tokens, passwords
- Check for secrets in logs, error messages, comments
- Verify environment variable usage for sensitive configuration
- Check `.gitignore` covers secret-containing files

### Step 5: Produce Audit Report

**Executive Summary**: Total findings by severity, overall risk posture

**Findings Table**:
| # | Severity | CWE | OWASP | File:Line | Description | Remediation |
|---|----------|-----|-------|-----------|-------------|-------------|

**Detailed Findings**: For each finding:
- Evidence: Code snippet demonstrating the vulnerability
- Impact: What an attacker could achieve
- Remediation: Specific fix with code example
- Priority: Based on exploitability × impact

## References

- `.github/instructions/security-standards.instructions.md`
- `.github/instructions/sast-scanning.instructions.md`
- `.github/instructions/sca-scanning.instructions.md`
