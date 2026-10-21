import {z} from 'zod';
import {schemas} from '../schemas/labels';
import {createNativeAdminRequest} from './nativeAdmin';
import {normalizeCollection, normalizeEntity} from './responses';
import type {GhostClient, GhostConfig, OperationResult, QueryOptions, RequestExecutor} from './types';

export function createLabelClient(config: GhostConfig, makeRequest?: RequestExecutor): GhostClient['labels'] {
    const send = createNativeAdminRequest(config, makeRequest);
    function operation<K extends keyof typeof schemas>(op: K) {
        return async (input: unknown, options?: QueryOptions): Promise<OperationResult<K>> => {
            const parsed = schemas[op].safeParse(input);
            if (!parsed.success || !z.object({}).strict().safeParse(options === undefined ? {} : options).success) throw new Error(`Invalid Ghost labels ${op} input.`);
            const fields: Record<string, unknown> = {...parsed.data};
            const id = typeof fields.id === 'string' ? fields.id : undefined;
            delete fields.id;
            const slug = op === 'read' && typeof fields.slug === 'string' ? fields.slug : undefined;
            if (op === 'read') delete fields.slug;
            const write = op === 'add' || op === 'edit';
            const {include, ...entity} = fields;
            const result = await send(`labels.${op}`, {id, slug,
                query: write ? (include !== undefined ? {include: include as string} : {}) : fields as QueryOptions,
                ...(write ? {body: {labels: [entity]}} : {}),
            });
            if (op === 'delete') return undefined as OperationResult<K>;
            return (op === 'browse' ? normalizeCollection('labels', result) : normalizeEntity('labels', result)) as OperationResult<K>;
        };
    }
    return {browse: operation('browse'), read: operation('read'), add: operation('add'), edit: operation('edit'), delete: operation('delete')};
}
