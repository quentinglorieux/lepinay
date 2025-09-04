// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// PROJETS: chaque projet est un dossier avec un index.md
const projects = defineCollection({
  loader: glob({ pattern: '**/index.md', base: './src/content/projects' }),
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

// POSTS: un fichier .md par article dans src/content/posts
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/actus' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    date: z.coerce.date().optional(),
    city: z.string().optional(),
    image: image().optional(),
    categories: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }).passthrough(),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/agence.md', base: './src/content/pages' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    cover: image().optional(),
    associates: z.array(z.object({
      name: z.string(),
      role: z.string().optional(),
      bio: z.string().optional(),
      photo: image().optional(),
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