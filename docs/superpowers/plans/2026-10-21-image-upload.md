# Image Upload Implementation Plan

> Historical implementation plan. Technical decisions and verification evidence are retained below.

**Goal:** Deliver#9 safe remote-client image upload without filesystem/URL access.
**Architecture:** Strict shared base64 image validation, focused native image
client, bounded in-memory multipart through fixed authenticated native route.
Existing SDK operations and JSON/public native routes remain unchanged.
**Tech Stack:** Existing TypeScript/Zod/Axios/MCP, Node22 Buffer/crypto; no new deps.
**Spec:** `docs/superpowers/specs/2026-10-21-image-upload-design.md`

## Global Constraints
-52 tools;8 unchanged delete confirmations, entity `{data,meta?}` response.
-Max decoded5,242,880 bytes; encoded6,990,508 chars; multipart5MiB+8192 bytes;
  response65,536 bytes.30s timeout,0 redirects/retries,proxy:false.
-Required base64/filename/mime_type, optional ref; JPEG/PNG/GIF/WebP only.
-No temp/filesystem/remote URLs/SVG/themes/files/media or automatic post edits.
-No live uploads/private changes/merge/deploy/publication. Existing config,
  executable/license/badges/dependencies unchanged;9 advisories remain blockers.
-Source reference5.130.0 only, not live/every5.x support;5MiB is our local policy.
- Test-first implementation, one independent whole-branch review and pull-request delivery.

## Review Focus
1. Oversized/noncanonical base64 rejected before allocation/HTTP, exact5MiB accepted (Task1).
2. MIME/extension/signature mismatch and filename/ref CRLF cannot escape file headers (Tasks1/2).
3. Multipart bytes, omitted/refnull response and extra metadata stay literal; no inferred success (Task2).
4. Existing JSON routes/auth and public site noJWT remain unaffected by multipart changes (Tasks2/3).
5. Timeout/redirect/oversized response cannot trigger retry, leak diagnostics, leave local files or fetch output URL (Task3).

### Task 1: Shared bounded image contract
**Files:** create `src/schemas/images.ts`, `test/image-upload.test.cjs`,
`test/helpers/imageFixtures.cjs`.
**Interfaces:** export imageUploadParams, ImageUploadInput; constants
MAX_IMAGE_BYTES, MAX_IMAGE_BASE64_LENGTH, MAX_IMAGE_MULTIPART_BYTES,
MAX_IMAGE_RESPONSE_BYTES. `prepareImageUpload(input:unknown)` returns
`{input:ImageUploadInput,bytes:Buffer}`. Strict schema checks basic types/name/ref;
preparation checks capped canonical base64 before decode/signature matching.
- [ ] RED validation tests for each of four signatures, base64 padding/bits,
  dataURI/URL-safe/whitespace/invalid characters/empty, exact/over5MiB, wrong
  filename/MIME/signature, unknown paths/URL/options fields, ref controls.
- [ ] Build/run focused tests, observe missing schema RED; implement interfaces
  with bounded generic errors and no filesystem/image decompression.
- [ ] GREEN focused/full suite/typecheck/diff; commit.

### Task 2: Native multipart adapter and MCP tool
**Files:** create `src/client/{imageMultipart,imagesClient}.ts`, `src/tools/images.ts`;
modify `src/client/{nativeAdmin,nativeRequest,sdkAdapter,types}.ts`, createServer,
tests/fixtures/inventory/type/import contracts.
**Interfaces:** `createImageMultipart(input:ImageUploadInput,bytes:Buffer)` returns
`{body:Buffer,boundary:string}`; fresh random hex boundary and fixed file/ref
parts. `createImageClient(config,makeRequest?)` returns GhostClient['images']
with upload method returning EntityResponse (ResourceClient upload maps entity).
NativeInput.multipart internal object only for images.upload, fixed resource
images/upload route; JSON Content-Type/body unchanged for other routes.
Extend native executor options optional maxBodyLength/maxContentLength; upload
route picks5MiB+8192/65,536 defaults without changing injected executors or others.
- [ ] RED MCP/direct client exact multipart body/headers/route/JWT/result tests,
  optional ref, null/absent returned ref, returned extras/meta, malformed URL/ref/
  array/meta rejection and no echo. Invalid payloads cannot reach injected client.
- [ ] RED no-filesystem guard on valid/error/invalid paths and options immutability;
  transport rejects oversized or malformed internal multipart input.
- [ ] Implement minimal interfaces/native/tool registration; common preparation
  runs before injection and directly. Existing safe native errors reused.
