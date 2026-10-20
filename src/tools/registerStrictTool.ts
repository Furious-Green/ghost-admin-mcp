import {z, type ZodRawShape} from 'zod';
import {McpServer, type ToolCallback} from '@modelcontextprotocol/sdk/server/mcp.js';

// The pinned SDK wraps raw shapes in a stripping object by default. Its public
// RegisteredTool schema is writable, so tighten only these repaired tools.
export function registerStrictTool<Args extends ZodRawShape>(
    server: McpServer, name: string, description: string, shape: Args, callback: ToolCallback<Args>,
) {
    const registered = server.tool(name, description, shape, callback);
    registered.inputSchema = z.object(shape).strict();
    return registered;
}
