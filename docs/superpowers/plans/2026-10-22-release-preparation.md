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
- [x] Add RED manifest/lock identity and operation-specific discovery/error-hint tests.
- [x] Update metadata and accurate hints only; keep license/author/route/auth contracts.
- [x] Focused tests and typecheck GREEN; commit.

### Task 2: Source/runtime artifact gate
Files: scripts/verify-artifacts.cjs, test/helpers/stdioHarness.cjs,
test/release-policy.test.cjs, package.json, .github/workflows/ci.yml.
Interface: npm run verify:artifacts -> dist/<full-sha>/ with source/runtime .tar.gz,
SHA256SUMS and verification.json; nonzero on dirty tracked tree/existing output.
- [x] Add RED harness alternate-cwd smoke and executable preflight refusal tests.
- [x] Implement archive/extract/locked install/build/minimal runtime/production install,
  discovery in each extraction with dummy credentials and rejecting HTTP fixture.
- [x] Commit then run actual artifact command; inspect membership/evidence/checksums.

### Task 3: Coverage, adoption and completion
Files: README.md, docs/coverage.md, docs/artifacts.md, this plan outcome.
- [x] Document source-backed credential/SDK/native/live/version matrix and known gaps.
- [x] Document pinned source/runtime install, checksums, migrations and safe rollback.
- [x] Clean ci/typecheck/full suite/artifacts/full+production audit/diff check.
- [x] One independent whole-branch review; material fixes test-first and final verify.
- [ ] Audit #12/#1 acceptance, template search, push/PR with justified closing links;
  check CI and closing references, stop without merging or publishing.

## Progress
- [x] Existing isolated checkout reused with fresh branch from merged f498f72.
- [x] Baseline npm test passed (406 tests).
- [x] Design and plan self-review: artifact version/format/toolchain and limits explicit;
  user-selected continuous native workflow retained.

## Execution evidence and decisions

- Task1 RED on inherited package name and blanket invite-add/role staff advice;
  GREEN with clear unscoped fork identity/private guard and source-backed guidance.
  Existing loopback staff-only assertion was corrected for invite creation;
  credential redaction, one attempt, routes/auth/status handling remain tested.
- Task2 RED for ignored extraction cwd and absent verification command. Added
  actual executable preflight tests (dirty tree/existing output preservation),
  rather than source-grep script tests. Existing CI policy now requires artifact
  verification in addition to its original tests/permissions/triggers.
- At 6b85f57, clean source and production-only runtime artifacts both initialized
  and discovered54 tools/7 resource entries+templates/1 prompt with zero Ghost
  requests; runtime had no TypeScript. All SHA256SUMS entries verified. Local
  Node22.22.1/npm9.2.0/Linux recorded in output, not a universal platform claim.
- Retain inherited0.2.0; full SHA and checksums identify artifacts, avoiding an
  unauthorized release/version assertion. Cost: version alone cannot identify
  this fork. No bit-identical cross-toolchain promise or bundled dependencies.
- Final documentation covers all exposed resource families, SDK/native counts,
  source-vs-live and integration-vs-staff distinctions, known gaps, pinned install,
  response/strict-input/removal migrations and executable-only rollback limits.
- Clean npm ci, typecheck, **410/410 tests**, both audits **zero**, diff check
  passed before independent review. Artifact gate rerun for reviewed final SHA
  after committing docs; no live actions/publication/deployment.
- One independent read-only whole-branch review verified410 tests, typecheck,
  both audits0, artifacts/checksums and no consumer-specific public information.
  Important finding: installs under repository dist could inherit checkout
  node_modules through Node ancestor resolution, weakening runtime-only evidence.
- Independently reproduced TypeScript ancestor fallback. Refactored workspace
  allocation without behavior change (focused tests green), then negative
  checkout-only dependency regression RED (missing expected exception) -> external
  temp installs GREEN. Runtime additionally requires all direct imports local and
  TypeScript unresolvable; local output staging preserves same-filesystem rename.
  The MCP SDK root has no usable entry, so resolution checks its actual public
  server/mcp.js export. No private SDK APIs introduced.
- Review limits accepted: live services/consumer adoption/publication/merging stay
  unauthorized; #25 is separate; full UI parity/unsupported platforms/bit-identical
  archives not promised. Historical RED evidence is recorded here, not certified
  by the independent reviewer. Cost if wrong: offline evidence is insufficient
  for a particular consumer's live operation; separate approval/verification needed.
- No Minor findings. Final clean install/typecheck/**411 tests**/full+production
  audits0/diff check passed. Fixed b66e11e source/runtime artifacts passed with
  external extraction directories; all checksums verified. No second review.

## Acceptance audit for final PR

| Criterion | Evidence |
| --- | --- |
| Fork identity, no upstream npm ownership | manifest/lock name, private guard, repository metadata; inherited version documented |
| License and attribution | MIT manifest matches unchanged original LICENSE; original author retained and provenance documented |
| Locked clean source/runtime build/start | verify:artifacts source git archive -> npm ci build; independent production-only runtime install with local resolution checks |
| Offline CI discovery | existing410 suite plus isolation regression =411; CI adds artifact gate, dummy credentials and zero Ghost requests |
| Coverage/version/credential honesty | docs/coverage.md;31 SDK/23 native operations,5.130.0 source baseline, no live assurance; operation-specific hints |
| Migrations and pinned adoption/rollback | existing README envelope/strict/removal migrations + docs/artifacts.md full SHA/checksums/separate installs and remote-effect disclaimer |
| Known gaps and bounded side effects | coverage matrix explicitly excludes fullUI/internal parity and lists upload/email/billing/permission limits |
| No automatic publication/deployment | no publish/release/tag/upload/deploy workflow or service actions; private manifest protection |

The original #1 work items #2 through #11 are merged/closed; this final #12 slice
supplies its remaining release-preparation gate. Closing links for #12 and the
original scoped tracker #1 are justified only by this documented scope, not full
Admin API parity or live certification. #25 remains separate and open. No PR
merge or issue closure is performed here; CI/PR links are recorded externally.
