import {normalizeCollection, normalizeEntity} from './responses';
import type {CollectionResponse, EntityResponse} from './types';

export function readNativeCollection(resource: string, value: unknown): CollectionResponse {
    return normalizeCollection(resource, value);
}

export function readNativeEntity(resource: string, value: unknown): EntityResponse {
    return normalizeEntity(resource, value);
}
