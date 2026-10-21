import {ErrorCode, McpError} from '@modelcontextprotocol/sdk/types.js';
import {selector} from './schemas/query';
import {z} from 'zod';
import type {EntityResponse} from './client/types';

function record(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function resourceReadError(): McpError {
    return new McpError(ErrorCode.InternalError, 'Ghost resource read failed. Check the resource ID and Ghost permissions.');
}

export function resourceId(uri: URL, variables: Record<string, string | string[]>, scheme: string, key: string): string {
    const invalid = (): never => { throw new McpError(ErrorCode.InvalidParams, 'Invalid Ghost resource ID or URI.'); };
    if (!record(variables) || Object.keys(variables).length !== 1 || typeof variables[key] !== 'string'
        || uri.protocol !== `${scheme}:` || uri.username || uri.password || uri.port || uri.pathname || uri.search || uri.hash
        || variables[key] !== uri.host) return invalid();
    let id: string;
    try { id = decodeURIComponent(variables[key] as string); } catch { return invalid(); }
    if (!selector.and(z.string().max(191)).safeParse(id).success) return invalid();
    return id;
}

export async function readProtocolEntity(read: () => Promise<EntityResponse>): Promise<EntityResponse> {
    try {
        const result = await read();
        if (!record(result) || !record(result.data) || (result.meta !== undefined && !record(result.meta))) throw resourceReadError();
        return {data: result.data, ...(result.meta !== undefined ? {meta: result.meta} : {})};
    } catch { throw resourceReadError(); }
}
