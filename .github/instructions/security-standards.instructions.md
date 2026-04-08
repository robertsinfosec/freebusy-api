---
description: "Use when writing, reviewing, or modifying ANY code. Enforces security engineering standards anchored to OWASP ASVS, NIST SSDF, SLSA, CWE Top 25, OWASP Top 10, and NIST 800-53. Applies to all languages, frameworks, and file types."
applyTo: "**"
generation-source: "generation/instructions/security-standards.md"
---

# Security Standards

These rules are non-negotiable. Every code change must comply. When in doubt, choose the more restrictive option.

## Required Security Mindset

When generating or modifying code:
- Assume all input can be malicious
- Assume all external systems can fail or return malicious data
- Assume all client-controlled data can be tampered with
- Assume attackers will chain small weaknesses
- Prefer simple, reviewable, least-privilege designs
- Preserve confidentiality, integrity, availability, and auditability

## Input Handling & Injection Prevention

⛔ NEVER construct SQL, NoSQL, LDAP, OS commands, XPath, or templates by concatenating untrusted input
✅ ALWAYS use parameterized queries, prepared statements, safe APIs, or structured interfaces
✅ Validate all input at trust boundaries with strict allowlists: type, length, range, pattern, schema
✅ Canonicalize input before validation when relevant (Unicode normalization, path resolution)
⛔ NEVER rely solely on client-side validation — server-side validation is mandatory
⛔ NEVER use denylists as a primary defense — denylists are always incomplete
⛔ NEVER deserialize untrusted data without schema validation and type constraints
⛔ NEVER use dynamic execution features (eval, exec, Function constructor) unless explicitly justified and sandboxed
✅ Reject malformed, ambiguous, or unexpected input — do not attempt to "fix" it
✅ Enforce request size limits on all endpoints
<!-- ASVS: V5 | CWE: 20, 78, 79, 89, 94, 502 | OWASP: A03, API4 | NIST: SI-10 -->

## Authentication & Session Management

⛔ NEVER implement custom authentication unless explicitly required and approved — use established identity providers and libraries
✅ Validate identity server-side for every protected operation — no endpoint exempt, including "internal" ones
✅ Store passwords using adaptive hashing only: bcrypt, Argon2id, or scrypt with current recommended work factors
⛔ NEVER use MD5, SHA1, or plain SHA256 for password storage
✅ Use constant-time comparison for all secret and token validation
✅ Set session cookies with `Secure`, `HttpOnly`, `SameSite=Strict` (or `Lax` with documented justification)
✅ Invalidate session tokens server-side on logout, password change, and privilege escalation
✅ Enforce session idle timeout and absolute timeout
✅ Prefer short-lived credentials and tokens over long-lived static secrets
⛔ NEVER embed credentials in URLs — use Authorization headers
✅ Implement account lockout or progressive delays after repeated failed authentication attempts
<!-- ASVS: V2, V3 | CWE: 287, 384, 613 | OWASP: A02, A07, API2 | NIST: IA-5, IA-6, AC-7 -->

## Authorization & Access Control

✅ Default deny — every resource requires explicit access grants
✅ Enforce object-level, function-level, AND field-level access on every request
✅ Separate authentication from authorization — a valid identity does not imply permission
⛔ NEVER rely on obscurity (hidden URLs, unpredictable IDs), client-side checks, or role names alone
✅ Admin and privileged functions require authorization enforced at the middleware level
✅ Enforce least privilege for users, services, jobs, and components
✅ Enforce separation of duties for sensitive operations (requester ≠ approver)
✅ Re-authenticate for sensitive operations (password change, payment, data export, privilege escalation)
✅ Validate ownership, tenancy, and scope — prevent insecure direct object references
<!-- ASVS: V4 | CWE: 639, 862, 863 | OWASP: A01, API1, API5 | NIST: AC-3, AC-5, AC-6 -->

## Secrets & Credential Management

⛔ NEVER hardcode secrets, API keys, tokens, certificates, or passwords in code, tests, docs, examples, logs, or CI configs
✅ Store secrets only in approved secret management systems (environment variables as minimum, vault preferred)
✅ Rotate secrets on a defined schedule and immediately on suspicion of exposure
✅ Use scoped, least-privilege credentials — prefer ephemeral over long-lived static secrets
✅ Remove test credentials before merge
✅ Block commits that contain secrets (use pre-commit hooks or CI checks)
✅ Store keys separately from encrypted data — design for key rotation without data loss
⛔ NEVER commit `.env` files, private keys, or credential files to version control
<!-- ASVS: V2.10 | CWE: 522, 798 | OWASP: A02 | NIST: SC-12 -->

## Cryptography & Data Protection

