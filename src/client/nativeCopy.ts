import {createNativeAdminRequest} from './nativeAdmin';
import type {CopyInput, GhostConfig, GhostEntity, RequestExecutor} from './types';

export function createNativeCopy(config: GhostConfig, makeRequest?: RequestExecutor) {
    const execute = createNativeAdminRequest(config, makeRequest);
    return async (resource: 'posts' | 'pages', input: CopyInput): Promise<GhostEntity> => {
        if (resource !== 'posts' && resource !== 'pages') throw new Error('Invalid Ghost copy resource.');
        if (input.formats !== undefined && !['html', 'lexical', 'html,lexical', 'lexical,html'].includes(input.formats)) {
            throw new Error('Invalid Ghost copy formats.');
        }
        const response = await execute(`${resource}.copy`, {id: input.id,
            query: input.formats === undefined ? {} : {formats: input.formats}});
        const entities = typeof response === 'object' && response !== null
            ? (response as Record<string, unknown>)[resource] : undefined;
        if (!Array.isArray(entities) || entities.length !== 1 || typeof entities[0] !== 'object'
            || entities[0] === null || Array.isArray(entities[0])) {
            throw new Error('Unexpected Ghost copy response');
        }
        return entities[0];
    };
}
