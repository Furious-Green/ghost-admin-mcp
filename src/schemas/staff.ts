import {z} from 'zod';
import {nativeId} from './tiers';

export const inviteBrowseParams = {
    filter: z.string().optional(), limit: z.union([z.number().int().positive(), z.literal('all')]).optional(),
    page: z.number().int().positive().optional(), order: z.string().optional(), fields: z.string().optional(),
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
