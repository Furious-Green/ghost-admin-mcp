import {z, type ZodRawShape} from 'zod';
import {McpServer, type ToolCallback} from '@modelcontextprotocol/sdk/server/mcp.js';

// The pinned SDK wraps raw shapes in a stripping object by default. Its public
// RegisteredTool schema is writable, so tighten only these repaired tools.
export function registerStrictTool<Args extends ZodRawShape>(
    server: McpServer, name: string, description: string, shape: Args, callback: ToolCallback<Args>,
    validationError?: string,
) {
    const registered = server.tool(name, description, shape, callback);
    const schema = z.object(shape).strict();
    if (validationError !== undefined) {
        // The pinned SDK serializes validation errors before invoking callbacks.
        // Keep the real schema for discovery, but never echo sensitive inputs or
        // attacker-controlled enum values/property names through Zod diagnostics.
        const parse = schema.safeParseAsync.bind(schema);
        schema.safeParseAsync = async (input, params) => {
            const result = await parse(input, params);
            return result.success ? result : {success: false, error: new z.ZodError([
                {code: z.ZodIssueCode.custom, path: [], message: validationError},
            ])};
        };
    }
    registered.inputSchema = schema;
    return registered;
}
