# Ghost MCP Server

A Model Context Protocol (MCP) server for interacting with Ghost CMS through clients such as Claude. This public fork of [MFYDev/ghost-mcp](https://github.com/MFYDev/ghost-mcp) is repairing API coverage and reliability. It does not yet implement the full Ghost Admin API.

![demo](./assets/ghost-mcp-demo.gif)

## Features

- Secure Ghost Admin API requests with `@tryghost/admin-api`
- Existing tools for posts, members, users, tags, newsletter configuration, and webhooks
- Explicit Ghost query filters and numeric pagination inputs
- JSON-formatted text responses and MCP error signaling
- Offline request/registration contract tests, without Ghost credentials or live mutations

## Current limitations

42 tool names are retained for compatibility, but registration is not proof of live API support:

- The 15 tiers/offers/invites/roles tools return explicit unsupported SDK capability errors; real adapters are tracked in [#3](https://github.com/Furious-Green/ghost-admin-mcp/issues/3).
- Pages and copy operations are not implemented yet ([#4](https://github.com/Furious-Green/ghost-admin-mcp/issues/4)).
- Browse output currently drops pagination metadata, although page/limit inputs work ([#5](https://github.com/Furious-Green/ghost-admin-mcp/issues/5)).
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

## Available Resources

The following entity families have registered tool names (see the limitations above; the separately registered MCP resources are placeholders):

- **Posts**: Articles and content published on your Ghost site.
- **Members**: Registered users and subscribers of your site.
- **Newsletters**: Newsletter configuration, not an explicit email-send workflow.
- **Offers**: Promotional offers and discounts for members.
- **Invites**: Invitations for new users or staff to join your Ghost site.
- **Roles**: User roles and permissions within the Ghost admin.
- **Tags**: Organizational tags for posts and content.
- **Tiers**: Subscription tiers and plans for members.
- **Users**: Admin users and staff accounts.
- **Webhooks**: Automated event notifications to external services.

## Available Tools

Below is an inventory of registered tool names, not a full API coverage guarantee. Tiers, offers, invites, and roles are currently unsupported by the SDK adapter. Permissions and Ghost version may restrict other operations too.

### Posts
- **Browse Posts**: List posts with optional filters, pagination, and ordering.
- **Read Post**: Retrieve a post by ID or slug.
- **Add Post**: Create a new post with title, content, and status.
- **Edit Post**: Update an existing post by ID.
- **Delete Post**: Remove a post by ID.

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
- **Browse Offers**: List offers.
- **Read Offer**: Retrieve an offer by ID.
- **Add Offer**: Create a new offer.
- **Edit Offer**: Update offer details.
- **Delete Offer**: Remove an offer.

### Invites
- **Browse Invites**: List invites.
- **Add Invite**: Create a new invite.
- **Delete Invite**: Remove an invite.

### Roles
- **Browse Roles**: List roles.
- **Read Role**: Retrieve a role by ID.

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
- **Edit Tier**: Update tier details.
- **Delete Tier**: Remove a tier.

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

Failed tool calls return MCP errors. Unsupported SDK capabilities report the resource and operation explicitly. Startup failures are reported on stderr without dumping supplied configuration or credentials. There is no custom `GhostError` implementation.

## Development and verification

Node 22 is the tested development/CI baseline. The existing default API version is `v5.0`; this is not a claim of live compatibility with every Ghost version.

```bash
npm ci
npm run typecheck
npm test
```

`npm test` builds the TypeScript code and runs Node's built-in test runner. It exercises the real Ghost SDK with a recording request transport, actual MCP input parsing/discovery over in-memory transports, and executable stdio discovery with dummy credentials and a rejecting loopback fixture. Offline suites block outbound HTTP; no real Ghost key, content mutation, or email send is required. A pure `createServer(client)` factory accepts a typed client without reading environment configuration or connecting stdio. Tests and fixtures are outside the distributed `build/` directory.

CI uses the committed dependency lockfile, Node 22, and read-only permissions; it needs no repository secrets. The workflow uses JSON syntax, which is valid YAML, so its policy can be checked without adding a YAML parser dependency.

The inherited lockfile currently reports npm audit vulnerabilities, including critical advisories. This foundation change does not upgrade dependencies or constitute a release-readiness/security approval. Dependency remediation and release verification are required before adoption; do not publish using the upstream npm identity.

## Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Create pull request

## License

MIT
