import GhostAdminAPI from '@tryghost/admin-api';
import type {GhostClient, GhostConfig, GhostResult, QueryOptions, RequestExecutor} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkResult(value: unknown): GhostResult {
    if (value === undefined || isRecord(value)) return value;
    if (Array.isArray(value) && value.every(isRecord)) {
        if ('meta' in value && value.meta !== undefined && !isRecord(value.meta)) {
            throw new Error('Unexpected Ghost SDK response metadata');
        }
        return value;
    }
    throw new Error('Unexpected Ghost SDK response');
}

// This adapts capabilities; it does not implement routes the SDK does not have.
export function createGhostClient(config: GhostConfig, options: {makeRequest?: RequestExecutor} = {}): GhostClient {
    const sdk: unknown = new GhostAdminAPI({...config, ...options});

    function method(resource: string, operation: string) {
        return async (input: unknown, query?: QueryOptions): Promise<GhostResult> => {
            const target = isRecord(sdk) ? sdk[resource] : undefined;
            const fn = isRecord(target) ? target[operation] : undefined;
            if (typeof fn !== 'function') {
                throw new Error(`Unsupported Ghost SDK capability: ${resource}.${operation}`);
            }
            const result: unknown = await Reflect.apply(fn, target, [input, query]);
            // Ghost returns no entity for successful deletes (often an empty body).
            if (operation === 'delete') return undefined;
            return checkResult(result);
        };
    }

    function crud(resource: string) {
        return {
            browse: method(resource, 'browse'), read: method(resource, 'read'),
            add: method(resource, 'add'), edit: method(resource, 'edit'), delete: method(resource, 'delete'),
        };
    }

    return {
        posts: crud('posts'), members: crud('members'), users: crud('users'),
        tags: crud('tags'), tiers: crud('tiers'), offers: crud('offers'),
        newsletters: crud('newsletters'), invites: crud('invites'),
        roles: {browse: method('roles', 'browse'), read: method('roles', 'read')},
        webhooks: {add: method('webhooks', 'add'), edit: method('webhooks', 'edit'), delete: method('webhooks', 'delete')},
    };
}
