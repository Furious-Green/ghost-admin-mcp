import {schemas as tiers} from '../schemas/tiers';
import {schemas as offers} from '../schemas/offers';
import {createNativeAdminRequest} from './nativeAdmin';
import {readNativeCollection, readNativeEntity} from './nativeResponses';
import type {GhostClient, GhostConfig, OperationResult, QueryOptions, RequestExecutor} from './types';
import {z} from 'zod';

export function createCommerceClients(config: GhostConfig, makeRequest?: RequestExecutor): Pick<GhostClient, 'tiers' | 'offers'> {
    const send = createNativeAdminRequest(config, makeRequest);
    function resource(family: 'tiers' | 'offers', schemas: typeof tiers | typeof offers) {
        function operation<K extends 'browse' | 'read' | 'add' | 'edit'>(op: K) {
            return async (input: unknown, options?: QueryOptions): Promise<OperationResult<K>> => {
                const parsed = schemas[op].safeParse(input);
                if (!parsed.success || !z.object({}).strict().safeParse(options === undefined ? {} : options).success) throw new Error(`Invalid Ghost ${family} ${op} input.`);
                const fields: Record<string, unknown> = {...parsed.data};
                const id = typeof fields.id === 'string' ? fields.id : undefined;
                delete fields.id;
                if (family === 'offers' && op === 'add') {
                    fields.tier = {id: fields.tier_id};
                    delete fields.tier_id;
                }
                const query = op === 'browse' || op === 'read';
                const result = await send(`${family}.${op}`, {id,
                    ...(query ? {query: fields as QueryOptions} : {body: {[family]: [fields]}})});
                return (op === 'browse' ? readNativeCollection(family, result) : readNativeEntity(family, result)) as OperationResult<K>;
            };
        }
        return {browse: operation('browse'), read: operation('read'), add: operation('add'), edit: operation('edit')};
    }
    return {tiers: resource('tiers', tiers), offers: resource('offers', offers)};
}
