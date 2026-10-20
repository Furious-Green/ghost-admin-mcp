# Newsletter Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete #7 with explicit delivery/opt-in controls and truthful newsletter administration.
**Architecture:** Extend shared strict post/newsletter schemas, validate delivery
intent before injected clients and SDK requests, preserve query/body separation
and response normalization. Remove unsupported newsletter deletion, not emulate it.
**Tech Stack:** Existing TypeScript, Zod 3, pinned Ghost/MCP SDKs and Node 22 tests.
**Spec:** `docs/superpowers/specs/2026-10-21-newsletter-delivery-design.md`

## Global Constraints
- No live subscriber/verification emails, Ghost/Stripe mutations, private-wrapper changes, publication/deployment or merge.
- Dependencies/lock/licenses/badges/settings/HTTP auth/retry policies unchanged; nine inherited advisories remain release/adoption blockers.
- 45 tool names after explicit newsletters_delete removal; all other names and `{data, meta?}` outputs, seven delete confirmations retained.
- Native execution, one independent final review; approach approved with continuous spec/plan/implementation/push+PR, no further approval pauses.
- Baseline Ghost 5.130.0, minimum header v5.0; no live compatibility claim.

## Review Focus
1. Delivery options supplied through separate SDK options obey exactly the same cross-field guards as flat MCP input; injected clients cannot bypass guards (Task 1).
2. Empty/invalid newsletter or email_segment, segment without newsletter, and scheduled intent without explicit date fail before any HTTP, never fall back to all/default newsletter (Task 1).
3. Omitted/false opt-in are distinct from true, and metadata count zero/pending sender/absent meta remain literal server output rather than requested state (Task 2).
4. HTTP conflict/service failures never retry or claim delivered; a successful write returning failed/pending email remains failed/pending (Tasks 1/3).
5. Removed delete name never archives, discovery has exactly45 strict schemas and visible email side-effect warnings despite no annotations API (Tasks 2/3).

## Task 1: Explicit post delivery schema and guards
**Files:** create `src/schemas/postDelivery.ts`, `test/delivery-mcp.test.cjs`;
modify `src/schemas/content.ts`, `src/client/contentRequest.ts`,
`src/tools/posts.ts`, type/import tests, obsolete post email_only fixtures.
**Interfaces:** `validatePostDeliveryInput(input: Record<string,unknown>): void`
in postDelivery.ts consumes merged validated body/query fields, rejects segment
without newsletter, newsletter without explicit published/scheduled status,
scheduled delivery without explicit published_at, and email_only=true publishing/
scheduling without newsletter. No effects/reads/encoding/mutation. Add only
postQueryShapes.edit newsletter safe slug<=191 / email_segment nonblank; shared
shape factory must preserve extra query fields in inferred types (generic query
map or explicit post edit merge). Add email_subject nullable<=300 on posts only.
posts_edit splits controls from body, validates before client; direct content
preparation validates after input+query merge. No double-encoding of query slug.
- [ ] Write real MCP/recording RED cases for published/scheduled email-only/non
  email-only edit, original updated_at offsets, html/revision/include/formats
  query-body separation and optional subject.
- [ ] Write invalid cross-field/unknown/wrong-operation loops including add
  email_only publishing; direct options+injected permissive client prove no
  bypass. Literal omitted segment/no newsletter defaults, caller ownership.
- [ ] Run `npm run build && node --test test/delivery-mcp.test.cjs`; verify RED
  due missing accepted delivery fields/guards, not fixture/module typos.
- [ ] Implement exact interfaces/guards, descriptive posts_add/edit warnings.
  No send-on-create or auto-retry feature; use existing SDK request path.
- [ ] Add type/import coverage; migrate only intentionally invalid former
  email_only publish fixtures to explicit routing or drafts. Full tests/typecheck/
  diff check GREEN; commit.

## Task 2: Newsletter fields/opt-in and removal of unsupported deletion
**Files:** modify `src/schemas/accounts.ts`, `src/tools/{newsletters,registerAccountTools}.ts`,
`src/client/sdkAdapter.ts`, test fixtures/inventories/type/import tests;
create `test/newsletter-admin.test.cjs`.
**Interfaces:** accountQueryShapes.newsletters.add gains opt_in_existing boolean;
corresponding strict add shape includes same query keys. Move sender_name/email,
header_image/footer_content to shared create/edit fields; add slug nonblank<=191.
Sort order stays edit-only. Omit newsletters.delete from shapes/query maps/tool
exports/inferred client surface and explicit adapter runtime resource. No aliases.
Descriptions for add/edit explicitly warn opt-in/verification side effects, not
new send workflow. Shared registerAccountTools behavior/receiver stays intact.
- [ ] RED tests create opt-in true/false/omitted, supported create/edit fields
  and nulls, query-body split, wrong-operation opt-in rejection and strictness.
- [ ] RED tests returned verification+opt-in zero/unknown combined metadata,
  pending sender unchanged, absent meta omitted; direct calls and caller ownership.
- [ ] RED tests unknown removed tool/no HTTP/no archive; direct runtime client
  has no delete, type contract rejects it. Discovery inventory45.
- [ ] Run focused tests, observe actual old behavior RED, implement maps/fields/
  removal/descriptions. Update only current fixtures/counts, not historical docs.
- [ ] Full suite/typecheck/diff check GREEN; commit.

## Task 3: Wire contracts, migration, independent review and PR
**Files:** extend `test/native-http.test.cjs`, `test/stdio.test.cjs`, README.md;
record final execution/review in this plan.
- [ ] Loopback MCP HTTP pins newsletter/segment URL encoding, subject/email_only
  bodies, scheduled dates and updated_at exact strings, HTML/revision query
  separation, opt-in true/false and combined returned metadata.
- [ ] Conflict/permission/service response fixtures show one request/no retries,
  no delivered success; successful failed email result preserved. Existing tests
  retain other transport/headers/response contracts.
- [ ] Stdio discovers exact45 strict tools with side-effect descriptions;
  removed tool request fails with zero HTTP. No unsupported annotations invented.
- [ ] README draft/read/edit publish and email-only schedule examples, explicit
  segment/default all/active newsletter/state-transition caveats, opt-in and
  verification semantics, nullable documented settings, removed-name migration.
  Retain badges/licenses and dependencies warnings. Check #7 acceptance evidence.
- [ ] Clean npm ci/typecheck/full tests/diff check; commit test/docs deliverable.
- [ ] One independent read-only whole-branch review, spec/plan/Review Focus and
  declined-to-judge list. Regrade/fix blocking findings test-first, record scope
  rulings/minors. No per-task reviews or live tests.
- [ ] Final verification/clean status; find templates, push authorized branch,
  create PR with Closes #7 if acceptance met, watch push+PR CI; no merge/deploy.

## Self-review
Spec post rules -> Task1, newsletter/removed capability -> Task2, metadata/HTTP/
errors/discovery/migration -> Tasks2/3. Interfaces preserve existing generic
normalization and types; schema extra-key inference explicitly covered. All five
Review Focus classes have assigned tests. Descriptions, not a dependency upgrade
or unsupported annotations, provide this SDK's side-effect warnings.
