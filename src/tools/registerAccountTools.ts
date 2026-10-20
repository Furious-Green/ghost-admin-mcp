import {z} from 'zod';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {accountShapes, type AccountResource, type AccountOperation} from '../schemas/accounts';
import {splitAccountRequest, validateAccountInput} from '../client/accountRequest';
import type {GhostClient, QueryOptions} from '../client/types';
import {registerStrictTool} from './registerStrictTool';

export function registerAccountTools(server: McpServer, client: GhostClient, resource: AccountResource): void {
    const methods = client[resource] as unknown as Partial<Record<AccountOperation,
        (input: Record<string, unknown>, options?: QueryOptions) => Promise<unknown>>>;
    const label = {members: 'Member', users: 'User', newsletters: 'Newsletter', webhooks: 'Webhook'}[resource];
    for (const [operation, shape] of Object.entries(accountShapes[resource])) {
        const op = operation as AccountOperation;
        registerStrictTool(server, `${resource}_${op}`, `${op} ${resource} with supported resource-specific inputs.`, shape as z.ZodRawShape, async args => {
            const prepared = splitAccountRequest(resource, op, validateAccountInput(resource, op, args));
            const method = methods[op];
            if (!method) throw new Error(`Unsupported Ghost capability: ${resource}.${op}`);
            const result = await method(prepared.input, prepared.query);
            return {content: [{type: 'text', text: op === 'delete'
                ? `${label} with id ${args.id} deleted.` : JSON.stringify(result, null, 2)}]};
        });
    }
}
