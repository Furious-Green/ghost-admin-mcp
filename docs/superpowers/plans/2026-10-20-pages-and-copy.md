# Pages and Native Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve issue #4 with SDK-backed pages CRUD and native post/page copy, preserving existing tool behavior.

**Architecture:** Extract focused content schemas without changing post inputs, extend the typed SDK adapter with pages, and add a small separately tested native-copy adapter using the same injectable request boundary. Register seven additional MCP tools and verify actual SDK, MCP, and production HTTP paths.

**Tech Stack:** Node 22, TypeScript/CommonJS, Zod, existing Ghost/MCP SDKs and Axios, Node crypto and built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-20-pages-and-copy-design.md`

## Global Constraints

- Preserve all 42 existing tool names, schemas, successful results, executable, resource/prompt registrations, and import safety; discovery becomes 49 tools.
- No new dependency or lockfile version changes. Retain the separately approved README badges and MIT metadata alignment already on this branch.
- Pages CRUD uses the installed real SDK. Only native copy bypasses it; no private SDK imports, monkeypatching resources, or read/create fallback.
- Keep default `Accept-Version: v5.0`; source-verified reference is Ghost 5.130.0, not a live compatibility claim.
- Copy: POST `/ghost/api/admin/posts/<id>/copy/` or `/ghost/api/admin/pages/<id>/copy/`, no request body, optional formats query, no retries.
- Native HTTP: 30-second timeout, redirects disabled, no secret/config/request dumps, fresh HS256 token with `/admin/` audience and five-minute maximum lifetime.
- Preserve the site subdirectory. New copy input cannot control resource or endpoint. Reject invalid identifiers/configuration before HTTP.
- HTML source precedence and mandatory edit updated_at remain; no automatic collision recovery, publishing-copy override, or newsletter/send options.
- Pages browse retains existing array serialization and issue #5 metadata limitation. Do not claim fixes for #3, #5, #6, #7, or #11.
- No external Ghost calls, production secrets, email sends, consumer changes, deployments, publication, or unapproved pushes. Inherited audit vulnerabilities remain release blockers.

## Review Focus

1. A configured site has a subdirectory or an attacker supplies encoded/path-like IDs: native requests must preserve the site prefix and never escape the fixed resource route; Task 2 tests literal paths and zero-request rejections.
2. A server redirects or echoes secrets in an error body: authorization must not reach another URL and MCP must expose only safe diagnostics; Task 2 loopback and Task 3 MCP tests.
3. A copy times out after the server accepted it: fail once without retrying or creating a second draft; Task 2 timeout and request-count tests.
4. SDK edits mutate input objects and new options resemble content fields: use fresh inputs and verify query/body separation, unchanged post schemas, and timestamp forwarding; Tasks 1 and 3.
5. A server returns empty/multiple/wrong-resource copy entities or a caller supplies both page selectors: fail explicitly rather than reporting false success; Tasks 2 and 3.

## File and interface map

| File | Responsibility |
| --- | --- |
| `src/tools/contentSchemas.ts` (new) | Existing common content/relationship fields and new page/copy validators |
| `src/tools/pages.ts` (new) | Export page schemas/types first; page registration in Task 3 |
| `src/tools/posts.ts` | Import identical shared post fields, add copy schema/registration in Task 3 |
| `src/client/types.ts` | Page client and copy input/result interfaces |
| `src/client/sdkAdapter.ts` | Pages SDK CRUD, then native-copy composition |
| `src/client/nativeCopy.ts` (new) | Fixed copy routes, config/key/version validation, JWT, safe errors, response checks |
| `src/client/nativeRequest.ts` (new) | Axios body-returning executor, redirect and timeout policy |
| `src/createServer.ts` | Register page tools |
| `test/pages-adapter.test.cjs` (new) | Schema and real SDK page contracts |
| `test/native-copy.test.cjs` (new) | Network-blocked recording contracts, independent JWT verification |
| `test/native-http.test.cjs` (new) | Actual native transport, loopback-only network permission |
| `test/pages-mcp.test.cjs` (new) | Real MCP page/copy inputs, dispatch, errors |
| `test/helpers/loopbackGuard.cjs` (new) | Permit only the test fixture host/port while denying all other HTTP/fetch |
| Existing test fixtures/contracts | Keep old 42-case matrix; independently enumerate seven new names |
| `README.md` | Capabilities, copy semantics, query examples, retained limitations |

## Task 1: Shared schemas and SDK-backed page client

**Files:** Create `src/tools/contentSchemas.ts`, `src/tools/pages.ts`, `test/pages-adapter.test.cjs`. Modify `src/tools/posts.ts`, `src/client/types.ts`, `src/client/sdkAdapter.ts`, `test/types/client-contract.ts`. Extend recording helper only if tests require configurable config; preserve its default behavior.

**Interfaces:**
- `contentMutableFields`: the literal existing postMutableFields except email_only; export the existing relationship validators with it. Posts recombines `{...contentMutableFields, email_only: z.boolean().optional()}` and keeps all old keys/types/optionality.
- `formatsParam`: optional string validated against `html`, `lexical`, `html,lexical`, `lexical,html`.
- Pages exports browseParams/readParams/addParams/editParams/deleteParams and `ToolInputs` inferred through the existing `z.infer<z.ZodObject<...>>` pattern. No registration yet.
- `GhostClient.pages: ResourceClient<PageInputs>`; `createGhostClient` returns SDK-backed `pages: crud('pages')`. Copy is added in Task 2.
- `QueryOptions` and `RequestExecutor` remain unchanged; string `all` is already representable.

- [ ] Write `page schemas retain content fields without broadening posts` using literal field-name lists and representative values. Assert existing posts_add strips custom_template and unknown fields, retains email_only, and posts_edit still rejects missing updated_at. Pages accept custom_template and strip email_only. Include paired HTML/Lexical, tags/authors, image/SEO fields, and published_at fixtures.
- [ ] Write `page queries validate pagination and formats`: page/limit reject 0, negatives, fractions; limit accepts 15 or `all`; formats accepts the four specified strings and rejects `plaintext` or empty. Page read field shapes accept optional selectors; XOR checking is tested at the public handler in Task 3.
- [ ] Write real SDK table cases for browse/read-by-ID/read-by-slug/add/edit/delete, injecting the recording executor and fresh arguments. Expected paths are `/ghost/api/admin/pages/`, `/pages/abc123/`, `/pages/slug/about/`; body writes are `{pages: [entity]}`, never posts. Browse query `{page: 2, limit: 'all', include: 'tags,authors', formats: 'html,lexical'}` forwards exactly. HTML add/edit set `{source: 'html'}`, Lexical-only does not. SDK edit retains updated_at in the body; delete normalizes an empty response to undefined.
- [ ] Add type checks: pages methods exist; page edit without updated_at and nonexistent page operations fail TypeScript. Keep the existing negative post contract checks.
- [ ] Run `npm run build && node --test test/pages-adapter.test.cjs`. Expected RED: missing page module/client capability, before production additions. Record the failure; do not weaken the old suite.
- [ ] Extract common fields, implement page schemas and typed client CRUD. Page browse options: filter/order/include/fields/formats, positive integer page, positive integer-or-all limit. Page read: id/slug strings plus include/fields/formats. Add requires title; edit requires nonempty id/updated_at and optional title. Add/edit allow include/formats as tool inputs but callers split them into the client options argument. Do not implement query/content splitting inside generic SDK CRUD.
- [ ] Run `npm run typecheck && npm test`. Expected: all old tests plus new page contracts pass; existing discovery still contains exactly 42 tools until Task 3.
- [ ] Commit: `git commit -m "feat: add shared content schemas and typed pages client"`.

## Task 2: Secure native copy adapter and default HTTP transport

**Files:** Create `src/client/nativeCopy.ts`, `src/client/nativeRequest.ts`, `test/native-copy.test.cjs`, `test/native-http.test.cjs`, `test/helpers/loopbackGuard.cjs`. Modify `src/client/types.ts`, `src/client/sdkAdapter.ts`, `test/types/client-contract.ts`. No MCP registration yet.

**Interfaces:**
- In types.ts: `CopyInput = {id: string; formats?: string}`; `CopyOperation = (input: CopyInput) => Promise<GhostEntity>`.
- Client posts becomes `ResourceClient<PostInputs> & {copy: CopyOperation}` and pages becomes `ResourceClient<PageInputs> & {copy: CopyOperation}`. Do not add copy to ToolInputs maps: the old generic CRUD matrices remain independent.
- `createNativeCopy(config: GhostConfig, makeRequest?: RequestExecutor): (resource: 'posts' | 'pages', input: CopyInput) => Promise<GhostEntity>`.
- `createNativeRequestExecutor(options?: {timeoutMs?: number}): RequestExecutor`, default timeoutMs 30000. This test seam is internal, not a new CLI/tool option. Reject nonfinite/nonpositive timeout overrides.
- sdkAdapter composes `copy: input => copy('posts', input)` and the equivalent for pages. Pass options.makeRequest to both request paths. Native validation runs when copying, not while constructing/importing the client, so it cannot disrupt legacy SDK calls.

- [ ] Write `native copy uses fixed routes and independently verifiable authentication`: both resources, body undefined, params `{formats: 'html,lexical'}` or `{}`, Accept-Version v5.0, single entity result with unknown fields retained. Decode JWT header/payload and independently verify signature using node:crypto.createHmac and decoded synthetic hex secret. Assert alg HS256, typ JWT, kid fixture ID, aud `/admin/`, integer iat bounded by call time, exp = iat + 300. Invoke twice with fresh input; each request must have a valid token (do not require different token bytes within one second).
- [ ] Write path/config cases: base `https://example.invalid/blog` yields `https://example.invalid/blog/ghost/api/admin/pages/abc123/copy/`; ID with a space inside is encoded. Empty/whitespace-only ID, `.`, `..`, slash/backslash, query/fragment, controls, and percent-encoded traversal must reject without requests. Implement conservative copy IDs: reject `%` as well as reserved/control characters; encode remaining nonempty ID as one segment. Reject embedded URL credentials, query/fragment, non-HTTP(S), trailing slash. Key must match anchored 24:64 hex format. v5 normalizes to v5.0; v5.0/v6.0 forward; v4.0/canary reject before native HTTP. Existing SDK operations on otherwise valid configuration remain unchanged.
- [ ] Write malformed-response cases for missing/wrong resource, empty array, multiple entities, primitive entity and null; expected safe error `Unexpected Ghost copy response`. Reject injected executor failures carrying keys, Authorization, URLs and request/config/response diagnostics without leaking any into error messages or enumerable properties.
- [ ] Write safe error expectations: HTTP status failures produce `Ghost <resource> copy failed (HTTP <status>).`; failures without valid HTTP status produce `Ghost <resource> copy request failed.`. Copy errors may expose numeric statusCode and a validated short alphanumeric Ghost type (maximum 64 characters) as name; never reflect server message/context. Transport errors do not escape raw. Validation errors name the invalid field only. No error body, key, token, path, or headers in outward diagnostics; a 403/404/409/500 attempts exactly once.
- [ ] Run `npm run build && node --test test/native-copy.test.cjs`. Expected RED: native copy module/method missing. Implement only after recording this failure.
- [ ] Implement `createNativeCopy` with Node crypto, fixed allowlisted resources, strict validation, encoded segments, empty request body, optional formats, and strict single-entity response checking. Reuse no SDK internals. Wrap executor failures and response failures distinctly; generate tokens per invocation. Native production requests include JSON Accept, Authorization and Accept-Version headers; do not serialize a fabricated content body.
- [ ] Write loopback HTTP tests before nativeRequest implementation: fixture observes POST and zero request-body bytes, decodes formats query, returns `{pages: [{id: 'copy1'}]}`. Use the actual default transport through createGhostClient without options.makeRequest. Register reader/socket/server cleanup before assertions and use finite 10-second test timeouts.
- [ ] Add `loopbackGuard` before importing Axios/product modules: permit only 127.0.0.1 and fixture-assigned ports, forbid all other http/https request/get and fetch; preserve ordinary offline test guards. Resolve Axios URL/options overloads correctly and reject ambiguous destinations. HTTP fixture may listen before imports so allowed ports are exact. Default executor must bypass environment proxy routing for this fixed-host contract (`proxy: false`), never inheriting unrelated proxy credentials.
- [ ] Test a 302/307 response to a second local endpoint: first receives one request, target receives zero, caller gets safe failure. Test non-JSON/malformed success bodies and secret-echoing 403 errors. Test socket reset and delayed response with `createNativeRequestExecutor({timeoutMs: 50})` injected through the same copy API: one received request and generic failure, no retry. Independently assert default 30000 policy using a named exported `NATIVE_REQUEST_TIMEOUT_MS = 30000` consumed by the executor; test actual timeout behavior with the short override, not a 30-second sleep.
- [ ] Run `npm run build && node --test test/native-http.test.cjs` before implementing default executor. Expected RED: missing nativeRequest or default transport; if the module exists for composition, its missing behavior must be the failure. Never retain a fake-success transport.
- [ ] Implement nativeRequest using the existing Axios dependency, timeout option, `maxRedirects: 0`, `proxy: false`, return response.data only. No retries or response logging. Ensure Axios's empty POST really sends no bytes; assert it through the server rather than an injected call.
- [ ] Add TypeScript negative tests for missing copy ID and nonexistent copy on members; positive checks for posts/pages copy.
- [ ] Run `npm run typecheck && npm test`. Expected: all suites pass with no outbound traffic, extra HTTP attempts, open fixtures, or changed legacy discovery. If Task 2 composition needs nativeRequest before its RED cycle, use a missing module as the initial RED and finish the executor together with copy before the green run; do not introduce broken intermediate commits.
- [ ] Commit: `git commit -m "feat: add authenticated native post and page copy"`.

