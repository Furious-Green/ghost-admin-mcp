# Testable Client Foundation Implementation Plan

> Historical implementation plan. Technical decisions and verification evidence are retained below.

**Goal:** Resolve issue #2 by making existing tool handlers independently testable, exposing an honest typed client boundary, and adding offline contract tests and CI without expanding Ghost API coverage.

**Architecture:** Preserve the current SDK and tool modules, inject a typed client into registration, and move startup effects into the executable composition root. Test both the real SDK with a recording request implementation and real MCP calls over in-memory transports; characterize rather than silently fix separately tracked defects.

**Tech Stack:** Node 22, TypeScript with Node16/CommonJS compilation, existing Ghost/MCP SDKs and Zod, Node built-in test runner, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-20-testable-client-foundation-design.md`

## Global Constraints

- Preserve the `ghost-mcp` executable, stdio transport, 42 existing tool names, current input schemas, and existing successful response shapes in this slice.
- Downstream deployments and dependency references remain unchanged.
- No new test framework or runtime loader; keep fixtures outside distributed `build/` output.
- No production credentials, external HTTP calls, live Ghost mutations, npm publication, or deployment.
- Missing tiers/offers/invites/roles methods must return explicit unsupported-capability errors, never fake implementations.
- Keep issues #3, #5, and #11 open; passing characterization tests do not fix their defects.
- CI: Node 22, `npm ci`, explicit no-emit typecheck, tests, read-only contents permission, no secrets or privileged pull-request workflows.
- Retain/review `package-lock.json`; no unrelated dependency upgrades.
- Never log non-protocol output to stdout or add automatic mutation retries.

## Review Focus

1. A user supplies no Ghost environment variables while importing tools: importing and constructing the factory must not exit or connect; test in Task 2.
2. The SDK mutates selectors and edit inputs: forwarding must remain correct and test fixtures must not leak mutation across calls; test fresh arguments and recorded bodies in Tasks 1 and 3.
3. A permission error carries request diagnostics: MCP results must be errors without credentials/headers and without mutation retries; test in Tasks 1 and 3.
4. Discovery requests exceed one response page or a child process fails: enumerate all discovery pages and always clean up transports/processes/HTTP fixtures; test in Tasks 3 and 4.
5. Unavailable SDK resources remain advertised: report explicit errors with zero HTTP requests, never claim functionality from a fake injected resource; test in Tasks 1 and 3.

---

## File and interface map

| File | Responsibility |
| --- | --- |
| `src/client/types.ts` (new) | Operation input map, SDK result/metadata shapes, typed `GhostClient`, recording-request types |
| `src/client/sdkAdapter.ts` (new) | Only SDK interoperability boundary; runtime capability checks and optional request injection |
| `src/config.ts` | Explicit `readGhostConfig(env)` with no import-time environment processing |
| `src/ghostApi.ts` | Explicit production client factory; remove singleton after migration |
| `src/createServer.ts` (new) | Pure server factory and registration, without connection or environment lookup |
| `src/server.ts` | Existing CLI path: configuration, client, factory, stdio, sanitized fatal errors |
| `src/tools/{posts,members,users,tags,tiers,offers,newsletters,invites,roles,webhooks}.ts` | Existing schemas/handlers, exported input types, injected client |
| `src/prompts.ts` | Inject client; narrow unknown post fields without expanding prompt content |
| `src/resources.ts` | Remove unused singleton import; retain placeholders for issue #11 |
| `types/tryghost__admin-api.d.ts` | Focused constructor declaration returning `unknown`, not an untyped module |
| `test/helpers/{fixtures,recordingClient,mcpHarness,networkGuard}.cjs` (new) | Synthetic fixtures, recording SDK construction, MCP lifecycle, external-network denial |
| `test/{adapter,imports,mcp-contract,stdio,workflow}.test.cjs` (new) | Runnable tests of the corresponding responsibilities |
| `test/types/client-contract.ts` and `tsconfig.test-types.json` (new) | Compile-time boundary regression checks excluded from shipped build |
| `.github/workflows/ci.yml` (new), `package.json`, `README.md` | CI commands and accurate contributor instructions |

Use `.cjs` tests directly against compiled TypeScript (`require('../build/...')`).
No test transpilation step or framework is needed. Product output remains under
`build/`, and npm's existing `files` list does not start shipping fixtures.

### Shared interfaces

Export each module's existing `browseParams`, `readParams`, `addParams`,
`editParams`, and `deleteParams` only where present, without changing their
contents. Each module exports a type-only `ToolInputs` map using
`z.infer<z.ZodObject<typeof existingParams>>`. `src/client/types.ts` imports those
maps using `import type`; this does not load handlers/configuration at runtime.

- `GhostConfig = {url: string; key: string; version: string}`.
- `QueryOptions = Record<string, string | number | boolean | undefined>`.
- `GhostEntity = Record<string, unknown>`.
- `GhostMetadata = Record<string, unknown>`.
- `GhostArray = GhostEntity[] & {meta?: GhostMetadata}`.
- `GhostResult = GhostEntity | GhostArray | undefined` (the boundary permits an
  empty delete response; consumers narrow results before reading properties).
- `ResourceClient<Inputs>` maps each key of an input map to
  `(input: Inputs[Key], options?: QueryOptions) => Promise<GhostResult>`.
- `GhostClient` has the ten existing resource properties, each instantiated
  from its corresponding `ToolInputs`. No string index signature or `any`.
- `SdkRequest = {url: string; method: string; data?: unknown;
  params?: QueryOptions; headers?: Record<string, string>}`.
- `RequestExecutor = (request: SdkRequest) => Promise<unknown>`.
- `createGhostClient(config: GhostConfig, options?:
  {makeRequest?: RequestExecutor}): GhostClient`.
- `readGhostConfig(env: NodeJS.ProcessEnv): GhostConfig`.
- `createServer(client: GhostClient): McpServer`.

The SDK constructor declaration accepts the configuration and optional
`makeRequest`, returning `unknown`. The adapter checks records/functions and
narrows responses centrally. Localized assertions needed to construct a mapped
interface must follow runtime checks; never assert that the entire SDK already
implements `GhostClient`. A missing method rejects with exactly
`Unsupported Ghost SDK capability: <resource>.<operation>`.

### Task 1: Typed SDK boundary and offline adapter tests

**Files:** Create `src/client/types.ts`, `src/client/sdkAdapter.ts`,
`test/helpers/fixtures.cjs`, `test/helpers/recordingClient.cjs`,
`test/helpers/networkGuard.cjs`, `test/adapter.test.cjs`,
`test/types/client-contract.ts`, `tsconfig.test-types.json`.
Modify existing ten tool modules (schema exports/type maps only),
`types/tryghost__admin-api.d.ts`, `src/ghostApi.ts`, `src/prompts.ts` (result
narrowing only), and `package.json`.

**Interfaces:** Produces `GhostClient`, `createGhostClient`, `GhostResult`, and
`RequestExecutor` defined above. `src/ghostApi.ts` temporarily retains its
singleton using `createGhostClient` until Task 2 removes startup imports.
`recordingClient.cjs` exports `makeRecordingClient()` returning
`{client, requests, enqueueResponse, enqueueError}` using the real SDK adapter.

- [ ] Write adapter tests with a synthetic key of 24 hex zeroes, colon, 64 hex
  zeroes; URL `http://127.0.0.1:1`, version `v5.0`. Install a network guard before
  importing product modules: deny `http.request/get`, `https.request/get`, and
  `fetch` in these offline test processes, restoring originals at teardown.
