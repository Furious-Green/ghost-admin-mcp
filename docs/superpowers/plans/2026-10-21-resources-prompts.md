# Resources and Prompts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete#11 real resources and explicit bounded HTML prompt retrieval.
**Architecture:** Inject resource registration into existing server; shared safe
read boundary plus URI ID validation; strict prompt args and JSON source construction.
**Tech Stack:** Existing TypeScript/Zod/MCP and typed Ghost clients, Node22 tests.
**Spec:** `docs/superpowers/specs/2026-10-21-resources-prompts-design.md`

## Global Constraints
-Seven existing resource names/URIs,54 tools,8 deletes, summarize-post/postId preserved.
-Resources application/json `{data,meta?}`, no enumeration/placeholder/fallback reads.
-Prompt explicit formatshtml, HTML100000/title2000/excerpt5000 UTF16 caps, no
  split surrogate pairs, visible truncation/count metadata and untrusted sourceJSON.
-Strict args/IDs <=191, safe errors, no diagnostics/console logs; no new deps,
  live reads/mutations/emails/private changes/merge/deploy/publication.
-Existing client/transport/config/MIT/badges unchanged;9 advisories remain blockers.
-Approved native TDD/one whole-branch review/push+PR without additional pauses.

## Review Focus
1. Raw percent-encoded resource variables decode once, preserve case, reject nested escaping/traversal/URI structure before injected clients (Task1).
2. Client errors/malformed response or serializer exceptions never become placeholder success or diagnostics/log output (Task1).
3. Prompt unknown arguments rejected before client, explicit HTML missing/null fails rather than silent blank (Task2).
4. Content beyond300 and cap/surrogate boundaries have accurate visible truncation and no accidental instruction/source interpolation (Task2).
5. Blog public site noJWT and private resource reads use existing auth/permission boundaries; discovery does noHTTP (Task3).

### Task 1: Real injected resources
**Files:** replace src/resources.ts; create src/protocolReads.ts and
test/resources-prompts.test.cjs; modify createServer and known-placeholder tests.
**Interfaces:** registerResources(server:McpServer,client:GhostClient):void;
resourceId(uri:URL,variables:Record<string,string|string[]>,scheme,key):string;
readProtocolEntity(read:()=>Promise<EntityResponse>):Promise<EntityResponse>
validates normalized response, catches client errors into bounded MCP error.
- [ ] RED actual7 resource reads/metadata/MIME/one-request, encoded Unicode/case,
  invalid URI/direct variables/injected guards, malformed/error/no-console tests.
- [ ] Build/run focused test, observe placeholder behavior RED; implement exact
  callbacks/mappings incl posts formatshtml/site.read{}, bounded errors/JSON.
- [ ] Migrate known-placeholder regression to real retrieval assertions; GREEN
  focused/full suite/typecheck/diff; commit.

### Task 2: Explicit bounded HTML prompt
**Files:** modify prompts.ts and tools/registerStrictTool.ts; extend resource/
prompt tests and migrate existing preview assertions.
**Interfaces:** export reusable boundedValidationSchema(schema,message) from
strict helper (same opt-in behavior as uploads); prompt registers strict argsSchema.
HTML source builder uses UTF16-safe prefix and per-field counts; no new model API.
- [ ] RED injected readformats/receiver/strictargs/marker error tests, >300/exact
  cap/overcap/surrogate/title/excerpt/sourceJSON/null/empty/missingHTML cases.
- [ ] Implement explicit read, safe validation and source construction; preserve
  client error boundary and existing tool sanitizer behavior via regression suite.
- [ ] GREEN focused/full suite/typecheck/diff; commit.

### Task 3: HTTP/discovery/docs/review/PR
**Files:** native-http/stdio/resources-prompts tests, README and this plan outcomes.
- [ ] Actual loopback reads use only GET entity/site and prompt
  GETpost with formatshtml; encoded routes/privateJWT/public noJWT, error once.
- [ ] Stdio resource/prompt discovery same names with JSON descriptions; invalid
  resource IDs/promptargs no network or diagnostic stderr. No automatic listings.
- [ ] README remove stale placeholders and300-preview claims, MIME/envelope
  compatibility notes, encoded IDs/permissions/publicsite vs settings, prompt
  caps/truncation/source warning, no LLM/security/HTTP-memory guarantees.
- [ ] Clean ci/typecheck/full tests/diff; audit#11 criteria and commit.
- [ ] One independent read-only branch review; material findings test-first,
  record evidence/limits. Final verification, template search, approved push/PR
  Closes#11 if complete; verify actual closing link/CI; no merge or live changes.

## Self-review
Spec resource/URI/error contracts mapTask1, prompt/strictsourceTask2,
HTTP/permissions/discovery/docsTask3. All focus rows have tests. No parallel
implementation or unrelated tool/transport changes; helper extraction stays opt-in.

## Execution evidence

- Task1 four resource tests RED placeholder/no dispatch/missing helper -> GREEN392
  full tests. Seven real reads, JSON metadata, encoded case/Unicode, strict URI/
  injected-variable validation, malformed/serializer/error paths without logging.
- Task2 four prompt tests RED preview/loose args/no JSON -> GREEN396 full tests.
  Explicit HTML retrieval, beyond300/cap/surrogate boundaries and counts, missing
  HTML errors, empty HTML valid, untrusted quoted source and strict bounded args.
  Existing tool schema-error sanitization tests remain green after extraction.
- Task3 loopback verifies seven routes, prompt formatshtml, private JWT/public
  site noJWT, safe one-request SDK403/native404 errors. Same-resource concurrent
  MCP reads preserve invocation metadata. Stdio names/MIME/args/invalid-input
  no-network checks and import contracts updated; README no stale placeholder claim.
- Clean npm ci/typecheck/full suite **398/398**, diff whitespace check pass.
  No new dependencies;9 inherited advisories (3 moderate,4 high,2 critical).
- No live Ghost reads or mutations, model/Langfuse calls, telemetry, private
  changes, merge/deploy/publication. Existing transport policies unchanged.
- Independent read-only whole-branch review02e536b..61fe956 found no Critical,
  Important or Minor issues. Reviewer independently passed398 tests/typecheck/
  whitespace check and confirmed SDK raw-variable/strict-schema behavior, fixed
  resource mappings, error handling and prompt caps/format/source separation.
- No fix pass, deferred findings or additional review. Limitations stand: no live
  version/credential compatibility or model-output evaluation; source caps are
  not network/JSON/global-memory/token/injection-proof guarantees, and resource
  output caps were not promised. Nine inherited advisories remain blockers.
- Acceptance#11 audited: all7 resource registrations now read real clients with
  correct variables/JSON envelopes; permission boundaries and publicsite distinction
  retained; prompt explicitly requests supported HTML with documented truncation;
  no placeholder successes; actual MCP registration/variables/calls/errors/prompt
  construction, HTTP and stdio covered offline. Eligible for Closes#11.
- Remaining integration steps: final verification, authorized push/PR with actual
  closing link and CI checks. No live mutations/private adoption/merge/deploy.
