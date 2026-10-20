import {createHmac} from 'node:crypto';
import {createNativeRequestExecutor} from './nativeRequest';
import type {CopyInput, GhostConfig, GhostEntity, RequestExecutor} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(field: string): never {
    throw new Error(`Invalid Ghost copy ${field}.`);
}

function copyUrl(config: GhostConfig, resource: string, input: CopyInput): string {
    if (resource !== 'posts' && resource !== 'pages') invalid('resource');
    if (typeof input.id !== 'string' || !input.id.trim() || input.id === '.' || input.id === '..'
        || /[\\/?#%\x00-\x1f\x7f]/.test(input.id)) invalid('id');
    let segment: string;
    try { segment = encodeURIComponent(input.id); } catch { invalid('id'); }
    let url: URL;
    try { url = new URL(config.url); } catch { invalid('url'); }
    if (!/^https?:\/\//.test(config.url) || !['http:', 'https:'].includes(url.protocol)
        || url.username || url.password || url.search || url.hash || /[?#\\\s]/.test(config.url)
        || config.url.endsWith('/')) invalid('url');
    const prefix = url.pathname === '/' ? '' : url.pathname;
    return `${url.origin}${prefix}/ghost/api/admin/${resource}/${segment}/copy/`;
}

function versionHeader(version: string): string {
    const match = /^v(\d+)(?:\.(\d+))?$/.exec(version);
    if (!match || Number(match[1]) < 5) invalid('version');
    return match[2] === undefined ? `${version}.0` : version;
}

function token(key: string): string {
    if (!/^[0-9a-f]{24}:[0-9a-f]{64}$/i.test(key)) invalid('key');
    const [id, secret] = key.split(':');
    const header = Buffer.from(JSON.stringify({alg: 'HS256', typ: 'JWT', kid: id})).toString('base64url');
    const iat = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({iat, exp: iat + 300, aud: '/admin/'})).toString('base64url');
    const signature = createHmac('sha256', Buffer.from(secret, 'hex')).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${signature}`;
}

function safeRequestError(resource: string, error: unknown): Error {
    const response = isRecord(error) && isRecord(error.response) ? error.response : undefined;
    const status = response?.status;
    if (typeof status !== 'number' || !Number.isInteger(status) || status < 100 || status > 599) {
        return new Error(`Ghost ${resource} copy request failed.`);
    }
    const safe = new Error(`Ghost ${resource} copy failed (HTTP ${status}).`);
    Object.assign(safe, {statusCode: status});
    const data = isRecord(response?.data) ? response.data : undefined;
    const first = Array.isArray(data?.errors) ? data.errors[0] : undefined;
    const type = isRecord(first) ? first.type : undefined;
    // Never reflect arbitrary upstream strings (even an alphanumeric string can be a secret).
    if (typeof type === 'string' && [
        'NoPermissionError', 'NotFoundError', 'ValidationError', 'UnauthorizedError',
        'VersionMismatchError', 'ConflictError', 'BadRequestError', 'InternalServerError',
        'TooManyRequestsError',
    ].includes(type)) safe.name = type;
    return safe;
}

export function createNativeCopy(config: GhostConfig, makeRequest?: RequestExecutor) {
    const execute = makeRequest ?? createNativeRequestExecutor();
    return async (resource: 'posts' | 'pages', input: CopyInput): Promise<GhostEntity> => {
        const url = copyUrl(config, resource, input);
        if (input.formats !== undefined && !['html', 'lexical', 'html,lexical', 'lexical,html'].includes(input.formats)) invalid('formats');
        const version = versionHeader(config.version);
        const authorization = `Ghost ${token(config.key)}`;
        let response: unknown;
        try {
            response = await execute({
                url, method: 'POST', params: input.formats === undefined ? {} : {formats: input.formats},
                headers: {Accept: 'application/json', Authorization: authorization, 'Accept-Version': version},
            });
        } catch (error) {
            throw safeRequestError(resource, error);
        }
        const entities = isRecord(response) ? response[resource] : undefined;
        if (!Array.isArray(entities) || entities.length !== 1 || !isRecord(entities[0])) {
            throw new Error('Unexpected Ghost copy response');
        }
        return entities[0];
    };
}
