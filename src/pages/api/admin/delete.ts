import type { APIRoute } from 'astro';
import { handle, json, repoConfig, requireUser } from '../../../lib/admin/api';
import { entryDir, entryPath, isValidSlug, parseEntry } from '../../../lib/admin/content';
import { commitChanges, ConflictError } from '../../../lib/admin/github';
import { listFilesDeep } from '../../../lib/admin/repo-content';
import { readFile } from '../../../lib/admin/github';

export const prerender = false;

// Supprime un projet (dossier entier) ou une actualité (fichier .md).
export const POST: APIRoute = handle(async ({ request, locals }) => {
  const user = requireUser(locals);
  const { kind, slug, sha } = await request.json().catch(() => ({}));
  if ((kind !== 'project' && kind !== 'post') || !isValidSlug(slug) || !sha) return json({ error: 'Requête invalide' }, 400);

  const cfg = repoConfig();
  const md = await readFile(cfg, entryPath(kind, slug));
  if (!md) return json({ error: 'Introuvable' }, 404);
  const title = String(parseEntry(md.content.toString('utf8')).data.title ?? slug);
  const paths = kind === 'project' ? await listFilesDeep(cfg, entryDir(kind, slug)) : [entryPath(kind, slug)];
  try {
    await commitChanges(cfg, {
      message: `Admin : suppression ${kind === 'project' ? 'projet' : 'actualité'} « ${title} »`,
      author: user,
      changes: paths.map((path) => ({ path, delete: true as const })),
      expect: { path: entryPath(kind, slug), sha },
    });
    return json({ ok: true });
  } catch (e) {
    if (e instanceof ConflictError) return json({ error: 'Conflit', conflict: { author: e.author, date: e.date } }, 409);
    throw e;
  }
});
