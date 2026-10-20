import {createNativeAdminRequest} from './nativeAdmin';
import {normalizeEntity} from './responses';
import type {CopyInput, EntityResponse, GhostConfig, RequestExecutor} from './types';
import {z} from 'zod';
import {formatsParam} from '../schemas/query';

export function createNativeCopy(config: GhostConfig, makeRequest?: RequestExecutor) {
    const execute = createNativeAdminRequest(config, makeRequest);
    return async (resource: 'posts' | 'pages', input: CopyInput): Promise<EntityResponse> => {
        if (resource !== 'posts' && resource !== 'pages') throw new Error('Invalid Ghost copy resource.');
        if (!z.object({id: z.string(), formats: formatsParam}).strict().safeParse(input).success) {
            throw new Error('Invalid Ghost copy formats.');
        }
        const response = await execute(`${resource}.copy`, {id: input.id,
            query: input.formats === undefined ? {} : {formats: input.formats}});
        return normalizeEntity(resource, response, 'Unexpected Ghost copy response');
    };
}
