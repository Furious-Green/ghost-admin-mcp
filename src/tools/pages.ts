import {z} from 'zod';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {GhostClient} from '../client/types';
import {contentMutableFields, copyParams, formatsParam} from './contentSchemas';

const responseParams = {
  include: z.string().optional(),
  formats: formatsParam,
};
export const browseParams = {
  filter: z.string().optional(),
  order: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.union([z.number().int().positive(), z.literal('all')]).optional(),
  fields: z.string().optional(),
  ...responseParams,
};
export const readParams = {
  id: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).optional(),
  fields: z.string().optional(),
  ...responseParams,
};
const pageMutableFields = {...contentMutableFields, custom_template: z.string().optional()};
export const addParams = {title: z.string(), ...pageMutableFields, ...responseParams};
export const editParams = {
  id: z.string().trim().min(1),
  updated_at: z.string().min(1),
  title: z.string().optional(),
  ...pageMutableFields,
  ...responseParams,
};
export const deleteParams = {id: z.string().trim().min(1)};
export type ToolInputs = {
  browse: z.infer<z.ZodObject<typeof browseParams>>;
  read: z.infer<z.ZodObject<typeof readParams>>;
  add: z.infer<z.ZodObject<typeof addParams>>;
  edit: z.infer<z.ZodObject<typeof editParams>>;
  delete: z.infer<z.ZodObject<typeof deleteParams>>;
};

export function registerPageTools(server: McpServer, client: GhostClient): void {
  server.tool('pages_browse', browseParams, async args => ({
    content: [{type: 'text', text: JSON.stringify(await client.pages.browse(args), null, 2)}],
  }));
  server.tool('pages_read', readParams, async args => {
    const {id, slug, ...query} = args;
    if (Boolean(id) === Boolean(slug)) throw new Error('Provide exactly one page selector: id or slug.');
    const page = await client.pages.read(id ? {id} : {slug}, query);
    return {content: [{type: 'text', text: JSON.stringify(page, null, 2)}]};
  });
  server.tool('pages_add', addParams, async args => {
    const {include, formats, ...entity} = args;
    const options = {
      ...(include !== undefined ? {include} : {}),
      ...(formats !== undefined ? {formats} : {}),
      ...(entity.html ? {source: 'html'} : {}),
    };
    const page = await client.pages.add(entity, options);
    return {content: [{type: 'text', text: JSON.stringify(page, null, 2)}]};
  });
  server.tool('pages_edit', editParams, async args => {
    const {include, formats, ...entity} = args;
    const options = {
      ...(include !== undefined ? {include} : {}),
      ...(formats !== undefined ? {formats} : {}),
      ...(entity.html ? {source: 'html'} : {}),
    };
    const page = await client.pages.edit(entity, options);
    return {content: [{type: 'text', text: JSON.stringify(page, null, 2)}]};
  });
  server.tool('pages_delete', deleteParams, async args => {
    await client.pages.delete(args);
    return {content: [{type: 'text', text: `Page with id ${args.id} deleted.`}]};
  });
  server.tool('pages_copy', copyParams, async args => ({
    content: [{type: 'text', text: JSON.stringify(await client.pages.copy(args), null, 2)}],
  }));
}
