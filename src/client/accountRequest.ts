import {z} from 'zod';
import {accountShapes, accountQueryShapes, AccountResource, AccountOperation} from '../schemas/accounts';
import {encodePageSelector} from './pageSelector';
import type {QueryOptions} from './types';

export function validateAccountInput(resource: AccountResource, operation: AccountOperation, input: unknown, options?: QueryOptions): Record<string, unknown> {
    const shapes = accountShapes[resource] as Partial<Record<AccountOperation, z.ZodRawShape>>;
    const queries = accountQueryShapes[resource] as Partial<Record<AccountOperation, z.ZodRawShape>>;
    const shape = shapes[operation];
    if (!shape) throw new Error(`Unsupported Ghost ${resource} ${operation}.`);
    // Avoid Zod errors that include rejected account/webhook values in messages.
    const parsed = z.object(shape).strict().safeParse(input);
    const query = z.object(queries[operation] ?? {}).strict().safeParse(options === undefined ? {} : options);
    if (!parsed.success || !query.success) throw new Error(`Invalid Ghost ${resource} ${operation} input.`);
    const fields: Record<string, unknown> = parsed.data;
    const external: Record<string, unknown> = query.data;
    for (const key of Object.keys(external)) if (Object.hasOwn(fields, key)) throw new Error(`Duplicate Ghost ${resource} query option.`);
    const merged: Record<string, unknown> = Object.fromEntries([
        ...Object.keys(input as object).map(key => [key, fields[key]]),
        ...Object.keys(options ?? {}).map(key => [key, external[key]]),
    ]);
    if (operation === 'read' && ['id', 'slug', 'email'].filter(key => merged[key] !== undefined).length !== 1) {
        throw new Error(`Provide exactly one ${resource} selector.`);
    }
    return merged;
}

export function splitAccountRequest(resource: AccountResource, operation: AccountOperation, fields: Record<string, unknown>): {input: Record<string, unknown>; query: QueryOptions} {
    if (operation === 'browse') return {input: fields, query: {}};
    const shapes = accountQueryShapes[resource] as Partial<Record<AccountOperation, z.ZodRawShape>>;
    const input: Record<string, unknown> = {}, query: QueryOptions = {};
    for (const [key, value] of Object.entries(fields)) {
        if (Object.hasOwn(shapes[operation] ?? {}, key)) query[key] = value as QueryOptions[string];
        else input[key] = value;
    }
    return {input, query};
}

export function prepareAccountRequest(resource: AccountResource, operation: AccountOperation, input: unknown, options?: QueryOptions): {input: Record<string, unknown>; query: QueryOptions} {
    const prepared = splitAccountRequest(resource, operation, validateAccountInput(resource, operation, input, options));
    if (prepared.input.id !== undefined) prepared.input.id = encodePageSelector(prepared.input.id);
    if (operation === 'read') {
        if (prepared.input.slug !== undefined) prepared.input.slug = encodePageSelector(prepared.input.slug);
        if (prepared.input.email !== undefined) prepared.input.email = encodeURIComponent(prepared.input.email as string);
    }
    return prepared;
}
