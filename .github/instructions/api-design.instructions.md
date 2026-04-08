---
description: "Use when designing, implementing, or reviewing APIs, routes, controllers, endpoints, or request handlers. Enforces consistent resource naming, HTTP method semantics, structured error responses, versioning, pagination, idempotency, and API documentation."
applyTo: "**/routes/**, **/api/**, **/controllers/**, **/handlers/**, **/endpoints/**, **/openapi/**, **/swagger/**, **/*.openapi.yaml, **/*.openapi.json"
generation-source: "generation/instructions/api-design.md"
---

# API Design

All HTTP APIs must follow consistent design patterns for predictability, discoverability, and developer experience. Security aspects (authentication, authorization, input validation, rate limiting) are enforced by `security-standards.instructions.md` — this file covers design patterns.

## 1. Resource Naming and URL Structure

✅ Use plural nouns for collection endpoints: `/users`, `/orders`, `/products`
✅ Use the resource ID for individual items: `/users/{id}`
✅ Use kebab-case for multi-word URL path segments: `/order-items`, not `/orderItems`
✅ Limit nesting to two levels maximum: `/users/{id}/orders` — flatten deeper relationships with query parameters or top-level resources
⛔ NEVER use verbs in URLs: no `/getUsers`, `/createOrder`, `/deleteItem`
⛔ NEVER mix singular and plural inconsistently across endpoints
<!-- RFC: 9110 -->

## 2. HTTP Methods and Status Codes

✅ GET: read-only, cacheable, no side effects
✅ POST: create a resource → return `201 Created` with `Location` header pointing to the new resource
✅ PUT: full replacement of a resource → return `200 OK` or `204 No Content`
✅ PATCH: partial update → return `200 OK` with the updated resource
✅ DELETE: remove a resource → return `204 No Content`
✅ Use semantically correct status codes: `404 Not Found`, `409 Conflict`, `422 Unprocessable Content` where appropriate
⛔ NEVER use GET for operations with side effects
⛔ NEVER return `200 OK` with an error payload in the body — use appropriate 4xx/5xx status codes
<!-- RFC: 9110 -->

## 3. Request and Response Format

✅ Use a consistent JSON structure across all endpoints — pick an envelope or flat format and enforce it project-wide
✅ Use camelCase for JSON property names (unless the project standard differs — document and enforce one convention)
✅ Use ISO 8601 for all dates and timestamps, always with timezone/UTC offset
✅ Handle null values consistently — choose between returning `null`, omitting the field, or using a sentinel value, and apply the choice uniformly
⛔ NEVER mix JSON naming conventions (camelCase, snake_case, PascalCase) within the same API

## 4. Error Responses

✅ Use RFC 9457 Problem Details structure for all error responses: `type`, `title`, `status`, `detail`, `instance`
✅ Return `Content-Type: application/problem+json` for error responses
✅ Include field-level validation errors as an array with field name and error description
⛔ NEVER expose stack traces, internal file paths, database details, or infrastructure information in error responses
⛔ NEVER return unstructured error strings — all errors must be machine-parseable
<!-- RFC: 9457 -->

## 5. Versioning

✅ Version all APIs from the start — use URL path prefix as the default: `/v1/users`
✅ Increment major version only for breaking changes (removed fields, changed semantics, removed endpoints)
✅ Support at most two concurrent versions (N and N-1) — document sunset timelines for deprecated versions
⛔ NEVER introduce breaking changes without a version bump
⛔ NEVER embed version in the request body or as a query parameter

## 6. Pagination

✅ All collection endpoints must support pagination — never return unbounded result sets
✅ Define a default page size with a configurable limit and an enforced maximum cap
✅ Prefer cursor-based pagination for large or frequently-changing datasets — offset-based is acceptable for small, stable collections
✅ Include pagination metadata in responses: total count (when feasible), next/previous links or cursors
⛔ NEVER return all records from a collection endpoint without pagination

## 7. Idempotency and Retry Safety

✅ GET, PUT, and DELETE must be idempotent — repeated identical requests produce the same result
✅ POST endpoints that create resources should accept an `Idempotency-Key` header for safe client retries
✅ Document which endpoints are safe to retry in the API documentation
⛔ NEVER design POST create endpoints that produce duplicate resources on retry without an idempotency mechanism

## 8. API Documentation and Contracts

✅ Every endpoint must have an OpenAPI 3.x definition
✅ Include request/response examples for all operations, including all documented error status codes
✅ Keep the OpenAPI spec in sync with the implementation — generate from code annotations or validate against the spec in CI
⛔ NEVER deploy an endpoint that is not documented in the OpenAPI spec
