# Issue #8: member labels and site information

## Approved intent and boundaries

Add five standalone label tools and one public site-read tool to the public
single-site server. User approved the approach and continuous spec/plan/native
TDD/one independent review/push+PR without further pauses. Base: merged #19,
7a6cad2. Preserve executable/configuration, MIT/badges, strict unknown-input
rejection, existing member relationships and `{data, meta?}` output contract.
No private adoption, merge, deployment, publication, live Ghost/email/Stripe
actions or dependency changes. Nine inherited advisories remain adoption/release
blockers. The existing isolated worktree is reused with a fresh branch.

## Contracts

Add `labels_browse/read/add/edit/delete` and `site_read`: inventory 45 -> 51.
Working SDK operations stay unchanged; these missing resources use focused
native adapters and the fixed route allowlist, never a generic HTTP tool.

Labels:
- Browse: optional filter/order nonblank strings, fields CSV, include only
  count.members, positive safe integer page/limit or limit all. One page per call.
- Read: exactly one safe nonblank ID or slug, include/count.members, fields and
  filter. Native slug route `/labels/slug/{encodedSlug}/`; no selector in query.
- Add: required nonblank name <=191, optional nonblank slug <=191; edit requires
  safe ID and optional name/slug with same lengths. No null or generated/audit
  fields, timestamps, arbitrary relationships or delete options. Empty edits
  remain permissible like existing edit tools. Ghost generates/normalizes slug.
- Add/edit allow include=count.members as query, never in `{labels:[entity]}`.
  Delete requires ID only, sends no body and returns plain text
  `Label with id ID deleted.`. Delete removes label assignments, not members;
  tool description warns explicitly. No automatic deletion/merge/relationship
  fetch or mutation retries. Native errors are sanitized consistently.
- Strict validation at MCP and direct client boundaries; labels accept flat
  query controls only, consistent with native commerce/staff. Reject nonempty or
  malformed separate options, including arrays/null. Safe route selectors reject
  traversal/delimiters/escapes/control chars; encode Unicode/space once. Preserve
  caller data. All data operations use existing collection/entity normalization,
  retaining pagination and arbitrary valid metadata literally.

Existing members_add/edit labels (strict name/optional nullable slug objects)
and newsletter ID inputs stay unchanged. This issue does not introduce label-ID
assignment or resolve/fetch labels automatically. Tests pin combined existing
label/newsletter bodies and explicit empty-array replacement semantics. Deleting
a label's assignment cleanup is a Ghost server behavior, source-verified here,
not simulated or claimed proven by the mocked server.

Site:
- `site_read` and direct `client.site.read({})` take a strict empty object;
  reject query/body/URL overrides and malformed separate options before HTTP.
- GET configured `/ghost/api/admin/site/`, preserve configured subdirectory,
  omit Authorization entirely. Existing server still requires configured key
  for authenticated tools; no new anonymous server mode or arbitrary URL input.
- Native transport timeout30s, zero redirects, proxy false, no retries. Extend
  fixed route metadata to mark site read public without weakening label/other
  authenticated routes. URL/version validation remains shared; never forward
  credentials to redirects or site response URL.
- Ghost returns `{site:{...},meta?}`, not an entity array. Validate object site
  and object metadata, return `{data:site,meta?}`. Preserve extra public site
  fields and nullable logo, never fabricate data from local config. Reject null,
  arrays/missing site and malformed meta. Do not overfit to version strings or
  require an ID, since site has none.
- Document title/description/logo/url/version and that URL may differ from
  Admin URL, logo may be relative/null, version is returned literally (typically
  major.minor). Read-only public info, not settings access/editing. Leave
  `blog://info` and other placeholder resources for #11.

## Source/version evidence

Current public docs: https://docs.ghost.org/admin-api/labels/overview and
https://docs.ghost.org/admin-api/site/overview (retrieved as .md).
Independently verify the actual baseline Ghost **v5.130.0**, not infer support
from today's examples. Paths under ghost/core/core/server:
- api/endpoints/labels.js: browse/read/write option allowlists, exact selectors,
  count.members include, no update-collision timestamp requirement.
- web/api/endpoints/admin/routes.js: ID and slug reads, CRUD routes; public site
  route uses publicAdminApi, labels use authAdminApi.
- models/label.js: name trimming, generated slug, count relation, delete detaches
  member assignments before destroying only the label.
- data/schema/schema.js: name/slug nonnull max191, generated audit fields.
- api/endpoints/site.js: permissions false, publicConfig.site.
- services/public-config/site.js and output/site.js: real public site singleton,
  nullable settings, extra public fields. No site data from private config route.

The concrete supported/source-verified reference is 5.130.0. Minimum header v5.0
is not proof of every5.x minor, earlier versions or newer-major compatibility.
Do not auto-probe site before operations or gate label permissions by version.
Server permission/version failures remain errors, never fake empty success.

## Verification

Test-first recording-client plus real MCP parsing/injection tests for all six
tools, direct strict input/options, ID/slug/query/body separation and caller
immutability. Actual loopback HTTP covers encoded routes, configured prefix,
JWT on labels and absent Authorization on site, include/paging metadata, delete
empty body, safe errors/no retries and public redirects. Assert singleton site
shape, unknown/empty/absent meta, nullable/extras, malformed response rejection.
Member relationship regressions preserve both input families. Update independent
inventory fixtures/type/import tests and stdio to51 exact names, existing output
and8 delete confirmations. One independent whole-branch review, fix material
findings test-first; clean install/typecheck/full tests/diff check, authorized
push/PR closing#8 only if all acceptance criteria met. No live compatibility claim.
