// Accès au repo GitHub pour l'admin : lecture de fichiers et commits atomiques
// (Git Data API). Le token reste côté serveur.
import type { User } from './auth';

export type RepoConfig = { token: string; repo: string; branch: string; fetch?: typeof fetch };

export type Change = { path: string; content: Buffer } | { path: string; delete: true };

export class GitHubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Le fichier a été modifié (ou créé) par quelqu'un d'autre depuis sa lecture.
export class ConflictError extends Error {
  constructor(public author: string, public date: string) {
    super(`Modifié par ${author} le ${date}`);
  }
}

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

async function gh<T = any>(cfg: RepoConfig, method: string, path: string, body?: unknown): Promise<T> {
  const res = await (cfg.fetch ?? fetch)(`https://api.github.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${cfg.token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const msg = await res.json().then((j) => j?.message).catch(() => res.statusText);
    throw new GitHubError(res.status, `GitHub ${method} ${path} : ${res.status} ${msg}`);
  }
  return res.json() as Promise<T>;
}

const r = (cfg: RepoConfig) => `/repos/${cfg.repo}`;

// ---------------------------------------------------------------- lecture

export async function readFile(
  cfg: RepoConfig,
  path: string,
  ref = cfg.branch,
): Promise<{ content: Buffer; sha: string } | null> {
  try {
    const f = await gh(cfg, 'GET', `${r(cfg)}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`);
    if (Array.isArray(f)) return null;
    // Au-delà de 1 Mo, l'API contents ne renvoie pas le contenu : passer par le blob.
    if (!f.content && f.size > 0) {
      const blob = await gh(cfg, 'GET', `${r(cfg)}/git/blobs/${f.sha}`);
      return { content: Buffer.from(blob.content, 'base64'), sha: f.sha };
    }
    return { content: Buffer.from(f.content ?? '', 'base64'), sha: f.sha };
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}

async function fileSha(cfg: RepoConfig, path: string, ref: string): Promise<string | null> {
  try {
    const f = await gh(cfg, 'GET', `${r(cfg)}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`);
    return Array.isArray(f) ? null : f.sha;
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}

export async function listDir(
  cfg: RepoConfig,
  path: string,
): Promise<Array<{ name: string; path: string; type: 'file' | 'dir'; sha: string }>> {
  try {
    const list = await gh(cfg, 'GET', `${r(cfg)}/contents/${encodePath(path)}?ref=${encodeURIComponent(cfg.branch)}`);
    return Array.isArray(list) ? list.map(({ name, path, type, sha }) => ({ name, path, type, sha })) : [];
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return [];
    throw e;
  }
}

export async function lastCommitFor(cfg: RepoConfig, path: string): Promise<{ author: string; date: string } | null> {
  const list = await gh(
    cfg,
    'GET',
    `${r(cfg)}/commits?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(cfg.branch)}&per_page=1`,
  );
  const c = list?.[0]?.commit?.author;
  return c ? { author: c.name, date: c.date } : null;
}

// ---------------------------------------------------------------- écriture

export async function commitChanges(
  cfg: RepoConfig,
  opts: { message: string; author: User; changes: Change[]; expect?: { path: string; sha: string | null } },
): Promise<{ commitSha: string }> {
  if (opts.changes.length === 0) throw new Error('Aucun changement à enregistrer');
  for (let attempt = 1; ; attempt++) {
    const ref = await gh(cfg, 'GET', `${r(cfg)}/git/ref/heads/${cfg.branch}`);
    const headSha: string = ref.object.sha;

    if (opts.expect) {
      const current = await fileSha(cfg, opts.expect.path, headSha);
      if (current !== opts.expect.sha) {
        const last = await lastCommitFor(cfg, opts.expect.path).catch(() => null);
        throw new ConflictError(last?.author ?? 'quelqu’un', last?.date ?? '');
      }
    }

    const head = await gh(cfg, 'GET', `${r(cfg)}/git/commits/${headSha}`);
    const tree = [];
    for (const c of opts.changes) {
      if ('delete' in c) {
        tree.push({ path: c.path, mode: '100644', type: 'blob', sha: null });
      } else {
        const blob = await gh(cfg, 'POST', `${r(cfg)}/git/blobs`, {
          content: c.content.toString('base64'),
          encoding: 'base64',
        });
        tree.push({ path: c.path, mode: '100644', type: 'blob', sha: blob.sha });
      }
    }
    const newTree = await gh(cfg, 'POST', `${r(cfg)}/git/trees`, { base_tree: head.tree.sha, tree });
    const who = { name: opts.author.name, email: opts.author.email, date: new Date().toISOString() };
    const commit = await gh(cfg, 'POST', `${r(cfg)}/git/commits`, {
      message: opts.message,
      tree: newTree.sha,
      parents: [headSha],
      author: who,
      committer: who,
    });
    try {
      await gh(cfg, 'PATCH', `${r(cfg)}/git/refs/heads/${cfg.branch}`, { sha: commit.sha, force: false });
      return { commitSha: commit.sha };
    } catch (e) {
      // La branche a avancé entre la lecture et l'écriture : on recommence une fois.
      if (e instanceof GitHubError && e.status === 422 && attempt < 2) continue;
      throw e;
    }
  }
}
