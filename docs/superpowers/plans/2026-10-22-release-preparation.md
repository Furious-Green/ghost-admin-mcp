# Release Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete public fork identity, locked artifact verification and honest adoption guidance.
**Architecture:** Git source archive builds the minimal runtime archive; both use
the lock and executable discovery fixture. Existing client behavior unchanged.
**Tech Stack:** TypeScript, Node 22, npm, git, tar, Node test runner.
**Spec:** docs/superpowers/specs/2026-10-22-release-preparation-design.md

## Global Constraints
No publish/tag/release/deploy/merge/live Ghost or consumer-specific information.
54 tools, 7 resources, 1 prompt, 8 deletes, strict schemas, envelopes and existing
error semantics unchanged. Retain MIT/upstream author. #25 separate.

## Review Focus
1. Runtime install accidentally executes prepare without TypeScript: artifact smoke production-only install.
2. Source archive accidentally includes untracked secrets: git archive committed tree only, clean tracked preflight.
3. Misleading blanket credential claims: operation-specific tests and source-linked matrix.
4. Artifact accidentally tests repository build: explicit extracted cwd, exact discovery inventory and no HTTP.
5. Rollback mistaken for remote mutation reversal: explicit docs disclaimer and retained previous install.

### Task 1: Fork identity and permission corrections
Files: package.json/package-lock.json, test/release-policy.test.cjs,
test/staff-mcp.test.cjs, native permission tests, src/client/staffClient.ts,
src/tools/invites.ts, src/tools/roles.ts.
- [ ] Add RED manifest/lock identity and operation-specific discovery/error-hint tests.
- [ ] Update metadata and accurate hints only; keep license/author/route/auth contracts.
- [ ] Focused tests and typecheck GREEN; commit.

### Task 2: Source/runtime artifact gate
Files: scripts/verify-artifacts.cjs, test/helpers/stdioHarness.cjs,
test/release-policy.test.cjs, package.json, .github/workflows/ci.yml.
Interface: npm run verify:artifacts -> dist/<full-sha>/ with source/runtime .tar.gz,
SHA256SUMS and verification.json; nonzero on dirty tracked tree/existing output.
- [ ] Add RED harness alternate-cwd smoke and script/CI policy assertions.
- [ ] Implement archive/extract/locked install/build/minimal runtime/production install,
  discovery in each extraction with dummy credentials and rejecting HTTP fixture.
- [ ] Commit then run actual artifact command; inspect membership/evidence/checksums.

### Task 3: Coverage, adoption and completion
Files: README.md, docs/coverage.md, docs/artifacts.md, this plan outcome.
- [ ] Document source-backed credential/SDK/native/live/version matrix and known gaps.
- [ ] Document pinned source/runtime install, checksums, migrations and safe rollback.
- [ ] Clean ci/typecheck/full suite/artifacts/full+production audit/diff check.
- [ ] One independent whole-branch review; material fixes test-first and final verify.
- [ ] Audit #12/#1 acceptance, template search, push/PR with justified closing links;
  check CI and closing references, stop without merging or publishing.

## Progress
- [x] Existing isolated checkout reused with fresh branch from merged f498f72.
- [x] Baseline npm test passed (406 tests).
- [x] Design and plan self-review: artifact version/format/toolchain and limits explicit;
  user-selected continuous native workflow retained.
