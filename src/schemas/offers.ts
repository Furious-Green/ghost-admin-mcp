import {z} from 'zod';
import {nativeId} from './tiers';

const nonempty = z.string().refine(value => Boolean(value.trim()), 'Expected nonempty value');
export const browseParams = {filter: z.string().optional()};
export const readParams = {id: nativeId};
export const addParams = {
    name: nonempty, code: nonempty, cadence: nonempty, duration: nonempty,
    amount: z.number().int().finite(), tier_id: nativeId, type: nonempty,
    display_title: z.string().optional(), display_description: z.string().optional(),
    duration_in_months: z.number().int().positive().optional(), currency: nonempty.optional(),
};
export const editParams = {
    id: nativeId, name: nonempty.optional(), code: nonempty.optional(),
    display_title: z.string().optional(), display_description: z.string().optional(),
    status: z.enum(['active', 'archived']).optional(),
};
export const schemas = {
    browse: z.object(browseParams).strict(), read: z.object(readParams).strict(),
    add: z.object(addParams).strict().superRefine((value, ctx) => {
        if (value.type === 'fixed' && !value.currency) ctx.addIssue({code: 'custom', path: ['currency'], message: 'Fixed offers require currency'});
        if (value.duration === 'repeating' && value.duration_in_months === undefined) ctx.addIssue({code: 'custom', path: ['duration_in_months'], message: 'Repeating offers require duration_in_months'});
    }),
    edit: z.object(editParams).strict(),
};
export type ToolInputs = {[K in keyof typeof schemas]: z.infer<(typeof schemas)[K]>};
