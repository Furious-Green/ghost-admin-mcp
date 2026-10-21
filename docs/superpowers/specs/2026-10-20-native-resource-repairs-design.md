# Native adapters for tiers, offers, invites, and roles

Date: 2026-10-20
Issue: https://github.com/Furious-Green/ghost-admin-mcp/issues/3
Status: Design accepted on 2026-10-20.

## Intent

Repair the existing tools that call SDK resources which do not exist. Provide real,
typed requests for supported Ghost operations, and stop advertising operations
without matching routes. Help users migrating from the original implementation
understand the deliberate compatibility changes through a README migration note.

We remove tiers_delete, offers_delete, and roles_read rather than
retaining error-only compatibility stubs. Implement the other twelve operations
using native adapters, reusing the authentication and HTTP safeguards introduced
for post/page copy. No SDK-wide rewrite or dependency upgrade is needed.

## Evidence and reference version

Keep the default minimum-version header v5.0. Verify contracts against Ghost
5.130.0 source and current public documentation, not an assumption that all Ghost
5 releases behave identically. No live Ghost compatibility is established here.

Documentation:

- https://docs.ghost.org/admin-api
- https://docs.ghost.org/admin-api/tiers/overview
- https://docs.ghost.org/admin-api/tiers/updating-a-tier
- https://docs.ghost.org/admin-api/offers/creating-an-offer
- https://docs.ghost.org/admin-api/offers/updating-an-offer

Pinned source under https://github.com/TryGhost/Ghost/tree/v5.130.0:

- ghost/core/core/server/web/api/endpoints/admin/routes.js
- ghost/core/core/server/api/endpoints/{tiers,offers,invites,roles}.js
- ghost/core/core/server/api/endpoints/utils/serializers/input/tiers.js
- ghost/core/core/server/api/endpoints/utils/serializers/output/{tiers,roles}.js
- ghost/core/core/server/services/tiers/TiersAPI.js
- ghost/core/core/server/services/offers/application/{OffersAPI,OfferMapper}.js
- ghost/core/core/server/services/offers/domain/models/OfferStatus.js
- ghost/core/core/server/services/invites/{index,Invites}.js

The reference offers update service accepts status active/archived, although the
public update page only lists name/code/display_title/display_description. Label
offer archival as source-verified behavior for the reference version, not an
unqualified documented guarantee. Tier archival through active:false is documented
and its serializer maps active to the internal archived status.

The reference tiers browse service synthesizes pagination metadata; forwarding
documented pagination options must not be described as proof of working page
boundaries on every server version. Offers accepts filter but has no paginated
browse contract in the reference controller. Roles is an unpaginated collection.

## Supported operation matrix

All paths below are relative to the configured site's /ghost/api/admin/ prefix.
Preserve a configured subdirectory, such as /blog/ghost/api/admin/.

| Resource | Tool operation | HTTP contract |
| --- | --- | --- |
| tiers | browse | GET tiers/ |
| tiers | read | GET tiers/{id}/ |
| tiers | add | POST tiers/ with {tiers:[entity]} |
| tiers | edit | PUT tiers/{id}/ with {tiers:[fields]} |
| offers | browse | GET offers/ |
| offers | read | GET offers/{id}/ |
| offers | add | POST offers/ with {offers:[entity]} |
| offers | edit | PUT offers/{id}/ with {offers:[fields]} |
| invites | browse | GET invites/ |
| invites | add | POST invites/ with {invites:[{role_id,email}]} |
| invites | delete | DELETE invites/{id}/ with no body |
| roles | browse | GET roles/ |

Remove tiers_delete, offers_delete, and roles_read from registration, tool schemas,
typed client interfaces, fixtures, and advertised README inventory. Do not retain
hidden adapters or translate deletions to archival implicitly. MCP discovery
becomes 46 tools (49 minus three); all other existing tool names remain.

No new invites_read, archive aliases, role lookup emulation, or bulk operations.
Invites_add sends real staff invitation email when used against Ghost. Describe
this mutation explicitly; tests never send email or call a real Ghost server.

## Schemas and compatibility decisions

