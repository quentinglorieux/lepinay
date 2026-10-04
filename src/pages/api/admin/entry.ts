import type { APIRoute } from 'astro';
import { handle, json, repoConfig, requireUser } from '../../../lib/admin/api';
import { isValidSlug, type Kind } from '../../../lib/admin/content';
import { readEntry } from '../../../lib/admin/repo-content';

export const prerender = false;

export const GET: APIRoute = handle(async ({ url, locals }) => {
  requireUser(locals);
  const kind = url.searchParams.get('kind') as Kind;
  const slug = kind === 'agence' ? '' : (url.searchParams.get('slug') ?? '');
  if (!['project', 'post', 'agence'].includes(kind)) return json({ error: 'Type inconnu' }, 400);
  if (kind !== 'agence' && !isValidSlug(slug)) return json({ error: 'Identifiant invalide' }, 400);
  const entry = await readEntry(repoConfig(), kind, slug);
  return entry ? json(entry) : json({ error: 'Introuvable' }, 404);
});
