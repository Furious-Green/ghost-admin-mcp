import {z} from 'zod';
import {csv, nonblank, pagingParams, selector} from './query';

const include = {include: csv(['count.members']).optional()};
const name = nonblank.and(z.string().max(191));
export const shapes = {
    browse: {...pagingParams, filter: nonblank.optional(), order: nonblank.optional(), fields: csv().optional(), ...include},
    read: {id: selector.optional(), slug: selector.optional(), filter: nonblank.optional(), fields: csv().optional(), ...include},
    add: {name, slug: name.optional(), ...include},
    edit: {id: selector, name: name.optional(), slug: name.optional(), ...include},
    delete: {id: selector},
};
export const schemas = {
    browse: z.object(shapes.browse).strict(),
    read: z.object(shapes.read).strict().refine(value => Number(value.id !== undefined) + Number(value.slug !== undefined) === 1, 'Provide exactly one id or slug'),
    add: z.object(shapes.add).strict(), edit: z.object(shapes.edit).strict(), delete: z.object(shapes.delete).strict(),
};
export type LabelInputs = {[K in keyof typeof schemas]: z.infer<(typeof schemas)[K]>};