- [ ] Assert SDK-backed resources have the methods used by the 27 tools; absent
  tiers/offers/invites/roles operations reject with the exact capability error
  and leave the request count at zero. Do not populate synthetic production
  methods to satisfy these tests.
- [ ] Add table cases for GET browse/read, POST add, PUT edit, DELETE delete:
  exact `/ghost/api/admin/<resource>/` paths; ID/slug/email selection; query/body
  separation; resource-wrapped write bodies; `Accept-Version: v5.0`; and a
  nonempty `Authorization: Ghost ...` header whose value is not echoed in data.
- [ ] Assert edit retains `updated_at`, removes body ID, preserves other input
  fields, and works repeatedly using fresh copies of fixture arguments. Assert
  array `.meta` and one-element unwrapping match actual SDK behavior before MCP
  serialization.
- [ ] Add permission rejection with a synthetic 403 Ghost error and diagnostic
  request data containing the dummy key; assert safe message/error type and
  exactly one request for a failed mutation, with no retries.
- [ ] Run `npm ci --ignore-scripts`, then `npm run build` and
  `node --test test/adapter.test.cjs`. Record the expected RED result from missing
  client modules/exports before implementing them. Dependency installation is
  execution work, not part of preparing this plan.
- [ ] Implement type exports, runtime-checked adapter and focused constructor
  declaration. Delegate existing SDK methods with their receiver intact; pass
  original SDK semantics through rather than replacing routes or response
  envelopes. Verify each missing capability only at invocation, not startup.
