# Support

Thanks for using Freebusy API.

## Security issues

Please do **not** open a public issue for suspected vulnerabilities.

- Report security issues via GitHub Security Advisories:
  https://github.com/robertsinfosec/freebusy-api/security/advisories/new

## Bug reports

- Use the Bug Report issue template:
  https://github.com/robertsinfosec/freebusy-api/issues/new/choose

When filing a bug, please include:
- The request you made (path, method, headers like `Origin`), but **do not include secrets**.
- The response status code and JSON body.
- The `version` field returned by `/freebusy` (if applicable).

## Questions / discussions

If you have a question about how to deploy or configure the Worker, start with:
- README
- docs/RUNBOOK.md
- docs/ARCHITECTURE.md

If something is unclear, open a documentation issue.

## Compatibility policy

This project prefers correctness and safety over backwards compatibility. If you need a stable contract, pin to a specific deployed version and validate responses against `docs/openapi.yaml`.
