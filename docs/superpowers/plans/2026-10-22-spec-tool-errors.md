# Specification-Aligned Tool Errors Implementation Plan

> Historical implementation plan. Technical decisions and verification evidence are retained below.

**Goal:** Finish #25 with specification-aligned errors and explicit0.2.0 migration.
**Architecture:** Retain the public specification-boundary dispatcher and lifecycle
registry. Known-tool argument/budget failures become isError results; malformed,
unknown/disabled and internal request handling errors remain protocol errors.
**Tech Stack:** TS/Node22, pinned MCP1.32.1/Zod3, Node native tests and stdio fixtures.
**Spec:** docs/superpowers/specs/2026-10-22-spec-tool-errors-design.md

## Global Constraints
54 tools/7 resources/1 prompt/8 deletes/envelopes/strictness/caps and no retries.
Preserve all old invalid-input cases; change their expected channel deliberately.
No dependency upgrades, private SDK access, task support, live Ghost, publication,
releases/deploy/merge or consumer-specific public information. The versioning plan
uses annotated tags: v0.1.0 at merged4072575 after verification;
v0.2.0 waits for this PR's actual merge, never an unmerged candidate.
Version0.2.0; manifest/MCP/lock consistent. Test-first implementation and one independent review.

## Review Focus
1. A helper accidentally accepts protocol errors as tool results: negative helper tests and raw stdio assertions (Task1).
2. Omitted arguments bypass required fields or reject empty tools: real-MCP empty/required tests (Task1).
3. Parser exceptions or hostile enum/unknown-key inputs echo secrets: fixed internal errors and existing bounded-diagnostic regressions (Task1).
4. Budget guard weakened when schema errors change channel: retain deep/wide/cycle/shared/boundary/large-string cases and zero callbacks (Task1).
5. Registry simplification reintroduces stale rename/discovery/cross-server calls: preserve all lifecycle/isolation tests (Task1).

### Task 1: Contract and all offline regressions
Files: src/tools/toolDispatch.ts, test/helpers/toolError.cjs,
test/tool-compatibility.test.cjs, test/stdio.test.cjs, affected *mcp/input/upload/
loopback tests only where known-tool validation changes channel; no adapter changes.
Interfaces: assertToolError(Promise<CallToolResult>, matcher?, message?) resolves
the actual result and asserts isError/text, propagating any rejection; never
converts exceptions into passing tool results. Dispatcher remains public API.
- [x] Write helper behavioral tests and spec error-channel/malformed/internal/
  omitted-arguments regressions; migrate existing assertions retaining their cases.
- [x] Run suite RED against existing dispatcher; confirm failure channels match.
- [x] Add common tool-error result builder, change budget/schema failure returns,
  default absent arguments to{}, map parser exception to sanitized InternalError;
  keep unknown/disabled/task protocols and lifecycle untouched.
- [x] Typecheck/full suite GREEN; document any parser/envelope SDK surprises;
  commit. No tests should weaken schema rejection, sanitizers or no-HTTP assertions.

### Task 2: Version, migration, verification and PR
Files: package.json/package-lock.json, test/release-policy.test.cjs, README.md,
docs/tool-errors.md, docs/coverage.md, docs/artifacts.md,
docs/dependency-security.md, this plan outcome.
Interfaces: fork0.2.0 and current migration links, archive version evidence from
existing verify:artifacts; resource/prompt protocol classifications unchanged.
- [x] Manifest version test RED0.1.0 ->0.2.0 manifest/lock GREEN; document wire
  examples/client handling and explicitly justified retained dispatch/registry.
- [x] Clean ci/typecheck/full suite/full+production audit/diff; commit then source/
  runtime artifacts and checksums at committed SHA. No actual publication;
  annotated version tags follow the merge-boundary rule above.
- [ ] Independent read-only whole-branch review, fix material findings test-first;
  final gate, template search, push/open #25 PR, verify CI/closing references.

## Setup
- [x] Reused existing clean linked checkout on fresh fix/issue-25-spec-errors from
  merged4072575. Baseline411 tests passed. Prior #1/#12 scope remains completed.