- [ ] Migrate the temporary singleton to the typed factory and narrow the
  prompt's returned post record/title/excerpt/html before reading or slicing
  values, preserving existing wording and the 300-character preview. This
  keeps the whole project compiling before the injection migration in Task 2.
- [ ] Add compile checks: `client.posts.read({id: 'x'})` is valid;
  `client.posts.edit({id: 'x'})`, `client.webhooks.browse({})`, and
  `client.nonexistent.read({})` require `@ts-expect-error`. Exported input maps
  preserve the existing permissive read schema; do not tighten it here.
- [ ] Define `typecheck` as `tsc --noEmit && tsc -p tsconfig.test-types.json`, and
  `test` as `npm run build && node --test test/*.test.cjs`. Extend the test-types
  config without emitting files or including tests in the product build.
- [ ] Run `npm run typecheck` and `npm test`; all current adapter/type tests pass.
  Inspect lockfile changes; retain it unchanged unless an actual dependency or
  manifest change requires synchronization, without upgrading packages.
- [ ] Commit: `git commit -m "test: add typed SDK boundary and offline adapter contracts"`
  after adding only Task 1 files.

### Task 2: Pure server construction and client injection

**Files:** Create `src/createServer.ts`, `test/imports.test.cjs`.
Modify `src/config.ts`, `src/ghostApi.ts`, `src/server.ts`, all ten tool modules,
`src/prompts.ts`, and `src/resources.ts`.

**Interfaces:** Consumes Task 1's client. Produces `createServer(client)` and
`readGhostConfig(env)`. Every `register*Tools` function and `registerPrompts`
becomes `(server: McpServer, client: GhostClient): void`.

- [ ] Write a child-process import test with all three `GHOST_*` variables
  removed: require configuration, adapter, each tool module, prompt, resources,
  and factory. Construct a server with a recording client. Assert exit code 0,
  no stdout/stderr, zero requests, and completion without a connected transport.
- [ ] Test `readGhostConfig({})` throws a missing-variable error without exiting;
  missing URL/key fail explicitly; supplied values survive; omitted version
  remains `v5.0`. Include a dummy secret and assert validation errors omit it.
- [ ] Run `npm run build && node --test test/imports.test.cjs`; record RED from
  existing import-time exit or missing factory before migration.
- [ ] Implement explicit configuration loading and move registration into
  `createServer`. Preserve all existing resource URIs, tool schemas and names,
  prompt name, and MCP server identity. Return the server without connecting.
- [ ] Inject the client into handlers/prompts, remove singleton construction and
  unused imports from resources. Preserve Task 1's result narrowing, the current
  300-character HTML preview and wording. Do not repair placeholder resources
  or expand prompt behavior in this task.
- [ ] Keep executable shebang and stdio startup in `src/server.ts`; call factories
  explicitly. Report fatal errors without secrets to stderr, exit nonzero, and
  leave stdout exclusively for protocol traffic.
- [ ] Run `npm run typecheck`, `npm test`; all adapter/import tests pass and
  current tool input/response code remains unchanged apart from injection.
- [ ] Commit: `git commit -m "refactor: separate MCP construction from CLI startup"`.

### Task 3: Actual MCP discovery, dispatch, parsing and regression coverage

**Files:** Create `test/helpers/mcpHarness.cjs`,
`test/mcp-contract.test.cjs`; extend fixtures and recording helper if required.
Modify production files only to correct deviations from the approved injection
design, not to repair separately scoped capabilities.

**Interfaces:** `openMcpHarness(client)` returns
`{mcpClient, server, close}`. Connect a real MCP client/server with the installed
SDK's `InMemoryTransport.createLinkedPair()`. Register cleanup with test hooks
before assertions; close both sides even if setup partially fails.

- [ ] Write the harness/discovery tests, run
  `npm run build && node --test test/mcp-contract.test.cjs` and record RED before
  implementing the harness. Assert all 42 exact names from the inventory below;
  page through `listTools` while `nextCursor` exists. Compare sorted arrays,
  not only counts. Enumerate template/static resources and the one prompt too.
- [ ] Invoke all 42 tools through `mcpClient.callTool`, with per-tool required
  arguments. For 27 backed calls assert exact recording-request method/path/
  params/body and current text result. For 15 unsupported calls assert
  `isError: true`, exact capability message, and zero requests.
