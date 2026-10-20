// src/tools/webhooks.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GhostClient } from "../client/types";

// Parameter schemas as ZodRawShape (object literals)
export const addParams = {
  event: z.string(),
  target_url: z.string(),
  name: z.string().optional(),
  secret: z.string().optional(),
  api_version: z.string().optional(),
  integration_id: z.string().optional(), // Required for user-authenticated requests
};
export const editParams = {
  id: z.string(),
  event: z.string().optional(),
  target_url: z.string().optional(),
  name: z.string().optional(),
  api_version: z.string().optional(),
};
export const deleteParams = {
  id: z.string(),
};

export type ToolInputs = {
  add: z.infer<z.ZodObject<typeof addParams>>;
  edit: z.infer<z.ZodObject<typeof editParams>>;
  delete: z.infer<z.ZodObject<typeof deleteParams>>;
};

export function registerWebhookTools(server: McpServer, ghostApiClient: GhostClient) {
  // Add webhook
  server.tool(
    "webhooks_add",
    addParams,
    async (args, _extra) => {
      const webhook = await ghostApiClient.webhooks.add(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(webhook, null, 2),
          },
        ],
      };
    }
  );

  // Edit webhook
  server.tool(
    "webhooks_edit",
    editParams,
    async (args, _extra) => {
      const webhook = await ghostApiClient.webhooks.edit(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(webhook, null, 2),
          },
        ],
      };
    }
  );

  // Delete webhook
  server.tool(
    "webhooks_delete",
    deleteParams,
    async (args, _extra) => {
      await ghostApiClient.webhooks.delete(args);
      return {
        content: [
          {
            type: "text",
            text: `Webhook with id ${args.id} deleted.`,
          },
        ],
      };
    }
  );
}
