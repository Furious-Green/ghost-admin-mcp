# Dependency Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear inherited known dependency advisories while preserving public contracts.
**Architecture:** Exact patched dependency targets and committed transitive lock;
per-server public-API tool dispatcher preserving legacy protocol errors and strict
validation with bounded input counting. SDK retains discovery/resources/prompts.
**Tech Stack:** TS/Node22, MCP1.32.1, Axios1.20.0, Zod3.25.76; Ghost SDK1.13.13.
**Spec:** `docs/superpowers/specs/2026-10-22-dependency-remediation-design.md`

## Global Constraints
-54 tools/7 resources/1 prompt/8 deletes, existing envelopes/strictness/error split.
-No new public-project references to consumer-specific environments or details.
-No package identity/publication/tag/release/deploy/live Ghost/consumer changes.
-Keep Ghost1.13.13 and dev baseline; patch supported direct/transitive versions
  deliberately, never blind audit-force or security suppressions.
-Tool budget10000 containers/keys/values, bounded iterative work; no new HTTP/tasks.
-One independent review; reference#12 without closing it (slice2 remains).

## Review Focus
1. Upstream tool schema/unknown-name failures remain protocol InvalidParams, callback failures remain isError (Task1).
2. Public registry never shares schemas/callbacks across servers and respects disabled/removed/renamed tools (Task2).
3. Budget guard cannot recurse or enqueue unbounded work, accepts bounded uploads and rejects oversized/cyclic arguments before Zod/client (Task2).
4. Upgraded schema/HTTP behavior cannot strip strictness, bypass refinements/error sanitizers or change route/auth/retry/cap policy (Tasks1/3).
5. Zero-advisory result corresponds to actual committed clean-install graph; docs do not claim universal security/release readiness (Task3).

### Task 1: Evidence and patched dependency graph
**Files:** create test/dependency-policy.test.cjs and test/tool-compatibility.test.cjs;
modify package.json/package-lock.json only for dependency targets and resolutions.
**Interfaces:** policy asserts exact MCP1.32.1/Axios1.20.0/Zod3.25.76 and Ghost1.13.13;
audit baseline9. Tool regression asserts protocol error code-32602 for schema/
unknown tool and unchanged callback isError, no HTTP.
- [ ] RED dependency policy on existing graph; add explicit error-contract test
  (baseline passes before upgrade), run/record existing full398 baseline.
- [ ] Set exact selected direct targets, refresh only needed compatible transitive
  lock entries (form-data>=4.0.6,jws>=3.2.3,qs>=6.16.0,body-parser>=2.3.0,
  follow-redirects>=1.16.0,path-to-regexp>=8.4.0,proxy-addr>=2.0.8).
- [ ] Clean ci/typecheck/full tests; capture actual RED compatibility failures and
  audit after graph update. Do not commit incomplete graph as finished task; next
  task provides compatible dispatcher, then combined Task1/2 verified commit(s).

### Task 2: Public tool compatibility dispatcher
**Files:** create src/tools/toolDispatch.ts; modify registerStrictTool/createServer;
extend tool-compatibility tests and dependency-policy imports as needed.
**Interfaces:** trackRegisteredTool(server,name,registered,makeSchema):void;
installToolDispatcher(server):void; exported MAX_TOOL_INPUT_ELEMENTS=10000.
Registry uses current schema and callback, wrapped public update keeps keys
consistent; high-level tool list unchanged. No SDK private field access.
Use the current public registered.handler instead of copying callbacks so callback
updates remain synchronized; makeSchema retains strictness/sanitizers on schema updates.
- [ ] RED per-server/disabled/update/rename/remove and malformed/cyclic/deep/wide
  budget tests; bounded error/no callback tests. Existing tool guard regressions
  remain untouched unless target genuinely changes harmless schema formatting.
- [ ] Implement explicit public CallToolRequest handler and iterative budgetguard;
  parse original schemas before callback try/catch, preserve protocol errors vs
  callback results; explicitly reject task hints. Synchronize registrations.
- [ ] Resolve evidenced type/HTTP compatibility issues with smallest tested fixes;
  GREEN focused/full suite/typecheck/diff plus audits; record version graph; commit.

### Task 3: Verification, security notes and review/PR
**Files:** README.md, this plan outcome, current dependency evidence doc if needed.
- [ ] Clean ci/typecheck/full suite; full/production audit zero and npm ls inspection.
  Current security note gives dates/versions/known-advisory limits, updated SDK
  descriptions accurate; do not rewrite historical evidence or add environment details.
- [ ] Smoke existing stdio54/resource/prompt and all upload/native/SDK loopback
  regressions. No live Ghost/service calls or dependency security suppression.
- [ ] Independent read-only whole-branch review; material fixes RED->GREEN;
  final verify, template search, approved push/open PR references#12 only; CI.
- [ ] Stop after this slice's PR; packaging/coverage/artifact identity work is a
  separate reviewed change. No tag/publication or automatic closing#1/#12.

## Self-review
Task1 intentionally reaches upstream RED; Task2 owns the dependency compatibility
deliverable and shared verification/commit gate. Each focus row has tests. No
work on consumers or artifact publication; public notes limited to this fork.
