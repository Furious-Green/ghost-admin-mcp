import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {GhostClient} from '../client/types';
import {browseParams, readParams, addParams, editParams} from '../schemas/tiers';
import {registerStrictTool} from './registerStrictTool';
export {browseParams, readParams, addParams, editParams, type ToolInputs} from '../schemas/tiers';

export function registerTierTools(server: McpServer, client: GhostClient) {
    registerStrictTool(server, 'tiers_browse', 'Browse tiers using supported filters and includes.', browseParams, async args => ({
        content: [{type: 'text', text: JSON.stringify(await client.tiers.browse(args), null, 2)}],
    }));
    registerStrictTool(server, 'tiers_read', 'Read a tier by ID; slug selectors are unsupported. Browse first to find its ID.', readParams, async args => ({
        content: [{type: 'text', text: JSON.stringify(await client.tiers.read(args), null, 2)}],
    }));
    registerStrictTool(server, 'tiers_add', 'Create a paid tier. Prices are integer minor-unit amounts.', addParams, async args => ({
        content: [{type: 'text', text: JSON.stringify(await client.tiers.add(args), null, 2)}],
    }));
    registerStrictTool(server, 'tiers_edit', 'Edit a tier by ID. Explicitly archive with active:false; this is not deletion.', editParams, async args => ({
        content: [{type: 'text', text: JSON.stringify(await client.tiers.edit(args), null, 2)}],
    }));
}
