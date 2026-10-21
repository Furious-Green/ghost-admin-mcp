import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {GhostClient} from './client/types';
import {registerResources} from './resources';
import {registerPostTools} from './tools/posts';
import {registerPageTools} from './tools/pages';
import {registerMemberTools} from './tools/members';
import {registerUserTools} from './tools/users';
import {registerTagTools} from './tools/tags';
import {registerTierTools} from './tools/tiers';
import {registerOfferTools} from './tools/offers';
import {registerNewsletterTools} from './tools/newsletters';
import {registerInviteTools} from './tools/invites';
import {registerRoleTools} from './tools/roles';
import {registerWebhookTools} from './tools/webhooks';
import {registerLabelTools} from './tools/labels';
import {registerSiteTools} from './tools/site';
import {registerImageTools} from './tools/images';
import {registerThemeTools} from './tools/themes';
import {registerPrompts} from './prompts';
import {installToolDispatcher} from './tools/toolDispatch';

export function createServer(client: GhostClient): McpServer {
    const server = new McpServer({name: 'ghost-mcp-ts', version: '1.0.0'}, {
        capabilities: {resources: {}, tools: {}, prompts: {}, logging: {}},
    });

    registerResources(server, client);

    registerPostTools(server, client);
    registerPageTools(server, client);
    registerMemberTools(server, client);
    registerUserTools(server, client);
    registerTagTools(server, client);
    registerTierTools(server, client);
    registerOfferTools(server, client);
    registerNewsletterTools(server, client);
    registerInviteTools(server, client);
    registerRoleTools(server, client);
    registerWebhookTools(server, client);
    registerLabelTools(server, client);
    registerSiteTools(server, client);
    registerImageTools(server, client);
    registerThemeTools(server, client);
    registerPrompts(server, client);
    installToolDispatcher(server);
    return server;
}
