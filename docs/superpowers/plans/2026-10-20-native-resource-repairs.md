# Native Resource Repairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve issue #3 by implementing twelve real native operations, removing three nonexistent tools, and documenting migration from upstream.

**Architecture:** Extract the secure native request core from copy, preserving its contracts. Build typed, runtime-validated commerce and staff adapters on that core, then replace only the four nonexistent SDK resource mappings. Keep real MCP and loopback tests at each boundary and document intentional compatibility changes.

**Tech Stack:** Node 22, TypeScript/CommonJS, existing Zod/Ghost/MCP SDKs/Axios, Node crypto and built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-20-native-resource-repairs-design.md`

**Execution status (2026-10-20):** All three stages implemented and committed
(`a4d572d`, `d7c8942`, `2854eec`). Clean install, typecheck, 243 tests and diff check
passed. Independent whole-branch review reproduced verification and reported no
findings. No dependency changes or live calls. Push/PR, merge, release and private
consumer adoption remain separate approval gates. Step checklists below preserve
the original execution brief; completion is recorded by this status and commits.

## Global Constraints

- Implement tiers browse/read/add/edit; offers browse/read/add/edit; invites browse/add/delete; roles browse. No new tools beyond the approved twelve repairs.
- Remove tiers_delete, offers_delete, roles_read: no compatibility stubs, aliases, hidden delete adapters, or implicit archival.
- Discovery ends at 46 tools. Preserve other tool names, SDK CRUD/post/page schemas, executable, environment variables, resources/prompts, badges, and MIT metadata.
- Reuse native authentication and the same RequestExecutor; preserve existing copy error strings, response shape, no-body POSTs, and security tests.
- Keep default Accept-Version v5.0 and numeric v5-or-newer normalization; pinned source reference Ghost 5.130.0 is not live compatibility evidence.
- Native HTTP retains 30000 ms timeout, zero redirects, proxy:false, no retries or auth fallback. JWT HS256, aud /admin/, exp=iat+300; credentials never leave configured origin through redirects or errors.
- JSON writes wrap one entity and send Content-Type application/json. Reads/delete have no body; never send ID in edit body or tier_id in offer body.
- Validate/encode all native path IDs at MCP and client boundaries. Reject unsupported selectors/query fields before any request, not through silent Zod stripping.
- Preserve browse arrays and optional metadata at client boundary; issue #5 array JSON metadata loss remains. No special envelope or fabricated pagination.
- No dependency changes, production Ghost/Stripe calls, staff invitation emails, private consumer changes, publication, deployment, or unauthorized pushes. Inherited vulnerabilities remain adoption blockers.

## Review Focus

1. A key targets a subdirectory or a read/edit/delete ID contains traversal: every operation stays under its fixed native resource route; Tasks 1/2/3 pin exact paths and zero-request rejection.
2. A legacy client supplies slug/code, pagination for a nonpaginated collection, or an unknown field: it must fail explicitly rather than silently use a broader query; strict MCP and runtime validation in Tasks 2/3.
3. An invitation/pricing/archive mutation fails after possible acceptance: attempt it once, return a safe error, never retry or fall back to a different credential; Tasks 2/3 loopback and MCP failures.
4. A one-element browse result lacks pagination or a write returns an empty/wrong-resource envelope: collection results remain arrays and malformed entity writes do not look successful; Tasks 2/3 response tests.
5. Upstream callers continue invoking removed tool names: discovery must omit them, calls must fail without HTTP, and README must describe archival/role-list replacements without claiming deletion; Tasks 2/3 removal tests and documentation review.

## File and interface map

| File | Responsibility |
| --- | --- |
| `src/client/nativeAdmin.ts` (new) | Explicit operation allowlist, validated paths/config, shared signing/headers and safe request errors |
| `src/client/nativeCopy.ts` | Copy-specific input/result contract using shared native request core |
| `src/client/nativeResponses.ts` (new) | Native single-entity and collection envelope validation; retained metadata |
| `src/schemas/tiers.ts`, `src/schemas/offers.ts` (new) | Commerce raw shapes and strict reusable runtime schemas, without handler/client cycles |
| `src/schemas/staff.ts` (new) | Invite/role shapes and strict runtime schemas |
| `src/tools/registerStrictTool.ts` (new) | Strict schemas through the public RegisteredTool returned by server.tool |
| `src/client/commerceClient.ts` (new) | Tier/offer input validation, resource envelopes, tier mapping, archival |
| `src/client/staffClient.ts` (new) | Invite/role adapters, deletion semantics, staff guidance |
| `src/client/types.ts`, `src/client/sdkAdapter.ts` | Typed composition replacing only four nonexistent SDK resources |
| `src/tools/{tiers,offers,invites,roles}.ts` | Re-export schemas/types, preserve supported registrations, remove three tools |
| Native repair tests (new) | Shared core, commerce/staff adapter contracts, actual MCP dispatch |
| `test/native-http.test.cjs` | Existing and new default-transport loopback contracts |
| Existing fixtures/discovery/type/import tests | Preserve unrelated contracts; replace obsolete unsupported-resource assumptions |
| `README.md` | Exact supported inventory and original-to-fork migration guide |

## Task 1: Shared native admin request core without copy regressions

**Files:** Create `src/client/nativeAdmin.ts`, `test/native-admin.test.cjs`. Modify `src/client/nativeCopy.ts`. Extend `test/native-http.test.cjs` only for shared-core request behavior; leave nativeRequest.ts policy unchanged.

**Interfaces:**
- `NativeOperation` is the closed string union posts.copy, pages.copy, tiers.browse/read/add/edit, offers.browse/read/add/edit, invites.browse/add/delete, roles.browse (expand slashed notation into literal union members).
- `NativeInput = {id?: string; query?: QueryOptions; body?: unknown}`.
- `createNativeAdminRequest(config: GhostConfig, makeRequest?: RequestExecutor): (operation: NativeOperation, input?: NativeInput) => Promise<unknown>`.
- `encodeNativeId(value: unknown): string`: validates one nonempty segment, rejects dot/dot-dot, percent escapes, slash/backslash, query/fragment, controls, invalid Unicode; encodes allowed Unicode/spaces. Safe generic validation messages, never echo values.
- The operation map owns resource, verb, ID requirement, copy suffix, and body policy. Callers cannot pass an endpoint, URL, or method. Unknown operations reject before HTTP even from JavaScript.
- Preserve `createNativeCopy(config, makeRequest?)` and its public error strings. Copy still validates formats and exactly one corresponding entity.

- [ ] Write `shared native operations sign fixed routes without accepting arbitrary endpoints`: table all fourteen native operations (two existing copy plus twelve repairs). Literal expected verbs/paths, empty GET/DELETE/copy bodies, wrapped JSON write bodies, subdirectory prefix, Accept/Accept-Version/Content-Type. Decode and independently HMAC-verify JWT claims for at least GET, PUT, DELETE using synthetic fixture key; exp=iat+300, aud /admin/.
- [ ] Write rejection cases: unknown operation `tiers.delete`, malformed key, credential-bearing/query/fragment/trailing-slash/non-HTTP config URLs, v4.0/canary version, missing or unsafe path ID, and a body on copy/browse/delete. Assert requests length 0. Check Unicode path encoding without introducing a second encode/decode pass.
- [ ] Write `shared errors never reflect credentials or upstream diagnostics`: injected 403/404/409/500, socket-like failure, secret-bearing type/message/context. Result errors have only safe generic message, optional numeric statusCode, allowlisted type, no request/config/response/cause or secret in stack. Generic text for repaired operations is `Ghost <resource> <operation> failed (HTTP <status>).` or `Ghost <resource> <operation> request failed.`. Copy retains current exact strings.
- [ ] Run `npm run build && node --test test/native-admin.test.cjs`; expected RED: shared native module absent. Keep full failure output in the execution ledger workspace.
- [ ] Extract config/ID/version/token/error behavior into nativeAdmin. Validation errors for copy preserve `Invalid Ghost copy <field>.`; other operations use `Invalid Ghost <resource> <operation> <field>.`. Validate lazily on invocation so unrelated SDK construction/imports remain unaffected. Preserve the existing known error-type whitelist; never reflect arbitrary upstream strings.
- [ ] Refactor nativeCopy to use the shared core; do not change its public API or success/error behavior. The same injected executor observes SDK, copy, and later native resource calls. No new dependency or global configuration.
- [ ] Exercise actual shared-core JSON PUT and no-body DELETE against existing loopback-only fixtures; verify Content-Type, decoded response body, redirect refusal/timeout/error handling through unchanged default executor. Keep all old native-copy/native-http security tests intact.
- [ ] Run `npm run typecheck && npm test`; expected all baseline 191 cases plus new shared-core tests pass; discovery still 49, no changed unsupported-resource behavior yet.
- [ ] Commit: `git commit -m "refactor: share secure native admin request core"`.

## Task 2: Typed tiers/offers adapters, explicit archival and two removals

**Files:** Create `src/client/commerceClient.ts`, `src/client/nativeResponses.ts`, `src/schemas/tiers.ts`, `src/schemas/offers.ts`, `src/tools/registerStrictTool.ts`, `test/commerce-adapter.test.cjs`, `test/commerce-mcp.test.cjs`. Modify types.ts, sdkAdapter.ts, tools/tiers.ts, tools/offers.ts, test/types/client-contract.ts, fixture/adapter/MCP/discovery/stdio/page-inventory tests, README.md.

**Interfaces:**
- `createCommerceClients(config: GhostConfig, makeRequest?: RequestExecutor): Pick<GhostClient, 'tiers' | 'offers'>` consumes Task 1 core.
- Each schema module exports the existing browseParams/readParams/addParams/editParams names and `ToolInputs`, plus `schemas` whose values are `z.object(rawShape).strict()`. Tools re-export them so existing imports continue working. Client imports pure schemas, never registration modules.
- Remove delete from tier/offer ToolInputs and GhostClient capabilities by inference; no runtime delete property.
- `readNativeEntity(resource: string, value: unknown): GhostEntity` and `readNativeCollection(resource: string, value: unknown): GhostArray` validate envelopes without projecting unknown entity fields. Collection arrays retain optional record metadata; malformed meta is an error. Missing/empty/multiple entity results are errors; empty collections are valid.
- `registerStrictTool<Args extends ZodRawShape>(server: McpServer, name: string, description: string, shape: Args, callback: ToolCallback<Args>): RegisteredTool` uses `server.tool(...)`, then assigns `registered.inputSchema = z.object(shape).strict()` through the returned public typed property, before connecting. Do not touch _registeredTools, replace MCP dispatch, or change other tools' default parsing. Real MCP unknown-key tests are mandatory for this mechanism.
- Native client operations parse strictly before shared requests, with generic `Invalid Ghost <resource> <operation> input.` failures. Preserve ResourceClient signatures but reject nonempty optional second QueryOptions arguments; native query inputs belong in the typed first argument, not an ignored SDK-style option bag. Undefined/empty option bags may pass.

- [ ] Write eight adapter cases plus archival cases. Expected example:

```js
await client.offers.add({name: 'Sale', code: 'sale', cadence: 'month', duration: 'once', amount: 10, tier_id: 'tier1', type: 'percent'});
assert.deepEqual(requests[0].data, {offers: [{name: 'Sale', code: 'sale', cadence: 'month', duration: 'once', amount: 10, tier: {id: 'tier1'}, type: 'percent'}]});
// Tier/offer edit URLs contain the ID; their bodies do not.
assert.deepEqual(tierArchiveRequest.data, {tiers: [{active: false}]});
assert.deepEqual(offerArchiveRequest.data, {offers: [{status: 'archived'}]});
```

- [ ] Pin literal GET/POST/PUT paths, headers, query/body separation, include combinations, fields/filter and supported pagination forwarding. Tier read is ID-only; offers browse is filter-only. Read/add/edit require matching exactly-one entity; browse returns array for zero/one/many even without meta. Metadata is retained at client boundary. Test wrong-resource/missing/primitive/null envelopes and malformed metadata; no fake success.
- [ ] Define tier shapes exactly per spec: browse filter/limit/page/order/fields/include; read required ID/include; add nonempty name plus existing fields, no active; edit ID and optional fields plus active:boolean. Price fields finite integer nonnegative; include is a comma-separated nonempty subset of monthly_price/yearly_price/benefits. ID inputs use shared safe-segment validation. Keep source-backed partial edit, not an artificial required name.
- [ ] Define offer shapes: browse filter; read ID; add existing required/optional fields, finite integer amount, optional positive integer duration_in_months. Keep cadence/duration/type as nonempty strings with server domain validation; locally enforce fixed=>currency and repeating=>duration_in_months. Edit only ID/name/code/display_title/display_description/status(active|archived). Native schema refinement for cross-field dependencies also runs in client. No discount/tier changes on edit.
- [ ] Write strict schema/MCP tests for legacy slug/code read fields, offers pagination/order, unknown query fields, and immutable edit fields; zero HTTP requests even if a valid ID is supplied too. Assert clear property/required-ID validation errors. Before implementation run `npm run build && node --test test/commerce-adapter.test.cjs test/commerce-mcp.test.cjs`; expected RED from currently unsupported tier/offer calls and present delete registrations.
- [ ] Implement the schema modules, strict registration helper, response validators, and commerce adapters. Compose only tiers/offers into sdkAdapter; leave invites/roles unsupported for Task 3. Use shared operation IDs for every request; do not pass ID, include, tier_id, or query fields into inappropriate body locations. Preserve inputs (no mutation or prefetch/retry).
- [ ] Remove tiers_delete/offers_delete registrations and schemas. Add descriptions to archive-capable edits; no hidden aliases. Register all eight supported tools through strict helper. Fixed/repeating validation can occur in client after MCP basic parsing; failures still make zero requests. Test actual strict unknown-key rejection through the real MCP client.
- [ ] Update tests without losing unrelated coverage: keep fixture families for exact supported operations, remove two delete entries, keep backedFamilies as the six real SDK families. SDK generic tables continue covering all 27 real SDK dispatches; replace only tiers/offers unsupported branches with new dedicated native cases, leaving five invites/roles unsupported cases for Task 3. Keep independently hand-listed expected native operation names; do not derive expected inventory from production registration.
- [ ] Interim discovery is exactly 47 tools, with both removed names absent. Update all inventory consumers consistently (mcp-contract, pages-mcp, stdio), not just totals. Type tests prove tier/offer delete are absent and read requires ID. New MCP requests to removed names reject with unknown-tool errors and zero HTTP.
- [ ] Test 403/404/409 and secret-bearing server errors on add/edit, each exactly one request and safe error text; no archival-on-delete fallback. Add actual default HTTP loopback tier PUT and offer POST contracts, including nested tier JSON, failed mutation no-retry, and valid-origin route confinement on Unicode IDs. Malicious path IDs reject before transport.
- [ ] Begin README migration section with tier/offer removals and edit examples, tier_id mapping, source-vs-doc caveats, ID-only reads and rejected offers options. Update commerce inventory/support text, retaining staff limitation until Task 3. No extra documentation-only commit required.
- [ ] Run `npm run typecheck && npm test && git diff --check`; expected green suite and exact 47 names, unchanged SDK/pages/copy/import/security behavior.
- [ ] Commit: `git commit -m "fix: implement tier and offer adapters with explicit archival"`.

## Task 3: Staff adapters, role-read removal and complete migration guide

**Files:** Create `src/client/staffClient.ts`, `src/schemas/staff.ts`, `test/staff-adapter.test.cjs`, `test/staff-mcp.test.cjs`. Modify types.ts, sdkAdapter.ts, tools/invites.ts, tools/roles.ts, test/types/client-contract.ts, remaining fixture/adapter/MCP/discovery/stdio/page-inventory/import tests, native-http.test.cjs, README.md.

**Interfaces:**
- `createStaffClients(config: GhostConfig, makeRequest?: RequestExecutor): Pick<GhostClient, 'invites' | 'roles'>` uses shared request/response validators and strict runtime inputs from Task 2 patterns.
- staff schema exports `inviteSchemas` (browse/add/delete), `roleSchemas` (browse), inferred InviteInputs/RoleInputs. Tool modules re-export prior supported schema names and ToolInputs aliases, removing roles read entirely.
- Invite browse: filter/positive-integer-or-all limit/positive-integer page/order/fields; add safe nonempty role_id and z.string().email() email; delete safe ID. Roles browse: permissions optional literal assign. All runtime objects strict; all registrations use registerStrictTool.

- [ ] Write four adapter contracts: GET invites/ with query, POST invites/ with `{invites:[{role_id:'role1',email:'staff@example.invalid'}]}`, DELETE invites/abc123/ without body, GET roles/ with `{permissions:'assign'}`. Browse zero/one/many always arrays. Invite add exactly one matching entity; delete empty successful response => undefined. Safe staff permission failures preserve only generic status/type; no assertion about caller's actual key class.
- [ ] Write actual MCP tests: four successful dispatches, exact result/confirmation text `Invite with id abc123 deleted.`, strict unknown/legacy role filter/page/limit/order rejection, invalid email/role_id/ID, and 403/404/409 failures. No automatic retries, alternate credentials, discovery-time requests, or invitation sends in tests. Check failed delete never returns its success confirmation.
- [ ] Write removed roles_read call test (ID and name variants): unknown tool, no HTTP. Verify tiers_delete/offers_delete remain absent. Run new tests before implementation: `npm run build && node --test test/staff-adapter.test.cjs test/staff-mcp.test.cjs`; expected RED from current unsupported resources and existing roles_read.
- [ ] Implement staff schemas/client, compose into sdkAdapter, remove roles_read schema/registration/type. Register staff tools strictly, with descriptions identifying staff-management permission needs and invite email side effect. No new credential config, key-class guessing, or invites_read alias.
- [ ] Finish replacing obsolete unsupported-resource characterization branches; do not weaken unrelated SDK/HTML/Lexical/concurrency/selector/metadata/resource/prompt contracts. The final legacy matrix retains supported names only: 39 original operations plus the seven pages/copy additions. Native suites cover all twelve repaired operations, not fake SDK capabilities. Type tests reject tiers.delete, offers.delete, roles.read, missing read IDs and unsupported staff options.
- [ ] Update every discovery assertion to the same exact 46-name inventory, retaining cursor loops and zero-discovery-HTTP checks. Keep original resources and prompt registrations, including known placeholders.
- [ ] Extend import subprocess tests to shared native core, response/schema/client modules and strict-registration helper: no environment loading, output, requests, or exit when constructing the server without transport.
- [ ] Add loopback-only actual HTTP staff contracts: JSON invite creation to a local fixture only, empty-body DELETE/204, roles permissions query, safe secret-echoing 403, redirect target receives zero requests, timed-out invite mutation receives exactly one request using existing short-timeout executor seam. Reuse existing timeout/cleanup/network guards; no external destination or real invitation.
- [ ] Complete README `Migrating from the original implementation` section: three-row removed-tool replacement table; upstream missing-SDK explanation; refresh discovery; unknown-tool behavior; ID-only reads; tier_id remains input but native tier:{id} payload; archival is not deletion; supported/removed role/offer query options; staff-token permission and invitation-email caveats. Mark offer status and partial active-only tier edit as Ghost 5.130.0 source-verified where public docs differ. Document tiers pagination as server-dependent and unpaginated offers/roles honestly. Update all current capability and 46-tool inventory statements; preserve badges/MIT, issue #5/#6/#7/#11 limitations and inherited vulnerability blocker.
- [ ] Run `npm ci`, `npm run typecheck`, `npm test`, `git diff --check`; expected clean install/build, no skipped/failing tests, exact 46 tools, no outbound traffic, leaked processes, version/lockfile changes, or live actions. Record exact test totals and audit summary.
- [ ] Commit: `git commit -m "fix: implement staff adapters and document upstream migration"`.

## Completion and handoff

- [ ] Independent whole-branch review against spec, this plan, and Review Focus. Fix Critical/Important findings in one failing-test-first pass; record deferred minors/rulings.
- [ ] Re-run clean verification. Report exact test totals, removal/migration behavior, unchanged dependency versions, and source-not-live compatibility scope.
- [ ] After separate authorization, push and create an issue-#3 PR targeting main, inspecting PR templates and including the migration/removal notes. Observe hosted CI separately.
- [ ] No merge, release, deploy, private wrapper changes, or adoption until separately approved.

## Plan self-review

- [x] All spec sections mapped: shared auth/security (Task 1); tiers/offers and two removals (Task 2); invites/roles and final migration (Task 3).
- [x] Explicit intermediate inventory 49 -> 47 -> 46 keeps task commits independently testable; all expected names remain independent of production registration.
- [x] Public RegisteredTool schema property handles strict MCP parsing without private registries or global dispatcher changes; runtime client validation is independent.
- [x] Review Focus has recording, real MCP, and actual HTTP tests, not merely source-text assertions.
- [x] No production code or dependency edits in this plan. Native execution preference retained; implementation waits for plan approval.
