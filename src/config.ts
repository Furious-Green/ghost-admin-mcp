import type {GhostConfig} from './client/types';

export function readGhostConfig(env: NodeJS.ProcessEnv): GhostConfig {
    if (!env.GHOST_API_URL) throw new Error('GHOST_API_URL environment variable is not set.');
    if (!env.GHOST_ADMIN_API_KEY) throw new Error('GHOST_ADMIN_API_KEY environment variable is not set.');
    return {
        url: env.GHOST_API_URL,
        key: env.GHOST_ADMIN_API_KEY,
        version: env.GHOST_API_VERSION || 'v5.0',
    };
}
