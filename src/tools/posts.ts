// src/tools/posts.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GhostClient } from "../client/types";
import { contentMutableFields, copyParams } from './contentSchemas';

// Parameter schemas as ZodRawShape (object literals)
export const browseParams = {
  filter: z.string().optional(),
  limit: z.number().optional(),
  page: z.number().optional(),
  order: z.string().optional(),
};
export const readParams = {
  id: z.string().optional(),
  slug: z.string().optional(),
};
// Shared mutable post fields — accepted by both posts_add and posts_edit.
// Mirrors the Ghost Admin API post resource:
// https://ghost.org/docs/admin-api/#the-post-object
const postMutableFields = {
  ...contentMutableFields,
  email_only: z.boolean().optional(),
};
export const addParams = {
  title: z.string(),
  ...postMutableFields,
};
export const editParams = {
  id: z.string(),
  updated_at: z.string(),
  title: z.string().optional(),
  ...postMutableFields,
};
export const deleteParams = {
  id: z.string(),
};

export type ToolInputs = {
  browse: z.infer<z.ZodObject<typeof browseParams>>;
  read: z.infer<z.ZodObject<typeof readParams>>;
  add: z.infer<z.ZodObject<typeof addParams>>;
  edit: z.infer<z.ZodObject<typeof editParams>>;
  delete: z.infer<z.ZodObject<typeof deleteParams>>;
};

export function registerPostTools(server: McpServer, ghostApiClient: GhostClient) {
  server.tool('posts_copy', copyParams, async args => ({
    content: [{type: 'text', text: JSON.stringify(await ghostApiClient.posts.copy(args), null, 2)}],
  }));
  // Browse posts
  server.tool(
    "posts_browse",
    browseParams,
    async (args, _extra) => {
      const posts = await ghostApiClient.posts.browse(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(posts, null, 2),
          },
        ],
      };
    }
  );

  // Read post
  server.tool(
    "posts_read",
    readParams,
    async (args, _extra) => {
      const post = await ghostApiClient.posts.read(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(post, null, 2),
          },
        ],
      };
    }
  );

  // Add post
  server.tool(
    "posts_add",
    addParams,
    async (args, _extra) => {
      // If html is present, use source: "html" to ensure Ghost uses the html content
      const options = args.html ? { source: "html" } : undefined;
      const post = await ghostApiClient.posts.add(args, options);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(post, null, 2),
          },
        ],
      };
    }
  );

  // Edit post
  server.tool(
    "posts_edit",
    editParams,
    async (args, _extra) => {
      // If html is present, use source: "html" to ensure Ghost uses the html content for updates
      const options = args.html ? { source: "html" } : undefined;
      const post = await ghostApiClient.posts.edit(args, options);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(post, null, 2),
          },
        ],
      };
    }
  );

  // Delete post
  server.tool(
    "posts_delete",
    deleteParams,
    async (args, _extra) => {
      await ghostApiClient.posts.delete(args);
      return {
        content: [
          {
            type: "text",
            text: `Post with id ${args.id} deleted.`,
          },
        ],
      };
    }
  );
}
