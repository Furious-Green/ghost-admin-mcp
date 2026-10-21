import {McpServer, ResourceTemplate} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {GhostClient} from './client/types';
import {
    handleUserResource, handleMemberResource, handleTierResource, handleOfferResource,
    handleNewsletterResource, handlePostResource, handleBlogInfoResource,
} from './resources';
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
import {registerPrompts} from './prompts';

export function createServer(client: GhostClient): McpServer {
    const server = new McpServer({name: 'ghost-mcp-ts', version: '1.0.0'}, {
        capabilities: {resources: {}, tools: {}, prompts: {}, logging: {}},
    });

    // These handlers retain their existing placeholders until issue #11.
    server.resource('user', new ResourceTemplate('user://{user_id}', {list: undefined}), handleUserResource);
    server.resource('member', new ResourceTemplate('member://{member_id}', {list: undefined}), handleMemberResource);
    server.resource('tier', new ResourceTemplate('tier://{tier_id}', {list: undefined}), handleTierResource);
    server.resource('offer', new ResourceTemplate('offer://{offer_id}', {list: undefined}), handleOfferResource);
    server.resource('newsletter', new ResourceTemplate('newsletter://{newsletter_id}', {list: undefined}), handleNewsletterResource);
    server.resource('post', new ResourceTemplate('post://{post_id}', {list: undefined}), handlePostResource);
    server.resource('blog-info', 'blog://info', handleBlogInfoResource);

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
    registerPrompts(server, client);
    return server;
}
