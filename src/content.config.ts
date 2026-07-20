import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    category: z.array(z.string()).default([]),
    primaryCategory: z.string().optional(),
    image: z.string().optional(),
    heroImage: z.string().optional(),
    images: z.array(z.string()).default([]),
    coverImage: z.string().optional(),
    pinned: z.boolean().default(false),
    readingTime: z.string().optional(),
    author: z.string().optional(),
    sourceUrl: z.string().optional(),
  }),
});

export const collections = { blog };
