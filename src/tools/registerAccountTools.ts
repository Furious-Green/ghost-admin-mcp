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
        const description = resource === 'newsletters' && op === 'add'
            ? 'Create newsletter configuration, not a content send. WARNING: opt_in_existing=true subscribes existing members already subscribed to an active newsletter; never enabled implicitly. Sender settings may send real verification emails. Inspect returned entity/meta for pending verification and opt-in count; do not blindly retry.'
            : resource === 'newsletters' && op === 'edit'
                ? 'Edit or explicitly archive newsletter configuration, not a content send. WARNING: sender settings may send real verification emails and remain unchanged pending verification. Subscription settings affect signups. Read returned entity/meta; do not blindly retry.'
                : `${op} ${resource} with supported resource-specific inputs.`;
        registerStrictTool(server, `${resource}_${op}`, description, shape as z.ZodRawShape, async args => {
            const prepared = splitAccountRequest(resource, op, validateAccountInput(resource, op, args));
            const method = methods[op];
            if (!method) throw new Error(`Unsupported Ghost capability: ${resource}.${op}`);
            const result = await method.call(client[resource], prepared.input, prepared.query);
            return {content: [{type: 'text', text: op === 'delete'
                ? `${label} with id ${args.id} deleted.` : JSON.stringify(result, null, 2)}]};
        });
    }
}
