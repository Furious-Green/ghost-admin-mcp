# Testable Ghost client and contract-test foundation

Date: 2026-10-20
Issue: https://github.com/Furious-Green/ghost-admin-mcp/issues/2
Status: Written specification approved by the user on 2026-10-20.

## Intent and scope

Establish a reliable development foundation for repairing this public fork. Tool
handlers must be testable without Ghost credentials, environment initialization,
or network access. Tests must exercise real MCP input parsing and verify the
client/request behavior rather than merely calling duplicated test handlers.

Preserve the `ghost-mcp` executable, stdio transport, 42 existing tool names,
current input schemas, and existing successful response shapes in this slice.
Downstream deployments and dependency references remain unchanged. Pages,
missing resource adapters, pagination output changes, and other API expansion
belong to their separate issues.

## Current structure

`src/config.ts` reads the environment and exits at import time when required
values are absent. `src/ghostApi.ts` constructs a singleton immediately.
Every tool module imports it. `src/server.ts` registers everything and starts
stdio on import. The SDK declaration is untyped, so nonexistent SDK resources
compile. `npm test` is a placeholder that always fails.

The existing lockfile and TypeScript/CommonJS build remain the starting point;
this is not a transport rewrite or dependency-upgrade project.

## Selected approach

Use constructor/function injection and a small typed SDK adapter. This avoids
global module mocking and keeps the existing handler organization. A wholesale
HTTP-client replacement is deferred to the resource-repair work; monkeypatching
the SDK into pretending unsupported resources exist is explicitly excluded.

### 1. Pure server construction and explicit startup

- Introduce a server factory that accepts a client and registers the existing
  tools, resource templates, and prompt, returning an unconnected `McpServer`.
- Keep `src/server.ts` as the executable composition root: load/validate
  configuration, construct the production client, create the server, connect
  stdio, and report startup errors to stderr.
- Read configuration through an explicit function. Missing configuration must
  fail CLI startup, not terminate a process merely importing a tool or factory.
- Pass the client explicitly to tool registration functions and the prompt
  registration function. Placeholder resources remain behaviorally unchanged
  for issue #11, but importing them must not initialize production credentials.
- Never emit logs on stdout outside the MCP protocol.

### 2. Typed client boundary

- Define the resource/method contracts actually used by this fork, with typed
  selectors, query arguments, write inputs, and asynchronous return values.
  Use schema-derived input types where practical; do not create a comprehensive
  duplicate Ghost data model.
- Preserve arbitrary returned entity fields as `unknown` values until narrowed.
  Model the SDK's array metadata explicitly so tests can detect serialization
  loss. Do not replace the boundary with `any` or unsafe blanket type assertions.
- Isolate SDK interoperability in one adapter. Give the SDK constructor and
  verified resource methods a focused declaration or a runtime-validated
  `unknown` boundary; do not cast the whole SDK to a fictional complete API.
- Represent missing tiers/offers/invites/roles capability honestly. The adapter
  must reject calls to unavailable methods with a clear unsupported-capability
  error rather than dereferencing `undefined` or inventing HTTP support.
  Keep existing tool registrations for now; issue #3 will decide and implement
  their real routes, permissions, and compatibility behavior.
- This explicit error replaces the accidental TypeError only; it is not a claim
  that missing-resource tools have been repaired. Keep issue #3 open.
- Allow recording/mock request injection when constructing the SDK adapter.
  Production uses normal SDK authentication/transport. Tests use synthetic keys
  and recorded requests, never real credentials.

### 3. Error boundaries

Continue surfacing failed operations as MCP errors, not success-looking results.
Use the SDK's existing error behavior unless a test identifies secret-bearing
diagnostics. Do not add a raw error/request dump or return authentication headers,
keys, or environment values. Test a permission-denied response through the
adapter and MCP call path. Do not add automatic retries for mutations.

## Test design

Use Node's built-in test runner with compiled CommonJS JavaScript tests against
the TypeScript build. This requires no new test framework or runtime loader.
Tests may use the installed MCP SDK's in-memory transports and client. Keep
test fixtures outside the distributed `build/` output.

### Adapter tests

Construct the real SDK through its recording-request seam. Verify the available
27 tool operations map to the expected methods, resource paths, selectors,
query parameters, and resource-wrapped bodies. Requests return deterministic
fixtures. Verify `Accept-Version`, Ghost authorization generation with dummy
keys, and that secrets are not returned to callers. Explicitly test the 15
missing-resource operations as unsupported capabilities with zero HTTP requests.

### MCP contract tests

- Discover the expected 42 names through a real connected MCP client/server.
- Invoke every registered tool with a suitable fixture and assert dispatch.
- Exercise post HTML conversion options, Lexical input preservation, required
  and forwarded `updated_at`, and tag/author arrays.
- Exercise actual Zod parsing: missing required values are rejected and unknown
  fields behave as they do today. Characterize independently optional selectors
  without silently tightening schemas; issue #6 owns that change.
- Verify current single-result/delete text shapes and MCP error signaling.
- Characterize pagination metadata loss and placeholder resources as known
  defects linked to issues #5 and #11. These are passing characterization tests,
  not disabled failing tests or assertions that those defects are desirable.
  Their expectations will change in the corresponding repair commits.
- Test server-factory import/construction with Ghost environment variables unset.
  Test executable startup separately with dummy configuration, including a stdio
  tools/list exchange and controlled shutdown without any Ghost HTTP calls.
- Close transports and child processes after every test, including failures.

Network calls must be blocked/fail closed in adapter and in-memory suites. The
stdio smoke test performs discovery only; it must use a loopback-only rejecting
HTTP fixture as its Ghost URL and assert zero requests. It never invokes content
mutations or attempts an external hostname.

## Build and CI

- Keep `npm run build` and `npm start`; add an explicit no-emit typecheck command.
- Make `npm test` build and run the offline suite with a nonzero exit on failure.
- CI runs on pull requests and pushes using Node 22, `npm ci`, typecheck, and
  tests. Node 22 is the verified CI baseline, not a new claim about all Node or
  Ghost versions. It uses no repository secrets and has read-only contents
  permissions; do not use privileged pull-request workflows.
- Retain/review `package-lock.json`; change it only if scripts/package metadata
  or necessary dependencies actually require it. No unrelated package upgrades.
- Document local commands and known defects without claiming full API coverage.

## Acceptance and completion boundary

Issue #2 is complete only when a clean dependency install, typecheck, build,
offline contract suite, and stdio discovery smoke test all pass. The tests must
prove actual registration/request behavior and the absence of startup import
side effects, not merely check source strings.

The implementation must explicitly report that unsupported resources, metadata
loss, and placeholders remain tracked separately. It must not close issues #3,
#5, or #11 based on characterization tests. No deployment, npm publication,
consumer dependency update, or live Ghost mutation is part of this work.

## Review and next stage

After written-spec approval, produce a separate implementation plan with
red/green test steps and verification commands. Select its execution method
before changing product code. Subsequent issues receive focused designs where
they change behavior or introduce additional API capabilities.
