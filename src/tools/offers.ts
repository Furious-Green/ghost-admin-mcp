// src/tools/offers.ts
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
  code: z.string().optional(),
};
export const addParams = {
  name: z.string(),
  code: z.string(),
  cadence: z.string(),
  duration: z.string(),
  amount: z.number(),
  tier_id: z.string(),
  type: z.string(),
  display_title: z.string().optional(),
  display_description: z.string().optional(),
  duration_in_months: z.number().optional(),
  currency: z.string().optional(),
  // Add more fields as needed
};
export const editParams = {
  id: z.string(),
  name: z.string().optional(),
  code: z.string().optional(),
  display_title: z.string().optional(),
  display_description: z.string().optional(),
  // Only a subset of fields are editable per Ghost API docs
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

export function registerOfferTools(server: McpServer) {
  // Browse offers
  server.tool(
    "offers_browse",
    browseParams,
    async (args, _extra) => {
      const offers = await ghostApiClient.offers.browse(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(offers, null, 2),
          },
        ],
      };
    }
  );

  // Read offer
  server.tool(
    "offers_read",
    readParams,
    async (args, _extra) => {
      const offer = await ghostApiClient.offers.read(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(offer, null, 2),
          },
        ],
      };
    }
  );

  // Add offer
  server.tool(
    "offers_add",
    addParams,
    async (args, _extra) => {
      const offer = await ghostApiClient.offers.add(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(offer, null, 2),
          },
        ],
      };
    }
  );

  // Edit offer
  server.tool(
    "offers_edit",
    editParams,
    async (args, _extra) => {
      const offer = await ghostApiClient.offers.edit(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(offer, null, 2),
          },
        ],
      };
    }
  );

  // Delete offer
  server.tool(
    "offers_delete",
    deleteParams,
    async (args, _extra) => {
      await ghostApiClient.offers.delete(args);
      return {
        content: [
          {
            type: "text",
            text: `Offer with id ${args.id} deleted.`,
          },
        ],
      };
    }
  );
}
