# Issue #7: explicit newsletter delivery and administration

## Approved intent

Expose the documented Ghost newsletter send/schedule and subscriber opt-in
controls explicitly, without inferring recipients, sending during tests or
claiming delivery from a successful write. The user approved this approach and
continuous spec/plan/native implementation/one independent review/push+PR with
no further approval pauses. Base merged #18 is 53ba1b5. No merge/deployment,
publication, private-wrapper changes, real subscriber/verification emails or
live Ghost/Stripe actions. Nine inherited advisories remain release/adoption
blockers; no dependency/lock/license/badge/settings/transport policy changes.

Extend existing strict schemas/request preparation, not a new send tool, generic
HTTP proxy, recipient lookup, or implicit default newsletter. Keep existing
`{data, meta?}` envelopes and conflict/no-retry policies. Remove the known
unsupported newsletters_delete tool/client operation explicitly: inventory falls
from 46 to **45**, with seven unchanged delete confirmations, no alias or silent
archival. Users may explicitly edit newsletter status to archived instead.

## Post delivery contract

- `posts_edit` only: query `newsletter` (safe nonblank slug <=191) and optional
  `email_segment` (nonblank member NQL or literal all). Neither is a write-body
  field, nor available on add/read/browse/copy/delete/pages. Flat SDK input and
  separate query options continue to work; duplicates/unknowns fail.
- A supplied segment requires newsletter. A supplied newsletter requires explicit
  status published or scheduled. Scheduled delivery requires explicit non-null
  valid `published_at`; Ghost validates future timing/timezone/state semantics.
  No date or status inferred, no automatic read/change/retry loop.
- Explicit email_only=true plus publishing/scheduling requires newsletter. This
  applies to add too: since add cannot route delivery, first add a draft then
  edit with current updated_at, newsletter and publish/schedule intent. Draft
  email-only configuration remains valid. Normal web-only publishing unaffected.
- Add nullable `email_subject` <=300 to post add/edit body (not pages); setting
  subject or email_only alone is configuration, not a send request.
- Common pure `validatePostDeliveryInput(record)` runs before an injected MCP
  client and in direct SDK preparation after flat/separate query merging. It
  does not encode a slug used as query data; query serializer handles it.
- Current exact updated_at string remains mandatory, including valid offsets;
  retain source=html precedence, revision/options/body split and all other fields.

Ghost is authoritative for active newsletter existence, permissions, NQL validity,
prior post/email status, scheduling, and returned send state. The model only maps
newsletter/segment for qualifying transitions with no existing newsletter_id;
supplying options is not proof of changed recipients or new mail. Omitted segment
is forwarded as omitted (Ghost's documented default is all). Never automatically
select all/newsletter/retry a failed email or revert/re-publish. Persisted state
can cause email on a later publish even without new newsletter options; read
first and inspect newsletter/email relationships. No local promise of no email
just because a parameter was omitted. Result status sent/email status failed or
pending is returned verbatim, not synthesized as success.

## Newsletter administration

Creation-only boolean query `opt_in_existing`, optional and never defaulted. False
must survive. True subscribes existing members who already subscribe to at least
one active newsletter; it is not a one-off content send or arbitrary bulk-member
import. Reject on edit/read/browse; omit it from body even for direct SDK callers.

Complete the documented field set on create/edit: retain name, description,
sender_reply_to, active/archived status, subscribe_on_signup, header booleans,
font categories/alignment, feature-image flag, show_badge; allow slug, sender_name,
sender_email, header_image and footer_content on both. Keep sort_order edit-only:
baseline creation overwrites it. Slug is nonblank <=191 write string (server
generates/normalizes); name nonblank <=191. Sender_name nullable <=191; sender_email
valid email/empty string/null <=191 as before; description nullable <=2000,
header_image nullable <=2000, footer_content nullable string. Existing enum/null
rules and include options unchanged. Do not expose generated UUID/audit fields,
read-only/default visibility, lab flags or every database styling column as a
claim of documented coverage. No standalone verification-link/token tool.

Verification emails may be triggered by creation/editing sender settings.
Preserve returned entity and generic meta including sent_email_verification,
email_verified or opted_in_member_count (even zero), combined/unknown/nested
metadata. Pending verification is not a changed active address; do not replace
returned state with requested sender. No meta fabrication if absent.

## Discovery, errors, migration

Descriptions explicitly identify posts_edit as capable of real subscriber email,
newsletter add as capable of subscribing existing members and sending sender
verification, edit as capable of sender verification/configuration effects, and
posts_add as the draft-first route for delivery. MCP SDK pinned here exposes no
annotations property/API; do not upgrade dependencies or override discovery
handlers just to simulate annotations. Clear descriptions satisfy this SDK's
supported mechanism; tests assert user-visible discovery text.

Remove newsletters_delete from tool and typed/direct client APIs, fixtures and
current README inventory, without changing historical docs. Calls to the old
tool fail as unknown tool with zero HTTP; no success text or archive mutation.
No replacement name. Other tools' errors and output unchanged. New cross-field
errors use brief instructions without echoing segment/payload/secrets. Strict
schema errors continue existing protocol signaling. Permission/conflict/service
errors propagate unchanged and are never retried or converted to delivered.

## Source evidence and compatibility

Public docs (read as .md):
- https://docs.ghost.org/admin-api/posts/sending-a-post
- https://docs.ghost.org/admin-api/posts/email-only-posts
- https://docs.ghost.org/admin-api/newsletters/overview
- https://docs.ghost.org/admin-api/newsletters/creating-a-newsletter
- https://docs.ghost.org/admin-api/newsletters/updating-a-newsletter
- https://docs.ghost.org/admin-api/newsletters/sender-email-validation

Baseline source Ghost v5.130.0, ghost/core/core/server:
api/endpoints/posts.js (edit-only newsletter/email_segment), newsletters.js
(creation opt_in_existing, no destroy); models/post.js lines 756-800 (active
newsletter/state transition, default segment, email-only -> sent), services/posts/
PostsService.js editPost (NQL check and email creation/retry on server side);
services/newsletters/NewslettersService.js (field writes, overridden sort order,
opt-in transaction, email verification); models/newsletter.js and data/schema/
schema.js confirm existing write semantics/nullability. Pinned API schema 4.5.10
posts email_subject string/null max300. Header remains minimum v5.0, not a promise
all 5.x versions support every field; source evidence is not live compatibility.

## Verification and acceptance

Test-first actual MCP + SDK recording transport: publish/schedule/email-only
cases, explicit opt-in true/false/omitted, documented fields/nulls, slug/segment
encoding, HTML/revision/query-body split, direct and injected-client bypass
rejection, immutability, pending/zero/combined/absent metadata. Error fixtures for
403/409/service failure each dispatch once and never retry; successful returned
failed-email status remains failed. All network blocked except allowlisted
loopback HTTP fixtures, no real delivery SDK/service. Loopback verifies literal
paths/query/body/headers and conflict propagation. Stdio discovery exact45 strict
tools with side-effect descriptions, old name unknown/no HTTP. Type/import
contracts, response regressions; clean npm ci/typecheck/full suite/diff check.
One independent read-only whole-branch review, fix blocking findings test-first,
then authorized push/PR with Closes #7 only if all criteria met. README includes
draft-read-edit publish/schedule examples, all-vs-segment/active-state caveats,
opt-in and verification semantics, removed-name migration, no auto retry or live
compatibility claims. Private adoption and dependency remediation remain separate.
