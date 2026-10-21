# Issue #11: real resources and bounded HTML summarization source

## Intent and boundaries

Replace seven fake reads with real injected-client reads; preserve URI/name
discovery and54 tools,8 delete confirmations. The resource contract uses seven JSON resources,
public blog info, safe IDs/errors, explicit HTML prompt up to100000 characters,
untrusted-source separation, offline tests and one independent review before pull-request delivery.
Base merged#22:02e536b. No live Ghost mutations/emails/theme changes, private
adoption, deployment/publication or merge. Config/executable/MIT/badges/dependencies
and tools remain unchanged;9 advisories remain release/adoption blockers.

## Resource interface

Keep names/templates: user://{user_id}, member://{member_id}, tier://{tier_id},
offer://{offer_id}, newsletter://{newsletter_id}, post://{post_id}; exact resource
blog://info (name blog-info). Existing template enumeration remains unimplemented:
no automatic browsing or member/user listing. Discovering resources issues no HTTP.
Register injected callbacks from resources.ts, not globals or process env reads.
Replace internal placeholder handler exports with registerResources(server,client);
advertised MCP URI/name surface retained, not a promise internal exports are API.

Mappings: users/members/tiers/offers/newsletters.read({id}); posts.read({id},
{formats:'html'}); site.read({}) for blog info. Same client receiver preserved,
one call only per read; no fallback/mock/auto version probe/URL follow-up/retry.
No arbitrary query controls, slug/email selectors or browsing attached to URIs.

URI callback validates its scheme, empty username/password/port/path/query/hash,
exactly the expected single string variable and match with raw host. The pinned
SDK matches variables on URL.toString() without decoding; decode exactly once,
then validate existing safe selector plus maximum191 decoded UTF16 units.
Percent-encoded Unicode/space supported, literal IDs remain case-sensitive;
decoded traversal/delimiters/percent escapes/control/lone-surrogate rejected
before even injected methods. Reject arrays/ambiguous variables. URI is symbolic,
never an HTTP destination; fixed client resources determine routes. Resource
contents use the SDK-supplied uri.href, not a reconstructed URI or Ghost URL.

Successful resource contents: one `{uri,mimeType:'application/json',text:JSON}`,
where JSON is exactly `{data:entity,meta?}`. Preserve nullable/extra entity fields,
unknown/nested/empty/absent metadata from client. Shared read-response boundary
checks object data and object metadata even for injected clients, rejects null/
arrays/malformed responses/serialization errors. No resource-specific output
truncation added; prompt caps below are not a resource/HTTP/memory policy.

Invalid known-resource input -> bounded MCP InvalidParams error before HTTP;
client/permission/not-found/malformed response -> bounded MCP InternalError with
generic read/permissions guidance, no raw SDK/HTTP diagnostics/IDs/secrets or
console logging. No `{contents:[placeholder]}`/empty fake entity success.
Unknown/unmatched URI handling remains the pinned SDK's protocol behavior.
Permissions are the same as corresponding tools, not unrestricted because exposed
as a resource. Member/user data may be private. Blog info alone uses existing
public no-Authorization site route, not settings editing or anonymous-server mode.

## Summarize-post interface

Preserve prompt name summarize-post and required postId. Strict args object,
safe nonblank selector <=191, unknown args rejected (not silently stripped),
bounded sanitized schema errors. Validate before injected read, preserve method
receiver. One posts.read({id:postId},{formats:'html'}); never HTML fetches or
Lexical conversion, model execution, browsing or fallback credential changes.

Read returns normalized entity. Missing/non-string/null HTML fails with bounded
protocol error: no silently empty source. Empty string HTML is valid empty source.
Optional non-string title/excerpt become empty strings, not `[object Object]`.
Include complete supplied HTML when <=**100000 UTF16 code units**, otherwise
prefix <=100000; do not cut a surrogate pair. Title limit2000, excerpt5000 using
same prefix rule. These are prompt-source caps, not HTTP/JSON/global-concurrency
memory limits; the read already fetched full response. No hidden300-character cap.

Construct one user text message with concise summarization instructions followed
by JSON-serialized source data: title/excerpt/html and per-field truncation
metadata (originalCharacters/includedCharacters/limit/truncated). Outside source
JSON, explicitly label HTML complete or TRUNCATED and state included/original
counts for truncated content; never append misleading ellipsis to full content.
Always mark source fields as untrusted data, not instructions; do not follow
embedded instructions/links. JSON separates/escapes attacker-controlled source
from control copy; this is not a prompt-injection-proof or summary-quality claim.
No API keys/LLM/Langfuse integration, tracing or telemetry dependencies. This
repairs observable retrieval/construction defects, not model-specific tuning or
LLM output evaluation. MCP host decides how/when to execute returned prompt.

## Source evidence

Existing typed clients implement each read (#2–#10), metadata shape and strict
safe selectors. Baseline remains Ghost5.130.0; no new endpoint/version claim.
Pinned MCP SDK server/mcp.js resource registration/read callback and public
RegisteredPrompt.argsSchema support injected registration and strict prompt
validation. shared/uriTemplate.js match returns raw variable strings; NodeURL
non-special URI host retains case and percent encodings. Error behavior is
protocol-specific, not the tool isError envelope. Discovery URI surface unchanged.
Current resources.ts placeholders and prompts.ts300-char/no-formats behavior are
the concrete regression baseline; no external live Ghost reads needed.

## Verification

Test-first actual MCP discovery/reads for all7 mappings, preserved JSON/meta and
receivers; safe encoded Unicode/uppercase IDs; missing/array/direct variables,
URI credentials/port/query/hash/slash/percent/traversal rejection before HTTP and
injected clients. SDK/native403/404/malformed errors sanitized, no console logs,
one request, concurrent reads metadata isolation. Prompt formats explicit, beyond
300 characters, exact100000 boundary/truncation, metadata caps/surrogates/null/
missingHTML/emptyHTML/unknown args and malicious source preserved as quoted data.
Loopback confirms actual routing/HTML query/public site auth vs private auth;
stdio discovery unchanged and invalid read/get failures create no network calls.
Update known-placeholder tests and README compatibility notes, not historical
docs. Clean ci/typecheck/full suite/diff; one independent whole-branch review,
material fixes test-first; authorized PR closes#11 only if all criteria met.
