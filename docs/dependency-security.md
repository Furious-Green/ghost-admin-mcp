# Dependency verification — 2026-10-22

This is the dependency-remediation slice of #12, not a publication or deployment.
It changes only this public fork. Packaging, ownership metadata, artifact
reproducibility and the full coverage/permission matrix remain separate work.

## Before and after

The inherited lock reported nine affected packages: 3 moderate, 4 high, 2 critical.
The clean updated graph reports **zero known vulnerabilities**, both full and
production-only, using npm audit on 2026-10-22. These are registry package-level
findings, not a claim that every historical advisory was reachable in stdio or
that the software is free of all vulnerabilities.

| Package | Inherited | Verified locked target |
| --- | --- | --- |
| @modelcontextprotocol/sdk |1.10.1|1.32.1|
| axios |1.8.4|1.20.0|
| zod |3.24.3|3.25.76 (supported Zod3 peer)|
| @tryghost/admin-api |1.13.13|1.13.13 (unchanged)|
| body-parser |2.2.0|2.3.0|
| follow-redirects |1.15.9|1.16.1|
| form-data |4.0.2|4.0.6|
| jws |3.2.2|3.2.3|
| path-to-regexp |8.2.0|8.4.2|
| proxy-addr |2.0.7|2.0.8|
| qs |6.14.0|6.16.1|

Direct MCP/Axios/Zod versions are exact pins; package-lock.json retains the
resolved/integrity graph. No blanket overrides, audit suppressions or force-fix
were used. Existing development dependencies and the Ghost SDK remain unchanged.

## Compatibility protections

MCP 1.32 changes invalid tool arguments/unknown tools into isError results. This
fork preserves its existing distinction: schema/unknown/disabled failures are
MCP InvalidParams protocol errors; callback failures are isError text results.
A per-server registry and the public setRequestHandler API implement this boundary;
SDK private maps are not accessed. SDK registration/discovery/resources/prompts
remain intact. Tool updates preserve strict schemas and opted-in bounded error
diagnostics, names/removal/enable state and current callbacks. Repeated renames
use fresh public registrations/removals behind a stable handle, avoiding the
SDK's captured-original-name discovery behavior. Removed names can be reused
without stale entries. No task execution
or additional transport feature is introduced.

Before tool schema parsing, an iterative guard permits at most **10000 counted
containers/keys/values** with bounded queued work, rejecting cyclic/shared-reference
non-JSON inputs. It does not recurse or copy the whole tree. Large valid image/
ZIP base64 strings still use their own byte caps. This is not an upstream JSON
parser, global-memory, byte-size or total-concurrency guarantee. Resources and
prompts retain their existing validation and source policies.

Label reads retain exactly-one-ID/slug checks and strict discoverable object
schemas despite the newer SDK's schema normalization. The Axios serializer fix
is a type-only assertion retaining concat/join encoding. Existing SDK/native
routes, bodies, auth, redirect/timeout/proxy/retry and upload byte limits remain
regression-tested; this maintenance does not promise identical internal library
implementation or expand credential permissions.

## Reproduce verification

On Node 22, from a reviewed pinned checkout:

```sh
npm ci
npm run typecheck
npm test
npm audit --json
npm audit --omit=dev --json
```

Offline tests cover 54 tools, 7 resource URIs, one prompt and 8 delete confirmations;
the maintenance baseline is 406 passing tests. Local policy tests check installed
versions against the committed lock and known patched floors. They are not a
substitute for a fresh audit: new advisories can appear after this date. Audit
commands require npm registry access; contract tests use no live Ghost service.
No credentials, publication, tag/release or live content mutations are required.

Before any release, repeat these checks and complete the remaining packaging/
coverage work. A zero-advisory registry response does not establish live Ghost
compatibility, comprehensive security assurance or permission to publish under
the upstream npm identity. Preserve upstream attribution and MIT licensing.
