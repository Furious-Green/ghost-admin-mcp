import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {GhostClient} from '../client/types';
import {themeUploadParams, themeActivateParams, prepareThemeUpload, prepareThemeActivate} from '../schemas/themes';
import {registerStrictTool} from './registerStrictTool';

export function registerThemeTools(server: McpServer, client: GhostClient): void {
    registerStrictTool(server, 'themes_upload', 'Upload a supplied base64 classic ZIP (max 10 MiB, conservative metadata checks) to configured Ghost. WARNING: same-name replacement can immediately reload active theme files and change the public site; not harmless staging. Upload never calls the separate activation endpoint. Requires theme add permission and hosting plan support. No paths, URL fetching, local extraction, temporary files or automatic retries. Inspect returned state/Ghost after errors before manual retry.', themeUploadParams, async args => {
        prepareThemeUpload(args);
        return {content: [{type: 'text', text: JSON.stringify(await client.themes.upload(args), null, 2)}]};
    }, 'Invalid Ghost theme upload input.');
    registerStrictTool(server, 'themes_activate', 'Activate the explicitly named installed theme on configured Ghost. WARNING: changes active theme and public site appearance; requires theme activate permission and hosting plan support. Separate from upload; never inferred, automatically chained, retried or rolled back. Inspect returned active state and Ghost after errors before manual retry.', themeActivateParams, async args => {
        prepareThemeActivate(args);
        return {content: [{type: 'text', text: JSON.stringify(await client.themes.activate(args), null, 2)}]};
    }, 'Invalid Ghost theme activate input.');
}
