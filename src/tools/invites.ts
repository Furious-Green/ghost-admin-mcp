import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {GhostClient} from '../client/types';
import {inviteBrowseParams, inviteAddParams, inviteDeleteParams} from '../schemas/staff';
import {registerStrictTool} from './registerStrictTool';
export {inviteBrowseParams as browseParams, inviteAddParams as addParams,
    inviteDeleteParams as deleteParams, type InviteInputs as ToolInputs} from '../schemas/staff';

export function registerInviteTools(server: McpServer, client: GhostClient) {
    registerStrictTool(server, 'invites_browse', 'Browse staff invitations. Requires a staff access token with sufficient permissions.', inviteBrowseParams, async args => ({
        content: [{type: 'text', text: JSON.stringify(await client.invites.browse(args), null, 2)}],
    }));
    registerStrictTool(server, 'invites_add', 'Invite staff by role ID and email. Sends a real invitation email; requires a staff access token with sufficient permissions.', inviteAddParams, async args => ({
        content: [{type: 'text', text: JSON.stringify(await client.invites.add(args), null, 2)}],
    }));
    registerStrictTool(server, 'invites_delete', 'Delete a staff invitation by ID. Requires a staff access token with sufficient permissions.', inviteDeleteParams, async args => {
        await client.invites.delete(args);
        return {content: [{type: 'text', text: `Invite with id ${args.id} deleted.`}]};
    });
}
