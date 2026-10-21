# Tool error migration: fork 0.1.0 → 0.2.0

Version **0.2.0** aligns ordinary tool error classification with the
[MCP 2025-11-25 specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#error-handling),
not every behavior of the pinned TypeScript SDK. This is a breaking pre-1.0
minor change, not an npm publication, tagged release or comprehensive protocol
certification. It belongs to this fork's independent version line.

## Two distinct failure channels

| Condition | Fork 0.1.0 | Fork 0.2.0 |
| --- | --- | --- |
| Known tool, invalid arguments/unknown fields/selectors | InvalidParams protocol error | **Resolved tool result with `isError:true`** |
| Known tool, input element-budget/non-JSON-tree rejection | InvalidParams protocol error | **Resolved tool result with `isError:true`** |
| Unknown, removed or disabled tool | InvalidParams protocol error | Unchanged (-32602) |
| Malformed tools/call envelope: missing/wrong name or nonobject arguments | Protocol error (SDK could misclassify as InternalError) | InvalidParams protocol error (-32602) |
| Ghost API/permission/business/callback failure | `isError:true` tool result | Unchanged |
| Unexpected schema-parser exception or unsupported registered handler | Generic/misclassified protocol error | Fixed, non-echoing InternalError (-32603) |
| Resource/prompt failure | Separate sanitized protocol errors | Unchanged; not CallToolResult errors |

“Malformed request” and “invalid tool arguments” are different. A missing `name`
or `arguments: []` is malformed MCP. `arguments: {id: "../unsafe"}` is a valid
MCP request with invalid input for the named tool. Both remain rejected, but
the latter provides an error result the model can use to correct its input.
Omitted arguments mean `{}`: empty-input tools may run; required arguments and
client-side semantic validation still apply. Explicit null is not omitted.

These changes do not weaken strict schemas, strip unknown fields, loosen upload
caps, authorize an operation or retry a mutation. Rejected inputs cause no Ghost
request. Tool results and JSON-RPC responses are not HTTP status codes.

## Wire examples

For an ordinary known-tool validation failure, 0.1.0 returned:

```json
{"jsonrpc":"2.0","id":1,"error":{"code":-32602,"message":"Invalid arguments for tool posts_delete: ..."}}
```

Now 0.2.0 returns:

```json
{"jsonrpc":"2.0","id":1,"result":{"isError":true,"content":[{"type":"text","text":"Invalid arguments for tool posts_delete: ..."}]}}
```

An unknown tool still produces a JSON-RPC `error`, not `result.isError`.
Exact diagnostic wording is not a stable API; classify by the response channel
and `isError`, not substring matching. Upload validation and prompt diagnostics
retain bounded, non-echoing policies. Other schemas may include validation details;
this is not a new claim that every error from every transport is equally bounded.

## Client migration

Handle **both** channels, checking the tool result before parsing successful JSON
data. For a TypeScript MCP client, a transport/protocol failure rejects the call;
a tool error resolves it:

```js
let result;
try {
  result = await client.callTool({name, arguments: args});
} catch (error) {
  // Protocol/transport failure: report it; do not blindly retry a mutation.
  handleProtocolOrTransportFailure(error);
  return;
}
if (result.isError === true) {
  // Includes invalid arguments and execution failures; display safe feedback.
  handleToolFailure(result.content);
  return;
}
// Only now decode success according to the tool's documented response type.
// Data tools: JSON text {data, meta?}. Eight delete tools: plain-text confirmation.
handleSuccessfulToolResult(result);
```

Resources and prompts are separate MCP operations, not tools. Continue handling
their existing protocol errors rather than looking for `isError` on their results.
Pinned install/rollback remains in [the artifact guide](artifacts.md). Executable
rollback does not reverse already completed remote mutations or emails.

## Why retain the dispatcher?

SDK **1.32.1**'s high-level tool handler catches unknown/disabled-tool errors into
`isError` results, unlike the tools specification's documented classification.
Its outer full-request schema parse can also throw a raw Zod error before the
low-level Server's intended InvalidParams wrapper runs. This fork uses a broad
method-routing schema at the public `setRequestHandler` boundary, then the SDK's
full request-envelope check and its own typed dispatcher. Malformed envelopes
therefore remain protocol errors without private SDK maps or dependency patches.

The dispatcher retains only explicit responsibilities: known/enabled lookup,
input tree budget, strict current-schema parsing, specification-based error
classification and invocation of the current callback. The per-server lifecycle
handle still uses fresh public registrations/removals to avoid the SDK's stale
original-name rename behavior. Removing these protections just to match an SDK
default would not satisfy the selected contract. Discovery/resources/prompts
continue to use SDK machinery. No extra internal MCP transport or retry is added.

## Explicit experimental-task limitation

No task capability is advertised and no task execution is implemented. The SDK
rejects task-marked requests before the ordinary dispatcher with a protocol
InternalError (-32603), without invoking a callback. This existing fail-closed
behavior is preserved and covered by stdio tests; it is **not** presented as
experimental-task conformance.

The [experimental tasks specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks)
forbids clients from task-augmenting tools when capability is absent, but its
receiver behavior section also says unsupported metadata must be ignored and
requests processed normally. Implementing that latter rule could make an
unexpected task-marked mutation execute where it previously did not. That safety
boundary needs separate explicit design, not an incidental error-format change.
This limitation does not change ordinary tool, resource or prompt classification.

## Evidence and boundaries

Offline tests exercise real MCP transports and raw executable stdio response
envelopes, malformed parameters, unknown/disabled names, budget boundaries,
sanitized upload/schema-parser failures, updated schemas and repeated renames.
All previous invalid-input cases remain; expected error channels change explicitly.
Typed-client adapter validation continues to reject promises as before—it is not
the MCP wire response API. No live Ghost authorization or mutation is required.
Artifact gates independently check compiled source and production-only runtime
startup/discovery, matching manifest/MCP versions and zero Ghost requests.
