// Lecture du contenu éditable depuis le repo (via l'API GitHub).
import { listDir, readFile, type RepoConfig } from './github';
import { entryDir, entryPath, mediaDir, parseEntry, type Kind } from './content';

export type ListItem = {
  slug: string;
  title: string;
  year?: string | number;
  date?: string;
  city?: string;
  draft: boolean;
  cover?: string; // chemin dans le repo
};

const IMAGE = /\.(jpe?g|png|webp)$/i;

// Convertit une référence d'image du frontmatter (./images/x.jpg) en chemin du repo.
export function repoPathOf(kind: Kind, slug: string, ref: unknown): string | undefined {
  if (typeof ref !== 'string' || !ref) return undefined;
  if (ref.startsWith('/')) return `public${ref}`;
  const parts = `${entryDir(kind, slug)}/${ref}`.split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (p === '.' || p === '') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return out.join('/');
}

export async function listEntries(cfg: RepoConfig, kind: 'project' | 'post'): Promise<ListItem[]> {
  const base = kind === 'project' ? 'src/data/projects' : 'src/data/actus';
  const items = await listDir(cfg, base);
  const slugs =
    kind === 'project'
      ? items.filter((i) => i.type === 'dir').map((i) => i.name)
      : items.filter((i) => i.type === 'file' && i.name.endsWith('.md')).map((i) => i.name.replace(/\.md$/, ''));
  const entries = await Promise.all(
    slugs.map(async (slug) => {
      const f = await readFile(cfg, entryPath(kind, slug));
      if (!f) return null;
      const { data } = parseEntry(f.content.toString('utf8'));
      return {
        slug,
        title: String(data.title ?? slug),
        year: data.year,
        date: data.date,
        city: data.city,
        draft: data.draft === true,
        cover: repoPathOf(kind, slug, data.cover ?? data.image),
      } satisfies ListItem;
    }),
  );
  return entries.filter((e): e is ListItem => e !== null);
}

export async function readEntry(cfg: RepoConfig, kind: Kind, slug: string) {
  const f = await readFile(cfg, entryPath(kind, slug));
  if (!f) return null;
  const { data, body } = parseEntry(f.content.toString('utf8'));
  // Images déjà présentes dans le dossier du contenu (galerie automatique, choix de couverture).
  const media = await listDir(cfg, mediaDir(kind, slug));
  const files = media.filter((m) => m.type === 'file' && IMAGE.test(m.name)).map((m) => m.path).sort();
  return { slug, sha: f.sha, data, body, files };
}
