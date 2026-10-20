import {z} from 'zod';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {GhostClient} from '../client/types';
import {tagShapes} from '../schemas/tags';
import {registerStrictTool} from './registerStrictTool';

export const {browse: browseParams, read: readParams, add: addParams, edit: editParams, delete: deleteParams} = tagShapes;
export type ToolInputs = {
  browse: z.infer<z.ZodObject<typeof browseParams>>;
  read: z.infer<z.ZodObject<typeof readParams>>;
  add: z.infer<z.ZodObject<typeof addParams>>;
  edit: z.infer<z.ZodObject<typeof editParams>>;
  delete: z.infer<z.ZodObject<typeof deleteParams>>;
};

export function registerTagTools(server: McpServer, client: GhostClient): void {
  registerStrictTool(server, 'tags_browse', 'Browse tags with explicit query options.', browseParams, async args => ({
    content: [{type: 'text', text: JSON.stringify(await client.tags.browse(args), null, 2)}],
  }));
  registerStrictTool(server, 'tags_read', 'Read exactly one tag by id or slug.', readParams, async args => {
    const {id, slug, ...query} = args;
    const tag = await client.tags.read({...id !== undefined ? {id} : {}, ...slug !== undefined ? {slug} : {}}, query);
    return {content: [{type: 'text', text: JSON.stringify(tag, null, 2)}]};
  });
  registerStrictTool(server, 'tags_add', 'Add a tag with SEO, social and display fields.', addParams, async args => {
    const {include, ...entity} = args;
    const tag = await client.tags.add(entity, include === undefined ? {} : {include});
    return {content: [{type: 'text', text: JSON.stringify(tag, null, 2)}]};
  });
  registerStrictTool(server, 'tags_edit', 'Edit a tag with supported nullable clearing fields.', editParams, async args => {
    const {include, ...entity} = args;
    const tag = await client.tags.edit(entity, include === undefined ? {} : {include});
    return {content: [{type: 'text', text: JSON.stringify(tag, null, 2)}]};
  });
  registerStrictTool(server, 'tags_delete', 'Delete a tag by id.', deleteParams, async args => {
    await client.tags.delete(args);
    return {content: [{type: 'text', text: `Tag with id ${args.id} deleted.`}]};
  });
}
