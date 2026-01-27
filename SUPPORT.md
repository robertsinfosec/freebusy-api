# Support

Navigation: [Home](README.md) | [Contributing](CONTRIBUTING.md) | [Security](SECURITY.md)

Getting help and reporting issues.

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

## Questions and Discussions

If you have questions about deployment or configuration:

- Start with the [README](README.md)
- Review the [Setup Guide](docs/dev/SETUP.md) for deployment procedures
- Check [Architecture docs](docs/dev/ARCHITECTURE.md) for technical design
- See [Testing Guide](docs/dev/TESTING.md) for testing procedures

If something is unclear, [open a documentation issue](https://github.com/robertsinfosec/freebusy-api/issues/new).

## Compatibility policy

This project prefers correctness and safety over backwards compatibility. If you need a stable contract, pin to a specific deployed version and validate responses against `docs/openapi.yaml`.
