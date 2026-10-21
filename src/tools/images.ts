import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {GhostClient} from '../client/types';
import {imageUploadParams, prepareImageUpload} from '../schemas/images';
import {registerStrictTool} from './registerStrictTool';

export function registerImageTools(server: McpServer, client: GhostClient): void {
    registerStrictTool(server, 'images_upload', 'Upload supplied canonical base64 image bytes to configured Ghost storage (writes a file, does not publish or assign a post image). Max 5 MiB decoded; matching filename, MIME and JPEG/PNG/GIF/WebP signature required. No local paths, URL fetching or temporary files. Header checks are not full image validation. A timed-out/error upload may already exist: inspect Ghost before manually retrying; never automatically retried.', imageUploadParams, async args => {
        prepareImageUpload(args); // Protect even permissive injected clients.
        return {content: [{type: 'text', text: JSON.stringify(await client.images.upload(args), null, 2)}]};
    });
}
