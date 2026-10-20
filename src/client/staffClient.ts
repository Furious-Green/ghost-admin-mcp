import {inviteSchemas, roleSchemas} from '../schemas/staff';
import {createNativeAdminRequest} from './nativeAdmin';
import {readNativeCollection, readNativeEntity} from './nativeResponses';
import type {CollectionResponse, EntityResponse, GhostClient, GhostConfig, GhostResult, QueryOptions, RequestExecutor} from './types';

export function createStaffClients(config: GhostConfig, makeRequest?: RequestExecutor): Pick<GhostClient, 'invites' | 'roles'> {
    const send = createNativeAdminRequest(config, makeRequest);
    function request(operation: 'invites.browse' | 'roles.browse', input: unknown, options?: QueryOptions): Promise<CollectionResponse>;
    function request(operation: 'invites.add', input: unknown, options?: QueryOptions): Promise<EntityResponse>;
    function request(operation: 'invites.delete', input: unknown, options?: QueryOptions): Promise<undefined>;
    async function request(operation: 'invites.browse' | 'invites.add' | 'invites.delete' | 'roles.browse', input: unknown, options?: QueryOptions): Promise<GhostResult> {
        const [family, op] = operation.split('.');
        const schema = operation === 'roles.browse' ? roleSchemas.browse
            : inviteSchemas[op as keyof typeof inviteSchemas];
        const parsed = schema.safeParse(input);
        if (!parsed.success || (options && Object.keys(options).length)) throw new Error(`Invalid Ghost ${family} ${op} input.`);
        const fields: Record<string, unknown> = {...parsed.data};
        const id = typeof fields.id === 'string' ? fields.id : undefined;
        delete fields.id;
        let result: unknown;
        try {
            result = await send(operation, {id,
                ...(op === 'browse' ? {query: fields as QueryOptions} : op === 'add' ? {body: {invites: [fields]}} : {}),
            });
        } catch (error) {
            // The shared core already removed upstream diagnostics. Add only fixed,
            // actionable guidance, without guessing which kind of key was supplied.
            if (error instanceof Error && 'statusCode' in error && [401, 403].includes(Number(error.statusCode))) {
                error.message += ' This operation may require a staff access token with sufficient permissions.';
            }
            throw error;
        }
        if (op === 'delete') return undefined;
        return op === 'browse' ? readNativeCollection(family, result) : readNativeEntity(family, result);
    }
    return {
        invites: {
            browse: (input, options) => request('invites.browse', input, options),
            add: (input, options) => request('invites.add', input, options),
            delete: (input, options) => request('invites.delete', input, options),
        },
        roles: {browse: (input, options) => request('roles.browse', input, options)},
    };
}
