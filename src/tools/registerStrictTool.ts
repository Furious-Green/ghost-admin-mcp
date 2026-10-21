import {z, type ZodRawShape} from 'zod';
import {McpServer, type ToolCallback} from '@modelcontextprotocol/sdk/server/mcp.js';

// The pinned SDK wraps raw shapes in a stripping object by default. Its public
// RegisteredTool schema is writable, so tighten only these repaired tools.
export function boundedValidationSchema<Schema extends z.AnyZodObject>(schema: Schema, validationError: string): Schema {
    // SDK validation happens before callbacks and otherwise echoes raw Zod issues.
    const parse = schema.safeParseAsync.bind(schema);
    schema.safeParseAsync = async (input, params) => {
        const result = await parse(input, params);
        return result.success ? result : {success: false, error: new z.ZodError([
            {code: z.ZodIssueCode.custom, path: [], message: validationError},
        ])};
    };
    return schema;
}

export function registerStrictTool<Args extends ZodRawShape>(
    server: McpServer, name: string, description: string, shape: Args, callback: ToolCallback<Args>,
    validationError?: string,
) {
    const registered = server.tool(name, description, shape, callback);
    const schema = z.object(shape).strict();
    if (validationError !== undefined) {
        boundedValidationSchema(schema, validationError);
    }
    registered.inputSchema = schema;
    return registered;
}
