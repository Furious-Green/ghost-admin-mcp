# Issue #6, slice 1: strict posts/pages/tags inputs

## Intent and authorization

Make supported content queries and writes usable without silent input loss or
ambiguous requests. The user selected strict validation and approved the
posts/pages/tags boundary. On 2026-10-21 they explicitly requested completion of
the design, implementation plan, implementation and push/PR without another
implementation-plan approval pause. Execute natively with one independent final
review; do not merge, publish, deploy or modify the private HTTP wrapper.

This is the first of two #6 slices. Do not close #6: remaining resources' queries,
selectors and validation require the second slice. Keep all 46 tool names,
`{data, meta?}` outputs, delete confirmations, errors, auth/HTTP policies and
HTML/Lexical conversion behavior. Dependencies and licenses remain unchanged.

## Approach

Use reusable content/query schemas and the existing `registerStrictTool` helper,
not duplicated per-callback validation or a generic HTTP escape hatch. The
alternative of MCP-only validation leaves direct typed-client calls unsafe;
the alternative of global schema replacement expands this slice unnecessarily.
Validate these three resources at both MCP and typed-client boundaries. Nested
references are strict too. Other resources retain current behavior.

One pure preparation function validates input and optional query options,
separates selector/body from query, and encodes SDK path selectors exactly once.
It accepts the existing flat input convention and separate query-options
convention; duplicate query keys across both are errors rather than overrides.
It never mutates caller objects. Reuse the existing page-selector rules for
posts/tags without changing the page helper's legacy error text. Reject empty,
whitespace-only, dot segments, path/query/fragment delimiters, percent escapes,
controls and invalid Unicode; encode spaces/Unicode as one segment.

## Supported input contract

Unknown top-level and nested keys fail before HTTP instead of being stripped.
Read requires exactly one of `id`/`slug`; writes/deletes/copies require ID where
applicable. IDs remain opaque safe segments, not newly restricted to ObjectIds.
Do not trim/coerce input or silently select between competing selectors.

Browse: positive safe-integer `page`; positive safe-integer `limit` or `"all"`
for posts/pages/tags. Ghost's Admin API framework and pagination support all;
this is not a claim about the current Content API's maximum limit. No auto-paging.
`filter`/`order` remain opaque nonblank strings interpreted by Ghost. `fields`
is a nonempty comma-separated list of nonblank field tokens; no client-maintained
field enumeration or NQL/SQL parser. Reject empty list components. Preserve values.

| Resource | Browse | Read | Add/edit | Delete/copy |
| --- | --- | --- | --- | --- |
| Posts/pages | filter, order, page, limit, include, fields, formats | include, fields, formats | include, formats; save_revision boolean on edit only | delete ID only; copy ID/formats |
| Tags | filter, order, page, limit, include, fields | include, fields, filter | include | delete ID only |

`formats` is a comma-separated list of `html`, `lexical`, `plaintext`, `mobiledoc`
in any order, without blanks/unknown tokens. `include` is resource-specific:
posts: tags, authors, authors.roles, email, tiers, newsletter, count.conversions,
count.signups, count.paid_conversions, count.clicks, sentiment,
count.positive_feedback, count.negative_feedback, post_revisions,
post_revisions.author; pages: tags, authors, authors.roles, tiers, count.signups,
count.paid_conversions, post_revisions, post_revisions.author; tags: count.posts.
Do not expose endpoint debug/internal transaction options, force_rerender,
convert_to_lexical or source as MCP inputs. Preserve internal `source: 'html'`
query option and infer it for nonempty HTML exactly as before (HTML takes
precedence over supplied Lexical). `save_revision: false` must survive.

Content writes retain existing fields and add custom_template for posts,
locale, mobiledoc and tiers for both. Pages additionally support
show_title_and_feature_image; posts keep email_only, but email_subject and
delivery controls remain #7. Exclude unsupported/experimental collections,
custom visibility_filter and database-only fields (created_at, type, IDs,
generated html derivatives and audit fields). These exclusions are documented,
not an assertion that Ghost itself lacks them.

