import {z} from 'zod';
import {csv, dateTime, formatsParam, nonblank, nullableText, pagingParams, selector, seoFields} from './query';

const refText = (max: number) => z.string().max(max).refine(value => value.trim().length > 0, 'Must not be blank');
const namedRef = z.object({id: refText(24).optional(), slug: refText(191).optional(), name: refText(191).optional()})
    .strict().refine(value => Object.values(value).some(v => v !== undefined), 'Provide a reference identifier');
export const tagRef = z.union([refText(191), namedRef]);
export const tierRef = z.union([refText(191), namedRef]);
export const authorRef = z.union([refText(191), z.object({id: refText(24).optional(), slug: refText(191).optional(), email: refText(191).optional()})
    .strict().refine(value => Object.values(value).some(v => v !== undefined), 'Provide a reference identifier')]);
const jsonSource = z.string().refine(value => {
    try { JSON.parse(value); return true; } catch { return false; }
}, 'Must contain valid JSON').nullable().optional();

export const contentMutableFields = {
    html: z.string().nullable().optional(), lexical: jsonSource, mobiledoc: jsonSource,
    slug: z.string().max(191).optional(),
    visibility: z.enum(['public', 'members', 'paid', 'tiers']).optional(),
    featured: z.boolean().optional(), published_at: dateTime.nullable().optional(),
    locale: nullableText(6), custom_excerpt: nullableText(300),
    feature_image: nullableText(2000), feature_image_alt: nullableText(191),
    feature_image_caption: nullableText(65535), custom_template: nullableText(100),
    ...seoFields,
    tags: z.array(tagRef).optional(), authors: z.array(authorRef).optional(), tiers: z.array(tierRef).optional(),
};

const pageIncludes = ['tags', 'authors', 'authors.roles', 'tiers', 'count.signups', 'count.paid_conversions', 'post_revisions', 'post_revisions.author'];
const postIncludes = [...pageIncludes, 'email', 'newsletter', 'count.conversions', 'count.clicks', 'sentiment', 'count.positive_feedback', 'count.negative_feedback'];
function queries(includes: string[]) {
    const response = {include: csv(includes).optional(), formats: formatsParam};
    return {
        browse: {...pagingParams, filter: nonblank.optional(), order: nonblank.optional(), fields: csv().optional(), ...response},
        read: {fields: csv().optional(), ...response},
        add: response,
        edit: {...response, save_revision: z.boolean().optional()},
        delete: {},
    };
}
const postQueries = queries(postIncludes);
export const postQueryShapes = {...postQueries, edit: {...postQueries.edit,
    newsletter: selector.and(z.string().max(191)).optional(), email_segment: nonblank.optional(),
}};
export const pageQueryShapes = queries(pageIncludes);
export const copyParams = {id: selector, formats: formatsParam};
const postFields = {...contentMutableFields, status: z.enum(['draft', 'published', 'scheduled', 'sent']).optional(), email_only: z.boolean().optional(), email_subject: nullableText(300)};
const pageFields = {...contentMutableFields, status: z.enum(['draft', 'published', 'scheduled']).optional(), show_title_and_feature_image: z.boolean().optional()};
function shapes<Fields extends z.ZodRawShape, Query extends ReturnType<typeof queries>>(fields: Fields, query: Query) {
    return {
        browse: query.browse,
        read: {id: selector.optional(), slug: selector.optional(), ...query.read},
        add: {title: z.string().max(2000), ...fields, ...query.add},
        edit: {id: selector, updated_at: dateTime, title: z.string().max(2000).optional(), ...fields, ...(query.edit as Query['edit'])},
        delete: {id: selector}, copy: copyParams,
    };
}
export const postShapes = shapes(postFields, postQueryShapes);
export const pageShapes = shapes(pageFields, pageQueryShapes);
