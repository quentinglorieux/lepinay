import { describe, it, expect } from 'vitest';
import { commitChanges, readFile, listDir, lastCommitFor, ConflictError, type RepoConfig } from '../../src/lib/admin/github';

type Call = { method: string; url: string; body?: any };

// Faux GitHub en mémoire : une branche "b" dont la tête est HEAD, un fichier connu par chemin.
function fakeGitHub(opts: {
  files?: Record<string, { sha: string; content?: string }>;
  patchStatuses?: number[]; // statuts successifs renvoyés par PATCH ref
} = {}) {
  const calls: Call[] = [];
  const files = opts.files ?? {};
  const patchStatuses = [...(opts.patchStatuses ?? [200])];
  let head = 'HEAD1';
  const res = (status: number, body: any) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace('https://api.github.com', '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    if (method === 'GET' && url === '/repos/o/r/git/ref/heads/b') return res(200, { object: { sha: head } });
    if (method === 'GET' && url.startsWith('/repos/o/r/git/commits/')) return res(200, { sha: url.split('/').pop(), tree: { sha: 'TREE0' } });
    if (method === 'GET' && url.startsWith('/repos/o/r/contents/')) {
      const path = decodeURIComponent(url.slice('/repos/o/r/contents/'.length).split('?')[0]);
      if (path === 'dossier') return res(200, [{ name: 'a.md', path: 'dossier/a.md', type: 'file', sha: 'S1' }]);
      const f = files[path];
      if (!f) return res(404, { message: 'Not Found' });
      return res(200, { sha: f.sha, encoding: 'base64', content: Buffer.from(f.content ?? '').toString('base64'), size: (f.content ?? '').length });
    }
    if (method === 'GET' && url.startsWith('/repos/o/r/commits?')) {
      return res(200, [{ commit: { author: { name: 'Pierre', date: '2026-10-04T10:00:00Z' } } }]);
    }
    if (method === 'POST' && url === '/repos/o/r/git/blobs') return res(201, { sha: `BLOB${calls.filter((c) => c.url.endsWith('/blobs')).length}` });
    if (method === 'POST' && url === '/repos/o/r/git/trees') return res(201, { sha: 'TREE1' });
    if (method === 'POST' && url === '/repos/o/r/git/commits') return res(201, { sha: 'COMMIT1' });
    if (method === 'PATCH' && url === '/repos/o/r/git/refs/heads/b') {
      const status = patchStatuses.shift() ?? 200;
      if (status === 200) { head = 'COMMIT1'; return res(200, { object: { sha: 'COMMIT1' } }); }
      return res(status, { message: 'Update is not a fast forward' });
    }
    return res(500, { message: `route inconnue ${method} ${url}` });
  }) as typeof fetch;
  const cfg: RepoConfig = { token: 't', repo: 'o/r', branch: 'b', fetch };
  return { cfg, calls };
}

const author = { name: 'Garance Champlois', email: 'g@x.fr' };
const count = (calls: Call[], method: string, suffix: string) =>
  calls.filter((c) => c.method === method && c.url.endsWith(suffix)).length;

describe('lecture', () => {
  it('readFile renvoie contenu et sha', async () => {
    const { cfg } = fakeGitHub({ files: { 'src/a.md': { sha: 'X', content: 'bonjour' } } });
    const f = await readFile(cfg, 'src/a.md');
    expect(f?.sha).toBe('X');
    expect(f?.content.toString()).toBe('bonjour');
  });
  it('readFile renvoie null si absent', async () => {
    const { cfg } = fakeGitHub();
    expect(await readFile(cfg, 'absent.md')).toBeNull();
  });
  it('encode les espaces du chemin', async () => {
    const { cfg, calls } = fakeGitHub({ files: { 'src/data/projects/Helene Berr/index.md': { sha: 'H' } } });
    await readFile(cfg, 'src/data/projects/Helene Berr/index.md');
    expect(calls[0].url).toContain('Helene%20Berr');
  });
  it('listDir', async () => {
    const { cfg } = fakeGitHub();
    expect((await listDir(cfg, 'dossier'))[0].name).toBe('a.md');
    expect(await listDir(cfg, 'absent')).toEqual([]);
  });
  it('lastCommitFor', async () => {
    const { cfg } = fakeGitHub();
    expect(await lastCommitFor(cfg, 'x')).toEqual({ author: 'Pierre', date: '2026-10-04T10:00:00Z' });
  });
});

