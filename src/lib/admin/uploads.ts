// Stockage temporaire des fichiers envoyés depuis l'admin (Netlify Blobs).
// Chaque fichier est envoyé seul (requêtes < 6 Mo), puis repris au moment du commit.
import { randomUUID } from 'node:crypto';

const MAX_AGE_MS = 24 * 3600 * 1000;
export const MAX_UPLOAD_BYTES = 5.5 * 1024 * 1024;
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

async function store() {
  const { getStore } = await import('@netlify/blobs');
  return getStore({ name: 'admin-uploads', consistency: 'strong' });
}

export async function putUpload(buf: Buffer, type: string): Promise<string> {
  const id = randomUUID();
  const s = await store();
  await s.set(id, new Blob([new Uint8Array(buf)]), { metadata: { type, createdAt: Date.now() } });
  return id;
}

export async function takeUpload(id: string): Promise<{ buf: Buffer; type: string } | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const s = await store();
  const entry = await s.getWithMetadata(id, { type: 'arrayBuffer' });
  if (!entry) return null;
  const meta = entry.metadata as { type?: string; createdAt?: number };
  if (!meta.createdAt || Date.now() - meta.createdAt > MAX_AGE_MS) {
    await s.delete(id);
    return null;
  }
  return { buf: Buffer.from(entry.data), type: meta.type ?? 'application/octet-stream' };
}

export async function deleteUpload(id: string): Promise<void> {
  const s = await store();
  await s.delete(id);
}
