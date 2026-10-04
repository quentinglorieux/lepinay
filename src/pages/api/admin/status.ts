import type { APIRoute } from 'astro';
import { handle, json, optionalEnv, requireUser } from '../../../lib/admin/api';

export const prerender = false;

// État de la dernière publication Netlify (pour le bandeau de l'admin).
export const GET: APIRoute = handle(async ({ locals }) => {
  requireUser(locals);
  const token = optionalEnv('NETLIFY_API_TOKEN');
  const site = optionalEnv('NETLIFY_SITE_ID');
  if (!token || !site) return json({ state: 'unknown' });
  const res = await fetch(`https://api.netlify.com/api/v1/sites/${site}/deploys?per_page=1`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) return json({ state: 'unknown' });
  const [d] = await res.json();
  if (!d) return json({ state: 'unknown' });
  const state = d.state === 'ready' ? 'ready' : d.state === 'error' ? 'error' : 'building';
  return json({ state, updatedAt: d.published_at ?? d.updated_at });
});
