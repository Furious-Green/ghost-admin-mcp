# Public fork release preparation

## Intent and constraints
Finish #12 and audit the original #1 acceptance checklist, not full Admin UI
parity. User selected native test-first execution, one independent whole-branch
review, then push/PR without additional approval pauses. No automatic merges,
publication, tags, releases, deployment, live Ghost actions or consumer adoption.
Public documentation contains only this public project's details and generic
consumer guidance. #25's error migration remains separate.

## Identity
Use unscoped `ghost-admin-mcp`, `private: true`, public repository/bugs/homepage
metadata. Retain inherited version 0.2.0 as metadata, not a released fork version;
full commit identifies this preparation. Remove publishConfig; retain original
author and MIT copyright/license, explicitly distinguish fork maintainers from
upstream authorship. Keep ghost-mcp executable and all settings/protocol names.

## Artifact contract
Use local source and runtime tar.gz files, named with the full committed SHA.
Source is git archive HEAD, excluding untracked files/secrets/build outputs.
Runtime contains only package.json, package-lock.json, README.md, LICENSE and
build/, compiled from a clean source extraction using npm ci. Runtime install
uses npm ci --omit=dev --ignore-scripts (prepare requires dev TypeScript).
No npm pack/publish or moving-branch install instruction. SHA256SUMS identifies
exact bytes; dependency reproducibility means committed-lock installs, not a
promise of byte-identical archives across toolchains. Node 22/Linux, npm 9.2.0
observed locally; registry access required for installs/audits, Ghost is offline.

Artifact command refuses tracked changes and existing destination; creates its
own temporary directories, cleans only those, preserves user files. Source and
runtime installs must live outside checkout dependency ancestors, with direct
runtime dependencies resolving locally and TypeScript not resolvable at all.
Both initialize MCP and list all 54 tool names with dummy credentials,
blocking external HTTP and recording zero Ghost requests. Reuse existing stdio
harness with explicit cwd option. Runtime must start with production dependencies
only and no compiler. CI runs this command after contract tests, without upload
or publication. Include checksums and commit/toolchain evidence in local output.

## Coverage and credential documentation
Consolidate SDK-backed versus fixed-route native resources, seven resource URIs,
one prompt, eight deletes, version/source evidence and missing operations. Source
baseline Ghost 5.130.0, SDK 1.13.13; no live verification claimed. Integration
route allowlist permits roles GET, invites POST, users GET, themes POST/PUT;
invite browse/delete and users edit/delete require suitable staff context.
Permissions, roles, hosting, billing and mail remain server-authoritative. Correct
invite-add/role discovery and 401/403 hints test-first: no blanket staff-only
claim for operations permitted by integration routes. Never infer credential
class or change authentication/HTTP routes/retries. Preserve true staff-only
hints for invite browse/delete.

Generic adoption uses reviewed full SHA, separate install directory, lock/checksum
verification, discovery refresh and explicit response/strict-input migrations.
Rollback selects retained previous executable/configuration; never restores
remote content or undoes emails/files/Stripe effects. Theme upload may overwrite
active files; never describe it as harmless staging.

## Verification and completion
Baseline 406 tests. New policy/permission tests RED before implementation. Full
clean ci, typecheck, tests, artifact verification, both audits and diff check;
one independent whole-branch review and test-first material fixes. Audit #12/#1
criteria before using closing links. #25 remains open. No release claim follows
from zero advisories or offline compatibility tests alone.
