import {z} from 'zod';
import {encodePageSelector} from '../client/pageSelector';

export const nonblank = z.string().refine(value => value.trim().length > 0, 'Must not be blank');
export const selector = nonblank.refine(value => {
    try { encodePageSelector(value); return true; }
    catch { return false; }
}, 'Invalid Ghost selector');

export function csv(allowed?: readonly string[]) {
    return nonblank.refine(value => value.split(',').every(token =>
        token.trim().length > 0 && (!allowed || allowed.includes(token))), 'Invalid comma-separated list');
}
export const formatsParam = csv(['html', 'lexical', 'plaintext', 'mobiledoc']).optional();
export const pagingParams = {
    page: z.number().int().safe().positive().optional(),
    limit: z.union([z.number().int().safe().positive(), z.literal('all')]).optional(),
};
export const dateTime = z.string().datetime({offset: true});
export const nullableText = (max: number) => z.string().max(max).nullable().optional();
export const seoFields = {
    meta_title: nullableText(300), meta_description: nullableText(500),
    og_title: nullableText(300), og_description: nullableText(500), og_image: nullableText(2000),
    twitter_title: nullableText(300), twitter_description: nullableText(500), twitter_image: nullableText(2000),
    codeinjection_head: nullableText(65535), codeinjection_foot: nullableText(65535),
    canonical_url: nullableText(2000),
};
