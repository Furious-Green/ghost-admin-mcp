import {z} from 'zod';
import {postShapes, pageShapes, postQueryShapes, pageQueryShapes} from '../schemas/content';
import {tagShapes, tagQueryShapes} from '../schemas/tags';
import {encodePageSelector} from './pageSelector';
import type {QueryOptions} from './types';

type Resource = 'posts' | 'pages' | 'tags';
type Operation = 'browse' | 'read' | 'add' | 'edit' | 'delete';
const shapes = {posts: postShapes, pages: pageShapes, tags: tagShapes};
const queryShapes = {posts: postQueryShapes, pages: pageQueryShapes, tags: tagQueryShapes};

export function prepareContentRequest(resource: Resource, operation: Operation, input: unknown, options?: QueryOptions): {input: Record<string, unknown>; query: QueryOptions} {
    const write = operation === 'add' || operation === 'edit';
    const queryShape: z.ZodRawShape = queryShapes[resource][operation];
    const parsedOptions: Record<string, unknown> = z.object({...queryShape, ...(write && resource !== 'tags' ? {source: z.literal('html').optional()} : {})}).strict().parse(options ?? {});
    const {source, ...externalOptions} = parsedOptions;
    const parsed = z.object(shapes[resource][operation]).strict().parse(input) as Record<string, unknown>;
    for (const key of Object.keys(externalOptions)) {
        if (Object.hasOwn(parsed, key)) throw new Error(`Duplicate Ghost query option: ${key}`);
    }
    // Zod emits schema order; retain the caller's query order for SDK transport parity.
    const combined: Record<string, unknown> = Object.fromEntries([
        ...Object.keys(input as object).map(key => [key, parsed[key]]),
        ...Object.keys(options ?? {}).filter(key => key !== 'source').map(key => [key, externalOptions[key]]),
    ]);
    if (operation === 'read' && Number(combined.id !== undefined) + Number(combined.slug !== undefined) !== 1) {
        throw new Error(`Provide exactly one ${resource === 'pages' ? 'page' : resource === 'posts' ? 'post' : 'tag'} selector: id or slug.`);
    }
    if (resource !== 'tags' && write && !combined.html && combined.lexical && combined.mobiledoc) {
        throw new Error('Provide only one of lexical or mobiledoc unless converting HTML.');
    }
    if (operation === 'browse') return {input: combined, query: {}};
    const entity: Record<string, unknown> = {};
    const query: QueryOptions = {};
    for (const [key, value] of Object.entries(combined)) {
        if (Object.hasOwn(queryShape, key)) query[key] = value as QueryOptions[string];
        else entity[key] = value;
    }
    if (source !== undefined || (resource !== 'tags' && write && combined.html)) query.source = 'html';
    if (entity.id !== undefined) entity.id = encodePageSelector(entity.id);
    if (operation === 'read' && entity.slug !== undefined) entity.slug = encodePageSelector(entity.slug);
    return {input: entity, query};
}
