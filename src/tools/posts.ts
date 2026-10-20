import {z} from 'zod';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {GhostClient} from '../client/types';
import {postShapes} from '../schemas/content';
import {registerStrictTool} from './registerStrictTool';

export const {browse: browseParams, read: readParams, add: addParams, edit: editParams, delete: deleteParams} = postShapes;
export type ToolInputs = {
  browse: z.infer<z.ZodObject<typeof browseParams>>;
  read: z.infer<z.ZodObject<typeof readParams>>;
  add: z.infer<z.ZodObject<typeof addParams>>;
  edit: z.infer<z.ZodObject<typeof editParams>>;
  delete: z.infer<z.ZodObject<typeof deleteParams>>;
};

export function registerPostTools(server: McpServer, client: GhostClient): void {
  registerStrictTool(server, 'posts_browse', 'Browse posts with explicit query options.', browseParams, async args => ({
    content: [{type: 'text', text: JSON.stringify(await client.posts.browse(args), null, 2)}],
  }));
  registerStrictTool(server, 'posts_read', 'Read exactly one post by id or slug.', readParams, async args => {
    const {id, slug, ...query} = args;
    const post = await client.posts.read({...(id !== undefined ? {id} : {}), ...(slug !== undefined ? {slug} : {})}, query);
    return {content: [{type: 'text', text: JSON.stringify(post, null, 2)}]};
  });
  registerStrictTool(server, 'posts_add', 'Add a post with supported writable fields.', addParams, async args => {
    const {include, formats, ...entity} = args;
    const post = await client.posts.add(entity, {
      ...(include !== undefined ? {include} : {}), ...(formats !== undefined ? {formats} : {}),
      ...(entity.html ? {source: 'html'} : {}),
    });
    return {content: [{type: 'text', text: JSON.stringify(post, null, 2)}]};
  });
  registerStrictTool(server, 'posts_edit', 'Edit a post using its current updated_at; optionally save a revision.', editParams, async args => {
    const {include, formats, save_revision, ...entity} = args;
    const post = await client.posts.edit(entity, {
      ...(include !== undefined ? {include} : {}), ...(formats !== undefined ? {formats} : {}),
      ...(save_revision !== undefined ? {save_revision} : {}), ...(entity.html ? {source: 'html'} : {}),
    });
    return {content: [{type: 'text', text: JSON.stringify(post, null, 2)}]};
  });
  registerStrictTool(server, 'posts_delete', 'Delete a post by id.', deleteParams, async args => {
    await client.posts.delete(args);
    return {content: [{type: 'text', text: `Post with id ${args.id} deleted.`}]};
  });
  registerStrictTool(server, 'posts_copy', 'Copy a post as a new Ghost draft.', postShapes.copy, async args => ({
    content: [{type: 'text', text: JSON.stringify(await client.posts.copy(args), null, 2)}],
  }));
}
