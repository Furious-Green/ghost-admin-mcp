import {McpServer, ResourceTemplate} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {EntityResponse, GhostClient} from './client/types';
import {readProtocolEntity, resourceId, resourceReadError} from './protocolReads';

async function contents(uri: URL, read: () => Promise<EntityResponse>) {
    try {
        const result = await readProtocolEntity(read);
        return {contents: [{uri: uri.href, mimeType: 'application/json', text: JSON.stringify(result, null, 2)}]};
    } catch { throw resourceReadError(); }
}

export function registerResources(server: McpServer, client: GhostClient): void {
    const bindings = [
        {scheme: 'user', key: 'user_id', read: (id: string) => client.users.read({id})},
        {scheme: 'member', key: 'member_id', read: (id: string) => client.members.read({id})},
        {scheme: 'tier', key: 'tier_id', read: (id: string) => client.tiers.read({id})},
        {scheme: 'offer', key: 'offer_id', read: (id: string) => client.offers.read({id})},
        {scheme: 'newsletter', key: 'newsletter_id', read: (id: string) => client.newsletters.read({id})},
        {scheme: 'post', key: 'post_id', read: (id: string) => client.posts.read({id}, {formats: 'html'})},
    ];
    for (const {scheme, key, read} of bindings) {
        server.resource(scheme, new ResourceTemplate(`${scheme}://{${key}}`, {list: undefined}),
            {mimeType: 'application/json', description: 'Read one Ghost entity as {data, meta?}; access is limited by the configured Ghost permissions. No automatic enumeration.'},
            async (uri, variables) => {
                const id = resourceId(uri, variables, scheme, key);
                return contents(uri, () => read(id));
            });
    }
    server.resource('blog-info', 'blog://info', {mimeType: 'application/json', description: 'Read public site information, not general settings; no Authorization header is sent to Ghost.'},
        uri => contents(uri, () => client.site.read({})));
}
