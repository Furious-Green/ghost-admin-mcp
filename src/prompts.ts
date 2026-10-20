// src/prompts.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "./ghostApi";

// Example prompt: summarize-post
export function registerPrompts(server: McpServer) {
  server.prompt(
    "summarize-post",
    { postId: z.string() },
    async ({ postId }) => {
      // Fetch the post by ID
      const post = await ghostApiClient.posts.read({ id: postId });
      const record = post && !Array.isArray(post) ? post : {};
      const title = typeof record.title === "string" ? record.title : "";
      const excerpt = typeof record.excerpt === "string" ? record.excerpt : "";
      const html = typeof record.html === "string" ? record.html : "";

      // Compose a summary message
      const summary = `Title: ${title}\nExcerpt: ${excerpt}\n\nContent Preview:\n${html.slice(0, 300)}...`;

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Summarize the following Ghost post:\n\n${summary}`,
            },
          },
        ],
      };
    }
  );
}
