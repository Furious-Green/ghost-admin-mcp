# Specification-aligned tool errors (#25)

## Approved intent
The user selected the MCP specification, not implementation defaults, as the
authority. This supersedes #25's initial native-SDK preference where they differ.
Use the established continuous native TDD/spec/plan/one-independent-review/PR
workflow, without new approval pauses. Base is merged #26 (4072575), fork0.1.0.
No merge, tag, publication, deployment, live Ghost actions or consumer adoption.
Public files contain only public-project details and generic consumer guidance.

## Authority and selected classification
[MCP2025-11-25 tools, Error Handling](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#error-handling)
separates unknown tools/malformed requests/server errors from API, argument
validation and business-logic failures. SDK1.32.1's high-level catch converts
unknown/disabled errors into tool results, so following every SDK default would
not implement that documented distinction. This is an error-classification
alignment, not a comprehensive protocol certification or a protocol revision.

| Condition | Chosen response |
| --- | --- |
| Malformed tools/call request (missing/wrong name, nonobject arguments) | JSON-RPC InvalidParams -32602; SDK request-envelope parser |
| Unknown/removed/disabled tool | InvalidParams -32602, bounded fixed guidance |
| Unsupported task augmentation | Existing SDK protocol rejection before callback; no task capability added (see limitation below) |
| Valid request, known tool, schema/selector/unknown-field failure | CallToolResult isError:true; existing diagnostic/sanitizer policies |
| Known-tool input-budget/non-JSON-tree rejection | isError:true with bounded fixed guidance before Zod/callback/HTTP |
| Ghost/API/permission/business/callback failure | isError:true; existing sanitized adapter diagnostics, no retries |
| Unexpected schema-parser exception or unsupported registered handler | InternalError -32603 with fixed non-echoing message |
| Resource/prompt failure | Existing separate sanitized protocol errors, unchanged |

Request-envelope validity is not the same as matching a tool's declared schema.
Arguments omitted from a valid request mean an empty object: empty-input tools
may run; required-input tools still return an isError validation result. Null,
arrays and scalar arguments violate the request envelope and remain protocol
errors. Shared/cyclic direct in-memory inputs remain rejected by the10000-element
tree guard (they are not JSON-wire inputs). Preserve its exact counting/caps,
large-upload allowance, bounded pending work, iterative traversal and isolation.

## Architecture and scope
Keep the existing small public low-level dispatcher as a specification boundary;
SDK defaults cannot replace it without reintroducing the unknown-tool mismatch.
Remove its legacy claim that argument failures must be protocol errors. Reuse
one tool-result error helper for validation/budget/execution failures; do not
route through a second internal MCP client/server or patch dependency internals.
Keep per-server registry and stable lifecycle handle: repeated SDK renames have
captured-original-key behavior, so fresh public registrations/removals remain
necessary for correct discovery/name reuse and strict updated schemas. No native
dispatch simplification may discard tested protections merely to remove code.

Preserve54 tool names,7 resource entries/templates,1 prompt,8 delete confirmations,
data envelopes, strict schemas, upload/prompt caps and bounded diagnostics,
credential/HTTP/JWT policy and no mutation retry. No dependency upgrades.
Version0.2.0 starts the next pre-1.0 minor because clients previously relying on
exceptions for invalid tool arguments must now inspect isError before parsing
data. Read version from manifest as already implemented. No dual behavior switch,
no tagged/published release, no implication of upstream version continuity.

### Experimental task limitation (source-backed scope correction)
Raw stdio tests found the SDK rejects task augmentation for an unadvertised
capability with -32603 before our dispatcher. Preserve this fail-closed boundary
and do not claim experimental-task conformance: the tasks specification's receiver
requirements describe ignoring metadata without support, while client negotiation
forbids sending task-augmented tool calls without the capability. Changing this
to execute an unexpected task-marked mutation would alter an existing safety
boundary and needs separate explicit design. This issue aligns ordinary tool
error classification, not all experimental task behavior. The local dispatcher
retains its secondary unsupported-task check, but that is not the wire path.

## Tests, migration and gate
Update known-tool validation assertions to inspect resolved isError text without
catching/recasting protocol failures. Preserve every existing invalid-input case,
diagnostic assertion and no-HTTP/callback checks. Keep adapter rejection tests
and unknown/disabled/resource/prompt protocol rejection tests unchanged in kind.
Add table-driven real-MCP and executable stdio tests for valid-invalid arguments,
malformed envelopes, removed names, budget/sanitizer failures and continued
connection usability. Check raw stdio JSON-RPC error versus result distinction;
do not let a helper accept either channel. Add parser-exception sanitization and
omitted-arguments empty/required input tests. Prove any assertion helper rejects
protocol errors and successful results, not just matches its own fixtures.

Document old/new wire examples, version migration, error handling before parsing
JSON data, source/spec links, justified retained dispatcher/lifecycle machinery
and separate resource/prompt behavior. Mark earlier dependency notes historical
with current migration links rather than erasing original evidence.
Clean ci/typecheck/full offline tests, isolated source/runtime artifact gate,
checksums, full+production audits and diff check. One independent whole-branch
review, material fixes RED->GREEN, final push/PR closing #25 only when complete;
no automatic merge or service action.
