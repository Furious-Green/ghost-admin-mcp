#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {readGhostConfig} from './config';
import {createGhostClient} from './ghostApi';
import {createServer} from './createServer';

// Set up and connect to the standard I/O transport
async function startServer() {
    const server = createServer(createGhostClient(readGhostConfig(process.env)));
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Ghost MCP TypeScript Server running on stdio"); // Log to stderr
}

// Start the server
startServer().catch(() => {
    // SDK constructor errors can contain supplied configuration values.
    console.error("Fatal error starting Ghost MCP server. Check GHOST_API_URL, GHOST_ADMIN_API_KEY, and GHOST_API_VERSION.");
    process.exit(1);
});
