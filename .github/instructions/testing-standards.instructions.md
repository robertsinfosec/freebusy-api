---
description: "Use when writing, reviewing, or modifying tests, specs, test configuration, or test utilities. Enforces consistent test structure, isolation, naming, coverage strategy, and CI integration."
applyTo: "**/*.test.*, **/*.spec.*, **/tests/**, **/test/**, **/__tests__/**, **/testing/**, **/fixtures/**, **/factories/**"
generation-source: "generation/instructions/testing-standards.md"
---

# Testing Standards

All tests must provide reliable, fast feedback about code correctness. Tests that are flaky, coupled to implementation, or untested-path-blind are worse than no tests — they create false confidence.

## 1. Test Structure

✅ Follow Arrange-Act-Assert (or Given-When-Then) with clear visual separation between phases
✅ One logical assertion per test — multiple physical assertions of the same concept are acceptable
✅ Each test must be independent — runnable in any order, passable in isolation
⛔ NEVER write tests that depend on the execution order of other tests
⛔ NEVER share mutable state between tests without explicit per-test setup and teardown

## 2. Test Naming

✅ Names must describe the behavior and expected outcome: `rejects_expired_tokens`, `returns_empty_list_when_no_results`
✅ A failing test name must make the failure self-diagnosing without reading the test body
⛔ NEVER name tests after the method being tested: no `testProcess`, `test_handle_request`, `it_works`

## 3. Unit Tests

✅ Test behavior through public interfaces — not internal implementation details
✅ Unit tests must be deterministic — same input always produces the same result
✅ Unit tests must be fast — individual tests should complete in milliseconds
✅ Unit tests must be isolated from external systems (network, database, filesystem)
⛔ NEVER assert on implementation details: mock call counts, internal state, private method calls
⛔ NEVER write unit tests that break when code is refactored without behavior change

## 4. Integration Tests

✅ Explicitly mark integration tests — they must run in a separate CI stage or test suite
✅ Test real boundaries: database queries, HTTP calls, file I/O, message queues
✅ Use test containers, in-memory databases, or managed fixtures — never hit production services
✅ Clean up all test data — no leaked state between test runs
⛔ NEVER mix integration tests with unit tests in the same suite without clear separation

## 5. Test Doubles (Mocks, Stubs, Fakes)

✅ Prefer fakes and stubs over mocks when possible — they test behavior, not interaction
✅ Mock at architectural boundaries (external services, I/O layers) — not between internal modules
⛔ NEVER mock the thing you are testing
⛔ NEVER write tests that verify the mocking framework works instead of verifying the code under test
⛔ If a test requires more than 3 mocks, treat it as a signal that the code under test needs refactoring

## 6. Edge Cases and Error Paths

✅ Test boundary values: zero, one, maximum, empty, null/undefined, negative
✅ Test error and exception paths — not just happy paths
✅ Test invalid inputs, unauthorized access attempts, and timeout scenarios
✅ Test concurrent access scenarios where the code handles shared state
⛔ NEVER submit a test suite that only covers the happy path

## 7. Coverage

✅ Measure branch coverage, not just line coverage — branch coverage exposes untested decision paths
✅ Prioritize coverage on business logic, error handling, and security-sensitive code paths
✅ Use coverage reports to find untested code — not as a quality metric to optimize for
⛔ NEVER inflate coverage by testing generated code, type definitions, configuration files, or trivial data structures
⛔ NEVER treat a coverage percentage as proof of test quality — 100% coverage with poor assertions is worthless

## 8. CI Integration and Reliability

✅ All tests must run in CI on every pull request — failing tests block merge
✅ Separate unit and integration test stages for fast feedback
✅ Quarantine flaky tests immediately — fix or remove within a defined timeframe
⛔ NEVER leave flaky tests in the main test suite — they erode trust and train developers to ignore failures
⛔ NEVER allow tests that pass locally but fail in CI due to environment dependencies (time zones, locale, file paths, network access)