Post status: draft/published/scheduled/sent. Page status:
draft/published/scheduled. Both visibility: public/members/paid/tiers; custom NQL
visibility is not supported. Title remains required string on add, optional
string on edit; no whitespace rewriting. Edit requires a valid date-time
updated_at string, not null. published_at accepts date-time or null. Date-times
accept timezone offsets without changing the exact string used for collision
detection. Lexical/mobiledoc strings must contain valid JSON; reject simultaneous
nonempty Lexical and Mobiledoc unless nonempty HTML is used for conversion.

Nullable string fields: html, lexical, mobiledoc, locale, published_at,
custom_excerpt, feature_image/alt/caption, meta_title/description,
og_title/description/image, twitter_title/description/image, codeinjection_head/
foot, canonical_url, custom_template. Null passes through unchanged; it means
request clearing, not guaranteed post-processing state. No null for title,
status, visibility, featured, email_only, show_title_and_feature_image, tags,
authors or tiers. Relation clearing uses [] (server rules still apply, especially
authors). Refs accept nonblank strings or strict objects with at least one
nonblank identifier: tags/tiers id,slug,name; authors id,slug,email. Multiple
identifier fields are allowed for existing returned-reference compatibility.

Tags add requires name, edit requires ID; mutable fields: name, slug,
description, visibility, feature_image, meta_title/description,
og_title/description/image, twitter_title/description/image, codeinjection_head/
foot, canonical_url, accent_color. Nullable strings except name/visibility;
visibility public/internal. Exclude generated parent/url/count/audit fields.
Use baseline schema maximum lengths (feature_image_alt limited further by DB
to 191); do not impose absolute HTTP URL-only rules: Ghost accepts URI references.

## Sources and compatibility

Baseline is Ghost v5.130.0; minimum-version header stays v5.0, which does not
assert that every option exists on all 5.x versions. Checked source, not live API:

- `https://github.com/TryGhost/Ghost/tree/v5.130.0/ghost/core/core/server/api/endpoints`
  posts.js/pages.js/tags.js: per-operation query lists/includes.
- Same tree `utils/serializers/input/{posts,pages,tags}.js`,
  `utils/validators/input/posts.js`, and `models/{post,tag}.js`: HTML conversion,
  relations, supported formats/statuses, visibility, revision option.
- Ghost core package.json pins @tryghost/admin-api-schema 4.5.10 and
  @tryghost/api-framework 1.0.2. Inspected published package schemas
  `lib/schemas/{posts,pages,tags}.json`, posts-add/edit and framework global
  validators: API-accepted write fields/nullability and `limit=all` acceptance.
- @tryghost/bookshelf-plugins 0.6.27 delegates pagination to
  @tryghost/bookshelf-pagination (^0.1.51); inspected 0.1.51 parseOptions/fetchPage
  handling of `limit: 'all'` (fetchAll without a numeric limit).
- `https://docs.ghost.org/admin-api/posts/overview.md`
- `https://docs.ghost.org/admin-api/posts/updating-a-post.md`
- `https://docs.ghost.org/content-api/parameters.md` (general query semantics,
  not a substitute for Admin operation-specific allowlists).

## Errors, tests and migration

Strict MCP argument errors stay protocol validation errors; cross-field/runtime
errors use existing tool error signaling and issue no HTTP. Do not echo complete
payloads/secrets in new custom errors. Ghost permission/version/collision errors
and no-retry behavior remain unchanged. No inferred successful writes.

Test-first: actual MCP parsing/SDK recording transport for accepted query/body
separation and rejected unknown/wrong-operation/nested keys, selectors, integers,
enums, nulls and date-times. Direct typed-client bypass tests cover validation,
caller immutability, duplicate options and selector encoding. Include false,
empty relation arrays, nullable clears, HTML/Lexical and Mobiledoc precedence.
Update old tests that deliberately expected stripping, not request/auth tests.
Verify exact 46-name inventory, response envelopes and unchanged non-slice
resources; real loopback HTTP verifies encoded selectors/revision query/body.
Clean npm ci, typecheck, full tests and diff check; one independent review.

README must identify breaking validation behavior, exact scope, options/nullable
examples, query separation, limits and excluded fields. PR references #6 but
does not close it. Nine inherited dependency advisories remain release/adoption
blockers; no live email/Stripe/Ghost actions or dependency changes.
