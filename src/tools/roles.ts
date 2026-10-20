import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {GhostClient} from '../client/types';
import {roleBrowseParams} from '../schemas/staff';
import {registerStrictTool} from './registerStrictTool';
export {roleBrowseParams as browseParams, type RoleInputs as ToolInputs} from '../schemas/staff';

export function registerRoleTools(server: McpServer, client: GhostClient) {
    registerStrictTool(server, 'roles_browse', 'Browse staff roles; permissions:assign lists assignable roles. Requires a staff access token with sufficient permissions; no pagination or role-read endpoint.', roleBrowseParams, async args => ({
        content: [{type: 'text', text: JSON.stringify(await client.roles.browse(args), null, 2)}],
    }));
}
