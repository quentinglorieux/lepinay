import type { APIRoute } from 'astro';
import { handle, json, repoConfig, requireUser } from '../../../lib/admin/api';
import { listEntries } from '../../../lib/admin/repo-content';

export const prerender = false;

export const GET: APIRoute = handle(async ({ url, locals }) => {
  requireUser(locals);
  const kind = url.searchParams.get('kind');
  if (kind !== 'project' && kind !== 'post') return json({ error: 'Type inconnu' }, 400);
  return json(await listEntries(repoConfig(), kind));
});
