import type {McpServer, RegisteredTool} from '@modelcontextprotocol/sdk/server/mcp.js';
import {CallToolRequestSchema, ErrorCode, McpError} from '@modelcontextprotocol/sdk/types.js';
import type {z, ZodRawShape} from 'zod';

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

export function trackRegisteredTool(server: McpServer, name: string, tool: RegisteredTool, makeSchema: (shape: ZodRawShape) => z.AnyZodObject): void {
    const tools = registry(server);
    tools.set(name, tool);
    let current: string | null = name;
    const update = tool.update.bind(tool);
    tool.update = updates => {
        const next = updates.name === undefined ? current : updates.name || null;
        if (next && tools.has(next) && tools.get(next) !== tool) throw new Error('Duplicate Ghost tool name.');
        const schema = updates.paramsSchema === undefined ? undefined : makeSchema(updates.paramsSchema as ZodRawShape);
        update(updates);
        if (schema) tool.inputSchema = schema;
        if (next !== current) {
            if (current) tools.delete(current);
            if (next) tools.set(next, tool);
            current = next;
        }
    };
}

// MCP1.32 catches argument/name errors into tool results. This public-API
// dispatcher retains the fork's established protocol-error/callback-error split.
// The SDK still owns registration/discovery and resource/prompt handling.
export function installToolDispatcher(server: McpServer): void {
    server.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
        const tool = registry(server).get(request.params.name);
        if (!tool || !tool.enabled) throw new McpError(ErrorCode.InvalidParams, 'Tool not found or disabled.');
        if (request.params.task !== undefined) throw new McpError(ErrorCode.InvalidParams, 'Task requests are not supported.');
        if (!withinInputBudget(request.params.arguments)) throw new McpError(ErrorCode.InvalidParams, 'Tool arguments exceed the input element budget or are not a JSON tree.');
        // All fork registrations use Zod3 through registerStrictTool. Read the
        // current public schema/handler so updates and refinements stay effective.
        const schema = tool.inputSchema as z.ZodTypeAny;
        const parsed = await schema.safeParseAsync(request.params.arguments);
        if (!parsed.success) throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for tool ${request.params.name}: ${parsed.error.message}`);
        const handler = tool.handler;
        if (typeof handler !== 'function') throw new McpError(ErrorCode.InvalidParams, 'Task handlers are not supported.');
        try { return await Reflect.apply(handler, undefined, [parsed.data, extra]); }
        catch (error) {
            return {isError: true, content: [{type: 'text', text: error instanceof Error ? error.message : String(error)}]};
        }
    });
}
