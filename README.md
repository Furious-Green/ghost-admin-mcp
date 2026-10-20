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
- Explicit Ghost query filters and pagination inputs (pages additionally accept `limit: "all"`)
- JSON-formatted text responses and MCP error signaling
- Offline request/registration contract tests, without Ghost credentials or live mutations

## Current limitations

46 tools are registered; registration is not proof of live API support:

- Tiers/offers/invites/roles use native adapters for twelve supported operations. Contracts are verified against documentation and Ghost 5.130.0 source, not a live server; permissions and version differences still apply.
- Browse output, including pages, currently drops pagination metadata, although page/limit inputs work ([#5](https://github.com/Furious-Green/ghost-admin-mcp/issues/5)).
- Query/field coverage and explicit newsletter delivery options are incomplete ([#6](https://github.com/Furious-Green/ghost-admin-mcp/issues/6), [#7](https://github.com/Furious-Green/ghost-admin-mcp/issues/7)). Newsletter configuration tools do not provide an explicit send workflow.
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

Other SDK CRUD, pages/copy, executable and environment variable names, badges and MIT licensing are unchanged. Native requests refuse redirects, time out after 30 seconds and never retry; check Ghost before manually repeating a timed-out mutation.

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

`include`/`fields` are comma-separated query strings. `formats` accepts `html`, `lexical`, `html,lexical`, or `lexical,html`. Include/formats are never written into content. Nonempty HTML uses Ghost's `source=html` conversion (also taking precedence if Lexical is supplied); Lexical-only writes do not. Page tools do not expose newsletter or email-only options. Read the current page first and pass its exact `updated_at` into edits; conflicts are not retried.

#### Native copy behavior

```json
{"name":"pages_copy","arguments":{"id":"PAGE_ID_FROM_READ","formats":"lexical"}}
```

Both copy tools require an ID and accept optional `formats`, with no content/title/status overrides or email-send options. They return the new entity from Ghost. In the source-verified Ghost 5.130.0 implementation, copying creates a new draft titled `<original title> (Copy)` and carries Ghost's selected fields/relationships—not necessarily every field. Edit the returned draft separately if needed. The current key must have add permission; a rejected copy is never simulated by reading and creating content.

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

`npm test` builds the TypeScript code and runs Node's built-in test runner. It exercises the real Ghost SDK with a recording request transport, actual MCP input parsing/discovery over in-memory transports, and executable stdio discovery with dummy credentials and a rejecting loopback fixture. Native-adapter tests independently verify JWT signatures and use the real Axios transport against loopback-only fixtures for JSON payloads, empty bodies, redirects, errors, and timeouts. All other suites block outbound HTTP; no real Ghost key, live content mutation, or email send is required. A pure `createServer(client)` factory accepts a typed client without reading environment configuration or connecting stdio. Tests and fixtures are outside the distributed `build/` directory.

CI uses the committed dependency lockfile, Node 22, and read-only permissions; it needs no repository secrets. The workflow uses JSON syntax, which is valid YAML, so its policy can be checked without adding a YAML parser dependency.

The inherited lockfile currently reports npm audit vulnerabilities, including critical advisories. These changes do not upgrade dependencies or constitute a release-readiness/security approval. Dependency remediation and release verification are required before adoption; do not publish using the upstream npm identity.

## Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Create pull request

## License

MIT
