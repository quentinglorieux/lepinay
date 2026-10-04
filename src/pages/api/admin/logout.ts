import type { APIRoute } from 'astro';
import { SESSION_COOKIE } from '../../../lib/admin/auth';
import { handle, json } from '../../../lib/admin/api';

export const prerender = false;

export const POST: APIRoute = handle(async ({ cookies }) => {
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return json({ ok: true });
});
