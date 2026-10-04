import type { APIRoute } from 'astro';
import { handle, json, requireUser } from '../../../lib/admin/api';
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, putUpload } from '../../../lib/admin/uploads';

export const prerender = false;

export const POST: APIRoute = handle(async ({ request, locals }) => {
  requireUser(locals);
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return json({ error: 'Aucun fichier reçu' }, 400);
  if (!ALLOWED_TYPES.includes(file.type)) return json({ error: `Format non accepté (${file.type || 'inconnu'})` }, 415);
  if (file.size > MAX_UPLOAD_BYTES) return json({ error: 'Fichier trop lourd (5,5 Mo maximum)' }, 413);
  const id = await putUpload(Buffer.from(await file.arrayBuffer()), file.type);
  return json({ id });
});
