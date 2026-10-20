import {z} from 'zod';
import {encodeNativeId} from '../client/nativeAdmin';

export const nativeId = z.string().refine(value => {
    try { encodeNativeId(value); return true; } catch { return false; }
}, 'Expected a nonempty, safe single-segment ID');
const name = z.string().refine(value => Boolean(value.trim()), 'Expected nonempty name');
const include = z.string().refine(value => value.split(',').every(part =>
    ['monthly_price', 'yearly_price', 'benefits'].includes(part)), 'Unsupported tier include');
export const browseParams = {
    filter: z.string().optional(), limit: z.union([z.number().int().positive(), z.literal('all')]).optional(),
    page: z.number().int().positive().optional(), order: z.string().optional(), fields: z.string().optional(),
    include: include.optional(),
};
export const readParams = {id: nativeId, include: include.optional()};
export const addParams = {
    name, description: z.string().optional(), welcome_page_url: z.string().optional(),
    visibility: z.string().optional(), monthly_price: z.number().int().nonnegative().optional(),
    yearly_price: z.number().int().nonnegative().optional(), currency: z.string().optional(),
    benefits: z.array(z.string()).optional(),
};
export const editParams = {...addParams, id: nativeId, name: name.optional(), active: z.boolean().optional()};
export const schemas = {
    browse: z.object(browseParams).strict(), read: z.object(readParams).strict(),
    add: z.object(addParams).strict(), edit: z.object(editParams).strict(),
};
export type ToolInputs = {[K in keyof typeof schemas]: z.infer<(typeof schemas)[K]>};
