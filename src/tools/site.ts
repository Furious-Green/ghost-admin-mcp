import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {GhostClient} from '../client/types';
import {registerStrictTool} from './registerStrictTool';

export function registerSiteTools(server: McpServer, client: GhostClient): void {
    registerStrictTool(server, 'site_read', 'Read public site information (title, description, logo, frontend URL and version) from the configured site. The Ghost endpoint is unauthenticated; no credentials are sent. This is read-only information, not general settings access or editing.', {}, async args => ({
        content: [{type: 'text', text: JSON.stringify(await client.site.read(args), null, 2)}],
    }));
}
