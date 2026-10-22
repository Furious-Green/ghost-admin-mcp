# Tool reference and migration guide

Start with the [quick start](../README.md#quick-start) to connect your MCP client.
Use this reference when you need exact inputs, response formats or upgrade details.

- [Tool inventory and examples](#available-tools)
- [Post, page and tag inputs](#strict-content-input-migration)
- [Member, staff, newsletter and other inputs](#strict-remaining-resource-input-migration)
- [Newsletter delivery](#explicit-newsletter-delivery-and-administration)
- [Member labels and site information](#member-labels-and-public-site-information)
- [Image uploads](#bounded-image-upload-for-remote-clients)
- [Theme uploads and activation](#theme-zip-upload-and-explicit-activation)
- [Resource reads](#available-resources) and [summarization](#summarization-prompt)
- [Migration from the original server](#migrating-from-the-original-implementation)
- [Response format](#response-format-migration) and [error handling](#error-handling)

## Migrating from the original implementation

The original package advertised tiers/offers/invites/roles operations absent from its Ghost SDK, so they failed before HTTP. This fork implements the twelve supported operations using native requests: tiers/offers browse/read/add/edit, invites browse/add/delete, and roles browse.

| Removed tool | Explicit replacement |
| --- | --- |
| `tiers_delete` | `tiers_edit` with `{"id":"TIER_ID","active":false}` |
| `offers_delete` | `offers_edit` with `{"id":"OFFER_ID","status":"archived"}` |
| `roles_read` | `roles_browse`, then select the returned role by ID/name yourself |

Archival is **not deletion**. Refresh MCP tool discovery after upgrading; removed names produce unknown-tool errors, with no aliases or silent archival. Tier archival is documented; active-only partial edits are verified against Ghost 5.130.0 source. Offer status (`active`/`archived`) is [source-verified in Ghost 5.130.0](https://github.com/TryGhost/Ghost/blob/v5.130.0/ghost/core/core/server/services/offers/application/OffersAPI.js), but omitted from the public offer-update documentation. These contracts are not live-version guarantees.

Tier-slug and offer-code read selectors are rejected, including when also supplying an ID. Browse/filter first, then pass the returned ID. `offers_browse` supports only `filter`, not legacy `page`/`limit`/`order`. Tier browse accepts `filter`, `limit` (positive safe integer or `"all"`), `page`, `order`, and `fields`; read supports ID only. **Correction:** tier `include` is now rejected: it was advertised using Content API relationships, but these baseline Admin endpoints do not accept it. The reference tier service returns its whole filtered in-memory repository with synthetic one-page metadata, ignoring endpoint-accepted paging/order/field controls. Forwarding those controls does not promise effective server pagination/projection; no client-side emulation is added.

`offers_add` retains the `tier_id` tool input, translated to native `tier:{id}`; `tier_id` is never sent to Ghost. Cadence is `month`/`year`, duration `once`/`repeating`/`forever`/`trial`, type `percent`/`fixed`/`trial`. Amounts are nonnegative safe integers, with percent at most 100. Fixed offers require currency, repeating offers require positive safe-integer `duration_in_months`; Ghost remains authoritative for discount/currency combinations. Tier visibility is `public`/`none`, prices nonnegative safe-integer minor-unit amounts. Tier description/welcome URL accept null; null pricing/currency/benefits are deliberately not exposed. Offer edits allow only name/code/display fields and status, not discount/tier/cadence/duration changes. Unsupported fields are rejected rather than discarded.

`roles_browse` supports only optional `permissions: "assign"` (assignable roles), not legacy `filter`/`page`/`limit`/`order`. Offers and roles are unpaginated collections; no client-side pagination or role-read emulation is provided. `invites_browse` supports `filter`, `limit` (positive integer or `"all"`), `page`, `order`, and `fields`.

**Credential permissions:** Ghost 5.130.0's integration route gate permits role
browsing and invite creation, subject to fixed integration and role permissions;
these are not categorically staff-token-only. Invite browse/delete and user
edit/delete require a suitable staff context. See [source evidence and the full
matrix](coverage.md). Credentials use the existing `GHOST_ADMIN_API_KEY`
setting (`id:secret`); the client never infers credential class, auto-escalates
or retries with another auth method. `invites_add` **sends a real staff invitation
email**. Browse roles first to choose an assignable role. Delete removes an
invitation, not an existing staff account. None of this is live permission proof.

Executable and environment variable names, badges and MIT licensing are unchanged. **All data-returning tools now use the [response envelope below](#response-format-migration)**, including reads and copies; see both [content](#strict-content-input-migration) and [remaining-resource](#strict-remaining-resource-input-migration) input migrations. Native requests refuse redirects, time out after 30 seconds and never retry; check Ghost before manually repeating a timed-out mutation. SDK transport policy is unchanged; these native safeguards are not a claim that the SDK transport has the same policy.

## Response format migration

**Breaking output change:** browse/read/add/edit/copy return JSON text containing `{data, meta?}`. The outer MCP response is still `content: [{type: "text", text: "...JSON..."}]`, not a new protocol envelope. Tool names and executable/settings are unchanged. Version `0.2.0` separately changes [tool validation error signaling](tool-errors.md); the strict-input migration below changes content validation. Delete tools keep their existing plain-text confirmations (for example, `Post with id abc123 deleted.`).

Previously, browse text was usually a bare array and lost pagination metadata; SDK singletons could even become bare entities when metadata was absent:

```json
[{"id":"one"}]
```

Now browse `data` is always an array, even for zero or one records:

```json
{"data":[{"id":"one"}],"meta":{"pagination":{"page":1,"pages":2,"limit":1,"total":2,"prev":null,"next":2}}}
```

Previously, an entity result could be `{"id":"one"}`. Read/add/edit/copy now consistently return one entity inside `data`, even when metadata accompanies it:

```json
{"data":{"id":"one"}}
```

Update consumers to unwrap once:

```js
const result = JSON.parse(toolResponse.content[0].text); // after checking for MCP errors
const records = result.data; // browse: array; read/add/edit/copy: one entity
const pagination = result.meta?.pagination;
// For an entity response: result.data.id, not result.id.
```

Metadata is retained as supplied by Ghost, including unknown keys and nested values. An absent `meta` is omitted, an empty object remains `{}`, and entity fields named `data` or `meta` remain inside the entity. Malformed resource/metadata responses are errors, not successful empty results. There is no compatibility flag, alternate tool name or bare-result fallback.

**Paging remains explicit:** for resources supporting numeric paging, inspect `result.meta?.pagination.next` and supply that number in a separate `page` request, retaining your filter/order/limit. `next: null` is preserved. Each browse call requests one server response; there is no automatic paging. Missing pagination does **not** prove exhaustion or imply another page exists. Offers/roles are unpaginated collections; see the tier pagination caveat above. `limit: "all"` is accepted by posts/pages/tags/members/users/newsletters/tiers/invites browse, not offers/roles; it can produce a large response and does not change Content API limits.

**Newsletter metadata describes returned state, not requested state.** For example:

```json
{"data":{"id":"newsletter1","sender_email":null},"meta":{"sent_email_verification":["sender_email"]}}
```

This reports pending verification, **not** an already-active new sender address. The returned `sender_email` stays unchanged until verification. Opt-in counts are preserved when Ghost returns them, without interpreting or fabricating them; see explicit delivery and administration below. Update integrations to parse this response format before upgrading.

## Strict content input migration

**Breaking validation change for the 17 posts/pages/tags tools:** unknown keys now fail instead of disappearing, including unknown nested relationship fields and copy overrides. Read accepts **exactly one** nonblank `id` or `slug`; supplying both no longer silently picks the ID. IDs/slugs cannot contain traversal, path/query/fragment delimiters, percent escapes or control characters; spaces and Unicode are encoded as one path segment. Refresh MCP discovery and remove undeclared inputs before upgrading. Output envelopes and remaining delete confirmations are unchanged; see newsletter-delete removal above. The second slice below extends strictness to the remaining tools.

| Tools | Query controls |
| --- | --- |
| Posts/pages browse | `filter`, `order`, `page`, `limit`, `include`, `fields`, `formats` |
| Posts/pages read | `include`, `fields`, `formats` |
| Posts/pages add | `include`, `formats` |
| Posts/pages edit | `include`, `formats`, `save_revision` (boolean) |
| Posts edit only | Additionally `newsletter`, `email_segment` (explicit delivery rules below) |
| Posts/pages copy | `formats` only, plus required ID |
| Tags browse | `filter`, `order`, `page`, `limit`, `include`, `fields` |
| Tags read | `include`, `fields`, `filter` |
| Tags add/edit | `include` |
| Posts/pages/tags delete | Required ID only |

`page` and numeric `limit` must be positive safe integers, not numeric strings or fractions. These three Admin browse tools also accept `limit: "all"` (potentially a large response); this does not extend other resource schemas or change the Content API's limits. `filter` and `order` are nonblank strings interpreted by Ghost. `fields` is a nonempty comma-separated list, not an unrestricted request object; Ghost remains authoritative for field availability and field/include interactions. Empty list components are rejected.

`formats` accepts comma-separated `html`, `lexical`, `plaintext`, `mobiledoc`, in any order (legacy Mobiledoc is baseline-source-verified, not a future-version guarantee). Tags have no formats. Include lists are resource-specific and unknown values fail rather than being silently removed:

- **Pages:** `tags`, `authors`, `authors.roles`, `tiers`, `count.signups`, `count.paid_conversions`, `post_revisions`, `post_revisions.author`.
- **Posts:** all page includes plus `email`, `newsletter`, `count.conversions`, `count.clicks`, `sentiment`, `count.positive_feedback`, `count.negative_feedback`.
- **Tags:** `count.posts` only.

Query controls never enter write bodies. Typed-client callers may provide them in the existing flat input or separate options argument; duplicate keys across the two are rejected, not overwritten. Nonempty HTML still infers `source=html` and takes precedence over supplied Lexical/Mobiledoc; source conversion is not a new MCP argument. Otherwise do not supply both nonempty Lexical and Mobiledoc. Both source strings must contain valid JSON; Ghost handles document semantics.

Posts/pages retain image/SEO/social/injection fields and relationships, and accept `custom_template`, `locale`, `mobiledoc`, and `tiers`. Pages additionally accept `show_title_and_feature_image`; posts retain `email_only`. Post statuses: `draft`, `published`, `scheduled`, `sent`; page statuses: `draft`, `published`, `scheduled`. Both accept visibility `public`, `members`, `paid`, `tiers`. Custom NQL visibility is deliberately unsupported. Tag writes now include visibility (`public`/`internal`), feature image, SEO/social fields, code injection, canonical URL and accent color, in addition to name/slug/description. Ghost still enforces permissions and valid state transitions.

**Clearing:** content accepts explicit `null` for HTML/Lexical/Mobiledoc, locale, `published_at`, custom excerpt/template, image/alt/caption, SEO/social strings, code injections and canonical URL. Tags accept `null` for optional string fields, including slug/description/images/SEO/social/injections/canonical URL/accent color. Null is forwarded unchanged as a clearing request, not proof that Ghost will leave the field null after processing. Title/name, status/visibility, booleans and relation arrays do not accept null. Clear relations with `[]` where Ghost permits it; authors may have server-side requirements. Arrays replace, not merge, relations. Strings or strict reference objects are supported: tags/tiers use `id`/`slug`/`name`; authors use `id`/`slug`/`email`. Objects need at least one nonblank identifier; multiple identifiers are retained.

Edit timestamps must be valid date-times with a timezone (`Z` or offset). Read first and pass the exact `data.updated_at`; no timestamp rewriting or conflict retry occurs. For example:

```json
{"name":"posts_edit","arguments":{"id":"ID_FROM_READ","updated_at":"2026-10-21T00:00:00.000Z","custom_template":null,"meta_description":null,"save_revision":true,"include":"post_revisions","formats":"html,lexical"}}
```

API schema lengths/nullability and query options were checked against **Ghost 5.130.0**, including its pinned `@tryghost/admin-api-schema@4.5.10`, not just its database columns. `Accept-Version: v5.0` remains a minimum-version header, not a guarantee for every 5.x minor. Excluded here: generated/audit/database-only fields, experimental collections, custom `visibility_filter`, debug/internal transaction/conversion controls and post `show_title_and_feature_image`. Email subject/delivery controls are documented below. No arbitrary HTTP proxy or unknown-field escape hatch is added. Live version/permission compatibility remains unverified.

## Strict remaining-resource input migration

The second #6 slice makes members/users/newsletters/webhooks strict at both MCP and typed-client boundaries. Nested member label/newsletter objects are strict too. Native tiers/offers/invites/roles remain strict, now with safe-integer paging, tighter enums/ranges and malformed-options rejection. Unknown inputs have no passthrough. Refresh discovery; output envelopes and remaining delete text are unchanged. The current inventory is **54 names**, including label/site, bounded image/theme uploads and explicit theme activation below, and excluding unsupported newsletter deletion.

| Resource | Browse queries | Read queries/selectors | Write queries |
| --- | --- | --- | --- |
| Members | filter, order, page, limit, fields, search, include | include; exactly one id/email | none |
| Users | filter, order, page, limit, fields, include | include, fields, filter; exactly one id/slug/email | edit include |
| Newsletters | filter, order, page, limit, fields, include | include, fields; exactly one id/slug | add/edit include; add-only opt_in_existing (boolean) |
| Webhooks | no browse tool | no read tool | none |
| Tiers | filter, order, page, limit, fields (server caveat above) | id only; no include | none |
| Offers | filter only | id only | none |
| Invites | filter, order, page, limit, fields | no read tool | none |
| Roles | permissions=assign only | no read tool | none |

Delete inputs are ID-only. `fields` is deliberately absent on member reads; no formats or save_revision on these resources. Includes are comma-separated supported values:

- Members: `email_recipients`, `products`, `tiers`.
- Users: `count.posts`, `permissions`, `roles`, `roles.permissions`.
- Newsletters: `count.posts`, `count.members`, `count.active_members`.

Nonblank query strings/CSV lists, positive safe-integer paging and the `"all"` support listed above are validated without coercion. ID/slug path rules match content. Email read selectors are valid <=191-character addresses and encoded once (including `+`, `%`, `@`); write emails stay literal body text. Caller values are not trimmed, lowercased or rewritten. Member/user read selectors cannot be combined. No new role/UUID read selectors are added.

Typed SDK-backed resource methods accept supported query controls flat or in their separate options argument, rejecting duplicates. Native tiers/offers/invites/roles keep **flat query inputs only**; nonempty separate options are rejected. Null, arrays and primitives are not valid options objects. Query controls never become write fields; caller objects are not mutated.

Existing member name/note fields remain non-null strings. Labels require a nonblank name and optional nullable slug; newsletter references require an ID. Unknown reference properties fail. `labels: []` / `newsletters: []` remain explicit replacement requests, not merges; Ghost governs their effects. No new comped, subscription, billing or bulk-member controls.

Existing user bio/website/location/facebook/twitter fields accept null clearing; name/email/slug do not. Newsletter status is `active`/`archived`, font categories `serif`/`sans_serif`, alignment `left`/`center`, sort order an edit-only nonnegative safe integer. Creation and editing accept slug, sender name/email, header image and footer content. Description, sender name/email, header image and footer content are nullable. Sender email may also be an empty string; sender reply-to must be `newsletter`, `support` or a valid email, never null. Boolean fields accept only booleans. Sender settings can trigger Ghost's verification emails; returned metadata is not proof that the requested sender is active.

Webhook targets must be absolute HTTP(S) URLs; event is nonblank lowercase text, with supported events still validated by Ghost. Name/secret accept null, including secret on edit; integration ID remains add-only. This is input validation, not verification of delivery or a guarantee that a target is safe to contact. Never put secrets in issue reports or logs.

The supported schema contract is source-verified against Ghost **5.130.0**, pinned API schemas and the relevant models/services, not a live instance. Null is forwarded as a clearing request; server transforms and permissions still apply. Member-cancellation and internal/debug/transaction controls are not exposed. Explicit newsletter delivery and opt-in controls are described below. Dependency advisories remain a separate release/adoption gate.

### Explicit newsletter delivery and administration

**WARNING: these writes can email real people.** Tests use mocks/loopback only.
Tool descriptions expose these side effects; this fork does not add tool
annotations in this compatibility slice. No automatic send retry, newsletter selection or recipient inference is
performed. Permissions, active newsletter existence, valid member NQL, scheduling
timing and post/email state transitions remain Ghost's responsibility. A successful
write is not proof of delivery: inspect returned `data.status`, email relationships
and metadata. Failed/pending states are returned unchanged.

Delivery is **edit-only**. Create a draft, read it, then use the exact current
`data.updated_at` (replace the example timestamp) to publish:

```json
{"title":"Weekly update","status":"draft","html":"<p>Hello</p>"}
```

Pass that to `posts_add`, then `posts_read` with `{"id":"POST_ID","include":"email,newsletter"}`.
Publish with `posts_edit`:

```json
{"id":"POST_ID","updated_at":"2026-10-21T00:00:00.000Z","status":"published","newsletter":"weekly","email_segment":"status:free","email_subject":"Your weekly update"}
```

Or schedule an email-only post with `posts_edit` and an explicit future timestamp:

```json
{"id":"POST_ID","updated_at":"2026-10-21T00:00:00.000Z","status":"scheduled","published_at":"2027-01-15T12:00:00+01:00","email_only":true,"newsletter":"weekly"}
```

`newsletter` is an **active newsletter slug**, not an ID. `email_segment` is
member NQL (or `all`), not a replacement subscriber list; it requires newsletter.
Omitting it leaves Ghost's documented default **all subscribed recipients**.
Both controls are query parameters, never post body fields, and are rejected on
create/read/browse/copy/delete and pages. A newsletter requires explicit
published/scheduled status; scheduled delivery requires non-null `published_at`.
Explicit `email_only:true` publishing/scheduling requires newsletter, so create
email-only drafts first. Nullable `email_subject` (max 300) and `email_only` alone
are configuration, not send requests. Delivered email-only posts have status `sent`.

Ghost only applies delivery routing on qualifying state transitions without an
existing newsletter association; these options do not guarantee a new send or
recipient change. Stored newsletter/email state can send on later publishing even
without new delivery options. Read first. On conflict, reread before deciding
what to do; on timeout/error, inspect server state rather than blindly retrying,
reverting or republishing. The adapter never retries these mutations.

`newsletters_add` accepts creation-only boolean `opt_in_existing`. Omitted stays
omitted, false stays false; true subscribes existing members already subscribed
to at least one active newsletter. It is not a content send or arbitrary member
import. Example: `{"name":"Weekly","slug":"weekly","opt_in_existing":false}`.
Create/edit sender settings may trigger real **verification emails**. Preserve
the returned entity as authoritative: `meta.sent_email_verification` indicates
pending verification, not that the requested sender is active. Unknown/combined
metadata and `opted_in_member_count:0` are retained; absent meta is not invented.
There is no verification-token tool. Archive explicitly with
`newsletters_edit` / `{"id":"NEWSLETTER_ID","status":"archived"}`; the removed
`newsletters_delete` name now fails as unknown and never silently archives.

These contracts use Ghost 5.130.0 source and public sending/email-only/newsletter
documentation; the `Accept-Version: v5.0` minimum header does not establish support
for every Ghost 5.x minor. No live email or compatibility test is claimed.

### Member labels and public site information

Standalone labels organize members, not post tags. All five tools use strict
inputs and the existing response envelope: browse returns `{data:[...],meta?}`;
read/add/edit return `{data:{...},meta?}`. Pagination and `count.members` are
returned as supplied, including zero counts and `next:null`. Each browse call
fetches one page; inspect pagination and request the next page explicitly.

| Tool | Inputs and query controls |
| --- | --- |
| `labels_browse` | Optional filter, order, fields CSV, include=`count.members`, positive safe integer page/limit or limit=`all` |
| `labels_read` | Exactly one id/slug; optional filter, fields, include=`count.members` |
| `labels_add` | Required nonblank name, optional nonblank slug; optional include=`count.members` |
| `labels_edit` | Required id, optional name/slug; optional include=`count.members` |
| `labels_delete` | Required id only |
| `site_read` | No inputs (`{}`) |

Label name/slug writes have max191 characters; null and generated/audit fields
are rejected. Ghost generates/normalizes slugs. Read selectors are safely encoded
once and reject traversal, delimiters, escapes and control characters. Query
controls never enter label bodies. Like other native resources, direct-client
label queries belong in the flat input; nonempty/malformed separate options are
rejected. Site accepts only empty input/options objects. No URL overrides exist.

Examples: `labels_browse` with `{"include":"count.members","limit":50,"page":1}`,
`labels_read` with `{"slug":"vip"}`, and `labels_add` with `{"name":"VIP"}`.
Existing member assignment inputs are unchanged: `members_edit` accepts
`{"id":"MEMBER_ID","labels":[{"name":"VIP","slug":"vip"}],"newsletters":[{"id":"NEWSLETTER_ID"}]}`.
Member labels remain name/optional nullable slug objects, not standalone label
IDs; no automatic lookup occurs. Empty relationship arrays are explicit
replacement requests, not merges. Ghost governs assignment/subscription effects.

**Deletion is irreversible:** `labels_delete` removes the label and its member
assignments, **not the members**. It returns `Label with id ID deleted.` after
Ghost succeeds, never retries or simulates archival, and does not send member
deletion requests. Assignment cleanup is verified in Ghost source, not a claim
that offline fixtures executed a real member database mutation.

`site_read` returns real **public** title, description, logo, frontend URL and
version from `/ghost/api/admin/site/` as `{data:{...},meta?}`. Ghost returns a
singleton object, not an array. Nullable logo and additional public fields are
preserved. The logo may be relative; the frontend URL may differ from the Admin
URL; version is retained literally (typically major.minor). None of these values
are fabricated from local configuration or followed as new request destinations.

Ghost's site endpoint is **unauthenticated**: this request sends no Authorization
header. The MCP server still requires its existing key/configuration for other
tools; there is no anonymous-server mode. The request uses only the configured
site URL/subdirectory, refuses redirects, times out after30 seconds and never
retries. Site read is **not general settings access or editing**. `blog://info`
now uses the same public site read; other entity resources remain permission-bound.

| Version evidence | Labels | Public site |
| --- | --- | --- |
| Ghost **5.130.0** source | CRUD/ID+slug routes, option allowlists, count relation, slug generation, assignment detachment verified | Public route, permissions=false, singleton serializer and public fields verified |
| Earlier5.x / other majors | Not verified by this change | Not verified by this change |
| Live installations | No live compatibility or credential-permission test | No live compatibility test |

Reference: [labels docs](https://docs.ghost.org/admin-api/labels/overview),
[site docs](https://docs.ghost.org/admin-api/site/overview), baseline
[labels endpoint](https://github.com/TryGhost/Ghost/blob/v5.130.0/ghost/core/core/server/api/endpoints/labels.js),
[label model](https://github.com/TryGhost/Ghost/blob/v5.130.0/ghost/core/core/server/models/label.js),
and [site serializer](https://github.com/TryGhost/Ghost/blob/v5.130.0/ghost/core/core/server/api/endpoints/utils/serializers/output/site.js).
Current documentation alone is not evidence of older-version support. The
minimum `Accept-Version: v5.0` header does not promise every5.x minor. Ghost
enforces label permissions; permission/version failures remain errors rather
than empty success. No automatic site-version probe or auth escalation is added.

### Bounded image upload for remote clients

`images_upload` accepts image bytes supplied by the caller, not a path on the
MCP client or server and not a URL to download. It writes a file to configured
Ghost storage; it does **not** publish content or assign the image to a post.

| Input | Contract |
| --- | --- |
| `base64` (required) | Canonical standard RFC4648 base64, with required padding; no whitespace, URL-safe alphabet or data-URI prefix. Maximum **6,990,508 characters** and **5,242,880 decoded bytes (5 MiB)**. Empty input rejected. |
| `filename` (required) | 1–120 ASCII characters, first alphanumeric, rest alphanumeric/space/dot/underscore/hyphen; matching extension required, case insensitive. No path separators, leading dot, quotes, percent syntax or controls. |
| `mime_type` (required) | `image/jpeg` (.jpg/.jpeg), `image/png` (.png), `image/gif` (.gif), `image/webp` (.webp). |
| `ref` (optional) | Nonblank opaque text, maximum1024 UTF16 code units, no ASCII controls/DEL. Never fetched or opened as a path. Omitted stays omitted in the multipart request. |

Example MCP call using a small PNG (the caller supplies its bytes directly):

```json
{"name":"images_upload","arguments":{"filename":"pixel.png","mime_type":"image/png","base64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=","ref":"hero-image"}}
```

Example response (the server's returned values are authoritative):

```json
{"data":{"url":"https://storage.example/content/images/pixel.png","ref":"hero-image"}}
```

Returned URL/ref, including null or absent ref, extra entity fields and valid
metadata are preserved literally. The client never fabricates a ref or fetches
the returned URL; a storage adapter may return another origin or a relative URL.
To use it, explicitly pass `data.url` into a later `posts_add`/`posts_edit`
`feature_image` field (with the current `updated_at` for editing). Assigning an
existing URL does not upload it; uploading does not assign it automatically.

Type/extension/signature must match. **Signature checks identify headers only**:
JPEG FF D8 FF, PNG eight-byte signature, GIF87a/GIF89a, WebP RIFF/WEBP header.
They are not full image decoding, malware scanning, dimension/decompression
limits or proof that a file is valid. Ghost still controls processing, permission,
optimization, filename normalization and storage; bytes need not be stored
unchanged. SVG/SVGZ/ICO/AVIF, themes/files/media, URL fetching and local filesystem
reads are deliberately unsupported. Unknown input keys fail rather than disappear.
Direct typed-client callers use `client.images.upload(input)`; separate options
must be omitted or an empty strict object, not null/arrays/nonempty options.

Multipart is built entirely in memory using `file` and optional `ref`, capped at
**5 MiB+8192 bytes**, with no temporary files or local cleanup obligation on
success/failure. Encoded and decoded size checks run before multipart dispatch;
oversized encoded input is rejected before scanning/decoding. The default
upload transport also caps response bytes at **65,536**, times out after30s,
refuses redirects, disables proxy discovery, and never retries. Custom injected
request executors receive the same validated multipart bytes but own their
transport policies. Other SDK/native request policies remain unchanged.

These are **per-request** application limits: the MCP transport has already
received/parsed JSON before tool validation, concurrent callers consume additional
memory, and transient encoded/decoded/multipart copies coexist. This is not a
process-wide memory or denial-of-service guarantee. No local image decompression
is attempted. On error/timeout, the upload may already exist in Ghost: inspect
server state before manually retrying. No automatic retry, rollback or cleanup
DELETE is performed; malformed/oversized replies are errors, not upload success.

Contracts are source-verified against Ghost **5.130.0**
[authenticated routes](https://github.com/TryGhost/Ghost/blob/v5.130.0/ghost/core/core/server/web/api/endpoints/admin/routes.js),
[upload validation](https://github.com/TryGhost/Ghost/blob/v5.130.0/ghost/core/core/server/web/api/middleware/upload.js),
[type allowlist](https://github.com/TryGhost/Ghost/blob/v5.130.0/ghost/core/core/shared/config/overrides.json),
[image endpoint](https://github.com/TryGhost/Ghost/blob/v5.130.0/ghost/core/core/server/api/endpoints/images.js)
and [response serializer](https://github.com/TryGhost/Ghost/blob/v5.130.0/ghost/core/core/server/api/endpoints/utils/serializers/output/images.js),
plus [public docs](https://docs.ghost.org/admin-api/images/overview).
The5MiB cap is this MCP server's policy, not a universal Ghost limit. Minimum
`Accept-Version: v5.0` is not proof of every5.x minor/newer-major support. All
upload tests are mocked/allowlisted loopback; no live upload or credential
permission compatibility is claimed.

### Theme ZIP upload and explicit activation

**Both operations can change the public site.** Uploading and activating are
separate tools, not an automatic workflow. Upload never calls the activation
endpoint or selects a different active theme, but Ghost can **replace an existing
same-named theme and immediately reload it if active**. Upload is not harmless
staging. Back up/review theme changes through your own process before invoking.

`themes_upload` accepts exactly:
- `filename`: safe ASCII basename1..120 characters, same rule as image uploads,
  with `.zip` extension (case insensitive). Never a local/client/server path.
- `base64`: canonical standard base64 with correct padding bits, no whitespace,
  data URI or URL-safe alphabet. Maximum **13,981,016 characters**, decoded
  **10,485,760 bytes (10MiB)**. Empty, oversized and noncanonical inputs fail.

There is no MIME/ref/URL/path/activate input or arbitrary header/query option.
The file part uses fixed `application/zip`. For example, replace the explicitly
marked placeholder with bytes of a trusted, compatible theme ZIP on your client:

```json
{"name":"themes_upload","arguments":{"filename":"my-theme.zip","base64":"REPLACE_WITH_CANONICAL_BASE64_OF_THEME_ZIP"}}
```

Successful data is returned exactly from Ghost, for example:

```json
{"data":{"name":"my-theme","active":false,"package":{"name":"my-theme"},"templates":[]}}
```

`active` can also be **true** after upload; never assume false or derive the
installed name from the filename. Ghost sanitizes names and may refuse default
theme replacement. Package/templates/warnings/errors and valid `meta` are
preserved, not interpreted as a new client guarantee. To activate deliberately,
use Ghost's returned name in a **separate** call:

```json
{"name":"themes_activate","arguments":{"name":"my-theme"}}
```

Activation takes only a required nonblank safe name <=191 characters, encodes it
once in the fixed route, and sends a bodyless PUT. It cannot upload implicitly,
accept ZIP bytes, choose a default theme, edit general settings or roll back.
Returned `active:false` remains false rather than fabricated success. Missing,
malformed, unauthorized and incompatible themes remain errors. HTTP theme
validation errors expose bounded status/category (`ThemeValidationError`), not
raw gscan paths, diagnostics or server-echoed bytes. Inspect Ghost for full
validation details. Successful theme warning/error metadata remains unchanged.

**ZIP subset and limits:** metadata inspection accepts classic single-disk ZIP,
stored/deflate, ASCII/UTF8 names and consistent optional data descriptors/comments.
It checks central/local consistency, offsets and contiguous nonoverlapping ranges;
maximum **2000 entries**, **1024-byte entry names**, and **100MiB total declared
uncompressed size**. It rejects ZIP64, encryption/multidisk/unsupported compression,
alternate Unicode-path/AES extras, malformed records, symlinks/special files,
unsafe absolute/traversal/drive/backslash/control paths, Windows device names,
duplicates (conservative NFKC/uppercase aliases with sharp-S expansion), including
Greek case aliases and superscript Windows device names, file/directory aliases and file-parent
conflicts. Empty/directory-only archives and prefixed/trailing/gapped records are
rejected. Some ZIP writers/variants therefore require repacking; this is not a
complete ZIP-format implementation.
Compatibility normalization is deliberately conservative and can also reject
distinct Unicode names; use unambiguous archive paths when repacking.

**No local extraction, decompression, CRC-content verification, filesystem reads
or temporary files occur.** Declared sizes can lie: these checks do not prove
safe actual expansion, compression ratio, archive integrity, absence of malware
or theme compatibility. Ghost/gscan remains responsible for actual extraction
and validation. There is no local package.json/layout guess or template execution.
No files need cleaning up locally on success, rejection or failure.

Multipart body is capped at **10MiB+8192 bytes**; default responses for both
theme operations at **1MiB decompressed**. Default native transport uses30s
timeout, no redirects, no automatic retries and no proxy discovery. All caps
are per request, not upstream MCP JSON-parsing or total concurrency guarantees;
encoded/decoded/multipart buffers can coexist. Injected executors own their
transport policy. Image limits and existing native/SDK policies are unchanged.
After timeout/error/malformed response, the theme change may already have taken
effect: inspect Ghost before manual retry. No automatic recovery/delete/rollback.

**Credentials and hosting:** use the existing configured Admin API key or staff
token with the corresponding Ghost **theme add** (upload) / **theme activate**
permission. Ghost5.130.0's Admin Integration fixture grants theme management;
Owner/Administrator staff can manage themes, while Editor-style roles are
read-only for themes. This does not promise every key, hosting plan or version
permits custom themes. Ghost enforces permission and `customThemes` plan limits;
the client never escalates or switches authentication.

Source reference is **Ghost5.130.0**, not every5.x minor, other majors or live
compatibility. Local ZIP limits are MCP policy, not universal Ghost limits.
Evidence: [theme docs](https://docs.ghost.org/admin-api/themes/overview),
[endpoints](https://github.com/TryGhost/Ghost/blob/v5.130.0/ghost/core/core/server/api/endpoints/themes.js),
[storage/active overwrite](https://github.com/TryGhost/Ghost/blob/v5.130.0/ghost/core/core/server/services/themes/storage.js),
[validation](https://github.com/TryGhost/Ghost/blob/v5.130.0/ghost/core/core/server/services/themes/validate.js),
[returned metadata](https://github.com/TryGhost/Ghost/blob/v5.130.0/ghost/core/core/server/services/themes/to-json.js)
and [permission fixtures](https://github.com/TryGhost/Ghost/blob/v5.130.0/ghost/core/core/server/data/schema/fixtures/fixtures.json).
All tests use mocked/allowlisted loopback endpoints: no live theme upload or
activation. Browse/download/delete/install-from-GitHub and file/media uploads
are not silently included.

## Available Resources

All seven existing MCP resource names/URIs now perform real reads:

| URI | Client read |
| --- | --- |
| `user://{user_id}` | users.read by ID |
| `member://{member_id}` | members.read by ID |
| `tier://{tier_id}` | tiers.read by ID |
| `offer://{offer_id}` | offers.read by ID |
| `newsletter://{newsletter_id}` | newsletters.read by ID |
| `post://{post_id}` | posts.read by ID with explicit formats=html |
| `blog://info` | Public site.read, not general settings |

**Compatibility change:** resource text is now `application/json`, not successful
placeholder `text/plain`. Each read returns one
`contents:[{uri,mimeType:"application/json",text:"...JSON..."}]`, with text
containing `{data:entity,meta?}` just like entity tools. Nullable/extra entity
fields, empty/unknown/nested metadata and absent metadata are preserved. Resource
names/templates and54 tool names are unchanged; no automatic enumeration or
background Ghost requests occur during discovery. Internal standalone placeholder
handler exports were replaced by injected `registerResources(server,client)`;
those internal functions were not a working retrieval API.

Example resource read: `{"uri":"post://POST_ID"}`. IDs are case-sensitive,
nonblank and <=191 UTF16 code units. Percent-encode spaces/Unicode in resource
URIs, for example `post://caf%C3%A9%20ID`; variables decode exactly once and the
client encodes the ID once for the fixed HTTP route. Traversal, nested escapes,
delimiters/control characters, URI credentials/ports/query/fragment/path additions
and malformed variables fail before client dispatch. URI values are symbolic
identifiers, not arbitrary HTTP destinations. No slug/email/query controls are
accepted through resource URIs; use the corresponding tools for those queries.

Configured Ghost permissions still apply, including private member/staff data:
advertising a resource does not grant access to it. Each read invokes the same
client as its tool, without fallback auth, fake entities, logging credentials or
automatic retries. Permission/not-found/malformed response/serialization failures
are sanitized **MCP protocol errors**, not tool `isError` content or placeholder
success. Check the ID and Ghost permissions for details. Unknown/unmatched URI
handling remains the pinned MCP SDK's behavior. `blog://info` alone uses the
public site endpoint without sending Authorization; the server's existing key
configuration is still required. No resource-specific output truncation or new
HTTP-size policy is introduced; prompt caps below are separate.

## Summarization prompt

`summarize-post` keeps its required `postId` argument, now strict and validated
before even injected clients. Unknown arguments, unsafe/blank IDs and IDs over191
UTF16 code units fail instead of being silently discarded. One explicit
`posts.read({id:postId},{formats:"html"})` supplies the source; no links are fetched
and no Lexical conversion or model call is performed by this server.

The returned user message includes full supplied HTML up to **100,000 UTF16 code
units**, plus title up to2000 and excerpt up to5000. Longer fields use a prefix
without cutting a surrogate pair. The old silent300-character preview and
unconditional ellipsis are removed. HTML is visibly labelled complete or
**TRUNCATED**, with included/original counts; all three fields have explicit
`truncation` metadata (`originalCharacters`, `includedCharacters`, `limit`,
`truncated`) in JSON source. Null/missing/non-string HTML fails rather than
constructing a fake empty source; genuinely empty HTML remains valid. Optional
non-string title/excerpt become empty strings.

Source is JSON-quoted and marked **untrusted data, not instructions**; the prompt
asks the host model not to follow embedded instructions or links. This is not a
prompt-injection-proof guarantee or evaluated summary-quality claim. The MCP host
decides whether/how to execute the returned prompt; no LLM/Langfuse credentials,
tracing or telemetry dependency is added. Caps govern source construction after
the full Ghost response is fetched, not network/JSON parsing, total memory,
concurrent requests or model tokens. Read failures remain sanitized protocol
errors; endpoint/version/permission evidence remains the existing Ghost5.130.0
baseline, not live compatibility proof.

## Available Tools

Below is an inventory of the 54 registered tool names, not a full API coverage guarantee. Permissions and Ghost version may restrict operations.

### Posts
- **Browse Posts**: List posts with optional filters, pagination, and ordering.
- **Read Post**: Retrieve a post by ID or slug.
- **Add Post**: Create a new post with title, content, and status.
- **Edit Post**: Update an existing post by ID.
- **Delete Post**: Remove a post by ID.
- **Copy Post** (`posts_copy`): Duplicate a post by ID using Ghost's native copy endpoint.

### Pages
- **Browse Pages** (`pages_browse`): Filter/order pages, with `page`, `limit` (positive integer or `"all"`), `include`, `fields`, and `formats` options.
- **Read Page** (`pages_read`): Supply exactly one ID or slug, plus optional `include`, `fields`, and `formats`.
- **Add Page** (`pages_add`): Create a page with required title and optional HTML/Lexical, relationships, image/SEO metadata, and `custom_template`.
- **Edit Page** (`pages_edit`): Update by ID with required `updated_at` collision-detection timestamp.
- **Delete Page** (`pages_delete`): Remove a page by ID.
- **Copy Page** (`pages_copy`): Duplicate a page by ID using Ghost's native copy endpoint.

#### Page tool examples

These are MCP tool-call names and arguments, not direct HTTP request bodies:

```json
{"name":"pages_read","arguments":{"slug":"about","include":"tags,authors","formats":"html,lexical"}}
```

```json
{"name":"pages_add","arguments":{"title":"About us","slug":"about","html":"<p>Hello!</p>","status":"draft","custom_template":"about","include":"tags","formats":"html"}}
```

```json
{"name":"pages_edit","arguments":{"id":"PAGE_ID_FROM_READ","updated_at":"TIMESTAMP_FROM_READ","lexical":"{\"root\":{\"children\":[],\"direction\":null,\"format\":\"\",\"indent\":0,\"type\":\"root\",\"version\":1}}"}}
```

`include`/`fields` are comma-separated query strings; see the [content input table](#strict-content-input-migration) for allowed includes and formats. Include/formats/revision controls are never written into content. Nonempty HTML uses Ghost's `source=html` conversion (also taking precedence if Lexical is supplied); Lexical-only writes do not. Page tools do not expose newsletter or email-only options. Read the current page first and pass its exact `data.updated_at` into edits; conflicts are not retried.

#### Native copy behavior

```json
{"name":"pages_copy","arguments":{"id":"PAGE_ID_FROM_READ","formats":"lexical"}}
```

Both copy tools require an ID and accept optional `formats`, with no content/title/status overrides or email-send options. They return the new entity from Ghost inside `data`, plus response `meta` when supplied. In the source-verified Ghost 5.130.0 implementation, copying creates a new draft titled `<original title> (Copy)` and carries Ghost's selected fields/relationships—not necessarily every field. Edit the returned draft separately if needed. The current key must have add permission; a rejected copy is never simulated by reading and creating content.

Requests use native POST `/posts/{id}/copy/` and `/pages/{id}/copy/` with no body. Copy refuses redirects and has a 30-second timeout with no automatic retries: after a timeout, check Ghost before retrying manually, because the original request may have created a draft. Native copy uses the same configured key and minimum-version header as CRUD (numeric `v5` or newer; `v5` normalizes to `v5.0`). Reference routes and behavior were verified against [Ghost 5.130.0 source](https://github.com/TryGhost/Ghost/blob/v5.130.0/ghost/core/core/server/web/api/endpoints/admin/routes.js) and [official pages docs](https://docs.ghost.org/admin-api/pages/overview), not a live server. `Accept-Version: v5.0` specifies a minimum API version; it does not establish compatibility with every Ghost 5 minor or version.

### Members
- **Browse Members**: List members with filters and pagination.
- **Read Member**: Retrieve a member by ID or email.
- **Add Member**: Create a new member.
- **Edit Member**: Update member details.
- **Delete Member**: Remove a member.

### Member labels
- **Browse Labels** (`labels_browse`): List/filter labels with explicit paging and optional member counts.
- **Read Label** (`labels_read`): Retrieve by exactly one ID or slug.
- **Add Label** (`labels_add`): Create a named label, with optional slug.
- **Edit Label** (`labels_edit`): Update label name/slug by ID.
- **Delete Label** (`labels_delete`): Remove the label and assignments, not members.

### Site information
- **Read Site** (`site_read`): Read public site details without sending credentials; no settings editing.

### Images
- **Upload Image** (`images_upload`): Upload bounded supplied base64 JPEG/PNG/GIF/WebP bytes to configured Ghost storage; no local paths or URL fetching.

### Themes
- **Upload Theme** (`themes_upload`): Upload bounded supplied base64 ZIP; may replace/reload active files. Never calls activation automatically.
- **Activate Theme** (`themes_activate`): Explicitly select an installed theme by name; changes the public site.

### Newsletters
- **Browse Newsletters**: List newsletters.
- **Read Newsletter**: Retrieve a newsletter by ID.
- **Add Newsletter**: Create a new newsletter.
- **Edit Newsletter**: Update newsletter details.

### Offers
- **Browse Offers**: List offers with optional filter (no pagination/order).
- **Read Offer**: Retrieve an offer by ID.
- **Add Offer**: Create a new offer.
- **Edit Offer**: Update presentation fields or explicitly archive with `status: "archived"`.

### Invites
- **Browse Invites**: List invites.
- **Add Invite**: Send a real staff invitation email (integration route allowed; role/operation permissions apply).
- **Delete Invite**: Remove an invite.

### Roles
- **Browse Roles**: List roles, optionally with `permissions: "assign"` (integration route allowed; role permissions apply).

### Tags
- **Browse Tags**: List tags.
- **Read Tag**: Retrieve a tag by ID or slug.
- **Add Tag**: Create a new tag.
- **Edit Tag**: Update tag details.
- **Delete Tag**: Remove a tag.

### Tiers
- **Browse Tiers**: List tiers.
- **Read Tier**: Retrieve a tier by ID.
- **Add Tier**: Create a new tier.
- **Edit Tier**: Update tier details or explicitly archive with `active: false`.

### Users
- **Browse Users**: List users.
- **Read User**: Retrieve a user by ID or slug.
- **Edit User**: Update user details.
- **Delete User**: Remove a user.

### Webhooks
- **Add Webhook**: Create a new webhook.
- **Edit Webhook**: Update webhook details.
- **Delete Webhook**: Remove a webhook.

> Each tool is accessible via the MCP protocol and can be invoked from compatible clients. For parameter schemas, see the source code in [`src/tools/`](../src/tools/).


## Error Handling

From `0.2.0`, known-tool schema and input-budget failures return `isError:true`
tool results, as do execution failures. Unknown/disabled tools and malformed
tool-call envelopes remain InvalidParams protocol errors. Unexpected parser/server
handler faults use sanitized InternalError responses. Check **both channels**
before parsing successful data; resource/prompt errors remain separate protocol
errors. See [the migration, spec/SDK comparison and experimental-task limitation](tool-errors.md).
Native errors retain safe operation/status and credential guidance without server
diagnostic bodies or request configuration. Startup failures use stderr without
dumping supplied credentials. There is no custom `GhostError` implementation.
