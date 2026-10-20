// src/tools/tags.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";

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
export const addParams = {
  name: z.string(),
  description: z.string().optional(),
  slug: z.string().optional(),
  // Add more fields as needed
};
export const editParams = {
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  slug: z.string().optional(),
  // Add more fields as needed
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

export function registerTagTools(server: McpServer) {
  // Browse tags
  server.tool(
    "tags_browse",
    browseParams,
    async (args, _extra) => {
      const tags = await ghostApiClient.tags.browse(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tags, null, 2),
          },
        ],
      };
    }
  );

  // Read tag
  server.tool(
    "tags_read",
    readParams,
    async (args, _extra) => {
      const tag = await ghostApiClient.tags.read(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tag, null, 2),
          },
        ],
      };
    }
  );

  // Add tag
  server.tool(
    "tags_add",
    addParams,
    async (args, _extra) => {
      const tag = await ghostApiClient.tags.add(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tag, null, 2),
          },
        ],
      };
    }
  );

  // Edit tag
  server.tool(
    "tags_edit",
    editParams,
    async (args, _extra) => {
      const tag = await ghostApiClient.tags.edit(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tag, null, 2),
          },
        ],
      };
    }
  );

  // Delete tag
  server.tool(
    "tags_delete",
    deleteParams,
    async (args, _extra) => {
      await ghostApiClient.tags.delete(args);
      return {
        content: [
          {
            type: "text",
            text: `Tag with id ${args.id} deleted.`,
          },
        ],
      };
    }
  );
}
