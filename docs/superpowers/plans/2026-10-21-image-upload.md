# Image Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

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
-Approved continuous native TDD, one whole-branch review, push/PR without pauses.

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