## Task 3: MCP registration, regressions and user documentation

**Files:** Modify `src/tools/pages.ts`, `src/tools/posts.ts`, `src/tools/contentSchemas.ts`, `src/createServer.ts`, `test/helpers/fixtures.cjs`, `test/mcp-contract.test.cjs`, `test/stdio.test.cjs`, `test/imports.test.cjs`, `README.md`. Create `test/pages-mcp.test.cjs`. Keep foundation adapter matrices unchanged except adding dedicated page coverage from Task 1.

**Interfaces:**
- `registerPageTools(server: McpServer, client: GhostClient): void`.
- Export `copyParams = {id: <nonempty string validator>, formats: formatsParam}` from contentSchemas; register in posts/pages without changing their CRUD ToolInputs.
- Export seven hand-listed `additionalToolNames` in fixtures: pages_add, pages_browse, pages_copy, pages_delete, pages_edit, pages_read, posts_copy. Keep original families/toolNames arrays for the original 42 operations; discovery assertions compare their sorted union, never derive expected inventory from production registration.
- Page registration separates `{include, formats, ...entity}` for writes and `{id, slug, ...query}` for reads. Check read XOR before calling the client; throw `Provide exactly one page selector: id or slug.`. Browse forwards its query as first SDK argument. Include/formats/source are query-only, never body content.

