# Strict Content Schemas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete and strictly validate posts/pages/tags inputs without silent loss.

**Architecture:** Pure per-resource schema definitions feed strict MCP registration
and client request preparation. Preparation validates flat/separate options,
splits query from body and encodes SDK selectors once. Native copying uses the
same formats contract without changing its hardened transport.

**Tech Stack:** Existing TypeScript, Zod 3, pinned Ghost/MCP SDKs, Node 22 tests.

**Spec:** `docs/superpowers/specs/2026-10-21-content-schemas-design.md`

**Execution status:** Implemented natively in b577450, 6f25746, 1d07de4 plus
the test-first timezone-offset review fix. Clean npm ci, typecheck, full suite
(319 tests) and diff check passed. Independent whole-branch review found one
Important timestamp-range gap, reproduced and fixed RED→GREEN; no other findings.
User authorized push/PR, not merge/deploy. Checklists below preserve the original
brief; implementation commits and this status record completion.

## Global Constraints

- Keep all 46 tool names, `{data, meta?}` outputs, delete confirmations and HTTP/auth/error/retry policies.
- Scope is #6 slice 1 posts/pages/tags; do not close #6 or change other resources.
- No dependency upgrades, private-wrapper changes, live Ghost/email/Stripe actions, merge, publish or deployment.
- User explicitly waived further design/plan checkpoints and authorized native implementation, final independent review, push and PR.
- Use baseline Ghost 5.130.0 API schema 4.5.10 rather than DB schema to choose writable fields; exclusions per spec.

## Review Focus

1. Unknown nested ref fields must fail rather than disappear; valid multi-identifier refs and empty replacement arrays must survive (Task 1/2).
2. A caller supplies flat and separate query keys, null or false: reject duplicates, retain null in bodies and false in query without mutating input (Task 1/2).
3. IDs/slugs contain Unicode, spaces, percent-encoded traversal or invalid Unicode: encode exactly once or reject before HTTP for both MCP/direct calls (Task 1/3).
4. HTML and Lexical coexist, or callers request revisions without new HTML: preserve HTML conversion precedence; never turn query options into content (Task 2/3).
5. Refined schemas are represented through pinned MCP registration: discover strict object shapes with supported query options, reject unsupported combinations with no requests and keep 46-name inventory (Task 2/3).

## Task 1: Shared schema and pure client preparation contracts

**Files:** Create `src/schemas/content.ts`, `src/schemas/tags.ts`,
`src/schemas/query.ts`, `src/client/contentRequest.ts`,
`test/content-inputs.test.cjs`. Reuse `src/client/pageSelector.ts` unchanged.

**Interfaces:**
- query.ts: `nonblank`, `selector` Zod strings; `csv(allowed?: readonly string[])`
  for nonempty token lists without empty/whitespace tokens; `pagingParams`;
  `formatsParam`; nullable text helpers. Safe-integer numeric inputs, no coercion.
- content.ts: content mutable fields and refs; `postShapes`, `pageShapes` keyed
  browse/read/add/edit/delete/copy raw shapes; per-operation `postQueryShapes`,
  `pageQueryShapes`. Include enums and write/null/max-length rules from spec.
- tags.ts: `tagShapes`, `tagQueryShapes` same model, no copy/formats.
- contentRequest.ts: `prepareContentRequest(resource: 'posts'|'pages'|'tags',
  operation: 'browse'|'read'|'add'|'edit'|'delete', input: unknown,
  options?: QueryOptions): {input: Record<string, unknown>; query: QueryOptions}`.
  Parse strict full shape plus strict options; accept `source:'html'` only in
  separate write options. Reject duplicate query keys and selector conflicts;
  infer source for nonempty HTML; encode id/slug for SDK routes only. Return
  unencoded body slug on writes. Validate JSON source strings/date-time offsets.
  Validate conflicting Lexical/Mobiledoc except when HTML conversion takes precedence.
  Export schema maps for tool consumers; no global state.

- [ ] Write `content preparation rejects unknown inputs before dispatch` with
  literal invalid top-level keys, query keys, wrong-operation save_revision/
  fields, empty/both selectors, nested unknowns and empty refs.
- [ ] Write `content preparation preserves literal null false and replacement arrays`
  asserting edit input `{id:'one',updated_at:timestamp,custom_template:null,tags:[],authors:[],tiers:[]}`
  and query `{save_revision:false,formats:'html,plaintext'}`; original unchanged;
  duplicates rejected. Cover nullable tag SEO/image/slug clears and forbidden nulls.
