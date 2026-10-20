import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {GhostClient} from '../client/types';
import {browseParams, readParams, addParams, editParams} from '../schemas/offers';
import {registerStrictTool} from './registerStrictTool';
export {browseParams, readParams, addParams, editParams, type ToolInputs} from '../schemas/offers';

export function registerOfferTools(server: McpServer, client: GhostClient) {
    registerStrictTool(server, 'offers_browse', 'Browse offers with optional filter; pagination/order are unsupported.', browseParams, async args => ({
        content: [{type: 'text', text: JSON.stringify(await client.offers.browse(args), null, 2)}],
    }));
    registerStrictTool(server, 'offers_read', 'Read an offer by ID; code selectors are unsupported. Browse first to find its ID.', readParams, async args => ({
        content: [{type: 'text', text: JSON.stringify(await client.offers.read(args), null, 2)}],
    }));
    registerStrictTool(server, 'offers_add', 'Create an offer; tier_id maps to tier:{id}. Fixed offers require currency; repeating offers require duration_in_months.', addParams, async args => ({
        content: [{type: 'text', text: JSON.stringify(await client.offers.add(args), null, 2)}],
    }));
    registerStrictTool(server, 'offers_edit', 'Edit offer presentation or explicitly archive with status:archived (Ghost 5.130.0 source-verified). Not deletion.', editParams, async args => ({
        content: [{type: 'text', text: JSON.stringify(await client.offers.edit(args), null, 2)}],
    }));
}
