# Development and verification

For installation and MCP client setup, start with the [README](../README.md#quick-start).
This guide covers contributor checks, test architecture and release verification.

## Local checks

Use Node.js 22 and the committed dependency lockfile:

```sh
npm ci
npm run typecheck
npm test
```

`npm test` builds the TypeScript code and runs Node's built-in test runner. It
needs no real Ghost key, live content mutation or email send. Use dummy credentials
and recording or loopback fixtures when adding tests.

To verify distributable source and runtime artifacts from a clean committed checkout:

```sh
npm run verify:artifacts
```

This creates `dist/<full-sha>/`. See the [artifact guide](artifacts.md) for archive
contents, locked installation, production-only startup and rollback checks.

## What the tests exercise

- The real Ghost SDK with a recording request transport.
- Actual MCP input parsing and discovery over in-memory transports, plus executable
  stdio discovery with dummy credentials and a rejecting loopback fixture.
- Every data/delete tool's response format, explicit paging, pending newsletter
  metadata, malformed replies and out-of-order same-resource calls.
- Native adapter JWT signatures checked independently of the adapter.
- Real Axios loopback requests for SDK transport parity and native JSON payloads,
  empty bodies, redirects, errors and timeouts.

All other suites block outbound HTTP. The `createServer(client)` factory accepts a
typed client without reading environment configuration or connecting stdio. Tests
and fixtures are outside the distributed `build/` directory.

## CI and dependencies

CI uses the committed dependency lockfile, Node 22 and read-only permissions. It
needs no repository secrets. The workflow uses JSON syntax, which is valid YAML,
so its policy can be checked without adding a YAML parser dependency.

The 2026-10-22 dependency remediation replaced the inherited nine-advisory graph
with exact MCP 1.32.1 / Axios 1.20.0 / Zod 3.25.76 targets and patched compatible
transitives. Full and production-only audits reported zero known vulnerabilities
at that verification point. For current results, run:

```sh
npm audit --json
npm audit --omit=dev --json
```

See [dated dependency evidence](dependency-security.md) for the reproduction
commands, public-API tool error boundary and 10000-element pre-validation guard.
Audit results are time-specific; the [coverage matrix](coverage.md) records the
API source and contract evidence separately.

## Release verification

The artifact gate checks source/runtime startup with locked dependencies, including
runtime startup without development TypeScript. It does not publish artifacts,
create releases or change consumer installations. Package identity, versioning,
attribution and retained-artifact procedures are documented in the
[artifact guide](artifacts.md). Do not publish under the upstream npm identity.