- [ ] Update independent inventory to52 and every data-tool fixture (image reply
  needs url); import/type tests and recording transport preserve Buffer snapshots.
- [ ] GREEN focused/full suite/typecheck/diff; commit.

### Task 3: Wire, bounds, docs and independent review
**Files:** create `test/image-upload-http.test.cjs`; modify stdio/README/this plan.
- [ ] Actual allowlisted loopback parses boundary/parts with exact binary bytes,
  Content-Length/JWT/prefix and ref semantics; no live uploads or external URLs.
- [ ]403/413/500/redirect/socket/timeout dispatch once, safe errors/no leaks;
  response>65,536 fails, returned storage URL never fetched. Inject short timeout
  through native executor options only in test, production remains30s.
- [ ] Stdio exact52 strict tools, visible upload side-effect/no-retry/limit text,
  no startup HTTP or data payload in discovery. Preserve existing JSON/site tests.
- [ ] README complete base64 example, limits/MIME/extensions/header-check caveat,
  per-request vs upstream JSON/concurrency limits, no local paths/temp/URL fetch,
  uploaded URL vs assigned URL distinction and manual-retry caution/source baseline.
- [ ] Clean npm ci/typecheck/full tests/diff check; spec acceptance audit and commit.
- [ ] One independent read-only whole-branch review; material fixes RED->GREEN,
  record findings/limitations. Final verification, template search, approved
  push/openPR Closes#9 if acceptance complete; verify actual link and CI. No merge.

## Self-review
All spec input fields/constants map toTask1; request/result/security toTask2;
wire/transport/cleanup-docs/version/acceptance toTask3. All five focus classes
have tests. NativeInput multipart restricted to one route; no arbitrary header
override, and JSON/public behavior retains regression coverage. No split into
unrelated uploads or filesystem convenience paths.

## Execution evidence

- Task1 three validation tests RED (missing schema), then GREEN358 full tests.
  Exact5MiB accepted; encoded/decoded over-limit paths verified before decode.
  Additional high-bit GIF masquerade regression RED->byte-equality fix->GREEN.
- Task2 new MCP/direct/adapter tests RED (missing tool/client and ignored internal
  multipart), then GREEN363 full tests. Exact multipart bytes/ref/headers,
  no-filesystem guards, literal metadata, malformed results and safe errors.
  Inventory52 and every-data-tool/type/import contracts updated.
- Task3 real loopback verifies four types, binary bytes, prefix/JWT/length/ref,
  redirect/socket/timeout/403/413/500 one-request-only failures, response cap
  including decompressed gzip and actual5MiB upload. Stdio exact52 strict tools.
  PNG example checksum independently corrected; no production image decoder added.
- Clean npm ci/typecheck/full suite **369/369**, diff whitespace check pass.
  Dependencies unchanged:9 inherited advisories (3 moderate,4 high,2 critical).
- No live uploads, filesystem convenience input, local temporary files, private
  changes, publication, deployment or merge. README includes per-request limits
  and header-only validation caveats, not a process-wide resource/security claim.
- Independent read-only whole-branch review8e49849..c142989: no Critical findings;
  one Important MCP validation-error echo finding and one allocation-order
  discrepancy. Regraded the latter as an Important contract mismatch with the
  explicit pre-allocation Review Focus, not an unbounded-memory vulnerability.
  Both resolved in one fix pass with regressions observed RED->GREEN:
  long enum/unknown-key values no longer appear in schema errors; canonical
  padding bits rejected before decoded allocation, including exact5MiB input.
- The existing strict registration helper now accepts an opt-in validation-error
  message and replaces only failed async parsing diagnostics for this tool;
  discovery retains the real schema and other tools retain existing behavior.
  Roundtrip equality remains a defensive check after byte decoding. Final suite
  **371/371**, typecheck/diff pass. No second independent review requested.
- Review limitations stand: no live permission/storage-adapter/other-version
  compatibility, full image validity/scanning, process-wide concurrency guarantees
  or enforcement by custom executors. These are explicitly outside claims; source
  reference is5.130.0, default transport policy is tested. Nine inherited advisories
  remain release/adoption blockers, not remediated by this change.
- Acceptance#9 audited: remote input/size/type contract specified before code;
  literal multipart URL/ref output; no arbitrary path/URL inputs; bounded memory
  and no local files/cleanup on success or failure; actual mocked-only multipart,
  invalid/oversized/error paths; clear upload-vs-assigned-URL distinction. Eligible
  for closing#9. Remaining: final verification, authorized push/PR and both CI
  checks; no merge, publication, deployment or private adoption.