- [x] Test-first implementation and specification-led error classification.
- [x] Spec/plan self-review: request/schema distinction, budget/internal errors,
  omitted args and SDK mismatch explicit; Task1 supplies Task2 documented contract.

## Execution evidence

- Helper absent RED -> real-MCP helper tests GREEN; helper propagates protocol
  exceptions and refuses successful results, matches actual callback errors.
- Migrated every existing known-tool schema rejection case to explicit resolved
  isError assertions. Full suite initially RED28, preserving all input fixtures,
  strictness/diagnostic/no-HTTP assertions; adapter rejection tests unchanged.
- Malformed tools/call parameters revealed outer SDK schema.parse produces raw
  Zod/InternalError before its intended InvalidParams wrapper. Broad public
  method-routing schema lets full-envelope wrapper execute first; raw stdio
  regressions now verify the selected-32602 channel without private API changes.
- Parser exceptions sanitized as-32603; unsupported-handler regression observed
  RED-32602 -> GREEN-32603 with no callback. Existing deep/wide/cycle/shared and
  budget boundary/large string/schema update/rename/removal/isolation tests GREEN.
- Omitted arguments tested with empty tool and required posts_delete ID; no
  required-input bypass. All schema/input safeguards remain active before HTTP.
- Experimental task metadata is rejected by SDK capability check before dispatch
  with-32603; preserve existing fail-closed/no-mutation boundary and document the
  receiver ignore-metadata conformance limitation explicitly, not a whole-protocol
  compliance claim. Cost: that experimental task behavior remains outside this
  ordinary error-format migration and needs separately designed safety changes.
- Fork version policy RED0.1.0 -> GREEN0.2.0; manifest/MCP/lock stay aligned. No
  dependency graph updates. Current docs explain spec-vs-SDK, wire examples,
  client handling before parsing success and retained dispatcher/lifecycle need.
- Clean ci/typecheck/**417/417 tests**, full+production audits**zero**, diff check
  passed before review. Source/runtime artifact gate at173fef9 passed, manifest/
  handshake0.2.0 and zeroGhost requests. Exact-head checksums verified.
- Remote tag listing was empty; only CI workflow exists, with tests/artifact
  checks and no publish/deploy/upload actions. The planned v0.1.0 tag will
  identify merged #26 (4072575), not this0.2.0 branch. v0.2.0 awaits actual merge.

## Independent whole-branch review

One read-only review of4072575..173fef9 found **no Critical, Important or Minor
findings**. Independently verified typecheck,417 tests, both audits0, whitespace,
the entire diff/spec/SDK implementations, public-documentation privacy and
artifact checksums/exact-head metadata. No fix pass or second review needed.

Review limits retained explicitly:
- Experimental task conformance remains excluded as described in the design and
  migration: fail-closed metadata rejection is not the receiver ignore-metadata
  behavior. Cost: ordinary error alignment is not full task/protocol conformance.
- Live Ghost permissions/side effects remain untested and unauthorized. Cost:
  offline evidence cannot guarantee a particular live instance/credential.
- Reviewer did not repeat fresh artifact installs; the implementation's isolated gate and
  exact-head checksums supply that evidence, to be rerun at final commit. Cost:
  clean-install evidence is not a second independent installation run.
- Tags/PR CI/post-merge operations were outside read-only review. Release verification checks
  tag targets/conflicts/workflows and CI; v0.2.0 waits for PR merge. Cost: no
  assurance of operations that have not happened, no release/deploy permission.

## Issue #25 acceptance audit

Spec/SDK error comparison, chosen routing/argument/budget/execution/resource/
prompt classifications, old/new wire examples and client migration are documented.
Dispatcher retained for spec and safety reasons; no dependency internals patched.
All strictness/caps/sanitizers/isolation/lifecycle/envelope/no-retry boundaries
retain their regressions. Real-MCP and raw stdio tests cover both channels and
zero HTTP on rejected input. Version0.2.0 and artifact/dependency gates pass.
Closing #25 is justified for this ordinary-tool error scope; experimental tasks
are an explicit limitation, not silently certified by completion. Final PR/CI and
annotated v0.1.0 tag are recorded externally; no automatic merge or v0.2.0 tag.
