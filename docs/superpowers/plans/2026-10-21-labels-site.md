# Labels and Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver #8 standalone member-label management and public site information.
**Architecture:** Fixed native routes for labels and public site, strict schemas,
existing response normalization for labels, dedicated singleton site normalizer.
Keep SDK resources and member relationship schemas untouched.
**Tech Stack:** TypeScript, existing Zod/MCP/Ghost SDKs, Node22 offline test runner.
**Spec:** `docs/superpowers/specs/2026-10-21-labels-site-design.md`

## Global Constraints
- Six new tools, inventory51,8 plain-text delete confirmations; `{data,meta?}`.
- Native labels accept flat queries only; reject nonempty/malformed separate options.
- Site uses configured URL and no Authorization. No arbitrary URLs/settings edits.
- No live mutations/emails/Stripe, private adoption, merge/deploy/publication.
- Existing dependencies/lock/configuration/license/badges unchanged; nine advisories remain blockers.
- Source-verified baseline5.130.0 only, no claim of all5.x/live support.
- Native TDD and one independent whole-branch review, then approved push/PR.

## Review Focus
1. Slug reads vs ID reads preserve exactly one safe encoded route segment (Task1).
2. Query options never become label body fields; malformed separate options fail before HTTP (Task1).
3. Public site never receives JWT, redirects or response URLs never become destinations (Task2).
4. Singleton site nulls/extras/unknown metadata remain literal; malformed shapes fail (Task2).
5. Label deletion does not delete members; existing combined member label/newsletter inputs stay unchanged (Task1/3).

### Task 1: Label resource
**Files:** create `src/schemas/labels.ts`, `src/tools/labels.ts`,
`src/client/labelsClient.ts`, `test/labels-site.test.cjs`; modify
`src/client/{nativeAdmin,sdkAdapter,types}.ts`, `src/createServer.ts`, tests/fixtures.
**Interfaces:** schema module exports shapes, strict schemas, LabelInputs;
`createLabelClient(config:GhostConfig,makeRequest?:RequestExecutor)` returns
GhostClient['labels']. NativeInput gains slug; only labels.read route permits it,
exactly one selector. Existing native routes remain ID-only. Tool factory
`registerLabelTools(server:McpServer,client:GhostClient):void` uses strict helper.
- [ ] RED MCP tests five operations plus slug read; independent exact paths,
  query controls, body names/slug, metadata and delete text. Direct client tests
  invalid selectors/fields/queries/options, immutability, injected client validation.
- [ ] Run focused test after build, observe missing labels capability RED.
- [ ] Implement strict schemas, fixed native routes, adapter, registration/types.
  Add fixture family and update exact tool count assertions to50 temporarily.
- [ ] GREEN focused/full suite/typecheck/diff check; commit.

### Task 2: Public site singleton
**Files:** create `src/tools/site.ts`, `src/client/siteClient.ts`;
modify `src/client/{nativeAdmin,sdkAdapter,types}.ts`, `src/createServer.ts`,
`test/labels-site.test.cjs`, inventory fixtures and response/import/type tests.
**Interfaces:** `createSiteClient(config,makeRequest?)` returns GhostClient['site'];
strict read empty input/options, read returns EntityResponse. Add fixed site.read
public route flag; skip JWT/key use for that operation only; retain URL/version
validation and existing native error handling. Normalize nested site object
without changing array normalizers or any SDK capture.
- [ ] RED site response/MCP/direct validation tests, null/extras/metadata,
  malformed bodies/meta, exact absent Authorization and no caller mutation.
- [ ] Implement dedicated client/tool and public route; inventory51.
- [ ] GREEN focused/full suite/typecheck; update types negative contracts
  (no site settings/URL args, no label generated fields) and import coverage.
- [ ] Commit self-contained site deliverable.

### Task 3: HTTP, docs, review and integration
**Files:** `test/native-http.test.cjs`, `test/stdio.test.cjs`,
`test/labels-site.test.cjs`, `README.md`, this plan outcome section.
- [ ] Loopback verifies labels slug Unicode encoded once, paging/include, JWT,
  writes/deletion bodies and site singleton/absent credentials/subdirectory.
  403/404/409 failures dispatch once; site redirect refused, no destination GET.
- [ ] Pin member edit labels plus newsletter IDs and explicit empty arrays
  unchanged. No simulated member deletion to claim actual Ghost cleanup.
- [ ] Stdio exact51 strict names, no startup HTTP; side-effect delete description.
- [ ] README capabilities/strict tables, public site vs configured server auth,
  literal version/relative logo, label relationship/delete distinction, source
  version matrix with exact baseline and explicit limits; #11 unchanged.
- [ ] Clean npm ci/typecheck/full suite/diff check. Self-review spec acceptance,
  record results and commits. One independent read-only whole-branch review;
  fix material findings test-first, record limitations and resolved minor findings.
- [ ] Final verification, template search, push/openPR with Closes#8, verify
  actual issue closing link and both CI checks. No merge, preserve worktree.

## Self-review
Spec contracts map to Tasks1/2, source/version/relationship/discovery/HTTP toTask3.
All five focus classes assigned concrete tests; source evidence is baseline-only,
not live proof. No permission escalation or dependencies needed. Existing native
request abstraction receives two narrowly scoped route capabilities, not a proxy.

## Execution evidence

- Task1 label MCP/direct tests RED (missing label tool/client), then GREEN349
  full tests; strict selectors/options, query/body split and delete confirmations.
- Task2 site tests RED (missing site tool), then GREEN352 full tests. Public
  route omits JWT; strict singleton/meta validation and immutable caller inputs.
- Task3 adds HTTP/stdio/member regression coverage for those implemented paths.
  Initial HTTP assertion incorrectly expected Axios to escape a CSV comma;
  inspected literal request and retained existing safe native serialization.
- Clean npm ci/typecheck/full suite **355/355** and diff check pass. Dependencies
  unchanged; nine inherited advisories (3 moderate,4 high,2 critical).
- README covers all six tools, source-verified5.130.0 version matrix, public
  site vs configured-server auth, member relationships and deletion effects.
  Removed an inherited stale newsletter-delete inventory entry to match the
  actual51 names; no corresponding runtime change.
- Independent read-only whole-branch review of7a6cad2..3205717: no Critical,
  Important or Minor findings. Reviewer independently passed355 tests/typecheck/
  diff check and confirmed baseline source, safe selectors, query/body split,
  public-site auth isolation, singleton metadata and unchanged relationships.
- Review limitations stand: no live Ghost/email/Stripe/production permissions
  or database tests; source evidence is5.130.0 only, not all5.x/other majors.
  Nine inherited advisories remain release/adoption blockers; PR readiness is
  not permission for private adoption, publication or deployment.
- Acceptance audit for#8: label CRUD/options/pagination and payload/selector
  contracts (Tasks1/3); preserved member label/newsletter inputs (Task3);
  real public singleton title/description/logo/url/version and no settings
  editing/authentication (Tasks2/3); explicit version evidence/limits (spec,
  README matrix and independent source review). All acceptance criteria met.
- Remaining integration steps: final verification, authorized push/PR closing#8,
  both CI checks. No merge; preserve the isolated worktree for PR feedback.