Read operations use a required nonempty ID only. Reject deprecated tier slug and
offer code selectors even when an ID is also supplied, with actionable validation
messages and zero requests. Do not invent /tiers/slug or /offers/code routes, or
silently scan collections. Users can browse/filter, inspect the returned records,
and pass an ID. Roles must be selected from roles_browse by the caller.

Validate all native path IDs as single segments before constructing URLs: reject
empty/whitespace-only, dot/dot-dot, separators, percent escapes, query/fragment
delimiters, controls, and invalid Unicode. Encode allowed values exactly once.
Enforce at both MCP inputs and the typed-client runtime boundary; avoid repeating
the page-selector traversal defect fixed in issue #4.

### Tiers

- Browse: filter, positive integer-or-all limit, positive integer page, order,
  fields, and include. Read: ID plus include. Include values are comma-separated
  monthly_price, yearly_price, benefits, or their combinations per public docs.
- Add: required nonempty name; existing description, welcome_page_url, visibility,
  monthly_price, yearly_price, currency, and string-array benefits. Create is a
  paid tier; do not expose unsupported free-tier creation or suggest active:false
  affects add (the reference creates active tiers).
- Edit: required ID, optional nonempty name and the existing editable fields;
  add active:boolean for explicit archival/reactivation. Reference source permits
  partial edits, even though the documentation labels name required. Document
  partial active-only edit as verified against the reference implementation.
- Prices are integer nonnegative minor-unit amounts, not formatted currency.
  Keep domain/Stripe rules server-authoritative; do not prefetch tiers or retry
  pricing operations. Do not claim to repair server-side zero-price behavior.
- Keep include/query values outside the resource body and ID outside edit body.

### Offers

- Browse: filter only. Reject legacy page/limit/order options rather than
  pretending a nonpaginated collection is paginated.
- Read: required ID, with explicit rejection of the old code selector.
- Add retains the public tier_id input for migration compatibility, translating
  it to tier:{id} in the resource body. Never forward tier_id to Ghost. Do not
  simultaneously introduce a second tier input format.
- Preserve required name/code/cadence/duration/amount/type and existing optional
  display_title/display_description/duration_in_months/currency fields. Require
  nonempty identifiers/name/code and finite integer numeric amounts/durations;
  server remains authoritative for discount/cadence/duration combinations.
- Fixed offers require currency. Repeating offers require positive integer
  duration_in_months. Validate these dependencies before HTTP, without claiming
  that a local currency string check verifies the selected tier's actual currency.
- Edit: ID plus name/code/display_title/display_description and new optional
  status enum active|archived. Discount amount, tier, cadence, and duration are
  not editable; reject attempts rather than silently sending unsupported changes.
- Offer archival is an explicit edit, never reported as deletion.

### Invites and roles

- Invites browse: filter, positive integer-or-all limit, positive integer page,
  order, and fields. Add: required safe nonempty role_id and syntactically valid
  email. Delete: safe required ID. No read tool is added in this repair.
- Roles browse: optional permissions with the single supported value assign.
  Reject legacy filter/page/limit/order options; no fabricated role-by-ID/name
  endpoint and no pagination emulation.
- Explain that invites and roles are staff-management endpoints requiring a
  staff access token with sufficient role permissions, not the fixed Custom
  Integration permission set. Both use the existing GHOST_ADMIN_API_KEY format;
  never infer credential class from the key string, store a second credential,
  auto-escalate, or retry with another auth method. Let Ghost enforce permissions
  and return safe failure guidance when access is denied.

## Adapter structure and response behavior

Keep SDK-backed posts/pages and all other existing resources untouched. Extract
reusable signing, URL/version/key validation, and error sanitization from the
native-copy implementation into a focused native admin request layer. Both copy
and repaired resource adapters must use it; do not duplicate token generation.

The shared layer receives fixed resource/operation descriptions from application
code, never caller-supplied URLs or unrestricted endpoint strings. Supported
resource/operation pairs form an explicit allowlist. Use the same injectable
RequestExecutor as SDK and copy: requests expose URL/method/data/params/headers;
responses are decoded bodies. The existing default Axios executor retains a
30-second timeout, zero redirects, proxy:false, and no retry behavior.

