# Issue #10: bounded theme upload and explicit activation

## Intent and scope

Add separate themes_upload and themes_activate for remote MCP clients. The
upload contract uses a 10 MiB base64 ZIP, safe archive checks, no local extraction/paths/URL
fetching, an explicit activation name and truthful errors/metadata. Verification
uses test-first implementation and one independent review before pull-request
delivery. Base merged#21:41cd589.
No live theme/site changes, private adoption, publication/deployment or merge.
Existing isolated worktree reused. Preserve config/executable, strict inputs,
MIT/badges/dependencies and `{data,meta?}`; inventory52->54,8 delete confirmations.
Nine inherited advisories remain release/adoption blockers.

## Upload contract

`themes_upload` and client.themes.upload: required canonical `base64` and
`filename` only. Same base64 alphabet/padding-bit/roundtrip checks as images,
extracted into a shared bounded helper; length and decoded size checked before
allocation. ZIP limit **10,485,760 bytes (10MiB)**; encoded **13,981,016 chars**.
Filename uses existing1..120 safe ASCII basename rule, ends .zip case-insensitive.
No MIME/ref/purpose/activate/URL/path/headers overrides. MIME is fixed application/zip.
Unknown inputs/options rejected; direct separate options only omitted/strict{}.
Generic bounded MCP/direct validation errors, no filename/base64/serverpath echo.

Archive inspection is metadata-only, bounded by supplied bytes, **2000 entries**,
**100MiB total declared uncompressed bytes**, and entry names <=1024 bytes.
Allow a conservative classic single-disk ZIP subset, stored or deflate methods,
ASCII/UTF8 names, optional consistent data descriptors. Require exact EOCD/comment
termination and central-directory counts/size/offsets, consistent local headers,
names/flags/methods/sizes/CRC declarations, bounded nonoverlapping contiguous
local records, no SFX/prefix or unexplained gaps/trailing records. Reject ZIP64,
encryption/multidisk/unsupported methods, malformed extras and alternate Unicode
path/AES extras, symlinks or other special Unix file types. Require at least one
file (not just directories). No mandatory package.json/theme-layout heuristics:
Ghost/gscan validates actual theme contents and supports its own root layout.

Entry paths reject absolute paths, drive/colon/backslash/control syntax, empty
segments, . or .. components, trailing component spaces/dots and Windows device
names (including superscript device-number variants). Reject duplicate names
using a conservative NFKC/uppercase alias key, with sharp-S expansion (including file/dir aliases)
and file-as-parent conflicts. Safe UTF8 uses fatal decoding, non-UTF8-flag names
must be ASCII. No local file reads/writes, decompression, extraction, CRC-content
verification, template execution or gscan invocation. Declared sizes can lie:
these checks are NOT proof of safe actual expansion, compression ratio, valid
deflate/CRC/content, theme compatibility or absence of malware. Ghost must still
validate/extract/process the untrusted ZIP with its own safeguards. Rejecting
unsupported ZIP variants is an explicit policy, not full ZIP-format support.

## Requests and side effects

Use shared bounded multipart/base64 facilities from image upload, retaining image
5MiB policy/format/errors. Only fixed authenticated themes.upload permits ZIP
multipart: POST configured-prefix `/ghost/api/admin/themes/upload/`, single
`file` part, fixed application/zip, random48hex boundary, exact Content-Length.
No temp files or cleanup DELETE on success/error, no default theme name inferred.
Multipart max10MiB+8192. Default native executor limits theme responses to1MiB
decompressed, requests10MiB+8192, timeout30s, redirects0, proxy:false, retries0.
Both theme operations use response cap; other native/SDK policies unchanged.
Injected executors own transport policy. Memory per request is O(encoded + ZIP +
multipart + capped response); not an upstream JSON-parsing/global concurrency cap.

`themes_activate`/client.themes.activate takes required explicit `name` only,
safe nonblank selector <=191 chars. PUT `/themes/{name encoded once}/activate/`,
no request body or inferred theme. Reject traversal/query/escape/control delimiters.
No automatic browse/read, auth escalation, upload-then-activate chaining, activation
retry, rollback or active-theme setting emulation. Use returned theme.name for a
separate deliberate activation, not a filename-derived guess.

Upload never CALLS the activation endpoint or chooses a different active theme.
It can overwrite a same-named installed theme. **If currently active, Ghost can
reload/activate the overwritten files immediately.** Thus upload itself can alter
the public site; not harmless staging or a promise active:false. Warn in tool
descriptions/README for both operations. Activation changes active theme/site
appearance and may fail validation/plan/permission checks. No changes in tests.

## Output and errors

Normalize `{themes:[one],meta?}` to `{data:one,meta?}`. Require returned nonblank
string name and boolean active; preserve package/templates/warnings/errors and
unknown fields/metadata literally. Never synthesize active:true/false or replace
requested name with returned state. Malformed/cardinality/meta errors fail, not
fake success. Theme validation failures stay MCP errors, with bounded HTTP/status
and safe ThemeValidationError category rather than raw gscan errorDetails/paths or
server-echoed payload. Preserve warnings/errors in successful theme metadata.
Missing/unauthorized/invalid themes never trigger another request. On timeout or
malformed/oversized response, operation may already have taken effect; inspect
Ghost before manually retrying. No cleanup/recovery mutation performed.

## Source and credentials (Ghost v5.130.0)

Public https://docs.ghost.org/admin-api/themes/overview.md; actual routes
themes/upload and themes/:name/activate (the docs' image response comment is not
the route contract). Source under ghost/core/core/server:
- api/endpoints/themes.js: upload uses add permission; activate permission and
  active_theme update, host customThemes limits; no implicit external activation.
- web/api/endpoints/admin/routes.js and middleware/upload.js: authenticated
  multipart.single('file'), type themes, separate bodyless activation route.
- services/themes/storage.js: filename-derived sanitized name; gscan checkSafe,
  same-name replacement and activateFromAPIOverride when active; default theme
  replacement can be rejected. Do not locally predict overwrite/name/permissions.
- services/themes/validate.js: ThemeValidationError with unsafe path/details.
- services/themes/to-json.js and output/themes.js: actual metadata/warnings/errors.
- data/schema/fixtures/fixtures.json: Admin Integration grants theme all;
  Administrator/Owner can manage themes; editor roles only browse/readActive.
  Ghost/hosting/version still enforce authorization. Use existing Admin API key
  or sufficiently privileged staff token in existing setting; never demand
  unrestricted credentials, infer key class, auto-switch auth or escalate.
Minimum header v5.0 not proof of every5.x/other majors/live compatibility.10MiB,
archive subset and declared-size caps are local MCP policy, not universal Ghost limits.

## Verification

TDD independent ZIP builder fixtures (stored/deflated/UTF8/descriptors/comments),
mutation/truncation/path/duplicate/offset/count/expanded-limit/encrypted/ZIP64/
special-file tests. Shared-helper regressions retain all image behavior; exact
10MiB and over-cap/predecode rejection. MCP/direct/injected guards, error marker
non-echo, multipart bytes/route/JWT/prefix, explicit bodyless activation and no
cross-operation calls. Loopback safe403/404/422/500/redirect/timeout/responsecap,
literal active true/false and validation metadata; fs guards on success/failure.
No live upload/activation. Strict discovery54/type/import/every-tool response
contracts. Clean ci/typecheck/full suite/diff; one independent branch review,
material fixes test-first; PR closes#10 only if acceptance complete, no merge.
