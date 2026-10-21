# Ghost MCP Server

[![Build & tests](https://github.com/Furious-Green/ghost-admin-mcp/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Furious-Green/ghost-admin-mcp/actions/workflows/ci.yml?query=branch%3Amain)
[![Node.js 22](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/en/about/previous-releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A Model Context Protocol (MCP) server for interacting with Ghost CMS through clients such as Claude. This public fork of [MFYDev/ghost-mcp](https://github.com/MFYDev/ghost-mcp) is repairing API coverage and reliability. It does not yet implement the full Ghost Admin API.

![demo](./assets/ghost-mcp-demo.gif)

## Features

- Ghost Admin API requests with `@tryghost/admin-api` plus focused authenticated native adapters
- Tools for posts, pages, bounded image uploads, members, member labels, public site information, users, tags, newsletter configuration, webhooks, tiers, offers, staff invites and roles
- Native Ghost post/page copying, creating drafts without client-side reconstruction
- Explicit Ghost query filters and resource-specific pagination, including supported `limit: "all"`
- Strict tool inputs and typed-client validation with resource-specific queries, nullable clearing and revision controls
- Consistent JSON `data`/optional `meta` envelopes, preserving server pagination and mutation metadata
- MCP error signaling and unchanged plain-text delete confirmations
- Offline request/registration contract tests, without Ghost credentials or live mutations

## Current limitations

52 tools are registered; registration is not proof of live API support:

- Tiers/offers/invites/roles use native adapters for twelve supported operations. Contracts are verified against documentation and Ghost 5.130.0 source, not a live server; permissions and version differences still apply.
- Pagination is returned when Ghost supplies it; this server never invents pagination or automatically fetches additional pages. Available paging controls remain resource-specific.
- Both slices of [#6](https://github.com/Furious-Green/ghost-admin-mcp/issues/6) repair the exposed query/input schemas (see migrations below), not the full Admin API surface. Explicit delivery uses `posts_edit`; newsletter configuration tools manage settings and optional creation-time opt-in, not content sending.
- `newsletters_delete` and the direct client's newsletter delete method have been removed: Ghost 5.130.0 has no matching endpoint. There is no alias or automatic archive. Explicitly use `newsletters_edit` / `status: "archived"` where appropriate.
- All seven MCP resource handlers return placeholder text, and the summarize-post prompt retains a limited HTML preview ([#11](https://github.com/Furious-Green/ghost-admin-mcp/issues/11)).
- Available SDK methods do not prove that a Ghost version or credential permits an operation. Custom Integration keys have fixed restricted permissions; staff tokens act with the user's role. Never assume every key grants unrestricted admin access.

See [the coverage backlog](https://github.com/Furious-Green/ghost-admin-mcp/issues/1). Tests characterize known defects without treating them as repaired. Live Ghost compatibility has not been verified by the offline suite.

## Usage

Build a reviewed checkout of this fork with `npm ci` on Node 22. Configure your MCP client to run the resulting executable, for example in Claude Desktop's `claude_desktop_config.json`:
```json
{
  "mcpServers": {
      "ghost-mcp": {
        "command": "node",
        "args": ["/absolute/path/to/ghost-admin-mcp/build/server.js"],
        "env": {
            "GHOST_API_URL": "https://yourblog.com",
            "GHOST_ADMIN_API_KEY": "your_admin_api_key",
            "GHOST_API_VERSION": "v5.0"
        }
      }
    }
}
```

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

**Staff permissions:** invites and roles are staff-management endpoints. Supply a staff access token with sufficient role permissions through the existing `GHOST_ADMIN_API_KEY` setting (same `id:secret` format), not a Custom Integration's fixed restricted permission set. Ghost enforces permissions; the client never infers credential class, auto-escalates or retries with another auth method. `invites_add` accepts `role_id` and a valid email address and **sends a real staff invitation email** when run against Ghost. Browse roles first to choose an assignable role. Delete removes an invitation, not an existing staff account.

Executable and environment variable names, badges and MIT licensing are unchanged. **All data-returning tools now use the [response envelope below](#response-format-migration)**, including reads and copies; see both [content](#strict-content-input-migration) and [remaining-resource](#strict-remaining-resource-input-migration) input migrations. Native requests refuse redirects, time out after 30 seconds and never retry; check Ghost before manually repeating a timed-out mutation. SDK transport policy is unchanged; these native safeguards are not a claim that the SDK transport has the same policy.

## Response format migration

**Breaking output change:** browse/read/add/edit/copy return JSON text containing `{data, meta?}`. The outer MCP response is still `content: [{type: "text", text: "...JSON..."}]`, not a new protocol envelope. Tool names, executable/settings and MCP error signaling are unchanged. The separate strict-input migration below changes content validation. Delete tools keep their existing plain-text confirmations (for example, `Post with id abc123 deleted.`).

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

This reports pending verification, **not** an already-active new sender address. The returned `sender_email` stays unchanged until verification. Opt-in counts are preserved when Ghost returns them, without interpreting or fabricating them; see explicit delivery and administration below. Private consumers must explicitly adapt to this response change before separately approved adoption.

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

The second #6 slice makes members/users/newsletters/webhooks strict at both MCP and typed-client boundaries. Nested member label/newsletter objects are strict too. Native tiers/offers/invites/roles remain strict, now with safe-integer paging, tighter enums/ranges and malformed-options rejection. Unknown inputs have no passthrough. Refresh discovery; output envelopes and remaining delete text are unchanged. The current inventory is **52 names**, including the six label/site tools and bounded image upload below, and excluding unsupported newsletter deletion.

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
The pinned MCP SDK has no annotations API; tool descriptions expose these side
effects. No automatic send retry, newsletter selection or recipient inference is
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
and the other placeholder MCP resources remain deferred to #11.

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

## Available Resources

The following entity families have registered tool names (see the limitations above; the separately registered MCP resources are placeholders):

- **Posts**: Articles and content published on your Ghost site.
- **Pages**: Static content, managed separately from posts.
- **Members**: Registered users and subscribers of your site.
- **Newsletters**: Newsletter configuration, not an explicit email-send workflow.
- **Offers**: Promotional offers and discounts for members.
- **Invites**: Staff invitations, not member subscriptions.
- **Roles**: User roles and permissions within the Ghost admin.
- **Tags**: Organizational tags for posts and content.
- **Tiers**: Subscription tiers and plans for members.
- **Users**: Admin users and staff accounts.
- **Webhooks**: Automated event notifications to external services.

## Available Tools

Below is an inventory of the 52 registered tool names, not a full API coverage guarantee. Permissions and Ghost version may restrict operations.

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

`include`/`fields` are comma-separated query strings; see the strict content input table for allowed includes and formats. Include/formats/revision controls are never written into content. Nonempty HTML uses Ghost's `source=html` conversion (also taking precedence if Lexical is supplied); Lexical-only writes do not. Page tools do not expose newsletter or email-only options. Read the current page first and pass its exact `data.updated_at` into edits; conflicts are not retried.

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
- **Add Invite**: Send a new staff invitation email (staff permissions required).
- **Delete Invite**: Remove an invite.

### Roles
- **Browse Roles**: List roles, optionally with `permissions: "assign"` (staff permissions required).

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

> Each tool is accessible via the MCP protocol and can be invoked from compatible clients. For detailed parameter schemas and usage, see the source code in `src/tools/`.


## Error Handling

Failed tool calls return MCP errors. Native errors expose safe operation/status guidance, never server diagnostic bodies or request configuration; staff permission failures can suggest a sufficiently privileged staff token. Removed tools return unknown-tool errors. Startup failures are reported on stderr without dumping supplied configuration or credentials. There is no custom `GhostError` implementation.

## Development and verification

Node 22 is the tested development/CI baseline. The existing default API version is `v5.0`; this is not a claim of live compatibility with every Ghost version.

```bash
npm ci
npm run typecheck
npm test
```

`npm test` builds the TypeScript code and runs Node's built-in test runner. It exercises the real Ghost SDK with a recording request transport, actual MCP input parsing/discovery over in-memory transports, and executable stdio discovery with dummy credentials and a rejecting loopback fixture. Response tests cover every data/delete tool, explicit paging, pending newsletter metadata, malformed replies, and out-of-order same-resource calls. Native-adapter tests independently verify JWT signatures; real Axios loopback fixtures check SDK transport parity and native JSON payloads, empty bodies, redirects, errors, and timeouts. All other suites block outbound HTTP; no real Ghost key, live content mutation, or email send is required. A pure `createServer(client)` factory accepts a typed client without reading environment configuration or connecting stdio. Tests and fixtures are outside the distributed `build/` directory.

CI uses the committed dependency lockfile, Node 22, and read-only permissions; it needs no repository secrets. The workflow uses JSON syntax, which is valid YAML, so its policy can be checked without adding a YAML parser dependency.

The inherited lockfile currently reports npm audit vulnerabilities, including critical advisories. These changes do not upgrade dependencies or constitute a release-readiness/security approval. Dependency remediation and release verification are required before adoption; do not publish using the upstream npm identity.

## Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Create pull request

## License

MIT
