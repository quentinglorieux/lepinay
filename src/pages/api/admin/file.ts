import type { APIRoute } from 'astro';
import { handle, json, repoConfig, requireUser } from '../../../lib/admin/api';
import { readFile } from '../../../lib/admin/github';

export const prerender = false;

const TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

// Sert un fichier du repo (images, CV) à l'admin, y compris avant publication.
export const GET: APIRoute = handle(async ({ url, locals }) => {
  requireUser(locals);
  const path = url.searchParams.get('path') ?? '';
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const allowed = (path.startsWith('src/data/') || path.startsWith('public/cv/')) && !path.includes('..');
  if (!allowed || !TYPES[ext]) return json({ error: 'Chemin refusé' }, 400);
  const f = await readFile(repoConfig(), path);
  if (!f) return json({ error: 'Introuvable' }, 404);
  return new Response(new Uint8Array(f.content), {
    headers: { 'content-type': TYPES[ext], 'cache-control': 'private, max-age=300' },
  });
});
