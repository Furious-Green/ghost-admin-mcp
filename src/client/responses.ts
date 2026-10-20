import type {GhostEntity, GhostMetadata} from './types';

export type GhostResponse<T> = {data: T; meta?: GhostMetadata};
export type CollectionResponse = GhostResponse<GhostEntity[]>;
export type EntityResponse = GhostResponse<GhostEntity>;

function record(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeCollection(resource: string, value: unknown, errorMessage = `Unexpected Ghost ${resource} response`): CollectionResponse {
    const entities = record(value) ? value[resource] : undefined;
    if (!Array.isArray(entities) || !Array.from(entities).every(record)
        || (record(value) && value.meta !== undefined && !record(value.meta))) {
        throw new Error(errorMessage);
    }
    return {data: [...entities], ...(record(value) && record(value.meta) ? {meta: value.meta} : {})};
}

export function normalizeEntity(resource: string, value: unknown, errorMessage = `Unexpected Ghost ${resource} response`): EntityResponse {
    const response = normalizeCollection(resource, value, errorMessage);
    if (response.data.length !== 1) throw new Error(errorMessage);
    return {...response, data: response.data[0]};
}