describe('commitChanges', () => {
  it('un seul commit et une seule mise à jour de branche pour plusieurs fichiers', async () => {
    const { cfg, calls } = fakeGitHub({ files: { 'a.md': { sha: 'A' } } });
    const r = await commitChanges(cfg, {
      message: 'm',
      author,
      changes: [
        { path: 'a.md', content: Buffer.from('x') },
        { path: 'img/1.jpg', content: Buffer.from([1, 2]) },
        { path: 'img/2.jpg', content: Buffer.from([3]) },
      ],
      expect: { path: 'a.md', sha: 'A' },
    });
    expect(r.commitSha).toBe('COMMIT1');
    expect(count(calls, 'POST', '/git/blobs')).toBe(3);
    expect(count(calls, 'POST', '/git/trees')).toBe(1);
    expect(count(calls, 'POST', '/git/commits')).toBe(1);
    expect(count(calls, 'PATCH', '/refs/heads/b')).toBe(1);
    const commit = calls.find((c) => c.method === 'POST' && c.url.endsWith('/git/commits'))!;
    expect(commit.body.author.name).toBe('Garance Champlois');
    expect(commit.body.parents).toEqual(['HEAD1']);
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(patch.body.force).toBe(false);
  });

  it('conflit si le fichier a changé : rien n’est écrit', async () => {
    const { cfg, calls } = fakeGitHub({ files: { 'a.md': { sha: 'NOUVEAU' } } });
    const p = commitChanges(cfg, { message: 'm', author, changes: [{ path: 'a.md', content: Buffer.from('x') }], expect: { path: 'a.md', sha: 'ANCIEN' } });
    await expect(p).rejects.toBeInstanceOf(ConflictError);
    await p.catch((e) => {
      expect(e.author).toBe('Pierre');
      expect(e.date).toBe('2026-10-04T10:00:00Z');
    });
    expect(calls.some((c) => c.method === 'POST' || c.method === 'PATCH')).toBe(false);
  });

  it('création : conflit si le fichier existe déjà', async () => {
    const { cfg } = fakeGitHub({ files: { 'a.md': { sha: 'A' } } });
    await expect(
      commitChanges(cfg, { message: 'm', author, changes: [{ path: 'a.md', content: Buffer.from('x') }], expect: { path: 'a.md', sha: null } }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('suppression : entrée de tree avec sha null, sans blob', async () => {
    const { cfg, calls } = fakeGitHub();
    await commitChanges(cfg, { message: 'm', author, changes: [{ path: 'img/old.jpg', delete: true }] });
    const tree = calls.find((c) => c.url.endsWith('/git/trees'))!;
    expect(tree.body.tree).toEqual([{ path: 'img/old.jpg', mode: '100644', type: 'blob', sha: null }]);
    expect(tree.body.base_tree).toBe('TREE0');
    expect(count(calls, 'POST', '/git/blobs')).toBe(0);
  });

  it('réessaie une fois si la branche a bougé entre-temps', async () => {
    const { cfg, calls } = fakeGitHub({ patchStatuses: [422, 200] });
    const r = await commitChanges(cfg, { message: 'm', author, changes: [{ path: 'a.md', content: Buffer.from('x') }] });
    expect(r.commitSha).toBe('COMMIT1');
    expect(count(calls, 'PATCH', '/refs/heads/b')).toBe(2);
  });

  it('abandonne après deux échecs de mise à jour', async () => {
    const { cfg } = fakeGitHub({ patchStatuses: [422, 422] });
    await expect(commitChanges(cfg, { message: 'm', author, changes: [{ path: 'a.md', content: Buffer.from('x') }] })).rejects.toThrow();
  });

  it('refuse une liste de changements vide', async () => {
    const { cfg } = fakeGitHub();
    await expect(commitChanges(cfg, { message: 'm', author, changes: [] })).rejects.toThrow();
  });
});