⛔ NEVER design custom cryptographic algorithms or protocols — use approved platform libraries
⛔ NEVER use weak or deprecated algorithms: MD5, SHA1 (for security), DES, 3DES, RC4, ECB mode
✅ Use AES-256-GCM or ChaCha20-Poly1305 for symmetric encryption
✅ Use RSA-2048+ or Ed25519 for asymmetric operations
✅ Require TLS 1.2+ for all network communications — no exceptions
✅ Encrypt PII, PHI, financial data, and credentials at rest
✅ Minimize collection, retention, replication, and exposure of sensitive data — collect only what the business purpose requires
✅ Classify sensitive data and handle according to policy — define retention and deletion behavior
✅ Redact or mask sensitive data in logs, telemetry, traces, error messages, and debugging output
⛔ NEVER send sensitive data in query strings — it leaks in logs, referrer headers, and browser history
<!-- ASVS: V6, V8 | CWE: 311, 327, 328 | OWASP: A02 | NIST: SC-8, SC-12, SC-13, SC-28 -->

## Output & Response Security

✅ Encode all output based on context: HTML entities for HTML, JS escaping for JavaScript, URL encoding for URLs
⛔ NEVER reflect user input in responses without proper context-aware encoding
✅ Set security headers on all responses:
  - `Content-Security-Policy` — restrict script and style sources
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`)
  - `Strict-Transport-Security` — HSTS with `max-age` of at least one year, include subdomains
  - `Referrer-Policy: strict-origin-when-cross-origin` or stricter
✅ Strip stack traces, internal paths, and debug information from production responses
✅ Return generic error messages to users — log details server-side only
<!-- ASVS: V14 | CWE: 79, 116 | OWASP: A03, A05 | NIST: SI-11 -->

## API Security

✅ Authenticate and authorize every API request — validate object-level access on every ID parameter
✅ API responses expose only the fields the consumer needs — use explicit allowlists for serialization
✅ Rate-limit all API endpoints — stricter limits on authentication and sensitive business endpoints
✅ All list endpoints require pagination with an enforced maximum page size
✅ Protect sensitive business flows (checkout, transfer, registration) against automation abuse
✅ When calling third-party APIs, validate all response data — never trust external data
✅ All API endpoints must be versioned and documented — remove deprecated endpoints promptly
⛔ NEVER use `Access-Control-Allow-Origin: *` with credentials — set strict CORS policies
✅ Make idempotency, replay protection, and concurrency behavior explicit when relevant
✅ Disable unnecessary HTTP methods (TRACE, OPTIONS where not required)
<!-- ASVS: V13 | OWASP: API1–API10 | NIST: AC-3, SC-8 -->

## Server-Side Requests

⛔ NEVER allow user-controlled URLs to be fetched server-side without validation
✅ Maintain a strict allowlist of permitted external domains and IP ranges for outbound requests
⛔ NEVER allow server-side requests to internal networks, localhost, link-local (169.254.x.x), or cloud metadata endpoints (169.254.169.254)
✅ Allow only `https://` URL schemes — `http://` requires explicit documented justification
✅ Resolve DNS before connecting and verify the resolved IP is not in a blocked range
<!-- ASVS: V12 | CWE: 918 | OWASP: A10, API7 | NIST: SC-7 -->

## File, Process & System Interaction

✅ Validate and constrain file paths, filenames, archive contents, and upload types
⛔ NEVER allow path traversal — resolve and verify all paths against a safe base directory
⛔ NEVER extract archives without validating entry paths and sizes (zip slip prevention)
⛔ NEVER invoke shells unless strictly necessary — use direct process execution with fixed arguments
✅ Run external processes with least privilege
✅ Isolate code that interacts with the OS, container runtime, or infrastructure control plane
<!-- CWE: 22, 73, 434 | OWASP: A03 -->

## Error Handling & Fail-Safe

✅ Fail closed — if a security check encounters an error, deny access by default
⛔ NEVER catch and silently swallow security-relevant exceptions
✅ Catch specific exceptions, not generic catch-all blocks, in security-critical code paths
⛔ NEVER expose internal implementation details (file paths, stack traces, database schemas) in error responses
✅ Handle invalid states, timeouts, dependency failures, and partial failures explicitly
✅ Assume downstream systems can fail or return malicious/malformed data
✅ Clear sensitive data in memory (zero buffers, close connections) in error/finally blocks
<!-- ASVS: V7 | CWE: 209, 755 | OWASP: A04 | NIST: SI-11 -->

## Logging & Auditability

