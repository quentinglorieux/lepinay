// Outils communs aux routes de l'admin.
import type { User } from './auth';
import type { RepoConfig } from './github';

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

// Variable d'environnement obligatoire (Netlify en production, .env en local).
export function env(name: string): string {
  const v = process.env[name] ?? (import.meta.env as Record<string, string | undefined>)[name];
  if (!v) throw new Error(`Variable d'environnement manquante : ${name}`);
  return v;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name] ?? (import.meta.env as Record<string, string | undefined>)[name];
}

export function repoConfig(): RepoConfig {
  return {
    token: env('GITHUB_TOKEN'),
    repo: optionalEnv('GITHUB_REPO') ?? 'quentinglorieux/lepinay',
    branch: optionalEnv('GITHUB_BRANCH') ?? 'main',
  };
}

export function requireUser(locals: App.Locals): User {
  if (!locals.user) throw json({ error: 'Session expirée' }, 401);
  return locals.user;
}

// Les écritures doivent venir de l'admin elle-même (protection CSRF).
export function checkOrigin(request: Request): boolean {
  if (request.method === 'GET' || request.method === 'HEAD') return true;
  const origin = request.headers.get('origin');
  return !!origin && origin === new URL(request.url).origin;
}

// Redirection après connexion : uniquement vers une page de l'admin.
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/admin') || next.startsWith('//')) return '/admin';
  return next;
}

// Enveloppe une route : erreurs lancées en Response renvoyées telles quelles,
// les autres en 500 avec un message lisible.
export function handle(fn: (ctx: any) => Promise<Response>) {
  return async (ctx: any) => {
    try {
      if (!checkOrigin(ctx.request)) return json({ error: 'Origine refusée' }, 403);
      return await fn(ctx);
    } catch (e) {
      if (e instanceof Response) return e;
      console.error('[admin]', e);
      return json({ error: e instanceof Error ? e.message : 'Erreur inattendue' }, 500);
    }
  };
}
