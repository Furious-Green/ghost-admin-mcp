# Specification-Aligned Tool Errors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

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
tags/releases/deploy/merge or consumer-specific public information.
Version0.2.0; manifest/MCP/lock consistent. One independent review, native execution.

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
- [ ] Write helper behavioral tests and spec error-channel/malformed/internal/
  omitted-arguments regressions; migrate existing assertions retaining their cases.
- [ ] Run suite RED against existing dispatcher; confirm failure channels match.
- [ ] Add common tool-error result builder, change budget/schema failure returns,
  default absent arguments to{}, map parser exception to sanitized InternalError;
  keep unknown/disabled/task protocols and lifecycle untouched.
- [ ] Typecheck/full suite GREEN; document any parser/envelope SDK surprises;
  commit. No tests should weaken schema rejection, sanitizers or no-HTTP assertions.

### Task 2: Version, migration, verification and PR
Files: package.json/package-lock.json, test/release-policy.test.cjs, README.md,
docs/tool-errors.md, docs/coverage.md, docs/artifacts.md,
docs/dependency-security.md, this plan outcome.
Interfaces: fork0.2.0 and current migration links, archive version evidence from
existing verify:artifacts; resource/prompt protocol classifications unchanged.
- [ ] Manifest version test RED0.1.0 ->0.2.0 manifest/lock GREEN; document wire
  examples/client handling and explicitly justified retained dispatch/registry.
- [ ] Clean ci/typecheck/full suite/full+production audit/diff; commit then source/
  runtime artifacts and checksums at committed SHA. No actual publication/tag.
- [ ] Independent read-only whole-branch review, fix material findings test-first;
  final gate, template search, push/open #25 PR, verify CI/closing references.

## Setup
- [x] Reused existing clean linked checkout on fresh fix/issue-25-spec-errors from
  merged4072575. Baseline411 tests passed. Prior #1/#12 scope remains completed.
- [x] User-authorized continuous native workflow and specification authority.
- [x] Spec/plan self-review: request/schema distinction, budget/internal errors,
  omitted args and SDK mismatch explicit; Task1 supplies Task2 documented contract.
