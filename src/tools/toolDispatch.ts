import type {McpServer, RegisteredTool, ToolCallback} from '@modelcontextprotocol/sdk/server/mcp.js';
import {CallToolRequestSchema, ErrorCode, McpError, type CallToolResult} from '@modelcontextprotocol/sdk/types.js';
import {z, type ZodRawShape} from 'zod';

export const MAX_TOOL_INPUT_ELEMENTS = 10000;
const registries = new WeakMap<McpServer, Map<string, RegisteredTool>>();
function registry(server: McpServer): Map<string, RegisteredTool> {
    let tools = registries.get(server);
    if (!tools) { tools = new Map(); registries.set(server, tools); }
    return tools;
}

function withinInputBudget(input: unknown): boolean {
    const pending = [input], seen = new WeakSet<object>();
    let count = 0;
    try {
        while (pending.length) {
            if (++count > MAX_TOOL_INPUT_ELEMENTS) return false;
            const value = pending.pop();
            if (typeof value !== 'object' || value === null) continue;
            if (seen.has(value) || (Array.isArray(value) && value.length > MAX_TOOL_INPUT_ELEMENTS)) return false;
            seen.add(value);
            for (const key in value) {
                if (!Object.hasOwn(value, key)) continue;
                // Count/enforce before enqueueing so wide objects cannot grow
                // unbounded pending work. No recursive traversal or JSON copying.
                if (++count > MAX_TOOL_INPUT_ELEMENTS) return false;
                pending.push((value as Record<string, unknown>)[key]);
            }
        }
        return true;
    } catch { return false; }
}

export function trackRegisteredTool(server: McpServer, name: string, initial: RegisteredTool, makeSchema: (shape: ZodRawShape) => z.AnyZodObject): RegisteredTool {
    const tools = registry(server);
    let handle = initial;
    let current: string | null = name;
    const update = (updates: Parameters<RegisteredTool['update']>[0]) => {
        const next = updates.name === undefined ? current : updates.name || null;
        if (next && tools.has(next) && tools.get(next) !== front) throw new Error('Duplicate Ghost tool name.');
        const schema = updates.paramsSchema === undefined ? undefined : makeSchema(updates.paramsSchema as ZodRawShape);
        const {name: _name, ...fields} = updates;
        if (next !== current && next) {
            // SDK rename closures retain their original registration key. Use a
            // fresh public registration, never its rename path or private maps.
            // Create first so name collisions cannot remove the existing tool.
            const callback = (updates.callback ?? handle.handler) as ToolCallback<z.AnyZodObject>;
            if (typeof callback !== 'function') throw new Error('Task handlers are not supported.');
            const replacement = server.registerTool(next, {
                title: updates.title ?? handle.title,
                description: updates.description ?? handle.description,
                inputSchema: (schema ?? handle.inputSchema) as z.AnyZodObject,
                outputSchema: updates.outputSchema === undefined ? handle.outputSchema : z.object(updates.outputSchema as ZodRawShape),
                annotations: updates.annotations ?? handle.annotations,
                _meta: updates._meta ?? handle._meta,
            }, callback);
            if (!(updates.enabled ?? handle.enabled)) replacement.disable();
            if (current) handle.remove();
            handle = replacement;
        } else {
            handle.update(fields);
            if (schema) handle.inputSchema = schema;
            if (next !== current && current) handle.remove();
        }
        if (current !== next) {
            if (current) tools.delete(current);
            if (next) tools.set(next, front);
            current = next;
        }
    };
    const methods = {update, enable: () => update({enabled: true}), disable: () => update({enabled: false}), remove: () => update({name: null})};
    // Stable public handle: direct schema/metadata assignments and lifecycle calls
    // always address the current SDK registration, even after rename/re-add.
    const front = new Proxy(initial, {
        get: (_target, property) => typeof property === 'string' && Object.hasOwn(methods, property)
            ? methods[property as keyof typeof methods] : Reflect.get(handle, property),
        set: (_target, property, value) => Reflect.set(handle, property, value),
    });
    tools.set(name, front);
    return front;
}

function toolError(text: string): CallToolResult {
    return {isError: true, content: [{type: 'text', text}]};
}

// The MCP2025-11-25 specification distinguishes request/routing errors from
// known-tool validation/execution errors. SDK1.32's high-level catch conflates
// those channels, so retain this public-API specification boundary. The SDK
// still owns discovery and resource/prompt handling, not our error policy.
export function installToolDispatcher(server: McpServer): void {
    // Let Server's tools/call wrapper validate the full envelope as InvalidParams.
    // Registering the full schema here makes Protocol's outer parse throw raw
    // Zod errors first, which that layer misclassifies as InternalError.
    const route = z.object({method: z.literal('tools/call')}).passthrough();
    server.server.setRequestHandler(route, async (raw, extra) => {
        const request = CallToolRequestSchema.parse(raw);
        const tool = registry(server).get(request.params.name);
        if (!tool || !tool.enabled) throw new McpError(ErrorCode.InvalidParams, 'Tool not found or disabled.');
        if (request.params.task !== undefined) throw new McpError(ErrorCode.InvalidParams, 'Task requests are not supported.');
        if (!withinInputBudget(request.params.arguments)) return toolError('Tool arguments exceed the input element budget or are not a JSON tree.');
        // All fork registrations use Zod3 through registerStrictTool. Read the
        // current public schema/handler so updates and refinements stay effective.
        const schema = tool.inputSchema as z.ZodTypeAny;
        let parsed: Awaited<ReturnType<z.ZodTypeAny['safeParseAsync']>>;
        try { parsed = await schema.safeParseAsync(request.params.arguments ?? {}); }
        catch { throw new McpError(ErrorCode.InternalError, 'Tool input validation failed unexpectedly.'); }
        if (!parsed.success) return toolError(`Invalid arguments for tool ${request.params.name}: ${parsed.error.message}`);
        const handler = tool.handler;
        if (typeof handler !== 'function') throw new McpError(ErrorCode.InternalError, 'Registered tool handler is unsupported.');
        try { return await Reflect.apply(handler, undefined, [parsed.data, extra]); }
        catch (error) {
            return toolError(error instanceof Error ? error.message : String(error));
        }
    });
}
