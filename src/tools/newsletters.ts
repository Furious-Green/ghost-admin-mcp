import {z} from 'zod';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {GhostClient} from '../client/types';
import {accountShapes} from '../schemas/accounts';
import {registerAccountTools} from './registerAccountTools';

const shapes = accountShapes.newsletters;
export const {browse: browseParams, read: readParams, add: addParams, edit: editParams, delete: deleteParams} = shapes;
export type ToolInputs = {[K in keyof typeof shapes]: z.infer<z.ZodObject<(typeof shapes)[K]>>};
export function registerNewsletterTools(server: McpServer, client: GhostClient): void {
    registerAccountTools(server, client, 'newsletters');
}
