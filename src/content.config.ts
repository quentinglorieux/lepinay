// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';

const projects = defineCollection({
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      year: z.coerce.number().optional(),
      cover: image().optional(),
      gallery: z.array(image()).optional(),
      city: z.string().optional(),
      categories: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
    }).passthrough(),
});

// Collection de posts
const posts = defineCollection({
  schema: z.object({
    title: z.string(),
    // date: z.string().optional(),
    cover: z.string().optional(),
    excerpt: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).passthrough(),
});

export const collections = { projects, posts };