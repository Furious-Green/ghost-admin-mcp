// src/tools/tiers.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";

// Parameter schemas as ZodRawShape (object literals)
export const browseParams = {
  filter: z.string().optional(),
  limit: z.number().optional(),
  page: z.number().optional(),
  order: z.string().optional(),
  include: z.string().optional(),
};
export const readParams = {
  id: z.string().optional(),
  slug: z.string().optional(),
  include: z.string().optional(),
};
export const addParams = {
  name: z.string(),
  description: z.string().optional(),
  welcome_page_url: z.string().optional(),
  visibility: z.string().optional(),
  monthly_price: z.number().optional(),
  yearly_price: z.number().optional(),
  currency: z.string().optional(),
  benefits: z.array(z.string()).optional(),
  // Add more fields as needed
};
export const editParams = {
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  welcome_page_url: z.string().optional(),
  visibility: z.string().optional(),
  monthly_price: z.number().optional(),
  yearly_price: z.number().optional(),
  currency: z.string().optional(),
  benefits: z.array(z.string()).optional(),
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

export function registerTierTools(server: McpServer) {
  // Browse tiers
  server.tool(
    "tiers_browse",
    browseParams,
    async (args, _extra) => {
      const tiers = await ghostApiClient.tiers.browse(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tiers, null, 2),
          },
        ],
      };
    }
  );

  // Read tier
  server.tool(
    "tiers_read",
    readParams,
    async (args, _extra) => {
      const tier = await ghostApiClient.tiers.read(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tier, null, 2),
          },
        ],
      };
    }
  );

  // Add tier
  server.tool(
    "tiers_add",
    addParams,
    async (args, _extra) => {
      const tier = await ghostApiClient.tiers.add(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tier, null, 2),
          },
        ],
      };
    }
  );

  // Edit tier
  server.tool(
    "tiers_edit",
    editParams,
    async (args, _extra) => {
      const tier = await ghostApiClient.tiers.edit(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tier, null, 2),
          },
        ],
      };
    }
  );

  // Delete tier
  server.tool(
    "tiers_delete",
    deleteParams,
    async (args, _extra) => {
      await ghostApiClient.tiers.delete(args);
      return {
        content: [
          {
            type: "text",
            text: `Tier with id ${args.id} deleted.`,
          },
        ],
      };
    }
  );
}
