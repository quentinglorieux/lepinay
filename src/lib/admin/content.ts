// Modèle de contenu de l'admin : lecture et écriture des fichiers Markdown,
// schémas de validation, slugs et chemins. Aucun accès réseau ici.
import { load, dump, CORE_SCHEMA } from 'js-yaml';
import { z } from 'astro/zod';

export type Kind = 'project' | 'post' | 'agence';
export type Data = Record<string, any>;

import { PROJECT_CATEGORIES, slugify } from './shared';
export { PROJECT_CATEGORIES, slugify };

// Dossiers de projets créés avant l'admin, dont le nom sort du format des slugs.
export const LEGACY_SLUGS = ['Helene Berr', 'Lisieux'];

// Ordre d'écriture des clés dans le frontmatter (les clés inconnues suivent).
const KEY_ORDER: Record<Kind, string[]> = {
  project: [
    'title', 'subtitle', 'draft', 'status', 'year', 'city', 'country', 'surface', 'budget',
    'photographies', 'maitrise_ouvrage', 'maitre_oeuvre', 'architecte', 'bureau_etude',
    'entreprise', 'client', 'label', 'categories', 'tags', 'cover', 'gallery', 'seo',
  ],
  post: ['title', 'subtitle', 'draft', 'city', 'date', 'tags', 'categories', 'image', 'cover'],
  agence: ['title', 'subtitle', 'cover', 'associates'],
};

// ---------------------------------------------------------------- lecture / écriture

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseEntry(raw: string): { data: Data; body: string } {
  const m = raw.match(FRONTMATTER);
  if (!m) return { data: {}, body: raw };
  // CORE_SCHEMA : les dates AAAA-MM-JJ restent des chaînes (pas d'objet Date).
  const data = (load(m[1], { schema: CORE_SCHEMA }) as Data) ?? {};
  return { data, body: raw.slice(m[0].length) };
}

const isEmpty = (v: unknown) =>
  v === undefined ||
  v === null ||
  (typeof v === 'string' && v.trim() === '') ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0);

// Retire récursivement les valeurs vides (chaînes vides, null, listes et objets vides).
export function compact(value: any): any {
  if (Array.isArray(value)) return value.map(compact).filter((v) => !isEmpty(v));
  if (value && typeof value === 'object') {
    const out: Data = {};
    for (const [k, v] of Object.entries(value)) {
      const c = compact(v);
      if (!isEmpty(c)) out[k] = c;
    }
    return out;
  }
  return typeof value === 'string' ? value.replace(/\s+$/, '') : value;
}

export function serializeEntry(data: Data, body: string, kind: Kind): string {
  const clean = compact(data);
  if (data.title !== undefined && clean.title === undefined) clean.title = '';
  const ordered: Data = {};
  for (const k of KEY_ORDER[kind]) if (k in clean) ordered[k] = clean[k];
  for (const k of Object.keys(clean)) if (!(k in ordered)) ordered[k] = clean[k];
  const fm = dump(ordered, { schema: CORE_SCHEMA, lineWidth: -1, noRefs: true });
  const text = body.replace(/^\s*\n/, '').replace(/\s+$/, '');
  return `---\n${fm}---\n${text ? `\n${text}\n` : ''}`;
}

// ---------------------------------------------------------------- slugs et chemins

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(slug) || LEGACY_SLUGS.includes(slug);
}

function assertSlug(slug: string) {
  if (!isValidSlug(slug)) throw new Error(`Identifiant invalide : ${slug}`);
}

export function entryPath(kind: Kind, slug: string): string {
  if (kind === 'agence') return 'src/data/pages/agence.md';
  assertSlug(slug);
  return kind === 'project' ? `src/data/projects/${slug}/index.md` : `src/data/actus/${slug}.md`;
}

// Dossier du contenu : les chemins d'images du frontmatter sont relatifs à lui.
export function entryDir(kind: Kind, slug: string): string {
  return entryPath(kind, slug).replace(/\/[^/]+$/, '');
}

export function mediaDir(kind: Kind, slug: string, field?: 'cv'): string {
  if (field === 'cv') return 'public/cv';
  return `${entryDir(kind, slug)}/images`;
}

const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];

export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  let ext = dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';
  let stem = dot >= 0 ? base.slice(0, dot) : base;
  if (ext === 'heic' || ext === 'heif') ext = 'jpg';
  if (!ALLOWED_EXT.includes(ext)) ext = 'bin';
  stem = stem
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${stem || `image-${Date.now()}`}.${ext}`;
}

// ---------------------------------------------------------------- validation

const text = z.string().optional().nullable();
const list = z.array(z.string()).optional().nullable();
const image = z.union([z.string(), z.object({ src: z.string() }).passthrough()]).optional().nullable();

const schemas = {
  project: z
    .object({
      title: z.string().trim().min(1, 'Le titre est obligatoire'),
      subtitle: text,
      draft: z.boolean().optional(),
      status: text,
      year: z.union([z.number().int(), z.string().regex(/^\d{4}(\s*-\s*\d{4})?$/, 'Année (ex. 2016 ou 2012-2016)')]).optional().nullable(),
      city: text,
      surface: text,
      budget: text,
      categories: z.array(z.enum(PROJECT_CATEGORIES)).optional().nullable(),
      tags: list,
      bureau_etude: z.union([z.string(), z.array(z.string())]).optional().nullable(),
      cover: image,
      gallery: z.array(image).optional().nullable(),
      seo: z.object({ description: text }).passthrough().optional().nullable(),
    })
    .passthrough(),
  post: z
    .object({
      title: z.string().trim().min(1, 'Le titre est obligatoire'),
      subtitle: text,
      draft: z.boolean().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date au format AAAA-MM-JJ').optional().nullable(),
      city: text,
      categories: list,
      tags: list,
      image,
    })
    .passthrough(),
  agence: z
    .object({
      title: z.string().trim().min(1, 'Le titre est obligatoire'),
      subtitle: text,
      cover: image,
      associates: z
        .array(
          z
            .object({
              name: z.string().trim().min(1, 'Nom obligatoire'),
              role: text,
              bio: text,
              photo: image,
              email: z.union([z.string().email('Email invalide'), z.literal('')]).optional().nullable(),
              cv: text,
              links: z.object({ linkedin: z.union([z.string().url('Lien invalide'), z.literal('')]).optional().nullable() }).passthrough().optional().nullable(),
            })
            .passthrough(),
        )
        .optional()
        .nullable(),
    })
    .passthrough(),
} satisfies Record<Kind, z.ZodTypeAny>;

export function validate(
  kind: Kind,
  data: Data,
): { ok: true; data: Data } | { ok: false; errors: Record<string, string> } {
  const r = schemas[kind].safeParse(data);
  if (r.success) return { ok: true, data: r.data };
  const errors: Record<string, string> = {};
  for (const issue of r.error.issues) errors[issue.path.join('.') || '_'] ??= issue.message;
  return { ok: false, errors };
}
