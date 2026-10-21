import {z} from 'zod';
import {createNativeAdminRequest} from './nativeAdmin';
import type {GhostClient, GhostConfig, RequestExecutor} from './types';

function record(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createSiteClient(config: GhostConfig, makeRequest?: RequestExecutor): GhostClient['site'] {
    const send = createNativeAdminRequest(config, makeRequest);
    return {read: async (input, options) => {
        const empty = z.object({}).strict();
        if (!empty.safeParse(input).success || !empty.safeParse(options === undefined ? {} : options).success) throw new Error('Invalid Ghost site read input.');
        const result = await send('site.read');
        if (!record(result) || !record(result.site) || (result.meta !== undefined && !record(result.meta))) throw new Error('Unexpected Ghost site response');
        return {data: result.site, ...(record(result.meta) ? {meta: result.meta} : {})};
    }};
}
