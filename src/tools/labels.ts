import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import type {GhostClient} from '../client/types';
import {shapes, schemas} from '../schemas/labels';
import {registerStrictTool} from './registerStrictTool';
export type {LabelInputs as ToolInputs} from '../schemas/labels';

export function registerLabelTools(server: McpServer, client: GhostClient): void {
    for (const operation of Object.keys(shapes) as (keyof typeof shapes)[]) {
        const registered = registerStrictTool(server, `labels_${operation}`,
            operation === 'delete' ? 'Delete a member label and remove its assignments from members, not the members themselves. This is irreversible; no automatic retry.'
                : `${operation} member labels with explicit resource-specific inputs; browse returns one page and server metadata.`,
            shapes[operation] as z.ZodRawShape, async args => {
                // Revalidate refinements (including exactly one read selector) before injected clients.
                const parsed = schemas[operation].parse(args);
                const result = await Reflect.apply(client.labels[operation], client.labels, [parsed]);
                return {content: [{type: 'text', text: operation === 'delete'
                    ? `Label with id ${(parsed as {id: string}).id} deleted.` : JSON.stringify(result, null, 2)}]};
            });
        if (operation === 'read') registered.inputSchema = z.object(shapes.read).strict().superRefine((value, ctx) => {
            if (Number(value.id !== undefined) + Number(value.slug !== undefined) !== 1) ctx.addIssue({code: z.ZodIssueCode.custom, message: 'Provide exactly one id or slug'});
        }) as unknown as typeof registered.inputSchema;
    }
}
