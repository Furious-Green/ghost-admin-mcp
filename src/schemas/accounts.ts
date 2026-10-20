import {z} from 'zod';
import {csv, nonblank, nullableText, pagingParams, selector} from './query';

// Pinned Zod excludes '%' from email local parts. Permit that valid atom for
// selector compatibility; only the validation probe changes, never caller data.
export const accountEmail = z.string().max(191).refine(value =>
    z.string().email().safeParse(value.replace(/%/g, '+')).success, 'Invalid email');
const text = (max: number) => z.string().max(max);
const named = text(191).refine(value => Boolean(value.trim()), 'Must not be blank');
const memberInclude = {include: csv(['email_recipients', 'products', 'tiers']).optional()};
const userInclude = {include: csv(['count.posts', 'permissions', 'roles', 'roles.permissions']).optional()};
const newsletterInclude = {include: csv(['count.posts', 'count.members', 'count.active_members']).optional()};
const browse = {...pagingParams, filter: nonblank.optional(), order: nonblank.optional(), fields: csv().optional()};
export const accountQueryShapes = {
    members: {browse: {...browse, search: nonblank.optional(), ...memberInclude}, read: memberInclude, add: {}, edit: {}, delete: {}},
    users: {browse: {...browse, ...userInclude}, read: {fields: csv().optional(), filter: nonblank.optional(), ...userInclude}, edit: userInclude, delete: {}},
    newsletters: {browse: {...browse, ...newsletterInclude}, read: {fields: csv().optional(), ...newsletterInclude}, add: newsletterInclude, edit: newsletterInclude, delete: {}},
    webhooks: {add: {}, edit: {}, delete: {}},
};
const memberFields = {
    name: text(191).optional(), note: text(2000).optional(),
    labels: z.array(z.object({name: named, slug: text(191).nullable().optional()}).strict()).optional(),
    newsletters: z.array(z.object({id: selector.and(text(24))}).strict()).optional(),
};
const newsletterFields = {
    description: nullableText(2000),
    sender_reply_to: z.union([z.enum(['newsletter', 'support']), accountEmail]).optional(),
    status: z.enum(['active', 'archived']).optional(), subscribe_on_signup: z.boolean().optional(),
    show_header_icon: z.boolean().optional(), show_header_title: z.boolean().optional(), show_header_name: z.boolean().optional(),
    title_font_category: z.enum(['serif', 'sans_serif']).optional(), title_alignment: z.enum(['left', 'center']).optional(),
    show_feature_image: z.boolean().optional(), body_font_category: z.enum(['serif', 'sans_serif']).optional(), show_badge: z.boolean().optional(),
};
const webhookFields = {
    name: nullableText(191), secret: nullableText(191), api_version: text(50).and(nonblank).optional(),
};
const event = text(50).and(nonblank).refine(value => value === value.toLowerCase(), 'Expected lowercase webhook event');
const target = text(2000).url().refine(value => /^https?:\/\//i.test(value), 'Expected HTTP(S) webhook URL');
export const accountShapes = {
    members: {
        browse: accountQueryShapes.members.browse,
        read: {id: selector.optional(), email: accountEmail.optional(), ...memberInclude},
        add: {email: accountEmail, ...memberFields},
        edit: {id: selector, email: accountEmail.optional(), ...memberFields}, delete: {id: selector},
    },
    users: {
        browse: accountQueryShapes.users.browse,
        read: {id: selector.optional(), slug: selector.optional(), email: accountEmail.optional(), ...accountQueryShapes.users.read},
        edit: {id: selector, name: named.optional(), email: accountEmail.optional(), slug: text(191).optional(),
            bio: nullableText(250), website: nullableText(2000), location: nullableText(150), facebook: nullableText(2000), twitter: nullableText(2000), ...userInclude},
        delete: {id: selector},
    },
    newsletters: {
        browse: accountQueryShapes.newsletters.browse,
        read: {id: selector.optional(), slug: selector.optional(), ...accountQueryShapes.newsletters.read},
        add: {name: named, ...newsletterFields, ...newsletterInclude},
        edit: {id: selector, name: named.optional(), ...newsletterFields, sender_name: nullableText(191),
            sender_email: z.union([accountEmail, z.literal('')]).nullable().optional(), sort_order: z.number().int().safe().nonnegative().optional(),
            header_image: nullableText(2000), footer_content: z.string().nullable().optional(), ...newsletterInclude},
        delete: {id: selector},
    },
    webhooks: {
        add: {event, target_url: target, ...webhookFields, integration_id: selector.and(text(24)).optional()},
        edit: {id: selector, event: event.optional(), target_url: target.optional(), ...webhookFields}, delete: {id: selector},
    },
};
export type AccountResource = keyof typeof accountShapes;
export type AccountOperation = 'browse' | 'read' | 'add' | 'edit' | 'delete';
