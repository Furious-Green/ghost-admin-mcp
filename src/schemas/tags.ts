import {z} from 'zod';
import {csv, nonblank, nullableText, pagingParams, selector, seoFields} from './query';

const response = {include: csv(['count.posts']).optional()};
export const tagQueryShapes = {
    browse: {...pagingParams, filter: nonblank.optional(), order: nonblank.optional(), fields: csv().optional(), ...response},
    read: {fields: csv().optional(), filter: nonblank.optional(), ...response},
    add: response, edit: response, delete: {},
};
const name = z.string().max(191).refine(value => value.trim().length > 0 && !value.startsWith(','), 'Invalid tag name');
const mutable = {
    slug: nullableText(191), description: nullableText(500),
    visibility: z.enum(['public', 'internal']).optional(),
    feature_image: nullableText(2000), ...seoFields, accent_color: nullableText(50),
};
export const tagShapes = {
    browse: tagQueryShapes.browse,
    read: {id: selector.optional(), slug: selector.optional(), ...tagQueryShapes.read},
    add: {name, ...mutable, ...tagQueryShapes.add},
    edit: {id: selector, name: name.optional(), ...mutable, ...tagQueryShapes.edit},
    delete: {id: selector},
};
