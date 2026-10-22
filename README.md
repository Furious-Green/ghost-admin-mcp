# Ghost Admin MCP

[![Build & tests](https://github.com/Furious-Green/ghost-admin-mcp/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Furious-Green/ghost-admin-mcp/actions/workflows/ci.yml?query=branch%3Amain)
[![Node.js 22](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/en/about/previous-releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Manage your Ghost site from Claude Desktop or another Model Context Protocol
(MCP) client. **54 tools** let you work with content, members, newsletters,
images, themes and more through Ghost's Admin API.

![demo](./assets/ghost-mcp-demo.gif)

## Quick start

You need **Node.js 22**, npm, Git, a Ghost site and a Ghost Admin API key.

### 1. Build the server

These commands install **v0.2.0** from its pinned source commit:

```sh
git clone https://github.com/Furious-Green/ghost-admin-mcp.git
cd ghost-admin-mcp
git checkout --detach 26e95747d1fbc827d3cce54d4a9c8a33d6edc0b5
npm ci
```

`npm ci` installs dependencies and builds `build/server.js`. For checksummed
builds and runtime-artifact installation, see the [installation guide](docs/artifacts.md).

### 2. Get your Ghost credentials

Create a **Custom Integration** in Ghost Admin and copy its **Admin API key**
(`id:secret`), not its Content API key. Keep the key private.

Use your Ghost Admin URL without a trailing slash. If Ghost is installed in a
subdirectory, include that subdirectory in the URL.

### 3. Connect your MCP client

Add this to your client's MCP configuration. For Claude Desktop, use
`claude_desktop_config.json`. Replace the absolute server path, site URL and key:

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

Restart or reconnect your MCP client, then start with a read-only request:

> List my five most recently updated Ghost posts.

You can then ask it to create a draft, organize tags or manage members. Review
write actions before approving them: they operate on your real Ghost site.

## What you can do

| Area | Tools |
| --- | --- |
| Posts and pages | Browse, read, create, edit, delete and copy to a draft |
| Tags | Browse, read, create, edit and delete |
| Members and member labels | Browse, read, create, edit and delete |
| Newsletters | Browse, read, create and edit settings; archive explicitly |
| Tiers and offers | Browse, read, create, edit and archive explicitly |
| Images | Upload JPEG, PNG, GIF or WebP bytes, up to 5 MiB |
| Themes | Upload a ZIP up to 10 MiB; activate an installed theme separately |
| Staff users | Browse, read, edit and delete, subject to staff permissions |
| Staff invites and roles | Browse roles; browse, send and delete invitations |
| Webhooks | Create, edit and delete |
| Site information | Read public site details |

See the [full tool reference](docs/reference.md#available-tools) for tool names,
arguments and examples. Uploads accept base64 file bytes supplied by your client,
not local paths or URLs to download.

### Resources and summarization

MCP clients can also read posts, members, staff users, tiers, offers and newsletters
by ID through resource URIs such as `post://POST_ID`. `blog://info` returns public
site information.

The **`summarize-post`** prompt takes a `postId` and supplies the post's HTML to
your MCP client, which can run the summary. Long content is clearly marked when
truncated. See [resource reads](docs/reference.md#available-resources) and
[prompt details](docs/reference.md#summarization-prompt).

## Compatibility and scope

The server uses the official **`@tryghost/admin-api` SDK**, with native adapters
for additional operations the SDK doesn't expose.

- **SDK-backed operations** use the pinned SDK's API behavior, with explicit tool
  schemas defining the available fields and options.
- **Native adapters and extended schemas** follow Ghost's documented Admin API,
  using **Ghost 5.130.0** as the source reference.
- **Recommended configuration:** `GHOST_API_VERSION=v5.0`. This selects the minimum
  API contract, not the version of Ghost you must install. Newer Ghost releases can
  use that contract where the relevant endpoints remain compatible.

Use a **Custom Integration key** for integration workflows, or a **staff token**
for operations requiring staff permissions. Both use `GHOST_ADMIN_API_KEY`; Ghost
applies the credential's permissions to every request. Custom themes also depend
on your hosting plan.

See the [coverage matrix](docs/coverage.md) for operation-specific requirements,
supported options and known gaps.

## Before you make changes

- **Read before editing.** Post and page edits require the current `updated_at`
  value from a read. Inputs are strict; use the fields advertised by your client.
- **Pagination is explicit.** Browse tools preserve Ghost's pagination metadata;
  request subsequent pages using the controls available for that resource.
- **Email actions affect real people.** Publishing or scheduling a post can send
  newsletter email. Staff invitations and newsletter sender changes can also send
  email. Newsletter settings are separate from delivery through `posts_edit`;
  see the [delivery guide](docs/reference.md#explicit-newsletter-delivery-and-administration).
- **Theme upload can change the live site.** Replacing an active theme can reload
  it immediately, even without a separate activation call. Back up themes first.
- **Archive where appropriate.** Use `newsletters_edit` with `status: "archived"`,
  `tiers_edit` with `active: false`, or `offers_edit` with `status: "archived"`.
  These resources have no delete tool; other delete tools remove data.
- **Check Ghost after a timed-out write.** The change may have completed. Inspect
  its state before retrying to avoid duplicate posts, invitations or uploads.

## Documentation

| Looking for… | Guide |
| --- | --- |
| Tool names, fields, uploads and examples | [Tool reference](docs/reference.md#available-tools) |
| Response formats and upgrading from the original server | [Migration guide](docs/reference.md#migrating-from-the-original-implementation) |
| Tool failures and protocol errors | [Error handling](docs/tool-errors.md) |
| API coverage and credential requirements | [Coverage matrix](docs/coverage.md) |
| Pinned builds, runtime artifacts and rollback | [Installation guide](docs/artifacts.md) |
| Tests, CI and dependency checks | [Development guide](docs/development.md) |

## Contributing

Contributions are welcome. Fork the repository, make your changes and run
`npm run typecheck` and `npm test` before opening a pull request. See the
[development guide](docs/development.md) for the verification workflow.

## License

[MIT](LICENSE). This project is a fork of [MFYDev/ghost-mcp](https://github.com/MFYDev/ghost-mcp),
originally created by Fanyang Meng. Original copyright and attribution are retained.
