---
description: "Use when writing, reviewing, or modifying database migrations, models, schemas, SQL queries, ORM configurations, or any code that interacts with a database. Enforces parameterized queries, safe migration practices, data protection, connection management, and data integrity controls."
applyTo: "**/migrations/**, **/models/**, **/schema/**, **/entities/**, **/*.sql, **/prisma/**, **/drizzle/**, **/alembic/**, **/knex/**, **/sequelize/**, **/typeorm/**, **/db/**"
generation-source: "generation/instructions/database-safety.md"
---

# Database Safety

All code that interacts with a database must follow these rules. This file adds database-specific depth to the general injection and secrets management rules in `security-standards.instructions.md`.

## 1. Parameterized Queries and Injection Prevention

✅ Use parameterized queries or ORM query builders for ALL database operations — including SELECTs
✅ Allowlist-validate any dynamic identifiers (table names, column names) — never pass user input directly
✅ Use the ORM's built-in methods when available — drop to raw queries only when the ORM cannot express the operation
⛔ NEVER concatenate, interpolate, or template user input into SQL strings
⛔ NEVER trust user-supplied values for query structure — only for query parameters
<!-- OWASP-ASVS: V5 | CWE: 89 | OWASP: A03 -->

## 2. Migration Safety

✅ Migrations must be additive and backward-compatible with the currently deployed application version
✅ Stage destructive changes (DROP COLUMN, RENAME) across at least two deployments: first deploy stops using the column, second deploy removes it
✅ Every migration must have a corresponding rollback/down migration
✅ Separate schema migrations from data migrations — never mix DDL and DML in the same migration file
✅ Add NOT NULL columns with a DEFAULT value, or add as nullable first, backfill, then add the constraint
⛔ NEVER run untested migrations against production — test against production-scale data volumes first
⛔ NEVER perform long-running data transformations inside schema migration transactions

## 3. Schema Design and Data Integrity

✅ Enforce constraints at the database level: NOT NULL, UNIQUE, CHECK, FOREIGN KEY — application validation is not a substitute
✅ Define indexes for columns used in WHERE, JOIN, and ORDER BY clauses
✅ Use appropriate data types — dates as date/timestamp, monetary values as decimal/numeric, UUIDs as native UUID type
✅ Include audit columns on every table: `created_at`, `updated_at` at minimum
⛔ NEVER store dates as strings or monetary values as floating-point types
⛔ NEVER rely solely on application logic for referential integrity

## 4. Data Protection and Encryption

✅ Encrypt sensitive data at rest — PII, credentials, tokens, financial data, health data
✅ Hash passwords with bcrypt, scrypt, or Argon2id with current recommended parameters
✅ Classify data by sensitivity level and apply controls accordingly
✅ Mask or redact sensitive fields in application logs, error responses, and debug output
⛔ NEVER hash passwords with MD5, SHA-1, or unsalted SHA-256
⛔ NEVER store, log, or return PII in URLs, query parameters, error messages, or stack traces
⛔ NEVER store plaintext passwords, API keys, or tokens in the database
<!-- OWASP-ASVS: V8 | CWE: 312, 916 | NIST: SC-28 -->

## 5. Connection Management

✅ Use connection pooling — configure pool size, idle timeout, and connection timeout
✅ Require TLS for all database connections — verify server certificates
✅ Store database credentials in a secrets manager — inject at runtime via environment variables
✅ Close or return connections after use — use try-with-resources, context managers, or framework-managed lifecycle
⛔ NEVER hardcode database credentials in source code, config files, or Docker images
⛔ NEVER open a new connection per query outside of a connection pool
⛔ NEVER connect to databases over unencrypted channels
<!-- CWE: 319 | NIST: SC-8 -->

## 6. Authorization and Tenant Isolation

✅ Every query that returns or modifies user data must scope to the authenticated user or tenant
✅ Verify authorization server-side — never trust client-supplied IDs as proof of access
✅ Multi-tenant systems must enforce tenant boundaries at the query layer — not just the application layer
⛔ NEVER expose an endpoint that allows querying arbitrary rows by ID without authorization verification
<!-- CWE: 862, 863 -->

## 7. Transaction Safety

✅ Use explicit transactions for multi-step write operations — never leave partial state on failure
✅ Handle transaction rollback in every error/exception path
✅ Choose appropriate isolation levels — understand the tradeoffs between consistency and performance
⛔ NEVER commit partial state — if any step fails, the entire transaction must roll back
⛔ NEVER hold transactions open during external calls (HTTP requests, queue publishes) — this blocks connections and risks deadlocks

## 8. Data Lifecycle and Retention

✅ Define retention policies for sensitive data — delete or anonymize data that is no longer needed
✅ Implement soft-delete where business logic requires audit trails — with configurable hard-delete after retention period
✅ Verify backup and restore procedures regularly — untested backups are not backups
⛔ NEVER retain sensitive data beyond its defined retention period without documented justification
