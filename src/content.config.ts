// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// PROJETS: chaque projet est un dossier avec un index.md
const projects = defineCollection({
  loader: glob({ pattern: '**/index.md', base: './src/data/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      cover: z.union([image(), z.string()]).optional().catch(() => undefined),
      gallery: z.array(z.union([image(), z.string()])).optional().catch(() => []),
      city: z.string().optional(),
      year: z.union([z.number(), z.string()]).optional().transform(v => v ? String(v) : undefined),
      categories: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
    }).passthrough(),
});

// POSTS: un fichier .md par article dans src/data/actus
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/actus' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    date: z.coerce.date().optional(),
    city: z.string().optional(),
    image: z.union([image(), z.string()]).optional().catch(() => undefined),
    cover: z.union([image(), z.string()]).optional().catch(() => undefined),
    categories: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }).passthrough(),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/agence.md', base: './src/data/pages' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    cover: z.union([image(), z.string()]).optional().catch(() => undefined),
    associates: z.array(z.object({
      name: z.string(),
      role: z.string().optional(),
      bio: z.string().optional(),
      photo: z.union([image(), z.string()]).optional().catch(() => undefined),
      email: z.string().email().optional(),
      cv: z.string().optional(),
      links: z.object({
        linkedin: z.string().url().optional(),
        instagram: z.string().url().optional(),
        website: z.string().url().optional(),
        x: z.string().url().optional(),
      }).partial().optional(),
    })).optional(),
  }).passthrough(),
});

export const collections = { projects, posts, pages };