- [ ] Write schema cases for page/limit 0,-1,1.5,'1',unsafe integers; limit all
  accepted for all three; valid includes/formats combos and invalid/blank tokens;
  status sent posts-only, visibility enums, revision add rejection, JSON/date-times.
- [ ] Write safe selector cases (spaces/Unicode encoded once, traversal,
  delimiters, controls, percent escapes, lone surrogates rejected); write slug
  remains body text; multi-identifier refs retained.
- [ ] Run `npm run build` then `node --test test/content-inputs.test.cjs`; expect
  missing new module RED, then implement modules and rerun for GREEN.
- [ ] Run `npm run typecheck`, full `npm test`, `git diff --check`; commit helpers.

## Task 2: Atomic strict MCP/client integration

**Files:** Modify `src/tools/{contentSchemas,posts,pages,tags}.ts`,
`src/client/{sdkAdapter,nativeCopy}.ts`, existing pages/native-copy/import/type
tests; create `test/content-mcp.test.cjs`.

**Interfaces:** Tool raw-shape exports remain available with inferred ToolInputs.
Re-export shared refs/formats/copy from contentSchemas for compatibility.
Use registerStrictTool for all 17 post/page/tag tools. Calls retain response
serialization; post/page writes extract include/formats/save_revision options,
reads split selectors/query; tags extract include. Adapter applies Task 1
prepareContentRequest for these three SDK-backed resources before SDK invocation;
does not prepare other resources or double-encode selectors. Copy validates
unknown fields and shared formats but leaves existing native ID/error/policy
checks intact. Runtime client preparation handles flat or split query inputs.

- [ ] Write MCP RED tests using real in-memory harness and recording client:
  browse/read query forwarding, post/page edit revision false, custom_template
  null, tag full SEO/social/image/injection/visibility/accent fields, nullable
  clearing, HTML+Lexical source routing and Mobiledoc-only writing. Check exact
  body/query/method/path, one call per valid request and zero per invalid.
- [ ] Write MCP strict failure loops for all 17 names with extra keys; nested
  refs; unavailable fields/options (including page email_only and posts fields
  on edits); invalid selectors/enums/numbers/nulls. Allow protocol-invalid
  arguments or tool cross-field errors but never HTTP dispatch.
- [ ] Update former stripping tests to assert rejection plus separate successful
  supported writes. Do not weaken independent request/auth/error assertions.
- [ ] Run new MCP tests and inspect expected RED (stripping/missing forwarding).
- [ ] Implement integration using Task 1 interfaces; preserve signatures and
  outputs. Add direct client bypass rejection/immutability tests before adapter
  implementation. Add native-copy unknown/formats regression before copy change.
- [ ] Add type tests: nullable edits and revision option valid; invalid page
  sent, status values, null booleans and tag formats fail compilation; imports
  test includes new pure modules.
- [ ] Run typecheck/full suite/diff check for GREEN; commit integration.

## Task 3: HTTP parity, migration docs and final verification

**Files:** Extend `test/native-http.test.cjs`, `test/content-mcp.test.cjs`,
`test/stdio.test.cjs` only if needed; modify `README.md`; record status here.

- [ ] Add actual loopback HTTP test through MCP for post/page selectors with
  Unicode/spaces; edit save_revision false and null body; tags read include,
  fields and filter; copy expanded formats. Assert independently literal URLs,
  JSON bodies, headers and no extra calls. Existing response/error tests stay.
- [ ] Assert paginated discovery contains exactly 46 names and strict repaired
  inputSchema objects with no outputSchema; no network on discovery; other
  resource schemas unchanged. Reuse existing stdio harness for actual discovery.
- [ ] Document strict breaking migration and repaired scope, per-operation
  options/includes/formats, null/relations, datetime/revision examples and
  excluded options; retain badges/MIT, no claims of live compatibility.
- [ ] Run clean `npm ci`, `npm run typecheck`, `npm test`, `git diff --check`.
  Record counts and unchanged nine advisories; commit tests/docs.
- [ ] One independent read-only whole-branch review against spec/plan/base,
  including Review Focus and declined-to-judge list. Address actual findings
  test-first; no per-task reviewers. Record explicit scope rulings for deferrals.
- [ ] Final full verification and clean status; push feature branch; check PR
  templates; create PR referencing #6 without closing it. Check both push/PR CI.
  Preserve isolated worktree, do not merge or deploy.

## Self-review

All spec sections map to Task 1 schema/preparation, Task 2 integration or Task 3
verification/migration. Task 2 consumes exact maps/function in Task 1; no helper
assumes global input changes. Five Review Focus classes each have explicit tests.
Execution is native by prior preference; no further approval gate per user.
