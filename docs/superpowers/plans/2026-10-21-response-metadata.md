# Response Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve issue #5 by returning consistent data/optional-meta envelopes from all data-returning tools without losing server metadata or changing requests.

**Architecture:** Add shared decoded-body normalizers and an explicit executor faithful to the pinned SDK default. Use invocation-scoped AsyncLocalStorage with one SDK instance to validate and retain normalized results before SDK transformation, then migrate SDK/native clients and the prompt together. Verify the public migration across real MCP and loopback HTTP and document the breaking output change.

**Tech Stack:** Node 22, TypeScript/CommonJS, Node AsyncLocalStorage/test runner, existing Ghost/MCP SDKs, Zod and Axios; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-20-response-metadata-design.md`

## Global Constraints

- Uniform `{data, meta?}` for every data-returning tool, including copy. Browse data is always an array; read/add/edit/copy data is exactly one entity. Delete resolves undefined and preserves confirmation text.
- All 46 tool names, existing input schemas, stdio executable and environment settings remain. Do not weaken public types with old/new result unions.
- Preserve all JSON metadata keys/nested values from response-body top-level meta. Retain `{}`; omit absent/undefined; reject null/primitives/arrays. Nested nulls are valid. An entity's own meta/data fields stay inside data.
- Never synthesize pagination, counts, sender changes, verification flags, or permissions; never emit transport response/config/headers as metadata. Preserve returned entities and unknown fields.
- Successful data responses require the matching resource array of records. Browse accepts zero/one/many; entity operations require exactly one. Malformed responses fail safely with no retries.
- Preserve SDK routing, query/body mapping, HTML-source conversion, token/error semantics and injected RequestExecutor decoded-body contract. Preserve respective SDK and native HTTP policies; do not swap SDK transport for native transport.
- Preserve native paths, selector validation, wrapping, headers, sanitized errors and no-retry policy. Preserve established native copy validation/request errors and malformed-response message.
- Update summarize-post only to unwrap result.data; retain title/excerpt/300-character preview. Placeholder resources and full-content repair remain #11.
- No automatic paging, new operations, schema expansion, newsletter delivery/opt-in controls, retries, dependencies, publication, deployment, private-wrapper changes or live mutations.
- Inherited dependency advisories remain release/adoption blockers; offline evidence is not live compatibility evidence. Hosted CI requires an authorized push.

## Review Focus

1. Two same-resource SDK calls finish out of order or a success precedes a failure: each caller gets only its own data and metadata, with no retained last-response state (Task 2 deferred-promise tests).
2. An entity contains its own data/meta fields while the response carries different metadata: fields remain intact, envelope is exactly one layer, and metadata is not inferred from entity contents (Tasks 1/3).
3. Ghost returns a singleton without pagination, an empty page with next:null, or an unpaginated roles/offers collection: cardinality stays operation-specific and neither paging nor exhaustion is invented (Tasks 1/2/3).
4. Making SDK transport explicit changes comma/space query encoding, default Axios options, redirects or SDK error conversion: preserve the pinned default behavior, not the hardened native policy (Tasks 1/3 transport comparison).
5. A newsletter edit starts verification but retains the old sender address, or an add returns opt-in counts: metadata survives, the client reports the returned entity unchanged and no extra email/opt-in request occurs (Tasks 2/3).

## File and interface map

| File | Responsibility |
| --- | --- |
| `src/client/responses.ts` (new) | Shared plain-envelope validation/normalization and response types |
| `src/client/sdkRequest.ts` (new) | Faithful decoded-body executor equivalent to pinned SDK default Axios request |
| `src/client/sdkAdapter.ts` | One SDK instance; invocation-local normalized response capture before SDK transformation |
| `src/client/types.ts` | Re-export response types and operation-specific ResourceClient/CopyOperation returns |
| `src/client/nativeResponses.ts` | Resource-specific compatibility helpers delegate to shared normalizer, now return envelopes |
| `src/client/{commerceClient,staffClient,nativeCopy}.ts` | Explicit operation return signatures and common result contract |
| `src/prompts.ts` | Unwrap data without changing request/preview behavior |
| `test/{responses,sdk-request,sdk-metadata,response-mcp}.test.cjs` (new) | Normalization, transport parity, isolated SDK capture and whole MCP contract |
| Existing adapter/MCP/copy/HTTP/type/import tests | Update only result expectations; preserve request/security assertions |
| `README.md` | Output migration, examples, manual paging, newsletter metadata semantics |

The shared response types initially live in responses.ts without changing old public aliases; Task 2 switches the public contract atomically. responses.ts may import GhostEntity/GhostMetadata from types.ts using type-only imports. Avoid a runtime dependency cycle. Task 1 adds no active production behavior.

## Task 1: Shared response normalization and faithful SDK executor

**Files:** Create `src/client/responses.ts`, `src/client/sdkRequest.ts`, `test/responses.test.cjs`, `test/sdk-request.test.cjs`. No existing adapter/tool behavior changes.

**Interfaces:**
- `GhostResponse<T> = {data: T; meta?: GhostMetadata}`, `CollectionResponse = GhostResponse<GhostEntity[]>`, `EntityResponse = GhostResponse<GhostEntity>` exported by responses.ts.
- `normalizeCollection(resource: string, value: unknown, errorMessage?: string): CollectionResponse`.
- `normalizeEntity(resource: string, value: unknown, errorMessage?: string): EntityResponse`.
- Both consume decoded Ghost resource envelopes; default error `Unexpected Ghost <resource> response`. Optional message allows exact legacy SDK/copy messages without duplicating validation. No validation values in errors.
- `createSdkRequestExecutor(): RequestExecutor` forwards url/method/data/params/headers to Axios with maxContentLength/maxBodyLength Infinity and the pinned comma-joining, encodeURIComponent paramsSerializer; resolves only response.data. No explicit native timeout/maxRedirects/proxy settings, extra headers, retries or sanitization. SDK itself still performs its existing error conversion.

- [ ] Write `normalization keeps collections and metadata outside entity fields`: literal assertions for empty/one/many resource arrays, absent/undefined meta (no own meta property), `{}` meta retained, nested meta with next:null/unknown fields retained, and entity `{data:'own',meta:{own:true}}` alongside independent top-level meta. Check inputs unchanged and normalized data arrays have no hidden meta property.
- [ ] Write `normalization rejects malformed resource envelopes without reflecting payloads`: missing/wrong resource, primitive/null envelope, nonarray resource, primitive/null/array members; entity zero/two records; meta null/false/0/string/array. Assert safe generic error and exact custom copy message. Cover singleton meta:false explicitly: the SDK would otherwise unwrap and hide it.
- [ ] Run `npm run build && node --test test/responses.test.cjs`; expected RED: module missing. Implement the two normalizers in responses.ts using shared record/metadata validation and copied data arrays; no mutation, entity-field guessing or attached array properties. Run the same command; expected GREEN.
- [ ] Write `SDK executor matches pinned default options and encoding without adopting native policies`. In an isolated subprocess with outbound network blocked, intercept the Axios module at its public request boundary, exercise both the real Ghost SDK default transport and createSdkRequestExecutor with equivalent operations, and compare captured configs (excluding independently generated authorization token bytes). Hand-pin maxContentLength/maxBodyLength Infinity; absence of explicit timeout/maxRedirects/proxy; headers, URL/method/body; params serializer output for empty params, `fields:'id,title'`, `filter:'name:A B'`, null/undefined values supported by the executor runtime. Expected query contains `fields=id%2Ctitle&filter=name%3AA%20B`. Return a literal `{data: {posts:[{id:'one'}]}}` Axios response; executor yields only decoded body. Use subprocess isolation so Axios interception cannot affect any other suite; do not mutate node_modules.
- [ ] Run `npm run build && node --test test/sdk-request.test.cjs`; expected RED: sdkRequest module absent. Implement createSdkRequestExecutor with the pinned SDK defaults from lib/admin-api.js:54-76 and unchanged rejection propagation. Run the same command; expected GREEN. Exercise rejected executor calls too: no retries and no added response projection/sanitization before SDK conversion.
- [ ] Run `npm run typecheck && npm test && git diff --check`; expected all 243 baseline tests plus new tests pass, existing bare-result behavior/discovery unchanged.
- [ ] Commit the four new files: `git commit -m "refactor: add explicit response normalizers and SDK executor"`.

## Task 2: Atomic typed-client envelope migration and isolated SDK capture

**Files:** Modify `src/client/{types,sdkAdapter,nativeResponses,commerceClient,staffClient,nativeCopy}.ts`, `src/prompts.ts`, existing adapter/commerce/staff/native-copy/pages/MCP/HTTP/type tests. Create `test/sdk-metadata.test.cjs`. Update imports test for new modules. Tools already JSON.stringify their client results: leave registrations/input schemas unchanged.

**Interfaces:**
- types.ts re-exports Task 1 GhostResponse/CollectionResponse/EntityResponse; remove public GhostArray hidden-meta convention. `GhostResult` may be a union of the new envelopes and undefined only for internal use.
- `OperationResult<K> = K extends 'browse' ? CollectionResponse : K extends 'delete' ? undefined : EntityResponse`; `ResourceClient<Inputs>` maps each key K to `(input: Inputs[K], options?: QueryOptions) => Promise<OperationResult<K>>`. CopyOperation returns Promise<EntityResponse>.
- nativeResponses readNativeCollection/readNativeEntity keep existing (resource,value) parameters but return CollectionResponse/EntityResponse through Task 1 helpers, retaining existing resource-specific response error text.
- createNativeCopy retains config/executor and resource/input parameters, returns EntityResponse using normalizeEntity(..., 'Unexpected Ghost copy response'); validation/auth/request behavior unchanged.
- SDK invocation context is `{resource: string; operation: 'browse'|'read'|'add'|'edit'|'delete'; result?: CollectionResponse|EntityResponse}` owned by an AsyncLocalStorage instance inside createGhostClient, not a global cache. One GhostAdminAPI instance per client keeps existing eager config validation/warnings, options and token behavior. `makeRequest` closes over chosen injected executor or Task 1 SDK executor. Inside each method call, `storage.run(context, async () => ...)` surrounds the SDK invocation; the executor normalizes decoded success bodies into context.result before returning the original body to the SDK. DELETE bypasses normalization. Ignore the SDK's transformed return value; await SDK completion/error conversion before returning context.result. A successful data call without a captured result is a safe response error.
- Give SDK method factory and commerce operation factory generic operation keys/conditional returns or explicit browse/entity/delete functions so mapped public types stay honest. Do not use `as GhostClient`, `any`, or a permissive client cast to bypass compiler errors. Use overloads/narrow local result casts only where operation dispatch requires them, covered by compile-time tests. Staff request helper needs overloads or explicit return paths for browse/add/delete.

- [ ] Write `SDK result envelopes are stable across every operation and metadata shape`: table the six SDK-backed browse families (posts/pages/members/users/tags/newsletters), all SDK read/add/edit operations including webhooks add/edit, and unchanged deletes. Hand-write input fixtures and assert exact `{data,meta?}` results for one entity with/without metadata; check all literal request URL/method/query/body assertions remain. Empty/many collections stay arrays and data operations reject bad cardinality/wrong-resource bodies. Do not wrap expected results using production normalizers.
- [ ] Write `SDK capture validates before metadata can be stripped`: decoded singleton resource with meta:null/false/0/[] fails safely; valid empty-object metadata survives. Raw nonarray resource/missing resource is not a successful entity. Add a malformed-response error containing a secret-valued invalid meta, assert error text excludes it and only one request was made.
- [ ] Write deterministic concurrency tests using test-local deferred executor promises, no sleeps: start posts.read + posts.browse + posts.edit, complete in reverse order, compare each literal data/meta pair; add two same-operation posts.read calls with different IDs completed out of order. Then a metadata-bearing success, metadata-absent success and rejected request must not share state. Include overlapping native offers.browse and SDK posts.browse with independent responses.
- [ ] Write newsletter fixtures: edit sender_email input requests a new address but response retains sender_email:null plus `{sent_email_verification:['sender_email']}`; result must preserve both literally. Add response meta `{opted_in_member_count:7}` as an opaque test-only metadata key rather than claiming that field spelling is a Ghost guarantee; no opt_in_existing input, count inference or extra request. Preserve any documented/source-confirmed count shape as-is if additionally used.
- [ ] Add compile-time assignments for `Promise<CollectionResponse>` browse, `Promise<EntityResponse>` read/add/edit/copy and `Promise<undefined>` deletes; add @ts-expect-error for bare-array result assignment, entity result assigned to CollectionResponse, and delete result assigned to EntityResponse. Keep prior input/removed-tool constraints.
- [ ] Run `npm run build && node --test test/sdk-metadata.test.cjs`; expected RED: bare results, lost/shape-changing metadata and invalid-response acceptance. Run `npm run typecheck`; new result-type assertions should also fail until the migration. Preserve evidence in the execution ledger.
- [ ] Implement SDK invocation-scoped capture as specified above and migrate public types. Preserve page-selector encoding and SDK error paths; do not use shared last-response variables, per-resource maps, global async hooks, per-call SDK reconstruction or node_modules patches. Normalize inside the executor wrapper so falsey malformed metadata cannot disappear first. Use generic safe SDK response error text `Unexpected Ghost SDK response`, except established metadata diagnostics may stay `Unexpected Ghost SDK response metadata` if validated without payload reflection.
- [ ] Migrate native helpers/copy/commerce/staff to envelopes and explicit operation return types. Delete must still resolve undefined; staff permission guidance and all copy error strings remain. Do not alter nativeAdmin/nativeRequest route/signing/policy code. Update prompt's entity access to result.data, retaining defensive field checks and exact preview.
- [ ] Update existing assertions at every affected boundary: test/adapter, pages-adapter, native-copy, commerce-adapter, staff-adapter, mcp-contract, pages-mcp, commerce-mcp, staff-mcp, native-http. Replace only bare result/hidden-meta expectations; keep exact requests, schemas, errors, traversal/redirect/timeout/no-retry checks. Replace known-issue-#5 loss test with first/final/empty-page envelope preservation. Existing singleton SDK browse now expects `{data:[entity]}`, not `{data:entity}`. Prompt output must remain byte-for-byte unchanged for existing fixtures.
- [ ] Run `npm run typecheck && npm test && git diff --check`; expected green suite including Task 1 tests, exact 46-tool inventory, same request counts, no schema/package/lockfile changes. Newly normalized helpers are covered for all twelve repaired native operations plus two copy tools through existing tables. Extend native tests with metadata for each entity operation and empty metadata/no-pagination collection cases, not just SDK examples.
- [ ] Commit all migration code and updated tests: `git commit -m "fix: preserve data and metadata across typed client operations"`.

## Task 3: Whole-MCP migration contracts, actual HTTP parity and README

**Files:** Create `test/response-mcp.test.cjs`. Extend `test/native-http.test.cjs`, `test/imports.test.cjs`, `test/stdio.test.cjs` only where its current inventory/result contract requires it. Modify `README.md`. Reuse the existing stdio discovery harness; do not introduce a duplicate. Do not change product schemas or dependencies.

**Interfaces:** Consume Task 2 typed GhostClient results and existing real MCP harness. Keep MCP `content:[{type:'text',text:JSON.stringify(envelope,null,2)}]`; no structuredContent/outputSchema. README consumers use `JSON.parse(result.content[0].text).data` and sibling meta; this is not a change to the outer MCP message.

- [ ] Write `every data tool serializes one envelope while deletes keep their confirmation`: independently enumerate supported fixture families plus pages CRUD and post/page copy. All 38 data-returning tools produce `{data:recordOrArray,meta:{example:{retained:true}}}` from a queued response; all eight deletes produce existing singular confirmation text with no JSON envelope. Assert one request per call, no input/output-schema drift, exact 46 discovered names and no discovery HTTP. Use cursor iteration for inventory.
- [ ] Write `MCP callers can manually walk first/middle/final and empty pages without hidden requests`: queue literal server page responses for members/pages; compare exact totals/prev/next including null, iterate using returned next only in the test caller, assert each explicit call increments request count once. Include singleton roles/offers responses with no meta: no invented pagination or extra calls. Entity own meta/data fields must remain nested under the single data envelope after JSON serialization.
- [ ] Write `MCP newsletter metadata describes returned state, not requested state`: edit sender address response retains old/null sender and pending-verification metadata; creation preserves supplied opaque opt-in count metadata. Assert request count, unchanged query/body, no new opt-in/delivery inputs, unchanged errors/isError. Test malformed response returns MCP error with safe text, not a successful empty envelope.
- [ ] Run `npm run build && node --test test/response-mcp.test.cjs`; expected GREEN after Task 2. These are cross-boundary regression contracts, not a new product change; any failure requires root-cause investigation before code edits.
- [ ] Extend loopback real HTTP contracts: decoded SDK members browse JSON (with pagination), newsletter edit JSON (with verification meta), native tier edit and page copy JSON (with metadata) reach actual MCP output intact. Keep literal URL/query/body/header/request-count assertions. A default SDK query `fields:'id,title'`/filter with spaces is encoded exactly like pinned transport, not Axios's default query serializer; send it through direct SDK client options where MCP inputs do not expose it.
- [ ] Compare real SDK default transport and explicit SDK executor against the same loopback fixture using synthetic keys: body, path/query, Accept-Version and User-Agent match; verify unchanged SDK redirect behavior with two authorized fixture ports and no external destination. Keep native redirect refusal, timeout/no-retry tests intact rather than claiming SDK is newly hardened. Test SDK 403 conversion remains existing safe message/type and failed mutation count remains one. No hanging-server timeout test on default SDK (it has no new timeout).
- [ ] Extend import subprocess coverage to responses.ts/sdkRequest.ts and AsyncLocalStorage-backed client creation: no env loading, stdout/stderr, HTTP or process exit. Retain existing stdio lifecycle, schema/CI and removed-tool regressions.
- [ ] Add README `Response format migration` section linked from upstream migration guidance: before/after browse and entity examples; copy also wrapped; `result.data`/`result.meta?.pagination` access; outer MCP text unchanged; delete/error behavior stable; no compatibility flag/aliases/bare fallback. Explain explicit numeric next-page calls only where supported, resource-specific limit:'all', absent metadata does not prove exhaustion, unpaginated offers/roles and server-dependent tiers pagination. Explain sent_email_verification is pending, returned sender_email unchanged until verified; opt-in counts retained when supplied, new opt-in/newsletter delivery controls remain #7.
- [ ] Update README features/limitations/development/examples to remove stale #5 metadata-loss and bare-result claims, preserve #6/#7/#11, original three tool removals, staff guidance, badges/MIT, pinned-source-not-live caveats and inherited vulnerability blocker. No package identity/version change or private consumer edits.
- [ ] Run `npm ci`, `npm run typecheck`, `npm test`, `git diff --check`; expected clean install/build, zero failed/skipped tests, exact inventory, no lockfile/dependency changes or external traffic. Record final test total and inherited audit summary.
- [ ] Commit tests/documentation: `git commit -m "test: verify MCP metadata contract and document response migration"`.

## Completion gates

- [ ] Independent whole-branch review against spec, plan and Review Focus, including invocation isolation and SDK transport parity. Re-grade findings by user impact; fix Critical/Important once, failing-test-first, and ledger deferred minors/rulings.
- [ ] Re-run clean verification; report exact results, compatibility change, dependency advisory blocker and no-live-verification scope.
- [ ] Push/open PR only after separate authorization; inspect PR templates and include output migration notes. No merge, publication, deploy or private-wrapper adoption without approval.

## Plan self-review

- [x] Spec coverage: response/cardinality/metadata validation (Task 1); transport equivalence (Tasks 1/3); typed public contract, SDK isolation, native/copy/prompt migration (Task 2); MCP/HTTP/docs (Task 3).
- [x] Atomic migration keeps intermediate commits testable: Task 1 is unused helpers; Task 2 changes all client boundaries/consumers together; Task 3 verifies and documents the same public contract.
- [x] Interfaces match across tasks; broad internal unions do not leak into mapped method returns. Single SDK instance avoids repeated config validation warnings; AsyncLocalStorage carries request-local captures, not globals.
- [x] All five Review Focus classes have explicit owner tests with independent literal expectations, controlled promises or actual HTTP where necessary.
- [x] Scope preserves requests and existing SDK/native policy differences, avoids unrelated hardening, leaves newsletter/schema/resource work separate and retains native execution plus one final independent review.
- [ ] User reviews this implementation plan before execution.
