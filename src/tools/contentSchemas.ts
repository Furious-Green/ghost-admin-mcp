import {z} from 'zod';

export const tagRef = z.union([
  z.string(),
  z.object({id: z.string().optional(), slug: z.string().optional(), name: z.string().optional()}),
]);
export const authorRef = z.union([
  z.string(),
  z.object({id: z.string().optional(), slug: z.string().optional(), email: z.string().optional()}),
]);
export const contentMutableFields = {
  html: z.string().optional(),
  lexical: z.string().optional(),
  status: z.string().optional(),
  slug: z.string().optional(),
  visibility: z.string().optional(),
  featured: z.boolean().optional(),
  published_at: z.string().optional(),
  custom_excerpt: z.string().optional(),
  feature_image: z.string().optional(),
  feature_image_alt: z.string().optional(),
  feature_image_caption: z.string().optional(),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
  og_title: z.string().optional(),
  og_description: z.string().optional(),
  og_image: z.string().optional(),
  twitter_title: z.string().optional(),
  twitter_description: z.string().optional(),
  twitter_image: z.string().optional(),
  codeinjection_head: z.string().optional(),
  codeinjection_foot: z.string().optional(),
  canonical_url: z.string().optional(),
  tags: z.array(tagRef).optional(),
  authors: z.array(authorRef).optional(),
};

export const formatsParam = z.enum(['html', 'lexical', 'html,lexical', 'lexical,html']).optional();
