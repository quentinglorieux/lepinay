import type { APIRoute } from 'astro';
import {
  clearFailures,
  createSession,
  findUser,
  isRateLimited,
  parseUsers,
  recordFailure,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  verifyPassword,
} from '../../../lib/admin/auth';
import { env, handle, json } from '../../../lib/admin/api';

export const prerender = false;

export const POST: APIRoute = handle(async ({ request, cookies, url }) => {
  const { email = '', password = '' } = await request.json().catch(() => ({}));
  if (!email || !password) return json({ error: 'Email et mot de passe requis' }, 400);
  if (await isRateLimited(email)) {
    return json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' }, 429);
  }
  const user = findUser(email, parseUsers(env('ADMIN_USERS')));
  if (!user || !verifyPassword(password, user.hash)) {
    await recordFailure(email);
    return json({ error: 'Email ou mot de passe incorrect' }, 401);
  }
  await clearFailures(email);
  cookies.set(SESSION_COOKIE, createSession({ email: user.email, name: user.name }, env('ADMIN_SESSION_SECRET')), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    maxAge: SESSION_MAX_AGE,
  });
  return json({ ok: true, name: user.name });
});
