# Pages CRUD and native content copying

Date: 2026-10-20
Issue: https://github.com/Furious-Green/ghost-admin-mcp/issues/4
Status: Approach 1 selected by the user; written specification awaiting review.

## Intent and success criteria

Let MCP clients manage Ghost static pages and duplicate posts/pages using Ghost's
native copy behavior. Add seven tools without breaking the existing 42 tools,
changing downstream deployments, or rewriting the SDK integration. Success means
documented request contracts and real MCP parsing/discovery tests cover the new
operations without production credentials or live mutations.

The user selected SDK-backed pages CRUD plus a focused authenticated HTTP adapter
for copying. The branch also contains separately approved README status badges
and MIT metadata alignment; retain those changes in this PR.

## Evidence and compatibility baseline

The existing SDK 1.13.13 includes pages browse/read/add/edit/delete but no copy
methods. Ghost's current public documentation lists native copy for posts/pages.
Pinned Ghost 5.130.0 source independently establishes both routes, supported query
options, permissions, and native copying behavior:

- https://docs.ghost.org/admin-api/pages/overview
- https://docs.ghost.org/admin-api
- https://raw.githubusercontent.com/TryGhost/Ghost/v5.130.0/ghost/core/core/server/web/api/endpoints/admin/routes.js
- https://raw.githubusercontent.com/TryGhost/Ghost/v5.130.0/ghost/core/core/server/api/endpoints/pages.js
- https://raw.githubusercontent.com/TryGhost/Ghost/v5.130.0/ghost/core/core/server/api/endpoints/posts.js
- https://raw.githubusercontent.com/TryGhost/Ghost/v5.130.0/ghost/core/core/server/services/posts/PostsService.js

Both copy controllers accept ID and optional formats, return HTTP 201, and use add
permissions (pages uses the posts permission namespace). Neither consumes content
data. The service creates a draft with a new ID and a title suffixed with
` (Copy)`, copying Ghost's selected content, relationships, and metadata. Do not
promise an exact field-for-field clone or emulate these server-side decisions.

Keep the existing default `Accept-Version: v5.0`. This is a minimum API-version
header, not a claim that every Ghost 5 minor has been verified. Source verification
targets 5.130.0; live server compatibility remains unverified. A server rejecting
copy must produce an error, never a fallback read/create operation.

## Public tools and schemas

All seven tools return existing-style JSON text for entity results; page deletion
returns `Page with id <id> deleted.` Only report deletion after a successful call.

### Pages

- `pages_browse`: optional filter/order/include/fields/formats strings; positive
  integer page; positive integer or literal `all` limit. Include and fields are
  comma-separated strings; formats accepts html/lexical and their comma-separated
  combination, not arbitrary formats.
- `pages_read`: exactly one nonempty id or slug, plus optional include, fields,
  and formats. Reject missing or simultaneous selectors before a request. This
  tightens only the new page tool, not existing posts_read behavior.
- `pages_add`: required title and optional shared content fields, plus include
  and formats query options. Use HTML source conversion when nonempty HTML is
  supplied, matching the existing post workflow. Lexical-only writes do not set
  HTML source. If both are supplied, retain the existing HTML-source precedence.
- `pages_edit`: required nonempty id and updated_at; optional title/content fields,
  include and formats. Forward the supplied timestamp unchanged; no automatic
  timestamp fetching, conflict retry, or overwrite behavior.
- `pages_delete`: required nonempty id, without bulk deletion.

Extract the existing shared content fields and relationship schemas into a
focused content schema module. Preserve every existing post schema and its
successful parsing/forwarding behavior. Pages share HTML/Lexical, slug, status,
visibility, featured, published_at, excerpt, images, SEO/social metadata, code
injection, canonical URL, tags, and authors. Do not expose the post-specific
email_only field on pages. Add custom_template for pages only; expanding existing
post input fields remains issue #6. Do not introduce newsletter/send options.

Separate page query options from selectors and write payloads before invoking
the client. Include/formats must never appear inside the pages entity body.
Do not expose internal Ghost controller options such as transacting or forUpdate.

### Copy

- `posts_copy`: required nonempty id and optional formats.
- `pages_copy`: required nonempty id and optional formats.

Both tools are explicit mutating operations. They accept no title/status override,
slug selector, updated_at, content payload, newsletter, or send option. A caller
can edit the returned draft in a separate explicit operation.

## Client and transport design

Extend GhostClient with typed page methods and a typed copy operation on posts
and pages. Keep CRUD dispatch through the real SDK and its existing result
handling. Only copy bypasses the SDK. Preserve all other resource behavior,
including explicit unsupported-capability errors for issue #3 resources.

