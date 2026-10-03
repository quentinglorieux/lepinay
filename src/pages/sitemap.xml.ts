import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://pierre-lepinay-architecture.com');
  const projects = await getCollection('projects');
  const posts = await getCollection('posts');
  const paths = [
    '/',
    '/agence',
    '/actus',
    '/mentions-legales',
    ...projects.map((p) => `/projets/${p.id}`),
    ...posts.map((p) => `/actus/${p.id}`),
  ];
  const urls = paths.map((p) => `  <url><loc>${new URL(p, base).href}</loc></url>`).join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
};
