// src/tools/invites.ts
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
export const addParams = {
  role_id: z.string(),
  email: z.string(),
};
export const deleteParams = {
  id: z.string(),
};

export type ToolInputs = {
  browse: z.infer<z.ZodObject<typeof browseParams>>;
  add: z.infer<z.ZodObject<typeof addParams>>;
  delete: z.infer<z.ZodObject<typeof deleteParams>>;
};

export function registerInviteTools(server: McpServer) {
  // Browse invites
  server.tool(
    "invites_browse",
    browseParams,
    async (args, _extra) => {
      const invites = await ghostApiClient.invites.browse(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(invites, null, 2),
          },
        ],
      };
    }
  );

  // Add invite
  server.tool(
    "invites_add",
    addParams,
    async (args, _extra) => {
      const invite = await ghostApiClient.invites.add(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(invite, null, 2),
          },
        ],
      };
    }
  );

  // Delete invite
  server.tool(
    "invites_delete",
    deleteParams,
    async (args, _extra) => {
      await ghostApiClient.invites.delete(args);
      return {
        content: [
          {
            type: "text",
            text: `Invite with id ${args.id} deleted.`,
          },
        ],
      };
    }
  );
}
