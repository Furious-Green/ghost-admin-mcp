# Consistent data envelopes and response metadata

Date: 2026-10-20
Issue: https://github.com/Furious-Green/ghost-admin-mcp/issues/5
Base: merged issue #3, origin/main a6e27559af52b48366081ad01ad69f7cf63b18e7
Status: Written specification approved by the user on 2026-10-21.

## Intent and scope

Make pagination and relevant mutation metadata available to MCP callers without
changing request behavior. A caller must be able to inspect the records returned
by one browse request and any pagination information actually supplied by Ghost.
Single-entity results must not turn into collections merely because metadata is
present. Preserve newsletter verification/opt-in metadata without inventing a
successful sender-address change or adding newsletter controls from issue #7.

The user approved a uniform `{data, meta?}` envelope for every data-returning
tool, rather than resource-specific keys or a browse-only compatibility patch.
This is an intentional output-shape compatibility change, including copy tools.
Delete confirmations and error behavior remain unchanged. All 46 tool names,
existing input schemas, stdio executable and environment settings remain.

Do not add automatic paging, new operations, retries, schema expansion,
dependency upgrades, publication, deployment or private-wrapper adoption. Keep
the existing integration-versus-staff permission distinctions. Offline evidence
does not establish live Ghost compatibility.

## Evidence

- Installed/pinned `@tryghost/admin-api` `lib/admin-api.js`, function
  `makeResourceRequest`: a single entity with no metadata is unwrapped; otherwise
  resource-array results receive a non-index `meta` property. JSON.stringify on
  that array drops the property. An entity operation can consequently return an
  array when metadata is present.
- `src/client/sdkAdapter.ts`: currently accepts an entity, array-with-meta, or
  undefined without operation-specific cardinality.
- `src/client/nativeResponses.ts`: browse retains metadata on an array, but
  `readNativeEntity` discards it when extracting the entity. Native copy also
  extracts its entity without preserving response metadata.
- Data-returning handlers serialize these bare values. `src/prompts.ts` reads
  fields directly from a bare post result.
- https://docs.ghost.org/admin-api/newsletters/sender-email-validation documents
  `meta.sent_email_verification: ["sender_email"]`. The returned entity's
  `sender_email` stays unchanged until verification.
- https://docs.ghost.org/admin-api/newsletters/creating-a-newsletter documents
  the opted-in member count in response metadata for `opt_in_existing`.
- Ghost v5.130.0 `ghost/core/core/server/api/endpoints/newsletters.js` confirms
  the reference add option `opt_in_existing`; exposing that input remains #7.

Use pinned source and documentation to select representative fixtures. Preserve
metadata generically rather than hard-coding only currently known nested fields.

## Public result contract

At both the typed client boundary and the JSON inside MCP text content:

```ts
type GhostMetadata = Record<string, unknown>;
type GhostResponse<T> = {data: T; meta?: GhostMetadata};
type CollectionResponse = GhostResponse<GhostEntity[]>;
type EntityResponse = GhostResponse<GhostEntity>;
```

| Operation | Result |
| --- | --- |
| browse | `{data: [...]}` with optional sibling `meta` |
| read/add/edit/copy | `{data: {...}}` with optional sibling `meta` |
| delete | client resolves undefined; existing MCP confirmation text |

Give ResourceClient methods operation-specific return types: browse cannot
return an entity; entity operations cannot return an array or undefined; delete
cannot return an envelope. Copy returns EntityResponse. Remove hidden array-meta
conventions from normalized public results, not merely from tool serialization.
Any broad internal union must not weaken these public method signatures.

Examples:

```json
{"data":[{"id":"one"}],"meta":{"pagination":{"page":1,"pages":2,"limit":1,"total":2,"prev":null,"next":2}}}
```

```json
{"data":[],"meta":{"pagination":{"page":2,"pages":2,"limit":1,"total":1,"prev":1,"next":null}}}
```

```json
{"data":{"id":"newsletter1","sender_email":null},"meta":{"sent_email_verification":["sender_email"]}}
```

