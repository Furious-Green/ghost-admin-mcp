import {z} from 'zod';
import {nativeId} from './tiers';
import {csv, nonblank, pagingParams} from './query';

export const inviteBrowseParams = {
    ...pagingParams, filter: nonblank.optional(), order: nonblank.optional(), fields: csv().optional(),
};
export const inviteAddParams = {role_id: nativeId, email: z.string().email()};
export const inviteDeleteParams = {id: nativeId};
export const roleBrowseParams = {permissions: z.literal('assign').optional()};
export const inviteSchemas = {
    browse: z.object(inviteBrowseParams).strict(), add: z.object(inviteAddParams).strict(),
    delete: z.object(inviteDeleteParams).strict(),
};
export const roleSchemas = {browse: z.object(roleBrowseParams).strict()};
export type InviteInputs = {[K in keyof typeof inviteSchemas]: z.infer<(typeof inviteSchemas)[K]>};
export type RoleInputs = {[K in keyof typeof roleSchemas]: z.infer<(typeof roleSchemas)[K]>};
