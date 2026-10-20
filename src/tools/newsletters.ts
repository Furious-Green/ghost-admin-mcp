// src/tools/newsletters.ts
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
  sender_reply_to: z.string().optional(),
  status: z.string().optional(),
  subscribe_on_signup: z.boolean().optional(),
  show_header_icon: z.boolean().optional(),
  show_header_title: z.boolean().optional(),
  show_header_name: z.boolean().optional(),
  title_font_category: z.string().optional(),
  title_alignment: z.string().optional(),
  show_feature_image: z.boolean().optional(),
  body_font_category: z.string().optional(),
  show_badge: z.boolean().optional(),
  // Add more fields as needed
};
export const editParams = {
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  sender_name: z.string().optional(),
  sender_email: z.string().optional(),
  sender_reply_to: z.string().optional(),
  status: z.string().optional(),
  subscribe_on_signup: z.boolean().optional(),
  sort_order: z.number().optional(),
  header_image: z.string().optional(),
  show_header_icon: z.boolean().optional(),
  show_header_title: z.boolean().optional(),
  title_font_category: z.string().optional(),
  title_alignment: z.string().optional(),
  show_feature_image: z.boolean().optional(),
  body_font_category: z.string().optional(),
  footer_content: z.string().optional(),
  show_badge: z.boolean().optional(),
  show_header_name: z.boolean().optional(),
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

export function registerNewsletterTools(server: McpServer) {
  // Browse newsletters
  server.tool(
    "newsletters_browse",
    browseParams,
    async (args, _extra) => {
      const newsletters = await ghostApiClient.newsletters.browse(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(newsletters, null, 2),
          },
        ],
      };
    }
  );

  // Read newsletter
  server.tool(
    "newsletters_read",
    readParams,
    async (args, _extra) => {
      const newsletter = await ghostApiClient.newsletters.read(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(newsletter, null, 2),
          },
        ],
      };
    }
  );

  // Add newsletter
  server.tool(
    "newsletters_add",
    addParams,
    async (args, _extra) => {
      const newsletter = await ghostApiClient.newsletters.add(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(newsletter, null, 2),
          },
        ],
      };
    }
  );

  // Edit newsletter
  server.tool(
    "newsletters_edit",
    editParams,
    async (args, _extra) => {
      const newsletter = await ghostApiClient.newsletters.edit(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(newsletter, null, 2),
          },
        ],
      };
    }
  );

  // Delete newsletter
  server.tool(
    "newsletters_delete",
    deleteParams,
    async (args, _extra) => {
      await ghostApiClient.newsletters.delete(args);
      return {
        content: [
          {
            type: "text",
            text: `Newsletter with id ${args.id} deleted.`,
          },
        ],
      };
    }
  );
}
