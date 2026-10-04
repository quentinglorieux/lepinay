import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import {
  parseEntry,
  compact,
  serializeEntry,
  slugify,
  entryPath,
  mediaDir,
  safeFileName,
  validate,
  type Kind,
} from '../../src/lib/admin/content';

describe('slugify', () => {
  it('retire accents et ponctuation', () => {
    expect(slugify('Médiathèque « Hélène Berr » d’Été')).toBe('mediatheque-helene-berr-d-ete');
  });
  it('ne renvoie jamais vide', () => {
    expect(slugify('🏛️')).toMatch(/^projet-\d+$/);
  });
  it('limite la longueur', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(80);
  });
});

describe('chemins', () => {
  it('projet', () => expect(entryPath('project', 'dixmier')).toBe('src/data/projects/dixmier/index.md'));
  it('projet historique hors format', () => {
    expect(entryPath('project', 'Helene Berr')).toBe('src/data/projects/Helene Berr/index.md');
  });
  it('actu', () => expect(entryPath('post', 'triel')).toBe('src/data/actus/triel.md'));
  it('agence', () => expect(entryPath('agence', '')).toBe('src/data/pages/agence.md'));
  it('refuse un slug hostile', () => {
    expect(() => entryPath('post', '../x')).toThrow();
    expect(() => entryPath('project', 'a/b')).toThrow();
    expect(() => entryPath('project', '')).toThrow();
  });
  it('médias', () => {
    expect(mediaDir('project', 'dixmier')).toBe('src/data/projects/dixmier/images');
    expect(mediaDir('post', 'triel')).toBe('src/data/actus/images');
    expect(mediaDir('agence', '')).toBe('src/data/pages/images');
    expect(mediaDir('agence', '', 'cv')).toBe('public/cv');
  });
  it('nom de fichier sûr', () => {
    expect(safeFileName('../../Photo Été.HEIC')).toBe('photo-ete.jpg');
    expect(safeFileName('IMG_0001.JPG')).toBe('img_0001.jpg');
    expect(safeFileName('cv Garance.pdf')).toBe('cv-garance.pdf');
    expect(safeFileName('.jpg')).toMatch(/^image-\d+\.jpg$/);
    expect(safeFileName('script.exe')).toMatch(/^script\.bin$/);
  });
});

const listFiles = (): Array<[string, Kind]> => {
  const out: Array<[string, Kind]> = [];
  for (const d of readdirSync('src/data/projects')) {
    const f = `src/data/projects/${d}/index.md`;
    if (existsSync(f)) out.push([f, 'project']);
  }
  for (const f of readdirSync('src/data/actus')) if (f.endsWith('.md')) out.push([`src/data/actus/${f}`, 'post']);
  out.push(['src/data/pages/agence.md', 'agence']);
  return out;
};

describe('aller-retour sur le contenu existant', () => {
  for (const [f, kind] of listFiles()) {
    it(f, () => {
      const a = parseEntry(readFileSync(f, 'utf8'));
      const b = parseEntry(serializeEntry(a.data, a.body, kind));
      expect(b.data).toEqual(compact(a.data));
      expect(b.body.trim()).toBe(a.body.trim());
    });
  }
});

describe('sérialisation', () => {
  it('ordonne les clés selon le schéma et garde les inconnues', () => {
    const out = serializeEntry({ zz: 1, year: 2020, title: 'T' }, 'Texte', 'project');
    expect(out.indexOf('title:')).toBeLessThan(out.indexOf('year:'));
    expect(out).toContain('zz: 1');
    expect(out.endsWith('Texte\n')).toBe(true);
  });
  it('retire les champs vides', () => {
    const out = serializeEntry({ title: 'T', subtitle: '', city: undefined, tags: [] }, '', 'project');
    expect(out).not.toContain('subtitle');
    expect(out).not.toContain('city');
    expect(out).not.toContain('tags');
  });
  it('garde les dates en AAAA-MM-JJ', () => {
    const out = serializeEntry({ title: 'T', date: '2025-01-01' }, '', 'post');
    expect(out).toContain('date: 2025-01-01');
  });
});

describe('validate', () => {
  it('titre requis', () => expect(validate('project', { title: '' }).ok).toBe(false));
  it('catégorie inconnue refusée', () => {
    expect(validate('project', { title: 'x', categories: ['Piscine'] }).ok).toBe(false);
  });
  it('date invalide refusée', () => expect(validate('post', { title: 'x', date: '01/02/2025' }).ok).toBe(false));
  it('contenu existant valide', () => {
    for (const [f, kind] of listFiles()) {
      const r = validate(kind, parseEntry(readFileSync(f, 'utf8')).data);
      expect(r.ok, `${f} : ${JSON.stringify(!r.ok && r.errors)}`).toBe(true);
    }
  });
});

describe('année', () => {
  it('accepte une période', () => expect(validate('project', { title: 'x', year: '2012-2016' }).ok).toBe(true));
  it('refuse du texte libre', () => expect(validate('project', { title: 'x', year: 'bientôt' }).ok).toBe(false));
});

describe('fichiers atypiques', () => {
  it('BOM en tête de fichier', () => {
    const r = parseEntry('﻿---\ntitle: T\n---\nCorps');
    expect(r.data.title).toBe('T');
    expect(r.body).toBe('Corps');
  });
  it('frontmatter vide', () => {
    const r = parseEntry('---\n---\nCorps');
    expect(r.data).toEqual({});
    expect(r.body).toBe('Corps');
  });
});