Per request: create HS256 JWT using a strictly validated 24-hex ID and 64-hex
secret, kid/iat/exp and aud /admin/, exp=iat+300. Preserve Accept-Version behavior
for numeric v5-or-newer aliases and Accept:application/json. JSON writes also send
Content-Type:application/json. Native URL validation must not accept embedded
credentials, query, fragment, or a trailing slash. No import-time HTTP or env reads.

Use safe generic operation/status errors without reflecting server error messages,
emails, tokens, config, request/response objects, or URLs. Allow only known error
types and numeric status. Permission failures can explain that the operation may
require a staff token, but do not assert which credential type the caller used.
Preserve existing native-copy public error strings and response contracts during
extraction. No automatic retries, including token-refresh or permission retries.

Read/add/edit require the matching resource array containing exactly one entity
object. Browse requires an array of entity objects and always returns an array,
even for zero/one items. Retain optional record-shaped metadata at the typed
boundary; MCP browse JSON still drops attached array metadata under issue #5.
Do not introduce a one-off pagination envelope in this repair. Do not accept a
wrong-resource, missing, primitive, or malformed body as a successful result.

Invite delete returns undefined after a successful response; HTTP errors remain
errors. Its existing `Invite with id <id> deleted.` confirmation remains unchanged.
Other existing tool success responses remain JSON-formatted text. Never return a
deletion confirmation for an archival edit or an unsuccessful mutation.

## README migration section

Add a visible `Migrating from the original implementation` section explaining:

1. The original package advertised resources missing from its SDK; these tools
   failed before HTTP. This fork now implements the twelve supported operations.
2. Removed tools and replacements:
   - tiers_delete -> tiers_edit with id and active:false.
   - offers_delete -> offers_edit with id and status:archived (source-verified
     reference behavior; public update docs omit status).
   - roles_read -> roles_browse, then caller selection by ID/name.
3. Refresh MCP tool discovery/configuration after upgrading. Removed tools return
   unknown-tool errors; they do not retain aliases or silently archive resources.
4. Tier-slug and offer-code reads now require an ID; browse first. Explain the
   removed unsupported offer/role query options and current supported queries.
5. tier_id remains the creation input but is translated to tier:{id}. Document
   explicit archival versus deletion and staff-key permissions/invitation email.
6. Only these listed operations change; SDK CRUD for other resources, pages/copy,
   executable/config variable names, badges, and MIT licensing remain intact.

Remove stale claims that all tiers/offers/invites/roles tools are unsupported and
update the exact tool inventory to 46. Keep issue #5/#6/#7/#11 and inherited audit
limitations, version caveats, and private-deployment separation visible.

## Verification and non-goals

Offline recording tests cover every resource/operation, literal routes, verbs,
query/body separation, ID encoding/rejection, nested offer tier, archival bodies,
JWT signature/claims, version/auth/content headers, response shapes, and zero
requests on invalid/removed operations. Unknown query or unsupported selector
inputs must fail explicitly, not be silently discarded by default Zod stripping.

Real MCP discovery tests assert exactly 46 names and all three removals. Dispatch
tests exercise all twelve repaired operations, invalid inputs, safe 403/404/409/
validation errors, and one-attempt mutation failures. Keep all unrelated SDK,
pages/copy, schema, import, stdio lifecycle, and CI contracts. Replace obsolete
unsupported-capability characterizations only for the repaired/removed methods.

Use loopback-only HTTP fixtures to verify real JSON serialization, empty delete
body/204 response, redirect refusal, timeout/no retry, and safe errors. No real
Stripe changes, staff invitations, Ghost calls, or secrets. Existing shared
transport and copy regression tests must survive extraction unchanged.

Run npm ci, typecheck, full tests, and diff check. Preserve dependency versions and
obtain independent branch review. Hosted CI is checked only after an explicitly
authorized push. No publication, deploy, internal wrapper adoption, or fixes to
unrelated issues in this slice; inherited dependency advisories still block
release/adoption approval.

## Design preparation checklist

- [x] Inspect current handlers, merged foundation, issue, docs, and pinned source.
- [x] Approve twelve native operations, removal of three stubs, and README migration note.
- [x] Write specification; self-review scope, contracts, safety, and source/doc differences.
- [x] Review the written specification.
- [x] Write implementation plan after specification approval.
- [x] Review the implementation plan before implementation and independent final review.