The second example deliberately retains the supplied empty-page metadata rather
than recalculating it from the records. These examples are response fixtures,
not proof of identical behavior on all Ghost versions.

### Metadata semantics

- Preserve all JSON metadata keys and nested values supplied in the response
  body's top-level `meta`. Empty object metadata is retained as `meta: {}`.
- Absent/undefined metadata is omitted. Do not synthesize an empty object,
  pagination counts, current page, next/prev links, or permission capabilities.
- Present non-object metadata, including null, primitives and arrays, is a
  malformed response. JSON null values *inside* a metadata object are valid.
- An entity's own field named `meta` remains inside `data`; never reinterpret it
  as response metadata or merge response metadata into the entity.
- Only expose the resource data and response-body metadata, not Axios/HTTP
  response objects, transport headers, config, tokens, or request diagnostics.
- Do not derive counts, pending-verification flags, or sender addresses from the
  input. Preserve the returned entity unchanged. In particular, verification
  metadata is not confirmation that the new sender address is already active.
- Missing pagination does not mean another page exists, nor prove exhaustion.
  Collections such as offers/roles can lack pagination altogether.

## Adapter architecture

Use one focused normalization module for validating records, collection/entity
cardinality and metadata, shared by SDK and native paths. Keep transport,
normalization, and MCP presentation separate. Helpers must create explicit plain
envelopes, without mutating returned entities or storing metadata on arrays.

For the SDK-backed resources, preserve SDK routing, query/body mapping,
HTML-source conversion, token/error semantics, and the existing injected
RequestExecutor decoded-body contract. Validate/capture the decoded resource
envelope before the SDK's shape-changing transformation can discard information.
Scope this capture to the individual invocation, not to a shared last-response
variable or a resource-keyed response cache. Concurrent calls, including two
operations against the same resource, must never exchange data or metadata.

If SDK invocation-local construction/interception requires an explicit default
SDK executor, faithfully preserve the pinned SDK's existing Axios configuration,
query serialization, decoded-body return and error behavior. Do not replace it
with the differently configured native executor. This is a metadata boundary
repair, not an SDK transport-hardening or version-routing rewrite. Tests must
pin transport equivalence where an executor is made explicit.

After a successful SDK operation, normalize the request-local resource envelope
with the operation's expected cardinality. Do not infer a response envelope from
fields inside an entity, depend on pagination being present, patch node_modules,
or silently accept a wrong-resource response. Validate before any SDK response
transformation that would otherwise obscure malformed metadata. DELETE bypasses
data normalization and preserves its existing no-entity success contract.

Native commerce/staff adapters and post/page copy already receive decoded
resource envelopes directly. Normalize them through the same contracts, retaining
their existing fixed paths, selector validation, wrapping, headers, response
validation, sanitized errors and no-retry policy. Preserve the established copy
validation/request-error messages and its malformed-response message when
adapting the shared validator.

## Validation and failure semantics

Successful data responses require a matching resource array whose members are
non-null, non-array records. Browse accepts zero, one or multiple records; entity
operations require exactly one. Missing resources, malformed members, empty or
multiple entity results, and malformed metadata fail with safe generic response
errors. Never return `{data: undefined}`, a fabricated empty collection, or a
success confirmation after a failed request. Unknown entity fields are retained.

Metadata validation must not reflect its invalid value in an error message.
Keep SDK/native HTTP permission/conflict errors and MCP isError signaling intact.
Normalization failures occur after the original request and cause no retry or
additional read. A timed-out/failed mutation still has the existing ambiguity
about whether Ghost accepted it; this repair never repeats it automatically.

## MCP tools and internal consumers

Every existing data-returning tool serializes its normalized envelope as JSON
text, retaining the current content-block format and readable indentation. Do not
double-wrap the result or wrap the outer MCP protocol message. No new structured
content/output-schema contract is introduced in this issue.

Update the summarize-post prompt to read the entity from `result.data` and retain
its existing title/excerpt/300-character HTML preview. Do not expand retrieval or
alter truncation in this issue. Placeholder resource registrations remain #11.
Adapt typed test clients and all internal consumers; do not hide missing updates
behind a permissive old/new-result union.