Create a focused native-copy adapter. It shares the existing injectable
RequestExecutor contract: an executor receives URL/method/data/params/headers and
returns the decoded response body, not an Axios response wrapper. Pass the same
optional executor to both the SDK and native copy so existing recording tests
observe the complete request path. When no executor is supplied, use the existing
direct Axios dependency; no new dependency or SDK-private import is needed.

Copy requests are POST `/ghost/api/admin/posts/<id>/copy/` or
`/ghost/api/admin/pages/<id>/copy/`, with no request body. Forward only formats as
a query parameter. Preserve a configured site subdirectory before `/ghost/`.
Validate identifiers as single path segments and encode them; reject empty,
dot/dot-dot, slash/backslash, query/fragment, and control-character values before
any request. Callers cannot supply a resource name, endpoint, or absolute URL.

Use Node crypto to generate a fresh HS256 JWT per native request from the configured
24-hex ID / 64-hex secret key. Header: alg HS256, typ JWT, kid key ID. Claims: iat
in epoch seconds, exp at most five minutes later, aud `/admin/`. Send Authorization
`Ghost <token>` and Accept-Version from the configured version (normalize a v5-like
major alias consistently with the SDK). Native copy supports numeric v5-or-newer
versions; reject older/non-numeric aliases for this operation without affecting
existing SDK operations. No credentials or tokens are returned or logged.

Validate the configured native-copy URL as HTTP(S), without embedded credentials,
query, or fragment. Match the SDK's no-trailing-slash configuration rule. Native
HTTP requests disable redirects, use a finite 30-second timeout, and never retry.
Do not forward authorization to redirect targets. Production URL validation and
transport behavior must be tested, not only recording injection.

Require copy responses to contain the corresponding resource array with exactly
one entity object. Return that object, retaining unknown fields. Missing, empty,
multiple, or malformed entities are errors rather than successful null results.

## Errors and security

Existing SDK CRUD error handling is retained. Native-copy errors must be fresh
safe Error objects, never raw Axios errors. Preserve safe status and Ghost error
type where available, but do not copy arbitrary response properties, request
headers/config, bodies, URLs, or stack traces into MCP results. Use bounded,
generic operation/status diagnostics rather than reflecting untrusted response
messages that could echo credentials. Network/timeout failures receive generic
messages. Permission, not-found, conflict, redirect, and unsupported-server errors
remain failures; a mutation is attempted at most once.

## Output compatibility and deferred issues

Keep existing post tool names, schemas, results, CLI identity, and executable path.
Discovery becomes 49 tools. Retain existing resource/prompt registrations. Pages
browse initially follows existing array JSON serialization, including its known
metadata limitation; document that pages are also affected by issue #5 rather
than introducing a one-off pagination result format. No fixes for #3, #5, #6,
#7, or #11 are claimed by this issue.

No dependency upgrades, npm publication, internal wrapper changes, deployment,
production API calls, or email sends. The inherited dependency vulnerabilities
remain a release/adoption blocker.

## Verification and review focus

- Real SDK page contracts cover methods, ID/slug selection, exact resource paths,
  query/body separation, HTML source, Lexical, metadata, and collision timestamps.
- Native copy contracts cover both routes, no body, formats, response unwrapping,
  per-call JWT claims and signature (independently verified with crypto), version
  headers, subdirectory URLs, and malicious identifiers/configuration.
- Exercise the actual default copy HTTP transport against a rejecting/local
  loopback fixture, including redirect refusal, timeout configuration, and safe
  errors. All other tests deny network. Never contact an external Ghost instance.
- Real MCP tests discover all 49 exact names; exercise new schemas, invalid inputs,
  supported writes, safe permission failures, and zero-request rejection cases.
- Retain all foundation characterizations, import safety, stdio lifecycle, and CI
  policy checks. Update inventory assumptions without weakening old assertions.
- Test post-schema parity after extraction and page-specific email exclusion and
  custom_template support. Use fresh objects because SDK methods mutate inputs.
- Verify credentials do not leak through injected executor failures, non-JSON
  responses, redirect errors, or HTTP error bodies. Verify no mutation retries.
- Run clean npm ci, typecheck, complete test suite, and diff checks; observe hosted
  CI after any separately authorized push. Independent review precedes merge.

## Design preparation checklist

- [x] Inspect issue, current client/tools, SDK capabilities, and official sources.
- [x] Present alternatives; user selected SDK CRUD plus native-copy adapter.
- [x] Write specification and self-review scope, contracts, safety, and ambiguity.
- [ ] User reviews this written specification.
- [ ] Write implementation plan after specification approval.
- [ ] User reviews plan and chooses execution method before implementation.
