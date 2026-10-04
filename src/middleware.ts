import { defineMiddleware } from 'astro:middleware';
import { readSession, SESSION_COOKIE } from './lib/admin/auth';
import { env, json } from './lib/admin/api';

// Protège l'admin. Les pages publiques (pré-rendues) ne passent jamais par ici.
export const onRequest = defineMiddleware(async (ctx, next) => {
  if (ctx.isPrerendered) return next();
  const path = ctx.url.pathname.replace(/\/+$/, '') || '/';
  const isAdminPage = path === '/admin' || path.startsWith('/admin/');
  const isAdminApi = path.startsWith('/api/admin/');
  if (!isAdminPage && !isAdminApi) return next();

  const user = readSession(ctx.cookies.get(SESSION_COOKIE)?.value, env('ADMIN_SESSION_SECRET'));
  if (user) ctx.locals.user = user;

  const isPublic = path === '/admin/login' || path === '/api/admin/login';
  if (!user && !isPublic) {
    if (isAdminApi) return json({ error: 'Session expirée' }, 401);
    return ctx.redirect(`/admin/login?next=${encodeURIComponent(ctx.url.pathname + ctx.url.search)}`, 302);
  }

  const res = await next();
  try {
    res.headers.set('x-robots-tag', 'noindex, nofollow');
    if (isAdminPage) res.headers.set('cache-control', 'no-store');
  } catch {
    // En-têtes immuables (redirection) : sans conséquence.
  }
  return res;
});
