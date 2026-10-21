# Issue #9: bounded remote-client image uploads

## Approved intent

Remote MCP clients can upload supplied image bytes without granting filesystem
or arbitrary URL access. User approved base64/filename/MIME/ref, 5MiB,
JPEG/PNG/GIF/WebP signatures, in-memory multipart, no redirects/retries/temp
files, literal `{data,meta?}` response, native TDD/one review/push+PR without
further pauses. Base merged#20:8e49849. Existing isolated worktree reused.
No real uploads, private-wrapper changes, merge, publication or deployment.
Existing configuration/executable/MIT/badges/dependencies unchanged. Nine inherited
advisories remain release/adoption blockers. No themes/files/media/SVG follow-on.

## Public contract (before implementation)

Add `images_upload` and typed `client.images.upload(input, options?)`;52 tools,
8 unchanged delete confirmations. Required fields:
- `base64`: canonical standard padded RFC4648 base64, nonempty, no whitespace,
  URL-safe alphabet, data-URI prefix or missing/excess padding. Encoded maximum
  **6,990,508 characters**. Check length before scanning/decoding. Round-trip
  encoding must equal original (reject nonzero padding bits).
- `filename`:1..120 ASCII chars, starts alphanumeric; remaining characters only
  alphanumeric, spaces, dot, underscore, hyphen. No paths, separators, leading
  dot, quotes, CRLF, control chars or URL/percent syntax. Matching extension
  required, case insensitive: image/jpeg -> .jpg/.jpeg, image/png -> .png,
  image/gif -> .gif, image/webp -> .webp. Never treat name as a local path.
- `mime_type`: exact enum image/jpeg,image/png,image/gif,image/webp.
- Optional `ref`: nonblank text <=1024 UTF16 code units with no controls; opaque
  multipart text field (not a URL/path to open). Omission stays omitted.

Decoded bytes:1..**5,242,880 (5MiB)** inclusive. MIME/extension/signature must
agree: JPEG FF D8 FF; PNG89 50 4E 47 0D 0A 1A 0A; GIF87a/GIF89a; WebP RIFF
then WEBP at offset8, minimum12 bytes. These are deliberately header checks,
NOT full decoding, malware scanning, decompression/dimension limits or proof
of an uncorrupted image. Ghost processing/storage policies remain authoritative.
No local image decoding/resizing, SVG/ICO/AVIF, URL fetch, local file, data URI,
arbitrary headers/options, usage-purpose variants or automatic post assignment.
Unknown/malformed inputs rejected before injected clients and native HTTP.
Direct options accept only undefined/empty strict object (not null/array/nonempty).
Errors use generic bounded messages, never echo payload/ref/filename/key.

## Architecture and request flow

Shared strict image shape + `prepareImageUpload(input:unknown)` returns validated
public input and decoded Buffer. Encoded cap checked before Buffer allocation;
common preparation called at MCP boundary (protecting injected clients) and
direct adapter boundary. Keep original input immutable, no payload retained in
module state. MCP parse already received JSON; this cap cannot prevent upstream
transport JSON parsing allocations or unbounded concurrent requests. Document
per-request bounds, not a process-wide DoS or concurrency guarantee.

Focused image native adapter uses existing fixed-route nativeAdmin JWT/URL/version
and safe-error policies. Only `images.upload` permits internal multipart input.
No generic request/header override. Route POST `/ghost/api/admin/images/upload/`,
configured prefix retained, authenticated even though endpoint controller lists
permissions:false (router still uses authAdminApi). SDK remains unchanged.

Build multipart entirely in memory with fixed field names `file` and optional
`ref`. Fresh crypto-random boundary, ASCII filename header and selected MIME;
binary bytes preserved exactly, ref UTF8 as text. Buffer.concat bounded by
**5MiB+8192 bytes** inclusive; reject oversized internal payloads before HTTP.
Boundary internal hex-only value, never user-supplied. Set exact Content-Type
multipart/form-data; boundary=... and Content-Length. Existing JSON operations
retain their bodies and Content-Type; no global multipart conversion.

Use existing Axios executor with upload-only maxBodyLength=5MiB+8192 and
maxContentLength=**65,536 response bytes** (decompressed), default timeout30s,
maxRedirects0, proxy:false and zero retries. Other native/SDK policies unchanged.
Injected RequestExecutor receives exact Buffer/multipart headers but owns its
transport policy like existing adapters. No disk/temp files or fs calls at any
stage: success/error/timeout/invalid inputs leave nothing to clean up. Per-request
memory is O(encoded+decoded+multipart+bounded response), transient copies allowed;
caller-owned JSON and application concurrency are not globally bounded here.

## Results and failure semantics

Ghost response `{images:[{url,ref?}],meta?}` -> one entity `{data:{url,ref?},meta?}`.
Use existing array-singleton normalization, then require nonblank URL string;
ref if present must be string or null (Ghost baseline returns null if omitted).
Preserve returned URL/ref literally, including different storage origin/relative
URLs, nullable ref, extras and unknown/nested/empty metadata. No value invented
from input, no URL follow-up/fetch, no synthesis of uploaded ref when absent.
Reject missing/malformed resource, wrong cardinality, malformed meta/URL/ref.
Sanitize HTTP/transport errors through existing native errors; never return
Axios diagnostics, echoed bytes or keys. One upload request per invocation.
On timeout/error, a file may already exist: inspect Ghost before manual retry.
No rollback/delete API, local cleanup request or automatic repeat. Upload writes
storage but does not publish/edit a post. Users may explicitly assign returned
data.url later using existing content tools; setting an existing URL is not upload.

## Source/version evidence

Public https://docs.ghost.org/admin-api/images/overview.md; baseline Ghost
v5.130.0 under ghost/core/core:
- server/web/api/endpoints/admin/routes.js: authenticated images/upload route,
  upload.single('file'), validation({type:'images'}).
- server/web/api/middleware/upload.js: filename extension and MIME allowlists,
  Ghost-side temp handling and SVG sanitizer (SVG intentionally excluded here).
- shared/config/overrides.json: .jpg/.jpeg/.png/.gif/.webp and matching MIME
  are baseline subset; our5MiB cap is an MCP policy, not Ghost's universal cap.
- server/api/endpoints/images.js: storage adapter save, possible optimization,
  invalid-image failure, _o filename normalization. Do not promise byte-for-byte
  server storage, original name or a fixed output host.
- server/api/endpoints/utils/serializers/output/images.js: singleton url/ref,
  ref from frame.data.ref or null.
Concrete source reference5.130.0, no live compatibility or every5.x minor claim.
Minimum Accept-Versionv5.0 header remains unchanged, not a feature guarantee.

## Verification/acceptance

TDD shared validation + MCP/direct/injected-client guards for four signatures,
canonical padding/truncation/bits/empty/oversized payloads, exact5MiB boundary,
extension/MIME mismatch, filename/ref header safety, unknown/options rejection
and immutability. Multipart literal bytes/field names/optional ref/header test.
Actual allowlisted loopback fixtures assert route/prefix/JWT/boundary/length,
binary bytes, safe403/413/500 errors, redirect refusal and timeout exactly once,
response-size cap, malformed replies and returned ref not inferred from input.
No live uploads. No fs operations tested by guard during valid/failed/rejected
calls; no temp files to clean. Independent discovery/type/import/response tests
updated to52 including every data tool. README examples/limits/warnings/source
baseline and signature limitations. Clean ci/typecheck/full suite/diff, one
whole-branch independent review, fix material findings test-first, authorized
push/PR closes#9 only if acceptance complete; never merge/deploy/adopt privately.
