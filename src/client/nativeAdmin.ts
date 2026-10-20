import {createHmac} from 'node:crypto';
import {createNativeRequestExecutor} from './nativeRequest';
import type {GhostConfig, QueryOptions, RequestExecutor} from './types';

const routes = {
    'posts.copy': ['posts', 'POST', true, false, true],
    'pages.copy': ['pages', 'POST', true, false, true],
    'tiers.browse': ['tiers', 'GET', false, false],
    'tiers.read': ['tiers', 'GET', true, false],
    'tiers.add': ['tiers', 'POST', false, true],
    'tiers.edit': ['tiers', 'PUT', true, true],
    'offers.browse': ['offers', 'GET', false, false],
    'offers.read': ['offers', 'GET', true, false],
    'offers.add': ['offers', 'POST', false, true],
    'offers.edit': ['offers', 'PUT', true, true],
    'invites.browse': ['invites', 'GET', false, false],
    'invites.add': ['invites', 'POST', false, true],
    'invites.delete': ['invites', 'DELETE', true, false],
    'roles.browse': ['roles', 'GET', false, false],
} as const;
export type NativeOperation = keyof typeof routes;
export type NativeInput = {id?: string; query?: QueryOptions; body?: unknown};

export function encodeNativeId(value: unknown): string {
    if (typeof value !== 'string' || !value.trim() || value === '.' || value === '..'
        || /[\\/?#%\x00-\x1f\x7f]/.test(value)) throw new Error('Invalid Ghost native id.');
    try { return encodeURIComponent(value); } catch { throw new Error('Invalid Ghost native id.'); }
}

function record(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeError(label: string, error: unknown): Error {
    const response = record(error) && record(error.response) ? error.response : undefined;
    const status = response?.status;
    if (typeof status !== 'number' || !Number.isInteger(status) || status < 100 || status > 599) {
        return new Error(`Ghost ${label} request failed.`);
    }
    const safe = new Error(`Ghost ${label} failed (HTTP ${status}).`);
    Object.assign(safe, {statusCode: status});
    const data = record(response?.data) ? response.data : undefined;
    const first = Array.isArray(data?.errors) ? data.errors[0] : undefined;
    const type = record(first) ? first.type : undefined;
    if (typeof type === 'string' && [
        'NoPermissionError', 'NotFoundError', 'ValidationError', 'UnauthorizedError',
        'VersionMismatchError', 'ConflictError', 'BadRequestError', 'InternalServerError',
        'TooManyRequestsError',
    ].includes(type)) safe.name = type;
    return safe;
}

export function createNativeAdminRequest(config: GhostConfig, makeRequest?: RequestExecutor) {
    const execute = makeRequest ?? createNativeRequestExecutor();
    return async (operation: NativeOperation, input: NativeInput = {}): Promise<unknown> => {
        if (!Object.hasOwn(routes, operation)) throw new Error('Invalid Ghost native operation.');
        const route: readonly [string, string, boolean, boolean, boolean?] = routes[operation];
        const [resource, method, needsId, write, copy] = route;
        const label = operation.replace('.', ' ');
        const invalid: (field: string) => never = field => { throw new Error(`Invalid Ghost ${copy ? 'copy' : label} ${field}.`); };
        let segment = '';
        if (needsId) {
            try { segment = encodeNativeId(input.id); } catch { invalid('id'); }
        }
        if (!write && input.body !== undefined) invalid('body');
        let url: URL;
        try { url = new URL(config.url); } catch { invalid('url'); }
        if (!/^https?:\/\//.test(config.url) || !['http:', 'https:'].includes(url.protocol)
            || url.username || url.password || url.search || url.hash || /[?#\\\s]/.test(config.url)
            || config.url.endsWith('/')) invalid('url');
        const prefix = url.pathname === '/' ? '' : url.pathname;
        const path = `${url.origin}${prefix}/ghost/api/admin/${resource}/${needsId ? `${segment}/` : ''}${copy ? 'copy/' : ''}`;
        const match = /^v(\d+)(?:\.(\d+))?$/.exec(config.version);
        if (!match || Number(match[1]) < 5) invalid('version');
        const version = match[2] === undefined ? `${config.version}.0` : config.version;
        if (!/^[0-9a-f]{24}:[0-9a-f]{64}$/i.test(config.key)) invalid('key');
        const [id, secret] = config.key.split(':');
        const header = Buffer.from(JSON.stringify({alg: 'HS256', typ: 'JWT', kid: id})).toString('base64url');
        const iat = Math.floor(Date.now() / 1000);
        const payload = Buffer.from(JSON.stringify({iat, exp: iat + 300, aud: '/admin/'})).toString('base64url');
        const signature = createHmac('sha256', Buffer.from(secret, 'hex')).update(`${header}.${payload}`).digest('base64url');
        try {
            return await execute({url: path, method, params: input.query ?? {},
                ...(write ? {data: input.body} : {}),
                headers: {Accept: 'application/json', Authorization: `Ghost ${header}.${payload}.${signature}`,
                    'Accept-Version': version, ...(write ? {'Content-Type': 'application/json'} : {})},
            });
        } catch (error) { throw safeError(label, error); }
    };
}
