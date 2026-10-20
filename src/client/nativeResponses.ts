import type {GhostArray, GhostEntity} from './types';

function record(value: unknown): value is GhostEntity {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readNativeCollection(resource: string, value: unknown): GhostArray {
    const entities = record(value) ? value[resource] : undefined;
    if (!Array.isArray(entities) || !entities.every(record)
        || (record(value) && value.meta !== undefined && !record(value.meta))) {
        throw new Error(`Unexpected Ghost ${resource} response`);
    }
    const result: GhostArray = [...entities];
    if (record(value) && record(value.meta)) result.meta = value.meta;
    return result;
}

export function readNativeEntity(resource: string, value: unknown): GhostEntity {
    const result = readNativeCollection(resource, value);
    if (result.length !== 1) throw new Error(`Unexpected Ghost ${resource} response`);
    return result[0];
}
