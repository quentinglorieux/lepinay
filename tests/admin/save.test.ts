import { describe, it, expect } from 'vitest';
import { buildChanges, type SaveInput } from '../../src/lib/admin/save';
import { parseEntry } from '../../src/lib/admin/content';

const uploads: Record<string, { buf: Buffer; type: string }> = {
  'aaaaaaaa-0000-0000-0000-000000000001': { buf: Buffer.from('img1'), type: 'image/jpeg' },
  'aaaaaaaa-0000-0000-0000-000000000002': { buf: Buffer.from('img2'), type: 'image/jpeg' },
  'aaaaaaaa-0000-0000-0000-000000000003': { buf: Buffer.from('%PDF'), type: 'application/pdf' },
};
const get = async (id: string) => uploads[id] ?? null;
const U1 = 'aaaaaaaa-0000-0000-0000-000000000001';
const U2 = 'aaaaaaaa-0000-0000-0000-000000000002';
const U3 = 'aaaaaaaa-0000-0000-0000-000000000003';

const base = (over: Partial<SaveInput> = {}): SaveInput => ({
  kind: 'project',
  slug: 'maison-test',
  isNew: false,
  sha: 'SHA0',
  data: { title: 'Maison test', categories: ['Construction'] },
  body: 'Texte',
  mode: 'publish',
  added: [],
  removed: [],
  ...over,
});

const mdOf = (r: Awaited<ReturnType<typeof buildChanges>>) => {
  const c = r.changes.find((c) => c.path.endsWith('.md'))!;
  return parseEntry(('content' in c ? c.content : Buffer.from('')).toString());
};

describe('buildChanges', () => {
  it('brouillon : ajoute draft: true', async () => {
    const r = await buildChanges(base({ mode: 'draft' }), get, []);
    expect(mdOf(r).data.draft).toBe(true);
    expect(r.message).toBe('Admin : brouillon projet « Maison test »');
  });

  it('publication : retire draft', async () => {
    const r = await buildChanges(base({ data: { title: 'Maison test', draft: true } }), get, []);
    expect(mdOf(r).data.draft).toBeUndefined();
    expect(r.message).toBe('Admin : publication projet « Maison test »');
  });

  it('remplace les références upload: par les chemins finaux', async () => {
    const r = await buildChanges(
      base({
        data: { title: 'Maison test', cover: `upload:${U1}`, gallery: [`upload:${U1}`, './images/ancienne.jpg', `upload:${U2}`] },
        added: [
          { id: U1, name: 'Façade Sud.HEIC' },
          { id: U2, name: 'facade sud.jpg' },
        ],
      }),
      get,
      [],
    );
    const data = mdOf(r).data;
    expect(data.cover).toBe('./images/facade-sud.jpg');
    expect(data.gallery).toEqual(['./images/facade-sud.jpg', './images/ancienne.jpg', './images/facade-sud-2.jpg']);
    const paths = r.changes.map((c) => c.path).sort();
    expect(paths).toEqual([
      'src/data/projects/maison-test/images/facade-sud-2.jpg',
      'src/data/projects/maison-test/images/facade-sud.jpg',
      'src/data/projects/maison-test/index.md',
    ]);
    expect(r.usedUploads.sort()).toEqual([U1, U2].sort());
  });

  it('ne remplace jamais un fichier déjà présent dans le repo', async () => {
    const r = await buildChanges(
      base({ data: { title: 'Maison test', cover: `upload:${U1}` }, added: [{ id: U1, name: '01.jpg' }] }),
      get,
      ['src/data/projects/maison-test/images/01.jpg'],
    );
    expect(mdOf(r).data.cover).toBe('./images/01-2.jpg');
  });

  it('CV de la page Agence dans public/cv', async () => {
    const r = await buildChanges(
      base({
        kind: 'agence',
        slug: '',
        data: { title: 'Qui sommes-nous', associates: [{ name: 'G', cv: `upload:${U3}` }] },
        added: [{ id: U3, name: 'CV Garance.pdf', field: 'cv' }],
      }),
      get,
      [],
    );
    expect(mdOf(r).data.associates[0].cv).toBe('/cv/cv-garance.pdf');
    expect(r.changes.map((c) => c.path)).toContain('public/cv/cv-garance.pdf');
  });

  it('suppression de fichiers du dossier du projet', async () => {
    const r = await buildChanges(base({ removed: ['src/data/projects/maison-test/images/x.jpg'] }), get, []);
    expect(r.changes).toContainEqual({ path: 'src/data/projects/maison-test/images/x.jpg', delete: true });
  });

  it('refuse de supprimer hors du dossier du contenu', async () => {
    await expect(buildChanges(base({ removed: ['src/data/projects/autre/images/x.jpg'] }), get, [])).rejects.toThrow();
    await expect(buildChanges(base({ removed: ['src/data/projects/maison-test/index.md'] }), get, [])).rejects.toThrow();
    await expect(buildChanges(base({ removed: ['src/data/projects/maison-test/../autre/x.jpg'] }), get, [])).rejects.toThrow();
  });

  it('nouveau contenu : attend un fichier inexistant', async () => {
    const r = await buildChanges(base({ isNew: true, sha: null }), get, []);
    expect(r.expect).toEqual({ path: 'src/data/projects/maison-test/index.md', sha: null });
    expect(r.message).toBe('Admin : création projet « Maison test »');
  });

  it('upload introuvable ou expiré : erreur explicite', async () => {
    await expect(
      buildChanges(base({ data: { title: 'x', cover: 'upload:aaaaaaaa-0000-0000-0000-00000000dead' }, added: [{ id: 'aaaaaaaa-0000-0000-0000-00000000dead', name: 'a.jpg' }] }), get, []),
    ).rejects.toThrow(/expiré/);
  });

  it('données invalides : erreurs par champ', async () => {
    await expect(buildChanges(base({ data: { title: '' } }), get, [])).rejects.toMatchObject({ errors: { title: expect.any(String) } });
  });

  it('actu : image dans actus/images, chemin relatif à l’actu', async () => {
    const r = await buildChanges(
      base({ kind: 'post', slug: 'nouvelle', data: { title: 'N', date: '2026-10-04', image: `upload:${U1}` }, added: [{ id: U1, name: 'chantier.jpg' }] }),
      get,
      [],
    );
    expect(mdOf(r).data.image).toBe('./images/chantier.jpg');
    expect(r.changes.map((c) => c.path)).toContain('src/data/actus/images/chantier.jpg');
    expect(r.message).toBe('Admin : publication actualité « N »');
  });
});

describe('références upload: limitées aux champs image', () => {
  it('un titre qui commence par « upload: » reste du texte', async () => {
    const r = await buildChanges(base({ data: { title: 'upload: nouveautés', subtitle: 'upload:x' } }), get, []);
    expect(mdOf(r).data.title).toBe('upload: nouveautés');
    expect(mdOf(r).data.subtitle).toBe('upload:x');
  });
  it('photo et CV des associés sont bien remplacés', async () => {
    const r = await buildChanges(
      base({
        kind: 'agence',
        slug: '',
        data: { title: 'Agence', associates: [{ name: 'G', photo: `upload:${U1}`, cv: `upload:${U3}` }] },
        added: [{ id: U1, name: 'g.jpg' }, { id: U3, name: 'cv.pdf', field: 'cv' }],
      }),
      get,
      [],
    );
    expect(mdOf(r).data.associates[0]).toMatchObject({ photo: './images/g.jpg', cv: '/cv/cv.pdf' });
  });
});
