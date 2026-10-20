import GhostAdminAPI from '@tryghost/admin-api';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createNativeCopy} from './nativeCopy';
import {createCommerceClients} from './commerceClient';
import {createStaffClients} from './staffClient';
import {prepareContentRequest} from './contentRequest';
import {normalizeCollection, normalizeEntity} from './responses';
import {createSdkRequestExecutor} from './sdkRequest';
import type {CollectionResponse, EntityResponse, GhostClient, GhostConfig, OperationResult, QueryOptions, RequestExecutor} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type Operation = 'browse' | 'read' | 'add' | 'edit' | 'delete';
type Invocation = {resource: string; operation: Operation; result?: CollectionResponse | EntityResponse};

// Retain working SDK capabilities and compose focused native adapters where needed.
export function createGhostClient(config: GhostConfig, options: {makeRequest?: RequestExecutor} = {}): GhostClient {
    const invocations = new AsyncLocalStorage<Invocation>();
    const execute = options.makeRequest ?? createSdkRequestExecutor();
    const sdk: unknown = new GhostAdminAPI({...config, makeRequest: async request => {
        const invocation = invocations.getStore();
        if (!invocation) throw new Error('Unexpected Ghost SDK response');
        const body = await execute(request);
        if (invocation.operation !== 'delete') {
            // Capture before the SDK unwraps singletons or attaches hidden array
            // metadata. Each async invocation owns its result, even for the same resource.
            invocation.result = invocation.operation === 'browse'
                ? normalizeCollection(invocation.resource, body, 'Unexpected Ghost SDK response')
                : normalizeEntity(invocation.resource, body, 'Unexpected Ghost SDK response');
        }
        return body;
    }});
    const copy = createNativeCopy(config, options.makeRequest);

    function method<K extends Operation>(resource: string, operation: K) {
        return async (input: unknown, query?: QueryOptions): Promise<OperationResult<K>> => {
            const target = isRecord(sdk) ? sdk[resource] : undefined;
            const fn = isRecord(target) ? target[operation] : undefined;
            if (typeof fn !== 'function') {
                throw new Error(`Unsupported Ghost SDK capability: ${resource}.${operation}`);
            }
            let sdkInput = input;
            let sdkQuery = query;
            if (resource === 'posts' || resource === 'pages' || resource === 'tags') {
                const prepared = prepareContentRequest(resource, operation, input, query);
                sdkInput = prepared.input;
                sdkQuery = prepared.query;
            }
            const invocation: Invocation = {resource, operation};
            return invocations.run(invocation, async () => {
                await Reflect.apply(fn, target, [sdkInput, sdkQuery]);
                if (operation === 'delete') return undefined as OperationResult<K>;
                if (!invocation.result) throw new Error('Unexpected Ghost SDK response');
                // The operation selected both normalization and this mapped return type.
                return invocation.result as OperationResult<K>;
            });
        };
    }

    function crud(resource: string) {
        return {
            browse: method(resource, 'browse'), read: method(resource, 'read'),
            add: method(resource, 'add'), edit: method(resource, 'edit'), delete: method(resource, 'delete'),
        };
    }

    return {
        posts: {...crud('posts'), copy: input => copy('posts', input)},
        pages: {...crud('pages'), copy: input => copy('pages', input)},
        members: crud('members'), users: crud('users'),
        tags: crud('tags'), ...createCommerceClients(config, options.makeRequest),
        newsletters: crud('newsletters'), ...createStaffClients(config, options.makeRequest),
        webhooks: {add: method('webhooks', 'add'), edit: method('webhooks', 'edit'), delete: method('webhooks', 'delete')},
    };
}
