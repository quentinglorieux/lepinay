// Transforme un formulaire de l'admin en un ensemble de changements pour un commit unique.
import { entryDir, entryPath, mediaDir, safeFileName, serializeEntry, validate, type Data, type Kind } from './content';
import type { Change } from './github';

export type SaveInput = {
  kind: Kind;
  slug: string;
  isNew: boolean;
  sha: string | null;
  data: Data;
  body: string;
  mode: 'draft' | 'publish';
  added: Array<{ id: string; name: string; field?: 'cv' }>;
  removed: string[];
};

export class ValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super('Certains champs sont à corriger');
  }
}

const LABEL: Record<Kind, string> = { project: 'projet', post: 'actualité', agence: 'page Agence' };

// Remplace récursivement les valeurs "upload:<id>" par le chemin final du fichier.
function replaceRefs(value: any, refs: Map<string, string>): any {
  if (typeof value === 'string' && value.startsWith('upload:')) {
    const ref = refs.get(value.slice('upload:'.length));
    if (!ref) throw new Error('Une image envoyée est introuvable ou a expiré. Ajoutez-la à nouveau.');
    return ref;
  }
  if (Array.isArray(value)) return value.map((v) => replaceRefs(v, refs));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceRefs(v, refs)]));
  }
  return value;
}

// Dossiers où l'admin a le droit de supprimer des fichiers pour ce contenu.
function removableRoots(kind: Kind, slug: string): string[] {
  if (kind === 'project') return [`${entryDir(kind, slug)}/`];
  if (kind === 'agence') return [`${mediaDir(kind, slug)}/`, 'public/cv/'];
  return [`${mediaDir(kind, slug)}/`];
}

export async function buildChanges(
  input: SaveInput,
  getUpload: (id: string) => Promise<{ buf: Buffer; type: string } | null>,
  existingFiles: string[],
): Promise<{ changes: Change[]; message: string; expect: { path: string; sha: string | null }; usedUploads: string[] }> {
  const { kind, slug } = input;
  const mdPath = entryPath(kind, slug);
  const changes: Change[] = [];

  // Fichiers ajoutés : nom assaini, sans jamais écraser un fichier existant.
  const taken = new Set(existingFiles);
  const refs = new Map<string, string>();
  const usedUploads: string[] = [];
  for (const a of input.added) {
    const upload = await getUpload(a.id);
    if (!upload) throw new Error('Une image envoyée est introuvable ou a expiré. Ajoutez-la à nouveau.');
    const dir = mediaDir(kind, slug, a.field);
    const name = safeFileName(a.name);
    const dot = name.lastIndexOf('.');
    let path = `${dir}/${name}`;
    for (let n = 2; taken.has(path); n++) path = `${dir}/${name.slice(0, dot)}-${n}${name.slice(dot)}`;
    taken.add(path);
    changes.push({ path, content: upload.buf });
    refs.set(a.id, a.field === 'cv' ? `/${path.replace(/^public\//, '')}` : `./${path.slice(entryDir(kind, slug).length + 1)}`);
    usedUploads.push(a.id);
  }

  // Fichiers supprimés : uniquement dans les dossiers du contenu, jamais le .md.
  const roots = removableRoots(kind, slug);
  for (const p of input.removed) {
    const ok = !p.includes('..') && p !== mdPath && roots.some((r) => p.startsWith(r));
    if (!ok) throw new Error(`Suppression refusée : ${p}`);
    changes.push({ path: p, delete: true });
  }

  const data = replaceRefs(structuredClone(input.data), refs);
  if (input.mode === 'draft' && kind !== 'agence') data.draft = true;
  else delete data.draft;

  const result = validate(kind, data);
  if (!result.ok) throw new ValidationError(result.errors);

  changes.push({ path: mdPath, content: Buffer.from(serializeEntry(data, input.body, kind)) });

  const action = input.isNew ? 'création' : input.mode === 'draft' ? 'brouillon' : 'publication';
  return {
    changes,
    message: `Admin : ${action} ${LABEL[kind]} « ${String(data.title).trim()} »`,
    expect: { path: mdPath, sha: input.isNew ? null : input.sha },
    usedUploads,
  };
}