✅ Log all: authentication events (success and failure), authorization failures, input validation failures, sensitive admin actions, configuration changes, security-relevant system events
⛔ NEVER log: passwords, tokens, session IDs, PII, credit card numbers, encryption keys
⛔ NEVER log raw request/response bodies without redacting sensitive fields
✅ Use structured logging (JSON) with: ISO 8601 timestamp, user/session ID, action, resource, outcome, source IP, correlation ID
✅ Protect logs from tampering and unauthorized access — append-only stores where possible
✅ Make security events detectable and actionable by monitoring systems
✅ Preserve enough context for investigation without over-collecting data
<!-- ASVS: V7 | CWE: 532 | OWASP: A09 | NIST: AU-2, AU-3, AU-6 -->

## Secure Configuration & Defaults

✅ Ship with the safest configuration enabled by default
✅ Require explicit documented approval to weaken any security setting
✅ Disable unused features, protocols, ports, endpoints, accounts, and integrations
✅ Restrict admin interfaces and debug functionality in production
✅ Externalize security-relevant configuration — validate on startup
✅ Fail closed when critical security configuration is missing or invalid
<!-- ASVS: V14 | OWASP: A05 | CISA: Secure by Design -->

## Availability & Resilience

✅ Apply timeouts, retries with backoff, circuit breaking, and resource limits
⛔ NEVER allow unbounded memory, CPU, storage, queue, or network consumption
✅ Protect expensive operations from abuse — DoS resistance is part of normal design, not an afterthought
✅ Design for graceful degradation under load, fault, or dependency failure
<!-- CWE: 400, 770 | OWASP: API4 -->

## Memory Safety & Unsafe Operations

✅ Prefer memory-safe languages and libraries
⛔ NEVER use unsafe code, native interop, or manual buffer management without explicit justification and isolation
✅ Validate lengths, offsets, bounds, and lifetimes explicitly where memory safety is not guaranteed
✅ Use compiler, runtime, and platform hardening features appropriate to the stack
<!-- CWE: 119, 120, 125, 416, 787 -->

## Business Logic & Abuse Resistance

✅ Identify misuse cases and abuse paths during design and review
✅ Protect high-value workflows against fraud, enumeration, replay, race conditions, and privilege escalation
✅ Enforce workflow invariants server-side — do not assume users follow intended paths
✅ Add anti-automation controls where abuse risk exists
<!-- CWE: 362, 840 | OWASP: API6 -->

## AI-Generated Code

✅ Treat ALL AI-generated code as untrusted until reviewed
✅ Review generated code for: authentication, authorization, input validation, secrets exposure, insecure dependencies, insecure defaults, logging issues, and business logic flaws
⛔ NEVER accept generated code that bypasses established security patterns or approved libraries
✅ Verify generated code against project standards, threat models, and tests
⛔ NEVER paste secrets, proprietary source, regulated data, or sensitive production data into prompts unless explicitly approved
<!-- CISA: Secure by Design | NIST: SSDF -->

## Supply Chain & Build Integrity

✅ Use maintained, trusted dependencies from approved sources only — minimize dependency count
✅ Pin versions, commit lockfiles, verify checksums and signatures before installation
⛔ NEVER install from untrusted sources or use `curl | bash` patterns in production
⛔ NEVER ignore security advisories for direct or transitive dependencies
✅ Treat build scripts, CI/CD workflows, plugins, and transitive dependencies as attack surface
✅ Peer review for security-relevant changes — block release on critical security failures unless formally approved
✅ Protect build pipelines, runners, secrets, and signing — restrict who can approve, merge, tag, publish, deploy
✅ Preserve traceability from source change to released artifact
_See also: `sca-scanning.instructions.md` for dependency tooling, `sast-scanning.instructions.md` for static analysis._
<!-- SLSA | NIST: SSDF | CWE: 829 | OWASP: A06, A08 | NIST: SI-7 -->

---

## Non-Negotiable Rules

⛔ Never hardcode secrets
⛔ Never trust client-side authorization
⛔ Never concatenate untrusted input into interpreters or system commands
⛔ Never expose sensitive internals in errors or logs
⛔ Never weaken security defaults without documented approval
⛔ Never merge security-relevant code without review and testing
⛔ Never accept AI-generated code that bypasses security patterns

---

## Reference Standards

| Standard | Role |
|----------|------|
| **OWASP ASVS v5** | App-level control baseline — "what must the application do?" |
| **NIST SP 800-218 (SSDF)** | SDLC/process baseline — "how do we build and maintain securely?" |
| **SLSA v1.0** | Build/artifact integrity — "can we trust the build?" |
| **CWE Top 25** | Weakness reality check — "what keeps getting exploited?" |
| **OWASP Top 10 + API Top 10** | Risk catalogs — ensures coverage of common attack scenarios |
| **OWASP Proactive Controls 2024** | Developer-facing best-practice techniques |
| **NIST SP 800-53** | Enterprise governance overlay (AC, AU, IA, SC, SI families) |
| **CISA Secure by Design** | Producer-responsibility framing for safe defaults and transparency |
