import {z} from 'zod';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {GhostClient} from '../client/types';
import {pageShapes} from '../schemas/content';
import {registerStrictTool} from './registerStrictTool';

export const {browse: browseParams, read: readParams, add: addParams, edit: editParams, delete: deleteParams} = pageShapes;
export type ToolInputs = {
  browse: z.infer<z.ZodObject<typeof browseParams>>;
  read: z.infer<z.ZodObject<typeof readParams>>;
  add: z.infer<z.ZodObject<typeof addParams>>;
  edit: z.infer<z.ZodObject<typeof editParams>>;
  delete: z.infer<z.ZodObject<typeof deleteParams>>;
};

export function registerPageTools(server: McpServer, client: GhostClient): void {
  registerStrictTool(server, 'pages_browse', 'Browse pages with explicit query options.', browseParams, async args => ({
    content: [{type: 'text', text: JSON.stringify(await client.pages.browse(args), null, 2)}],
  }));
  registerStrictTool(server, 'pages_read', 'Read exactly one page by id or slug.', readParams, async args => {
    const {id, slug, ...query} = args;
    const page = await client.pages.read({...(id !== undefined ? {id} : {}), ...(slug !== undefined ? {slug} : {})}, query);
    return {content: [{type: 'text', text: JSON.stringify(page, null, 2)}]};
  });
  registerStrictTool(server, 'pages_add', 'Add a page with supported writable fields.', addParams, async args => {
    const {include, formats, ...entity} = args;
    const page = await client.pages.add(entity, {
      ...(include !== undefined ? {include} : {}), ...(formats !== undefined ? {formats} : {}),
      ...(entity.html ? {source: 'html'} : {}),
    });
    return {content: [{type: 'text', text: JSON.stringify(page, null, 2)}]};
  });
  registerStrictTool(server, 'pages_edit', 'Edit a page using its current updated_at; optionally save a revision.', editParams, async args => {
    const {include, formats, save_revision, ...entity} = args;
    const page = await client.pages.edit(entity, {
      ...(include !== undefined ? {include} : {}), ...(formats !== undefined ? {formats} : {}),
      ...(save_revision !== undefined ? {save_revision} : {}), ...(entity.html ? {source: 'html'} : {}),
    });
    return {content: [{type: 'text', text: JSON.stringify(page, null, 2)}]};
  });
  registerStrictTool(server, 'pages_delete', 'Delete a page by id.', deleteParams, async args => {
    await client.pages.delete(args);
    return {content: [{type: 'text', text: `Page with id ${args.id} deleted.`}]};
  });
  registerStrictTool(server, 'pages_copy', 'Copy a page as a new Ghost draft.', pageShapes.copy, async args => ({
    content: [{type: 'text', text: JSON.stringify(await client.pages.copy(args), null, 2)}],
  }));
}