## Compatibility and documentation

Add a visible response-format migration section to README, linked from the
existing original-implementation migration guidance:

- Browse changes from `[...]` (and SDK-dependent singleton results) to
  `{data:[...], meta?:{...}}`; consumers enumerate `result.data`.
- Read/add/edit/copy change from bare entities to `{data:{...}, meta?:{...}}`;
  consumers read fields such as `result.data.id`.
- Pagination lives at `result.meta?.pagination`. Follow server-provided `next`
  with an explicit next request only where that resource supports numeric paging.
- No metadata/pagination is fabricated for collections that omit it. `limit:"all"`
  support remains resource-specific and unchanged. No automatic paging is added.
- Delete text, error signaling, names, inputs and executable/settings are stable.
- Newsletter verification metadata can indicate a pending change; opt-in counts
  are preserved when returned, but new creation/delivery controls remain #7.
- Refresh client expectations; no compatibility flag, alternate tool names, or
  silent bare-result fallback. Update output examples and remove the stale claim
  that issue #5 metadata loss remains. Keep #6/#7/#11 and release/security caveats.

Private consumer code is not updated here; downstream adoption must explicitly
account for this response contract and remain separately approved.

## Offline verification

Use failing-test-first implementation with independently hand-written expected
envelopes. Preserve unrelated baseline tests rather than weakening assertions.

1. Shared normalization: zero/one/many collection records; entity cardinality;
   absent/undefined/empty metadata; nested values/nulls; record fields named
   data/meta; wrong-resource, missing, primitive, malformed records/metadata.
2. Real SDK adapter contracts: every supported browse/read/add/edit plus unchanged
   deletes; exact requests unaffected; nonpaginated singleton browse stays an
   array; singleton entity with metadata stays one entity. Capture metadata before
   SDK transformation, including malformed metadata it would otherwise hide.
3. Native adapters/copy: all existing repaired operations follow the same result
   shapes and preserve metadata, including unknown keys and no-pagination cases.
4. Pagination: first/middle/final/empty pages retain exact server totals and null
   next/prev values. One browse call issues one HTTP request, not a page loop.
5. Newsletter mutation fixtures: pending sender verification leaves returned
   sender_email unchanged and retains `sent_email_verification`; opt-in count
   metadata is not dropped or inferred. Do not add opt_in_existing MCP inputs.
6. Concurrency: explicitly controlled, out-of-order SDK reads/browses/mutations,
   including same-resource calls, preserve each invocation's data/meta pairing;
   SDK/native calls do not exchange metadata. A previous success cannot donate
   metadata to a later response or failure.
7. Real MCP dispatch: all 46 names unchanged; data-returning calls produce the
   agreed envelope; deletes/errors stay as before; prompt reads data correctly.
   Remove only obsolete tests that asserted metadata loss or bare result shapes.
8. Loopback actual HTTP: decoded SDK/native responses survive through to MCP;
   query/body/auth remain unchanged; errors/redirect/timeouts retain their
   existing respective transport policies with no mutation retries.
9. Compile-time return tests distinguish browse/entity/delete/copy contracts.
   Import/stdio/CI/security regression coverage remains intact.

Run clean npm ci, typecheck, full tests and diff check, preserving dependency
versions and lockfile. Obtain one independent whole-branch review after native
execution, unless the user changes that preference during plan approval. No live
Ghost requests, email sends or Stripe changes. Inherited dependency advisories
remain release/adoption blockers; hosted CI requires an authorized push.

## Design checklist

- [x] Inspect merged context, SDK/native transforms, consumers and issue #5.
- [x] Compare uniform/resource-keyed/browse-only approaches; user chooses uniform.
- [x] Approve conversational architecture, semantics, migration and verification.
- [x] Write specification and self-review contracts, scope and ambiguity.
- [x] User reviews this written specification.
- [x] Write/review implementation plan and confirm execution method.
