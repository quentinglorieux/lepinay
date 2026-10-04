// Appels à l'API de l'admin depuis le navigateur.
export type Kind = 'project' | 'post' | 'agence';

export class ApiError extends Error {
  constructor(public status: number, public body: any) {
    super(body?.error ?? `Erreur ${status}`);
  }
}

async function request<T = any>(url: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.body && !isForm ? { 'content-type': 'application/json' } : {}), ...(init.headers ?? {}) },
  });
  if (res.status === 401) {
    location.href = `/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`;
    throw new ApiError(401, { error: 'Session expirée' });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export type ListItem = {
  slug: string;
  title: string;
  year?: string | number;
  date?: string;
  city?: string;
  draft: boolean;
  cover?: string;
};

export type Entry = { slug: string; sha: string; data: Record<string, any>; body: string; files: string[] };

export type SavePayload = {
  kind: Kind;
  slug: string;
  isNew: boolean;
  sha: string | null;
  data: Record<string, any>;
  body: string;
  mode: 'draft' | 'publish';
  added: Array<{ id: string; name: string; field?: 'cv' }>;
  removed: string[];
};

export const api = {
  list: (kind: 'project' | 'post') => request<ListItem[]>(`/api/admin/list?kind=${kind}`),
  entry: (kind: Kind, slug: string) =>
    request<Entry>(`/api/admin/entry?kind=${kind}&slug=${encodeURIComponent(slug)}`),
  upload: (file: Blob, name: string) => {
    const form = new FormData();
    form.append('file', file, name);
    return request<{ id: string }>('/api/admin/upload', { method: 'POST', body: form });
  },
  save: (payload: SavePayload) =>
    request<{ ok: true; commitSha: string }>('/api/admin/save', { method: 'POST', body: JSON.stringify(payload) }),
  remove: (kind: 'project' | 'post', slug: string, sha: string) =>
    request('/api/admin/delete', { method: 'POST', body: JSON.stringify({ kind, slug, sha }) }),
  status: () => request<{ state: 'ready' | 'building' | 'error' | 'unknown'; updatedAt?: string }>('/api/admin/status'),
};

export const fileUrl = (repoPath: string) => `/api/admin/file?path=${encodeURIComponent(repoPath)}`;

// Dossier d'un contenu dans le repo (les chemins d'images du frontmatter y sont relatifs).
export function entryDir(kind: Kind, slug: string): string {
  if (kind === 'agence') return 'src/data/pages';
  return kind === 'project' ? `src/data/projects/${slug}` : 'src/data/actus';
}

// Chemin du repo correspondant à une référence du frontmatter (./images/x.jpg, /cv/x.pdf).
export function repoPathOf(kind: Kind, slug: string, ref: string): string {
  if (ref.startsWith('/')) return `public${ref}`;
  const out: string[] = [];
  for (const p of `${entryDir(kind, slug)}/${ref}`.split('/')) {
    if (p === '.' || p === '') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return out.join('/');
}

// Référence du frontmatter pour un fichier du repo (inverse de repoPathOf).
export function refOf(kind: Kind, slug: string, repoPath: string): string {
  return `./${repoPath.slice(entryDir(kind, slug).length + 1)}`;
}

export function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(+d) ? iso : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