- [ ] Write actual MCP discovery expecting the sorted 49-name union (including stdio discovery), leaving the original 42 dispatch cases intact. Write calls for all seven tools with literal required arguments and request/result expectations. Run `npm run build && node --test test/pages-mcp.test.cjs`; expected RED: tools missing. Confirm the discovery update fails for the seven missing names, not unrelated parsing.
- [ ] Add schema/dispatch cases: missing/both/empty page selectors fail with zero requests; id and slug dispatch correctly; invalid page/limit/formats reject; `limit: 'all'` forwards; include/fields/formats read and browse options are query-only. Add/edit preserve timestamps/content metadata and relationships; missing updated_at rejects before HTTP. Page custom_template survives while email_only/newsletter/send/unknown fields are stripped, never sent. Existing posts custom_template remains stripped and email_only retained.
- [ ] Assert HTML add/edit source precedence, Lexical-only no source, exact page resource bodies, JSON entity responses, and deletion text `Page with id abc123 deleted.` only on success. Characterize page pagination metadata loss with nonempty and empty arrays, explicitly naming issue #5.
- [ ] Assert native copy calls one POST with no body and returns the copied entity; formats forwards. Permission/not-found/conflict/secret-bearing injected errors result in isError true and only the safe Task 2 diagnostics, no retries or fallback reads. Invalid IDs fail without requests. Do not fabricate server copying/title/status logic: use literal returned entity fixtures representing Ghost's documented draft response.
- [ ] Register the five page tools and both copy tools. Register pages through createServer; reuse focused schemas/helpers rather than rewriting other handlers. Keep page selector cross-field validation inside handler because existing server.tool registration consumes a ZodRawShape.
- [ ] Extend credential-free import subprocess coverage to pages/contentSchemas/nativeCopy/nativeRequest; construction must emit no output, make no HTTP calls, and require no environment variables. Update stdio exact inventory to 49 without changing child lifecycle guarantees or permitting HTTP.
- [ ] Update README pages and copy capabilities, page read/write examples with query fields, formats/limit options, native draft semantics, minimum-version-header distinction and Ghost 5.130.0 source baseline. Explain no content overrides in copy, permission dependence, and new pages' issue #5 limitation. Retain badges/MIT, unsupported-resource warnings, and dependency security blocker. Do not mark source verification as live testing.
- [ ] Run `npm ci`, `npm run typecheck`, `npm test`, `git diff --check`. Expected: clean install/build and every suite passes, no skips, no production HTTP, unchanged dependency versions and license-only existing lockfile adjustment. Compare diff against approved spec and record exact test totals.
- [ ] Commit: `git commit -m "feat: expose pages and native copy through MCP"`.

## Completion and handoff

- [ ] Obtain independent whole-branch review against the approved spec, this plan, and Review Focus; fix significant findings with failing-then-passing regression tests.
- [ ] Re-run full verification and report test totals, audit limitation, deferred findings, and any design rulings.
- [ ] Only after explicit authorization, push and open a focused issue-#4 PR targeting main; inspect PR templates, include badges/MIT note and remaining known issues. Observe hosted CI separately.
- [ ] Do not merge, publish, deploy, or update the private consumer without separate approval.

## Plan self-review

- [x] Spec coverage: page schemas/SDK (Task 1), native routing/JWT/errors/default HTTP (Task 2), all MCP registration/compatibility/docs (Task 3).
- [x] Interfaces: CRUD ToolInputs stay independent of CopyInput; shared RequestExecutor returns decoded bodies on both paths; exact inventory preserves the original dispatch matrix.
- [x] Review Focus mapped to explicit tests, including actual default transport and malicious error bodies.
- [x] No production implementation included or authorized by this document. Native execution preference retained; implementation waits for user plan review.
