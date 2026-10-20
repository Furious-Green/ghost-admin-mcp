import {z} from 'zod';
import {contentMutableFields, formatsParam} from './contentSchemas';

const responseParams = {
  include: z.string().optional(),
  formats: formatsParam,
};
export const browseParams = {
  filter: z.string().optional(),
  order: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.union([z.number().int().positive(), z.literal('all')]).optional(),
  fields: z.string().optional(),
  ...responseParams,
};
export const readParams = {
  id: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).optional(),
  fields: z.string().optional(),
  ...responseParams,
};
const pageMutableFields = {...contentMutableFields, custom_template: z.string().optional()};
export const addParams = {title: z.string(), ...pageMutableFields, ...responseParams};
export const editParams = {
  id: z.string().trim().min(1),
  updated_at: z.string().min(1),
  title: z.string().optional(),
  ...pageMutableFields,
  ...responseParams,
};
export const deleteParams = {id: z.string().trim().min(1)};
export type ToolInputs = {
  browse: z.infer<z.ZodObject<typeof browseParams>>;
  read: z.infer<z.ZodObject<typeof readParams>>;
  add: z.infer<z.ZodObject<typeof addParams>>;
  edit: z.infer<z.ZodObject<typeof editParams>>;
  delete: z.infer<z.ZodObject<typeof deleteParams>>;
};
