import type { APIRoute } from 'astro';
import { handle, json, repoConfig, requireUser } from '../../../lib/admin/api';
import { mediaDir, type Kind } from '../../../lib/admin/content';
import { commitChanges, ConflictError, listDir } from '../../../lib/admin/github';
import { buildChanges, ValidationError, type SaveInput } from '../../../lib/admin/save';
import { deleteUpload, takeUpload } from '../../../lib/admin/uploads';

export const prerender = false;

export const POST: APIRoute = handle(async ({ request, locals }) => {
  const user = requireUser(locals);
  const input = (await request.json().catch(() => null)) as SaveInput | null;
  if (!input || !['project', 'post', 'agence'].includes(input.kind)) return json({ error: 'Requête invalide' }, 400);
  if (input.kind === 'agence') input.slug = '';
  input.added ??= [];
  input.removed ??= [];

  const cfg = repoConfig();
  try {
    // Noms déjà pris dans les dossiers de destination, pour ne jamais écraser un fichier.
    const dirs = new Set(input.added.map((a) => mediaDir(input.kind as Kind, input.slug, a.field)));
    const existing = (await Promise.all([...dirs].map((d) => listDir(cfg, d)))).flat().map((f) => f.path);

    const { changes, message, expect, usedUploads } = await buildChanges(input, takeUpload, existing);
    const { commitSha } = await commitChanges(cfg, { message, author: user, changes, expect });
    await Promise.all(usedUploads.map((id) => deleteUpload(id).catch(() => {})));
    return json({ ok: true, commitSha });
  } catch (e) {
    if (e instanceof ValidationError) return json({ error: e.message, errors: e.errors }, 400);
    if (e instanceof ConflictError) return json({ error: 'Conflit', conflict: { author: e.author, date: e.date } }, 409);
    throw e;
  }
});
