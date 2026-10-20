# Ghost MCP Server

[![Build & tests](https://github.com/Furious-Green/ghost-admin-mcp/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Furious-Green/ghost-admin-mcp/actions/workflows/ci.yml?query=branch%3Amain)
[![Node.js 22](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/en/about/previous-releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A Model Context Protocol (MCP) server for interacting with Ghost CMS through clients such as Claude. This public fork of [MFYDev/ghost-mcp](https://github.com/MFYDev/ghost-mcp) is repairing API coverage and reliability. It does not yet implement the full Ghost Admin API.

![demo](./assets/ghost-mcp-demo.gif)

## Features

- Ghost Admin API requests with `@tryghost/admin-api` plus focused authenticated native adapters
- Tools for posts, pages, members, users, tags, newsletter configuration, webhooks, tiers, offers, staff invites and roles
- Native Ghost post/page copying, creating drafts without client-side reconstruction
- Explicit Ghost query filters and pagination inputs, including `limit: "all"` for posts/pages/tags, tiers and invites
- Strict posts/pages/tags inputs with resource-specific queries, nullable clearing and revision controls
- Consistent JSON `data`/optional `meta` envelopes, preserving server pagination and mutation metadata
- MCP error signaling and unchanged plain-text delete confirmations
- Offline request/registration contract tests, without Ghost credentials or live mutations

## Current limitations

46 tools are registered; registration is not proof of live API support:

- Tiers/offers/invites/roles use native adapters for twelve supported operations. Contracts are verified against documentation and Ghost 5.130.0 source, not a live server; permissions and version differences still apply.
- Pagination is returned when Ghost supplies it; this server never invents pagination or automatically fetches additional pages. Available paging controls remain resource-specific.
- Posts/pages/tags have repaired query/write schemas and strict validation (see migration below). Remaining-resource query/validation work is still [#6](https://github.com/Furious-Green/ghost-admin-mcp/issues/6); explicit newsletter delivery/opt-in controls remain [#7](https://github.com/Furious-Green/ghost-admin-mcp/issues/7). Newsletter configuration tools do not provide an explicit send workflow.
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

Tier-slug and offer-code read selectors are rejected, including when also supplying an ID. Browse/filter first, then pass the returned ID. `offers_browse` supports only `filter`, not legacy `page`/`limit`/`order`. Tier browse supports `filter`, `limit` (positive integer or `"all"`), `page`, `order`, `fields`, and `include`; read supports ID and include. Include values are comma-separated `monthly_price`, `yearly_price`, `benefits`. Pagination boundaries remain server-dependent: the reference tiers service synthesizes pagination metadata.

`offers_add` retains the `tier_id` tool input, translated to native `tier:{id}`; `tier_id` is never sent to Ghost. Fixed offers require currency, repeating offers require positive integer `duration_in_months`; Ghost remains authoritative for discount/currency rules. Tier prices are nonnegative integer minor-unit amounts. Offer edits allow only name/code/display fields and status, not discount/tier/cadence/duration changes. Unsupported fields are rejected rather than discarded.

`roles_browse` supports only optional `permissions: "assign"` (assignable roles), not legacy `filter`/`page`/`limit`/`order`. Offers and roles are unpaginated collections; no client-side pagination or role-read emulation is provided. `invites_browse` supports `filter`, `limit` (positive integer or `"all"`), `page`, `order`, and `fields`.

**Staff permissions:** invites and roles are staff-management endpoints. Supply a staff access token with sufficient role permissions through the existing `GHOST_ADMIN_API_KEY` setting (same `id:secret` format), not a Custom Integration's fixed restricted permission set. Ghost enforces permissions; the client never infers credential class, auto-escalates or retries with another auth method. `invites_add` accepts `role_id` and a valid email address and **sends a real staff invitation email** when run against Ghost. Browse roles first to choose an assignable role. Delete removes an invitation, not an existing staff account.

Executable and environment variable names, badges and MIT licensing are unchanged. **All data-returning tools now use the [response envelope below](#response-format-migration)**, including reads and copies; posts/pages/tags also have the [strict input migration](#strict-content-input-migration). Native requests refuse redirects, time out after 30 seconds and never retry; check Ghost before manually repeating a timed-out mutation. SDK transport policy is unchanged; these native safeguards are not a claim that the SDK transport has the same policy.

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

**Paging remains explicit:** for resources supporting numeric paging, inspect `result.meta?.pagination.next` and supply that number in a separate `page` request, retaining your filter/order/limit. `next: null` is preserved. Each browse call requests one server response; there is no automatic paging. Missing pagination does **not** prove exhaustion or imply another page exists. Offers/roles are unpaginated collections, tiers pagination remains server-dependent, and `limit: "all"` is accepted only by resource-specific schemas (currently posts, pages, tags, tiers and invites).

**Newsletter metadata describes returned state, not requested state.** For example:

```json
{"data":{"id":"newsletter1","sender_email":null},"meta":{"sent_email_verification":["sender_email"]}}
```

This reports pending verification, **not** an already-active new sender address. The returned `sender_email` stays unchanged until verification. Opt-in counts are preserved when Ghost returns them, without interpreting or fabricating them; new opt-in and delivery controls remain [#7](https://github.com/Furious-Green/ghost-admin-mcp/issues/7). Private consumers must explicitly adapt to this response change before separately approved adoption.

## Strict content input migration

**Breaking validation change, scoped to the 17 posts/pages/tags tools:** unknown keys now fail instead of disappearing, including unknown nested relationship fields and copy overrides. Read accepts **exactly one** nonblank `id` or `slug`; supplying both no longer silently picks the ID. IDs/slugs cannot contain traversal, path/query/fragment delimiters, percent escapes or control characters; spaces and Unicode are encoded as one path segment. Refresh MCP discovery and remove undeclared inputs before upgrading. All 46 tool names, `{data, meta?}` outputs and delete confirmations remain unchanged. Other resource schemas are not made globally strict by this repair.

| Tools | Query controls |
| --- | --- |
| Posts/pages browse | `filter`, `order`, `page`, `limit`, `include`, `fields`, `formats` |
| Posts/pages read | `include`, `fields`, `formats` |
| Posts/pages add | `include`, `formats` |
| Posts/pages edit | `include`, `formats`, `save_revision` (boolean) |
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

API schema lengths/nullability and query options were checked against **Ghost 5.130.0**, including its pinned `@tryghost/admin-api-schema@4.5.10`, not just its database columns. `Accept-Version: v5.0` remains a minimum-version header, not a guarantee for every 5.x minor. Excluded here: generated/audit/database-only fields, experimental collections, custom `visibility_filter`, debug/internal transaction/conversion controls, post `show_title_and_feature_image`, and new email subject/delivery controls (#7). No arbitrary HTTP proxy or unknown-field escape hatch is added. Live version/permission compatibility remains unverified.

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

Below is an inventory of the 46 registered tool names, not a full API coverage guarantee. Permissions and Ghost version may restrict operations.

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

### Newsletters
- **Browse Newsletters**: List newsletters.
- **Read Newsletter**: Retrieve a newsletter by ID.
- **Add Newsletter**: Create a new newsletter.
- **Edit Newsletter**: Update newsletter details.
- **Delete Newsletter**: Remove a newsletter.

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
