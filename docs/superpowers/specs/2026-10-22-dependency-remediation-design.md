# Issue #12, slice1: dependency remediation without contract drift

## Approved intent and scope

First remove known dependency advisories, then separately prepare fork metadata,
artifacts and release documentation. User approved this sequence and continuous
native TDD/one independent review/push+PR workflow. This slice is public-project
maintenance only; public notes contain no consumer-specific environments,
architecture, configuration or URLs. No publication/tag/release/deployment,
live Ghost actions, external service changes or automatic consumer updates.
Base merged#23:d117c7b. Reuse isolated checkout with a fresh branch.

Retain54 tool names,7 resource URIs, summarize-post/postId,8 delete confirmations,
strict inputs, `{data,meta?}`, generic error protections, executable/configuration,
MIT/upstream attribution and SDK/native HTTP policies. Package ownership/name,
version/author metadata and artifact work belong to slice2. Do not close#12/#1
from this slice. No arbitrary security suppressions, audit-force upgrade or new
HTTP transport/authorization layer.

## Evidence and selected versions

2026-10-22 npm audit of inherited lock:9 affected packages (3 moderate,4 high,
2 critical). Affected direct MCP SDK1.10.1 and Axios1.8.4; transitives body-parser,
follow-redirects, form-data, jws, path-to-regexp, proxy-addr and qs. Counts are
package-level audit results, not proof every advisory is reachable in stdio.

Pin exact compatible maintained targets from npm metadata: MCP SDK**1.32.1**,
Axios**1.20.0**, Zod**3.25.76** (required supported Zod3 peer). Keep Ghost Admin
SDK**1.13.13** and existing TypeScript/Node22 development baseline unchanged
unless a concrete blocking compatibility issue is evidenced. Refresh affected
transitive lock entries to patched compatible releases, no unnecessary major
overrides. Preserve integrity/resolved lock metadata. Fresh `npm ci` must resolve
the committed graph, not a moving installation. Full and production audit must
report zero known advisories at final verification, or explicitly report blockers
and do not claim the security gate passed. Zero audit is a dated registry result,
not a comprehensive vulnerability or live compatibility guarantee.

## Compatibility boundary

SDK1.32.1 catches tool schema/unknown-name errors and returns isError tool results;
the established fork contract emits MCP InvalidParams protocol errors for those,
while callback failures return existing isError text. Preserve that distinction
using the public low-level `server.server.setRequestHandler(CallToolRequestSchema)`
API and our own per-server registry populated by registerStrictTool. Keep high-level
tool registration/list discovery from the SDK. Never access SDK private maps,
monkeypatch dependency files, or override prompt/resource handlers. Use original
callbacks and current registered schemas (including label read refinements and
opt-in bounded error sanitizers), preserving receiver and concurrent isolation.

Install the compatibility dispatcher only after factory registration. Registry
is WeakMap keyed by server, not global cross-client state. Enabled/update/remove/
rename operations on registered tools synchronize our registry so protocol reads
cannot call disabled/removed/stale entries. Do not expose new task/HTTP features;
task-augmented requests fail explicitly before callbacks. Normal result/output
contract remains the existing static factory surface; no output schemas added.

Retain validation resource protection when bypassing the newer SDK's call
dispatcher: iteratively check tool arguments before Zod, with **10000 counted
containers/keys/values** maximum, bounded pending work and no recursion. Reject
non-JSON cyclic/shared-reference inputs rather than traverse indefinitely. JSON
parser allocations and aggregate concurrency remain outside this per-call guard.
Do not dump attacker input in budget errors. Large base64 strings count as single
values and retain image5MiB/theme10MiB policies. No relaxation of strict schemas
or tool-error tests just to accommodate an upstream error-surface change.

Newest SDK resource variables remain raw percent-encoded strings; existing URI
decode-once and prompt strict Zod3 sanitizer remain compatible. New schema JSON
format details may differ without changing declared fields, strictness or enums;
test actual semantics, not irrelevant generator cosmetics. Axios upgrades must
preserve SDK/native routes/query/body/JWT, redirects/timeouts/proxy/retry/size
boundaries; fix real compatibility issues test-first rather than altering policy.

## Verification and delivery

Before changing dependencies, add a failing local dependency-policy test for exact
direct targets and minimum patched installed/locked transitive packages. Add
explicit protocol/disabled/rename/remove/per-server/callback failure tests plus
input-budget regressions before compatibility implementation. Run upgraded SDK
suite to identify actual regressions; existing assertions must stay meaningful.
Full54 discovery/stdio,7 resources, prompt strictness/truncation, metadata capture,
native/SDK loopback parity, upload/ZIP caps/error protection and import/types all
remain required. No live Ghost traffic; npm registry metadata/install/audit is
allowed for this dependency maintenance task.

Clean ci, typecheck, full offline tests, full+omit-dev npm audit JSON, dependency
graph inspection and diff whitespace check. Record before/after versions/counts,
not raw machine details. Update current README security status and compatibility
notes only; preserve historical completed design evidence. One independent
whole-branch review, fix material findings test-first; authorized push+PR references
#12 without a closing link. Packaging/artifact/coverage work remains open for the
second reviewed slice; no release or consumer operation implied by a green audit.
