# Issue #6 slice 2: remaining-resource validation

## Intent and approval

Complete the supported query/input contract after posts/pages/tags (#17), so
callers cannot silently lose options or bypass validation through the typed
client. The user approved this approach and requested continuous native execution
through written spec/plan, implementation, one independent whole-branch review,
push and PR. No further approval checkpoints, merge, release, deployment or
private-wrapper changes. Base is merged #17, aa85b40.

Keep all 46 names, `{data, meta?}` envelopes, delete text, executable/settings,
MIT/badges, dependencies and transport/auth/retry policies. Strict input validation
does not prove a server supports an operation: newsletters_delete remains an
existing baseline-unsupported tool pending the #7 capability decision.

## Approach

Use existing registerStrictTool and reusable Zod raw-shape maps for members,
users, newsletters and webhooks. Share these maps with a pure account request
preparer in the SDK adapter, validating both MCP and direct calls. Do not replace
content preparation or change response capture. Tools validate cross-field rules
before invoking injected clients and split query from body; SDK direct calls use
the same validation and splitting. No generic arbitrary HTTP/URL escape hatch.

MCP-only strictness leaves direct calls exposed; global universal query shapes
would advertise unsupported options. Both alternatives are rejected. Native
commerce/staff already validate strictly: audit their types/paging/enums and
reject malformed separate options rather than introducing a new native calling
convention (native query keys remain flat).

## Exact query/selector matrix

| Resource | Browse | Read | Add/edit | Delete |
| --- | --- | --- | --- | --- |
| Members | filter, order, page, limit, fields, search, include | include; exactly one id/email | existing body fields only | id only |
| Users | filter, order, page, limit, fields, include | include, fields, filter; exactly one id/slug/email | edit include | id only |
| Newsletters | filter, order, page, limit, fields, include | include, fields; exactly one id/slug | include | id only (capability unverified/unsupported at baseline) |
| Webhooks | no browse | no read | body only | id only |
| Tiers | filter, order, page, limit, fields | id only | existing body fields | none |
| Offers | filter only | id only | existing body fields | none |
| Invites | filter, order, page, limit, fields | none | role_id/email | id only |
| Roles | permissions=assign only | none | none | none |

Includes: members email_recipients/products/tiers; users count.posts/permissions/
roles/roles.permissions; newsletters count.posts/count.members/count.active_members.
Reject unknown/blank CSV components. Fields stay server-authoritative token lists;
filter/order/search nonblank, no NQL implementation. No formats on these resources.
No debug, forUpdate, transacting or other internal controls. Existing tier include
is removed: baseline endpoints do not accept it (not the Content API include list).

Page/numeric limit: positive safe integers, no coercion. `limit:"all"` is accepted
on members/users/newsletters/invites/tiers and existing content browse, not offers/
roles. Ghost's generic framework and Bookshelf pagination handle all; tier browse
at this baseline returns its whole filtered in-memory repository with synthetic
one-page metadata regardless of paging/field/order controls accepted by the
endpoint. Forward supported endpoint options but document this server limitation;
do not invent client-side paging/projection.

ID/slug safe-segment rules reuse content's selector validation/encoding; IDs stay
opaque (including `me`), no new ObjectId requirement. Email selectors are valid
nonblank emails <=191 and encoded exactly once (including + and %), not rewritten
or lowercased. Reads reject absent or multiple selectors. Write email/slug values
are body text, not path-encoded. Invalid Unicode/controls cannot create paths.
Flat and separate SDK query options are supported; duplicate keys error. Null/
arrays/primitives as options fail, not silently act like {}. No caller mutation.

## Existing write-field validation

Do not expand account management, billing or newsletter-send capabilities. Retain
current write fields, except add webhook edit secret (explicit endpoint body
field) and align existing validation. Unknown fields fail, not disappear.

- Members: email required on add, optional edit, valid <=191; name <=191 and
  note <=2000 strings (no null, matching pinned API write schema). Labels strict
  objects require name <=191 and optional nullable slug <=191; newsletters strict
  objects require safe nonblank id <=24. Array replacement/[] retained. No new
  subscribed/comped/Stripe/subscription/product/tier/bulk controls.
- Users edit: nonblank name <=191, valid email <=191, slug string <=191; nullable
  bio <=250, website <=2000, location <=150, facebook/twitter <=2000. Existing
  nonblank/empty strings retain Ghost semantics; do not enforce absolute URLs on
  these legacy profile fields. No new role/status/password/session controls.
- Newsletters: name nonblank <=191; description nullable <=2000; sender_reply_to
  newsletter/support/valid email <=191, not null; status active/archived; existing
  boolean fields strictly boolean; font categories serif/sans_serif; alignment
  left/center. Edit additionally sender_name nullable <=191, sender_email valid
  email/empty string/null <=191, sort_order nonnegative safe integer, header_image
  nullable <=2000, footer_content nullable string. Preserve existing add/edit
  field asymmetry, no new configuration surface. Verification side effects for
  existing sender fields remain Ghost-authoritative; never infer active sender
  from pending metadata. Newsletter model/service accepts these existing fields
  directly; DB constraints confirm null/enum/length rules, not standalone proof
  of writability.
- Webhooks: lowercase nonblank event <=50 (event registry server-authoritative),
  absolute HTTP(S) target_url <=2000; nullable name/secret <=191; nonblank
  api_version <=50, optional integration_id safe <=24 on add only. No event enum
  invented from a partial documentation list; never log/echo whole payloads.
- Native tiers: nonblank name <=191; description nullable <=191,
  welcome_page_url nullable <=2000; visibility public/none; prices nonnegative
  safe integers, currency nonblank, benefits string array (no null array). Price/
  currency null clearing deliberately not exposed: domain requires values and
  baseline edit uses fallback semantics. Keep existing active boolean.
- Native offers: cadence month/year; duration once/repeating/forever/trial; type
  percent/fixed/trial; amount nonnegative safe integer and percent <=100; duration
  months positive safe integer. Retain fixed currency/repeating duration
  requirements; no new offer/billing operations. Status active/archived unchanged.

## Sources and compatibility

Baseline remains **Ghost v5.130.0**, minimum header v5.0 (not an all-5.x guarantee).
Inspected github.com/TryGhost/Ghost/tree/v5.130.0/ghost/core/core/server:
api/endpoints/{members,users,newsletters,webhooks,tiers,offers,invites,roles}.js;
utils/serializers/input/{members,users,tiers,webhooks}.js and validators;
services/newsletters/NewslettersService.js, models/{newsletter,webhook}.js,
data/schema/schema.js, services/tiers/{TiersAPI,TierRepository,Tier}.js;
services/offers/domain/models/{OfferCadence,OfferDuration,OfferType,OfferAmount}.js.
Pinned @tryghost/admin-api-schema 4.5.10 schemas members/users/webhooks/tiers;
api-framework 1.0.2 operation configuration/option filtering and pagination checks;
bookshelf-pagination 0.1.51 all handling. No live Ghost tests or mutations.

## Errors and verification

Protocol schema errors and existing tool error signaling remain; malformed
cross-field input fails before HTTP, including injected-client MCP tests. Error
messages identify invalid resource/operation rather than echo full account or
webhook secrets. Do not wrap Ghost transport errors differently.

TDD: real MCP and recording transport tests for accepted matrix/query-body split,
unknown top-level/nested keys, selector ambiguity/unsafe paths, +/% email encoding,
null/false/[] values, enums/limits, duplicate/malformed options, and copy/content
regression. Native audit tests cover removed includes, safe integers/enums and
malformed options. Loopback HTTP pins wire paths/body/query and unchanged
headers/response envelopes; stdio discovers all 46 strict schemas. Update old
stripping tests only for intentional contract changes. Type contracts/import safety.
Clean npm ci/typecheck/full tests/diff check; one independent final review.

README query matrix, null migration and tier/include/version caveats. Close #6
only after explicit acceptance checklist confirms slices 1+2 meet it. Document
#7 exclusions: send_email/email_type, cancellation, opt_in_existing and newsletter
delete capability decision. Nine inherited advisories remain release/adoption
blockers; no dependencies or private consumer changes.
