import {z} from 'zod';
import {encodeNativeId} from '../client/nativeAdmin';
import {csv, nonblank, nullableText, pagingParams} from './query';

export const nativeId = z.string().refine(value => {
    try { encodeNativeId(value); return true; } catch { return false; }
}, 'Expected a nonempty, safe single-segment ID');
const name = z.string().max(191).refine(value => Boolean(value.trim()), 'Expected nonempty name');
export const browseParams = {
    ...pagingParams, filter: nonblank.optional(), order: nonblank.optional(), fields: csv().optional(),
};
export const readParams = {id: nativeId};
export const addParams = {
    name, description: nullableText(191), welcome_page_url: nullableText(2000),
    visibility: z.enum(['public', 'none']).optional(), monthly_price: z.number().int().safe().nonnegative().optional(),
    yearly_price: z.number().int().safe().nonnegative().optional(), currency: nonblank.optional(),
    benefits: z.array(z.string()).optional(),
};
export const editParams = {...addParams, id: nativeId, name: name.optional(), active: z.boolean().optional()};
export const schemas = {
    browse: z.object(browseParams).strict(), read: z.object(readParams).strict(),
    add: z.object(addParams).strict(), edit: z.object(editParams).strict(),
};
export type ToolInputs = {[K in keyof typeof schemas]: z.infer<(typeof schemas)[K]>};