- [ ] Cover real Zod parsing: post edit without `updated_at` rejects; unknown
  `custom_template` is stripped; numeric `page/limit` forward; `limit: 'all'`
  rejects. Characterize absent/multiple read selectors and SDK ID precedence
  without tightening current schemas. Use fresh objects on every call.
- [ ] Cover post nonempty HTML -> `source=html`; Lexical-only -> no HTML source;
  tags/authors, SEO/image fields, and timestamps remain intact. Cover existing
  delete confirmation text and a representative single read response.
- [ ] Assert metadata-loss characterization named `known issue #5: browse text
  drops array metadata`, with a synthetic two-page response and an empty page.
  Assert every registered resource yields its existing placeholder under
  `known issue #11`; exercise prompt construction with a 400-character HTML
  string and the current 300-character preview. Do not count these as fixes.
- [ ] Send the Task 1 synthetic permission error through MCP and assert error
  signaling, one mutation request, and no dummy secret, token, headers, stack,
  or request dump in the returned MCP text.
- [ ] Implement the lifecycle/fixtures and complete the table-driven tests;
  rerun `npm run typecheck && npm test`. All 42 discovery/dispatch cases and
  regressions pass; no test is skipped as a substitute for intended coverage.
- [ ] Commit: `git commit -m "test: exercise MCP discovery parsing and all tool dispatch"`.

Inventory: posts/members/tags/tiers/offers/newsletters each have browse, read,
add, edit, delete; users has browse, read, edit, delete; invites has browse, add,
delete; roles has browse, read; webhooks has add, edit, delete. The SDK-backed
families are posts/members/users/tags/newsletters/webhooks. The rest remain
explicitly unsupported in this slice.

### Task 4: CLI smoke tests, clean-install CI, and contributor documentation

**Files:** Create `test/stdio.test.cjs`, `test/workflow.test.cjs`,
`.github/workflows/ci.yml`; update `README.md`. No consumer configuration changes.

**Interfaces:** Consumes the executable `build/server.js` and existing package
bin entry. Spawn it with Node's `child_process.spawn` and read stdout through
`readline`, using newline-delimited MCP JSON-RPC initialize, initialized
notification, tools/list, and cursor requests. Use the installed SDK's supported
protocol-version constant. A local HTTP fixture on `127.0.0.1` and an ephemeral
port rejects/counts all requests.

- [ ] Write startup tests: missing configuration exits nonzero with a safe
  stderr diagnostic; valid dummy configuration completes initialize/tools-list
  with the exact 42 names and zero HTTP requests to the rejecting fixture.
  Parse every stdout line as JSON protocol data, not logs.
- [ ] Add finite timeouts (10 seconds per child-process test), teardown for stdin,
  stdout readers, child, and loopback fixture, and a deliberate failed-handshake
  lifecycle test proving cleanup occurs on errors. Pass an explicit allowlist
  of child environment values plus dummy credentials, not real `GHOST_*` values.
- [ ] Add a workflow contract test checking push/pull_request triggers, Node 22,
  `permissions: contents: read`, `npm ci`, `npm run typecheck`, and `npm test`,
  and absence of secrets, write permissions, and `pull_request_target`.
- [ ] Run `npm run build && node --test test/stdio.test.cjs test/workflow.test.cjs`;
  record RED from absent workflow or missing lifecycle support before completing
  the workflow/test fixture. Fail closed on any attempted external request.
- [ ] Implement CI using versioned checkout/setup-node actions and npm cache;
  use the existing lockfile. Document Node 22/local verification commands,
  client injection/no-secret tests, and known unsupported resources/metadata/
  placeholders with issue links. Avoid claiming all Ghost versions are tested.
- [ ] Run from a clean dependency installation: `npm ci`, `npm run typecheck`,
  `npm test`, `git diff --check`. Verify the build, all tests, zero unexpected
  requests/process leaks, stable bin path, and unchanged dependency versions.
  Local workflow assertions do not substitute for observing a real hosted CI run.
- [ ] Commit: `git commit -m "ci: verify offline MCP contracts and stdio startup"`.

## Completion and handoff

- [ ] Review the complete diff against the spec and run all final commands again.
- [ ] Report test totals, dependency changes (if any), known remaining defects,
  and whether hosted CI actually ran. Do not claim live Ghost compatibility.
- [ ] Prepare a focused issue-#2 PR only after checking repository PR templates;
  leave review/merge and publication explicit. Do not close #3, #5, or #11.
- [ ] Do not modify any internal consumer dependency until later required fixes
  are implemented, verified, and separately approved for adoption.
