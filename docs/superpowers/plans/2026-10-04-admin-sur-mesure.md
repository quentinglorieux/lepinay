# Admin sur mesure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une admin `/admin` intégrée au site Astro, permettant à Garance d'éditer projets, actus et page Agence (brouillons, aperçu fidèle, galerie, compression d'images), avec écriture dans le repo Git via l'API GitHub.

**Architecture:** Astro reste `output: 'static'` avec `@astrojs/netlify` ; seules `/admin/**` et `/api/admin/**` sont rendues à la demande (`prerender = false`). Le rendu des pages projet/actu/agence est extrait dans des vues partagées par le site et l'aperçu. Les écritures passent par une couche GitHub (Git Data API, commit atomique) ; les images transitent par Netlify Blobs.

**Tech Stack:** Astro 5.17, @astrojs/netlify 6, Vue 3 (déjà présent), @netlify/blobs, js-yaml, zod (`astro/zod`), @astrojs/markdown-remark (déjà présent), heic2any, vitest.

**Spec:** `docs/superpowers/specs/2026-10-04-admin-sur-mesure-design.md`

## Global Constraints

- Front public : HTML de chaque page de `dist/` identique avant/après, aux hash d'assets (`/_astro/*`) et `data-astro-cid-*` près. Aucune modification de `src/styles/global.css`, `Header.astro`, `Footer.astro`, `SEO.astro`, `Filters.vue`.
- Branche de travail `admin`. Jamais de push sur `main`. Écritures de test sur la branche de contenu `admin-content-test`.
- Contenu sur disque inchangé (chemins, noms de champs) ; seul ajout : `draft: true`.
- Slug : `[a-z0-9-]`, dérivé du titre ; dossiers existants hors format conservés.
- Images : 2400 px max grand côté, JPEG qualité 0.82, requêtes < 6 Mo.
- Session : cookie `lca_session`, HttpOnly, Secure, SameSite=Lax, 7 jours, HMAC-SHA256.
- Login : 5 échecs par email sur 15 min.
- Pas de tiret cadratin dans le code, les commentaires, les textes et les commits.

## Review Focus

1. Titre avec accents, apostrophes typographiques ou emoji : le slug reste `[a-z0-9-]`, non vide (repli `projet-<timestamp>`) ; test dans Task 4.
2. Fichier Markdown existant avec clé à espace (`subtitle :`), champs inconnus, liste YAML inline : relecture puis réécriture sans perte ; test aller-retour sur tous les fichiers dans Task 4.
3. Nom de fichier uploadé hostile (`../../x.jpg`, espaces, majuscules, `.HEIC`) : chemin final confiné au dossier du contenu ; test dans Task 4.
4. Deux enregistrements concurrents du même fichier : le second reçoit 409 et rien n'est écrit ; test dans Task 6.
5. Session falsifiée, expirée ou signée avec un autre secret : refusée ; test dans Task 5.

---

## File Structure

```
astro.config.mjs                       (modif) adaptateur netlify
package.json                           (modif) deps + scripts test
vitest.config.ts                       (nouveau)
scripts/compare-dist.mjs               (nouveau) non-régression HTML
scripts/admin-hash-password.mjs        (nouveau) hash scrypt pour ADMIN_USERS
src/lib/published.ts                   (nouveau) collections sans brouillons
src/components/views/ProjectView.astro (nouveau) extrait de projets/[slug]
src/components/views/PostView.astro    (nouveau) extrait de actus/[slug]
src/components/views/AgenceView.astro  (nouveau) extrait de agence
src/pages/{index,actus,agence}.astro, projets/[slug].astro, actus/[slug].astro, sitemap.xml.ts (modif)
src/lib/admin/content.ts               schémas, parse/serialize, slug, chemins
src/lib/admin/auth.ts                  hash, verify, sessions, rate limit
src/lib/admin/github.ts                lecture, commit atomique, conflits
src/lib/admin/uploads.ts               Netlify Blobs temporaire
src/lib/admin/save.ts                  construction d'un commit à partir d'un formulaire
src/lib/admin/api.ts                   helpers json(), requireUser(), checkOrigin()
src/middleware.ts                      garde /admin et /api/admin
src/pages/api/admin/{login,logout,list,entry,upload,file,save,delete,status}.ts
src/pages/admin/{login,index,agence}.astro, admin/projets/{index,[slug]}.astro, admin/actus/{index,[slug]}.astro
src/pages/admin/preview/[type].astro   aperçu SSR
src/layouts/AdminLayout.astro          coque admin + admin.css
src/styles/admin.css
src/lib/admin/image-client.ts          compression navigateur
src/lib/admin/client.ts                appels fetch typés côté navigateur
src/components/admin/*.vue             UI
tests/admin/*.test.ts
```

---

### Task 1: Filet de non-régression du front

**Files:**
- Create: `scripts/compare-dist.mjs`

**Interfaces:**
- Produces: `node scripts/compare-dist.mjs <dirA> <dirB>` : code 0 si identique après normalisation, 1 sinon avec la liste des pages et un extrait du premier écart.

- [ ] **Step 1:** Construire la référence depuis `main` dans un worktree temporaire : `git worktree add <scratchpad>/lepinay-ref main && cd <scratchpad>/lepinay-ref && npm ci && npm run build`, la référence est `<scratchpad>/lepinay-ref/dist`.
- [ ] **Step 2:** Écrire `scripts/compare-dist.mjs` :

```js
// Compare deux builds Astro page par page, aux hash près.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const [a, b] = process.argv.slice(2);
const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') || p.endsWith('.xml') ? [p] : [];
});
const norm = (s) => s
  .replace(/\/_astro\/[^"' )]+/g, '/_astro/X')
  .replace(/data-astro-cid-[a-z0-9]+/g, 'data-astro-cid-X')
  .replace(/astro-[a-z0-9]{8}/g, 'astro-X');
const pagesA = walk(a).map((p) => relative(a, p)).sort();
const pagesB = new Set(walk(b).map((p) => relative(b, p)));
let bad = 0;
for (const p of pagesA) {
  if (p.startsWith('admin/')) continue;
  if (!pagesB.has(p)) { console.log('MANQUANTE', p); bad++; continue; }
  const x = norm(readFileSync(join(a, p), 'utf8'));
  const y = norm(readFileSync(join(b, p), 'utf8'));
  if (x !== y) {
    let i = 0; while (x[i] === y[i]) i++;
    console.log('DIFF', p, '\n  avant:', x.slice(i - 60, i + 80), '\n  après:', y.slice(i - 60, i + 80));
    bad++;
  }
}
console.log(bad ? `${bad} page(s) différente(s)` : `OK, ${pagesA.length} pages identiques`);
process.exit(bad ? 1 : 0);
```

- [ ] **Step 3:** Vérifier que `node scripts/compare-dist.mjs <ref> <ref>` affiche `OK`. Puis `npm run build` sur `admin` et comparer : attendu `OK`.
- [ ] **Step 4:** Commit `Outil de non-régression du front`.

### Task 2: Vues partagées et brouillons

**Files:**
- Create: `src/components/views/ProjectView.astro`, `PostView.astro`, `AgenceView.astro`, `src/lib/published.ts`
- Modify: `src/pages/projets/[slug].astro`, `src/pages/actus/[slug].astro`, `src/pages/agence.astro`, `src/pages/index.astro`, `src/pages/actus.astro`, `src/pages/sitemap.xml.ts`

**Interfaces:**
- Produces:
  - `type Img = { src: string; width?: number; height?: number }`
  - `ProjectView` props : `{ data: Record<string, any> & { title: string }, cover?: Img, gallery: Img[], prev?: { href: string; title: string } | null, next?: same }`, slot par défaut = corps HTML.
  - `PostView` props : `{ data: Record<string, any>, coverSrc?: string }`, slot = corps.
  - `AgenceView` props : `{ data: Record<string, any>, cover?: Img, associates: Array<Record<string, any> & { photoSrc?: string }> }`, slot = corps.
  - `getPublished(name: 'projects' | 'posts')` : `getCollection(name, (e) => e.data.draft !== true)`.

- [ ] **Step 1:** Créer chaque vue en **déplaçant** le markup existant de `<html>` à `</html>` (y compris `<head>`, `<SEO>`, JSON-LD, `<script>` photoswipe, `<style scoped>`) sans modifier une balise ; remplacer `<Content />` par `<slot />` ; remplacer `d.cover.src` par `cover?.src`, `associate.photo.src` par `associate.photoSrc`, `prev.id/prev.data.title` par `prev.href/prev.title`. Les calculs (`subtitle`, `cats`, `dateStr`) passent dans le frontmatter de la vue.
- [ ] **Step 2:** Les pages deviennent : `getStaticPaths` + mapping entrée vers props + `<XView ...><Content /></XView>`. Exemple projet :

```astro
---
import ProjectView from '../../components/views/ProjectView.astro';
import { getPublished } from '../../lib/published';
import { render } from 'astro:content';
export async function getStaticPaths() {
  const projects = await getPublished('projects');
  return projects.map((p, idx) => ({
    params: { slug: p.id },
    props: { project: p, prev: projects[idx - 1] ?? null, next: projects[idx + 1] ?? null },
  }));
}
const { project, prev, next } = Astro.props;
const { Content } = await render(project);
// galerie : même logique d'auto-import qu'avant (images/ du dossier) si gallery vide
---
<ProjectView data={project.data} cover={project.data.cover} gallery={gallery}
  prev={prev && { href: `/projets/${prev.id}`, title: prev.data.title }}
  next={next && { href: `/projets/${next.id}`, title: next.data.title }}>
  <Content />
</ProjectView>
```

- [ ] **Step 3:** `index.astro`, `actus.astro`, `sitemap.xml.ts`, `actus/[slug].astro` : `getCollection(x)` remplacé par `getPublished(x)`. Retirer au passage le `console.log` de debug de `projets/[slug].astro` (n'affecte pas le HTML).
- [ ] **Step 4:** `npm run build && node scripts/compare-dist.mjs <ref> dist` : attendu `OK`. En cas de DIFF, corriger la vue jusqu'à identité (espaces compris).
- [ ] **Step 5:** Test brouillon : ajouter temporairement `draft: true` à `src/data/actus/triel.md`, build, vérifier que `dist/actus/triel` n'existe pas et que `sitemap.xml` ne le contient pas, puis annuler.
- [ ] **Step 6:** Commit `Vues partagées projet, actu, agence et filtrage des brouillons`.

### Task 3: Adaptateur Netlify et tests

**Files:**
- Modify: `astro.config.mjs`, `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1:** `npm i @astrojs/netlify@^6 @netlify/blobs js-yaml heic2any && npm i -D vitest @types/js-yaml`.
- [ ] **Step 2:** `astro.config.mjs` :

```js
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import netlify from '@astrojs/netlify';
export default defineConfig({
  site: 'https://pierre-lepinay-architecture.com',
  output: 'static',
  adapter: netlify(),
  integrations: [vue()],
});
```

- [ ] **Step 3:** `vitest.config.ts` avec `getViteConfig` d'Astro (`import { getViteConfig } from 'astro/config'; export default getViteConfig({ test: { include: ['tests/**/*.test.ts'] } });`), script `"test": "vitest run"`.
- [ ] **Step 4:** `npm run build` puis comparer `dist` à la référence : attendu `OK`.
- [ ] **Step 5:** Commit `Adaptateur Netlify (pages publiques toujours pré-rendues) et vitest`.

### Task 4: Modèle de contenu (`content.ts`)

**Files:**
- Create: `src/lib/admin/content.ts`, `tests/admin/content.test.ts`

**Interfaces:**
- Produces:
  - `type Kind = 'project' | 'post' | 'agence'`
  - `parseEntry(raw: string): { data: Record<string, any>; body: string }`
  - `serializeEntry(data: Record<string, any>, body: string, kind: Kind): string` (ordre des clés selon le schéma, clés inconnues à la suite, `undefined` et chaînes vides retirées sauf `title`)
  - `slugify(title: string): string`
  - `isValidSlug(s: string): boolean` (accepte aussi les dossiers existants listés dans `LEGACY_SLUGS`)
  - `entryPath(kind: Kind, slug: string): string`
  - `mediaDir(kind: Kind, slug: string, field?: 'cv'): string`
  - `safeFileName(name: string): string` (minuscules, `[a-z0-9._-]`, extension conservée, `.heic` devient `.jpg`)
  - `validate(kind, data): { ok: true; data } | { ok: false; errors: Record<string, string> }`
  - `PROJECT_CATEGORIES = ['Construction','Réhabilitation','Logements','Équipements','Médiathèque','Musée']`

- [ ] **Step 1: Tests**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, globSync } from 'node:fs';
import { parseEntry, serializeEntry, slugify, entryPath, mediaDir, safeFileName, validate } from '../../src/lib/admin/content';

describe('slugify', () => {
  it('retire accents et ponctuation', () => expect(slugify('Médiathèque « Hélène Berr » d’Été')).toBe('mediatheque-helene-berr-d-ete'));
  it('ne renvoie jamais vide', () => expect(slugify('🏛️')).toMatch(/^projet-\d+$/));
});
describe('chemins', () => {
  it('projet', () => expect(entryPath('project', 'dixmier')).toBe('src/data/projects/dixmier/index.md'));
  it('projet historique', () => expect(entryPath('project', 'Helene Berr')).toBe('src/data/projects/Helene Berr/index.md'));
  it('actu', () => expect(entryPath('post', 'triel')).toBe('src/data/actus/triel.md'));
  it('refuse un slug hostile', () => expect(() => entryPath('post', '../x')).toThrow());
  it('médias', () => {
    expect(mediaDir('project', 'dixmier')).toBe('src/data/projects/dixmier/images');
    expect(mediaDir('agence', '', 'cv')).toBe('public/cv');
  });
  it('nom de fichier sûr', () => {
    expect(safeFileName('../../Photo Été.HEIC')).toBe('photo-ete.jpg');
    expect(safeFileName('.jpg')).toMatch(/^image-\d+\.jpg$/);
  });
});
describe('aller-retour sur le contenu existant', () => {
  const files = [...globSync('src/data/projects/*/index.md'), ...globSync('src/data/actus/*.md'), 'src/data/pages/agence.md'];
  for (const f of files) it(f, () => {
    const kind = f.includes('/projects/') ? 'project' : f.includes('/actus/') ? 'post' : 'agence';
    const a = parseEntry(readFileSync(f, 'utf8'));
    const b = parseEntry(serializeEntry(a.data, a.body, kind));
    expect(b.data).toEqual(a.data);
    expect(b.body.trim()).toBe(a.body.trim());
  });
});
describe('validate', () => {
  it('titre requis', () => expect(validate('project', { title: '' }).ok).toBe(false));
  it('catégorie inconnue refusée', () => expect(validate('project', { title: 'x', categories: ['Piscine'] }).ok).toBe(false));
  it('projet existant valide', () => expect(validate('project', parseEntry(readFileSync('src/data/projects/dixmier/index.md', 'utf8')).data).ok).toBe(true));
});
```

- [ ] **Step 2:** `npx vitest run tests/admin/content.test.ts` : FAIL (module absent).
- [ ] **Step 3:** Implémenter `content.ts` : `parseEntry` découpe sur `^---\n...\n---\n?` puis `yaml.load` (js-yaml, `JSON_SCHEMA` désactivé pour garder les dates `YYYY-MM-DD` en chaîne : utiliser `yaml.load(fm, { schema: yaml.CORE_SCHEMA })`) ; `serializeEntry` utilise `yaml.dump(ordered, { lineWidth: -1, flowLevel: 1, schema: yaml.CORE_SCHEMA })` ; `slugify` via `normalize('NFD')`, suppression des diacritiques, `[^a-z0-9]+` en `-`, trim des tirets, repli `projet-${Date.now()}` ; `LEGACY_SLUGS = ['Helene Berr', 'Lisieux']` ; `entryPath` lève une erreur si `!isValidSlug`.
- [ ] **Step 4:** Tests au vert.
- [ ] **Step 5:** Commit `Admin : modèle de contenu (parse, sérialisation, slugs, chemins)`.

### Task 5: Authentification (`auth.ts`)

**Files:**
- Create: `src/lib/admin/auth.ts`, `scripts/admin-hash-password.mjs`, `tests/admin/auth.test.ts`

**Interfaces:**
- Produces:
  - `type User = { email: string; name: string }`
  - `hashPassword(pw: string): string` au format `scrypt:<saltB64>:<hashB64>`
  - `verifyPassword(pw: string, stored: string): boolean` (timingSafeEqual)
  - `findUser(email: string, users?: Array<User & { hash: string }>): (User & { hash: string }) | undefined` (comparaison d'email insensible à la casse)
  - `createSession(user: User, secret: string, now = Date.now()): string` (`base64url(json).base64url(hmac)`, exp 7 j)
  - `readSession(token: string | undefined, secret: string, now = Date.now()): User | null`
  - `SESSION_COOKIE = 'lca_session'`, `SESSION_MAX_AGE = 7 * 86400`
  - `isRateLimited(email): Promise<boolean>`, `recordFailure(email)`, `clearFailures(email)` (Netlify Blobs store `admin-auth`)

- [ ] **Step 1: Tests**

```ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, createSession, readSession, findUser } from '../../src/lib/admin/auth';
const S = 'secret-de-test-32-octets-minimum!!';
describe('mots de passe', () => {
  it('vérifie le bon', () => expect(verifyPassword('abc', hashPassword('abc'))).toBe(true));
  it('refuse le mauvais', () => expect(verifyPassword('abd', hashPassword('abc'))).toBe(false));
  it('refuse un hash malformé', () => expect(verifyPassword('abc', 'n-importe-quoi')).toBe(false));
});
describe('utilisateurs', () => {
  it('email insensible à la casse', () => expect(findUser('G@X.fr', [{ email: 'g@x.fr', name: 'G', hash: 'h' }])?.name).toBe('G'));
});
describe('sessions', () => {
  const u = { email: 'g@x.fr', name: 'G' };
  it('relit une session valide', () => expect(readSession(createSession(u, S), S)).toEqual(u));
  it('refuse une session expirée', () => expect(readSession(createSession(u, S, 0), S, 8 * 864e5)).toBeNull());
  it('refuse un autre secret', () => expect(readSession(createSession(u, S), S + 'x')).toBeNull());
  it('refuse une charge modifiée', () => {
    const [p, sig] = createSession(u, S).split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), email: 'pirate@x.fr' })).toString('base64url');
    expect(readSession(`${forged}.${sig}`, S)).toBeNull();
  });
  it('refuse vide', () => expect(readSession(undefined, S)).toBeNull());
});
```

- [ ] **Step 2:** FAIL. **Step 3:** Implémenter avec `node:crypto` (`scryptSync(pw, salt, 64)`, `createHmac('sha256')`, `timingSafeEqual`). `loadUsers()` lit `process.env.ADMIN_USERS` (JSON). Rate limit : clé `fail:<email>` contenant `{ count, since }`.
- [ ] **Step 4:** `scripts/admin-hash-password.mjs` : demande le mot de passe sans écho, imprime le hash.
- [ ] **Step 5:** Tests au vert, commit `Admin : authentification (scrypt, sessions signées)`.

### Task 6: Couche GitHub (`github.ts`)

**Files:**
- Create: `src/lib/admin/github.ts`, `tests/admin/github.test.ts`

**Interfaces:**
- Produces:
  - `type RepoConfig = { token: string; repo: string; branch: string; fetch?: typeof fetch }`
  - `readFile(cfg, path): Promise<{ content: Buffer; sha: string } | null>`
  - `listDir(cfg, path): Promise<Array<{ name: string; path: string; type: 'file' | 'dir'; sha: string }>>`
  - `lastCommitFor(cfg, path): Promise<{ author: string; date: string } | null>`
  - `commitChanges(cfg, { message, author: User, changes: Array<{ path: string; content: Buffer } | { path: string; delete: true }>, expect?: { path: string; sha: string | null } }): Promise<{ commitSha: string }>`
  - `class ConflictError extends Error { author: string; date: string }`
- Algorithme `commitChanges` : GET ref `heads/<branch>` ; si `expect`, relire le SHA du fichier à ce commit (`/contents/<path>?ref=<headSha>`) et lever `ConflictError` s'il diffère (`null` = le fichier ne doit pas exister) ; GET commit pour le tree de base ; POST blobs (base64) ; POST tree (`base_tree`, suppression = `sha: null`) ; POST commit (auteur, parent) ; PATCH ref (`force: false`) ; si PATCH renvoie 422 (ref déplacée entre-temps), recommencer une fois depuis le début.

- [ ] **Step 1: Tests** avec un faux `fetch` en mémoire : chaque test monte les routes `GET /repos/r/git/ref/heads/b`, `GET /repos/r/git/commits/<sha>`, `GET /repos/r/contents/<path>?ref=<sha>`, `POST /repos/r/git/blobs`, `POST /repos/r/git/trees`, `POST /repos/r/git/commits`, `PATCH /repos/r/git/refs/heads/b`, `GET /repos/r/commits?path=<p>&sha=<b>&per_page=1` et enregistre les appels.
  - commit atomique : 3 changements produisent 3 POST blobs, 1 POST tree, 1 POST commit, 1 PATCH ref ;
  - `ConflictError` si le SHA attendu a changé, et aucun POST ;
  - suppression : entrée de tree avec `sha: null` ;
  - création avec `expect.sha === null` et fichier existant : conflit ;
  - réessai unique si le PATCH renvoie 422, échec au second 422.
- [ ] **Step 2:** FAIL. **Step 3:** Implémenter. **Step 4:** Vert. **Step 5:** Commit `Admin : couche GitHub (commit atomique, conflits)`.

### Task 7: Garde, login, logout

**Files:**
- Create: `src/lib/admin/api.ts`, `src/middleware.ts`, `src/env.d.ts`, `src/pages/api/admin/login.ts`, `src/pages/api/admin/logout.ts`, `src/layouts/AdminLayout.astro`, `src/styles/admin.css`, `src/pages/admin/login.astro`, `src/components/admin/LoginForm.vue`, `tests/admin/api.test.ts`

**Interfaces:**
- Produces (`api.ts`) : `json(body, status = 200)`, `requireUser(locals): User` (lève une `Response` 401), `checkOrigin(request: Request): boolean`, `env(name): string` (lève si absent), `repoConfig(): RepoConfig`.
- `middleware.ts` : si `context.isPrerendered`, `next()` ; si chemin `/admin` ou `/api/admin` hors `/admin/login` et `/api/admin/login` : `locals.user = readSession(cookie)` ; absent → redirect 302 `/admin/login?next=<path>` (pages) ou 401 JSON (API). Ajoute `X-Robots-Tag: noindex` aux réponses admin.
- `env.d.ts` : `declare namespace App { interface Locals { user?: import('./lib/admin/auth').User } }`.

- [ ] **Step 1:** Test `api.test.ts` : `checkOrigin` accepte une requête dont `Origin` égale l'origine de son URL, refuse `https://evil.example`, refuse l'absence d'`Origin` sur POST.
- [ ] **Step 2:** Implémenter. `login.ts` (POST JSON `{ email, password }`) : rate limit, `findUser`, `verifyPassword`, cookie ; réponse générique « Email ou mot de passe incorrect » ; `logout.ts` efface le cookie.
- [ ] **Step 3:** `AdminLayout.astro` : `<html lang="fr">`, `<meta name="robots" content="noindex">`, favicon, `admin.css`, en-tête avec logo `logo-light.png` hauteur 40 px, nom de l'utilisateur, lien « Voir le site », bouton « Déconnexion ». `admin.css` : variables préfixées `--a-`, police système, aucune dépendance à `global.css`.
- [ ] **Step 4:** `login.astro` + `LoginForm.vue` (`client:load`) : email, mot de passe, message d'erreur, redirection vers `next` (chemin interne uniquement).
- [ ] **Step 5:** Vérif manuelle `npm run dev` avec `.env` local : `/admin` redirige vers login, mauvais mot de passe refusé, bon accepté. `.env` dans `.gitignore`.
- [ ] **Step 6:** Build + compare-dist `OK`. Commit `Admin : protection, connexion, déconnexion`.

### Task 8: Lecture du contenu, fichiers, uploads

**Files:**
- Create: `src/lib/admin/uploads.ts`, `src/pages/api/admin/list.ts`, `entry.ts`, `file.ts`, `upload.ts`

**Interfaces:**
- `GET /api/admin/list?kind=project|post` → `[{ slug, title, year?, date?, city?, draft, cover?: string /* chemin repo */ }]`.
- `GET /api/admin/entry?kind=&slug=` → `{ slug, sha, data, body, files: string[] /* médias existants, chemins repo */ }` ; 404 si absent. `kind=agence` ignore `slug`.
- `GET /api/admin/file?path=` → octets avec `Content-Type` selon l'extension, `Cache-Control: private, max-age=300` ; refuse tout chemin hors `src/data/` et `public/cv/` ou contenant `..`.
- `POST /api/admin/upload` (multipart, champ `file`) → `{ id }` ; refuse > 5,5 Mo et types hors `image/jpeg|png|webp`, `application/pdf`.
- `uploads.ts` : `putUpload(buf: Buffer, type: string): Promise<string>`, `takeUpload(id): Promise<{ buf: Buffer; type: string } | null>`, `deleteUpload(id)`. Store `admin-uploads`, métadonnée `createdAt` ; plus de 24 h = ignoré et supprimé.

- [ ] **Step 1:** Implémenter les routes avec `export const prerender = false`, `requireUser`, `checkOrigin` sur POST.
- [ ] **Step 2:** Vérif manuelle en dev sur `GITHUB_BRANCH=admin-content-test` : `list` renvoie les 14 projets et 9 actus, `entry` renvoie dixmier avec ses images.
- [ ] **Step 3:** Commit `Admin : lecture du contenu et upload temporaire`.

### Task 9: Enregistrement, suppression, statut

**Files:**
- Create: `src/lib/admin/save.ts`, `tests/admin/save.test.ts`, `src/pages/api/admin/save.ts`, `delete.ts`, `status.ts`

**Interfaces:**
- `buildChanges(input: SaveInput, getUpload: (id) => Promise<{ buf; type } | null>): Promise<{ changes; message; expect; usedUploads: string[] }>` avec
  `SaveInput = { kind: Kind; slug: string; isNew: boolean; sha: string | null; data: Record<string, any>; body: string; mode: 'draft' | 'publish'; added: Array<{ id: string; name: string; field?: 'cv' }>; removed: string[] }`.
  - `mode === 'draft'` → `data.draft = true` ; `'publish'` → `delete data.draft`.
  - Fichier ajouté : `mediaDir(kind, slug, field) + '/' + safeFileName(name)` ; en cas de collision de nom dans le même envoi, suffixe `-2`, `-3`.
  - `removed` : chaque chemin doit être sous `mediaDir(kind, slug)` (ou `public/cv` pour l'agence), sinon erreur 400.
  - Références provisoires : le client met `upload:<id>` dans `data` (cover, gallery[], image, associates[].photo, associates[].cv). `buildChanges` remplace par le chemin public relatif à l'entrée : `./images/x.jpg` (projet, actu, agence) ou `/cv/x.pdf`.
  - `expect = { path: entryPath(kind, slug), sha: isNew ? null : sha }`.
  - Message : `Admin : ${isNew ? 'création' : mode === 'draft' ? 'brouillon' : 'publication'} ${label} « ${data.title} »`.
- `POST /api/admin/save` → `{ ok: true, sha }` | 400 `{ errors }` | 409 `{ conflict: { author, date } }`.
- `POST /api/admin/delete` `{ kind, slug, sha }` → supprime le `.md` (actu) ou tout le dossier (projet) ; `agence` refusé.
- `GET /api/admin/status` → `{ state: 'ready' | 'building' | 'error', updatedAt }` via `GET https://api.netlify.com/api/v1/sites/<id>/deploys?per_page=1` ; `unknown` si pas de token.

- [ ] **Step 1: Tests** de `buildChanges` : brouillon ajoute `draft: true` ; publication le retire ; `upload:abc` dans `gallery` devient `./images/photo.jpg` ; `removed` hors dossier refusé ; nouveau projet → `expect.sha === null` ; deux uploads `photo.jpg` donnent `photo.jpg` et `photo-2.jpg`.
- [ ] **Step 2:** FAIL, implémenter, vert.
- [ ] **Step 3:** Routes ; `ConflictError` → 409 ; après commit, `deleteUpload` des ids utilisés.
- [ ] **Step 4:** Vérif manuelle sur `admin-content-test` : modifier un titre, vérifier le commit (un seul, auteur correct) ; conflit simulé.
- [ ] **Step 5:** Commit `Admin : enregistrement, suppression, statut de publication`.

### Task 10: Aperçu

**Files:**
- Create: `src/pages/admin/preview/[type].astro`

**Interfaces:**
- `POST /admin/preview/project|post|agence` avec JSON `{ data, body, images: Record<string, string> }` (`images` : valeur du champ vers URL affichable, fournie par le client : `blob:` pour les nouvelles, `/api/admin/file?path=` pour les existantes).
- Rend `<ProjectView>`/`<PostView>`/`<AgenceView>` avec `<Fragment set:html={html} />` en slot, `html` issu de `createMarkdownProcessor()` de `@astrojs/markdown-remark`.

- [ ] **Step 1:** Implémenter (`export const prerender = false`, `Astro.request.json()`).
- [ ] **Step 2:** Vérif : POST des données de `dixmier` → HTML avec Header, Footer, titre, galerie.
- [ ] **Step 3:** Commit `Admin : aperçu rendu avec les vues du site`.

### Task 11: Interface : tableau de bord et listes

**Files:**
- Create: `src/lib/admin/client.ts`, `src/pages/admin/index.astro`, `src/pages/admin/projets/index.astro`, `src/pages/admin/actus/index.astro`, `src/components/admin/Dashboard.vue`, `EntryList.vue`, `PublishStatus.vue`

**Interfaces:**
- `client.ts` : `api.list(kind)`, `api.entry(kind, slug)`, `api.upload(file: Blob, name)`, `api.save(input)`, `api.remove(kind, slug, sha)`, `api.status()`, `fileUrl(path)`. Une réponse 401 redirige vers `/admin/login?next=`.
- `PublishStatus.vue` : interroge `status` toutes les 10 s tant que `building`.
- `EntryList.vue` props `{ kind }` : vignettes (via `fileUrl`), titre, année ou date, badge Brouillon, recherche, bouton Nouveau (→ `/admin/projets/nouveau`).

- [ ] **Step 1:** Implémenter. **Step 2:** Vérif visuelle Playwright (bureau et 375 px). **Step 3:** Commit `Admin : tableau de bord et listes`.

### Task 12: Éditeurs

**Files:**
- Create: `src/lib/admin/image-client.ts`, `src/components/admin/useEditor.ts`, `ProjectEditor.vue`, `PostEditor.vue`, `AgenceEditor.vue`, `MarkdownField.vue`, `GalleryField.vue`, `ImageField.vue`, `FileField.vue`, `PreviewPane.vue`, `SaveBar.vue`
- Create: `src/pages/admin/projets/[slug].astro`, `src/pages/admin/actus/[slug].astro`, `src/pages/admin/agence.astro`

**Interfaces:**
- `image-client.ts` : `compressImage(file: File): Promise<{ blob: Blob; name: string; width: number; height: number }>` ; HEIC détecté par type ou extension, converti via `import('heic2any')` ; `createImageBitmap` + canvas, 2400 px max, `toBlob('image/jpeg', 0.82)` ; PNG conservé en PNG.
- `useEditor(kind, slug)` : charge l'entrée (ou vide si `nouveau`), état `data/body/sha`, `dirty`, `added` (Map id → { name, blobUrl, field }), `removed`, `save(mode)`, `remove()`, sauvegarde `localStorage` `lca-draft:<kind>:<slug>` à chaque modification et proposition de restauration au chargement, `beforeunload` si `dirty`. `imageUrl(value)` : `upload:<id>` → blobUrl, chemin relatif → `fileUrl(dossier + chemin)`.
- `GalleryField` : dépôt multi-fichiers, compression puis upload (3 en parallèle), progression par vignette, réordonnancement par glisser-déposer, étoile = couverture (`data.cover`), corbeille (ajoute à `removed` si fichier existant). Si `data.gallery` est vide, la galerie affichée est la liste des images existantes du dossier `images/` triée par nom ; toute modification écrit la liste explicite.
- `MarkdownField` : textarea + barre (Gras, Italique, Titre, Liste, Lien) insérant la syntaxe autour de la sélection.
- `PreviewPane` : POST debounced 1 s vers `/admin/preview/<kind>`, `iframe.srcdoc = html` ; onglet sur mobile.
- `SaveBar` : Enregistrer le brouillon / Publier / Supprimer (confirmation avec le titre), états chargement, messages (succès, conflit avec auteur et heure, erreur réseau avec Réessayer).
- Slug : pour `nouveau`, pré-rempli par `slugify(title)`, éditable tant que non publié.

- [ ] **Step 1:** `image-client.ts` et vérif dans le navigateur (JPEG lourd → < 1,5 Mo, 2400 px).
- [ ] **Step 2:** `useEditor` + `SaveBar` + `MarkdownField` + `ImageField` + `FileField`.
- [ ] **Step 3:** `PostEditor` de bout en bout sur `admin-content-test` : modifier, brouillon, publier.
- [ ] **Step 4:** `GalleryField` + `ProjectEditor` ; création d'un projet de test avec 3 photos, réordonnancement, couverture ; vérifier le commit unique.
- [ ] **Step 5:** `AgenceEditor` (associés, photo, CV PDF vers `public/cv/`).
- [ ] **Step 6:** `PreviewPane` sur les trois éditeurs.
- [ ] **Step 7:** Commit par sous-étape.

### Task 13: Nettoyage, vérification finale, branch deploy

**Files:**
- Delete: `public/admin/index.html`, `public/admin/config.yml`
- Create: `docs/admin.md` (mode d'emploi : créer un compte, variables d'env)

- [ ] **Step 1:** Supprimer Sveltia. `npm test` vert. `npm run build` + compare-dist `OK`.
- [ ] **Step 2:** Captures Playwright avant/après (Accueil, Agence, Actualités, un projet, une actu ; clair et sombre) : identiques.
- [ ] **Step 3:** Parcours complet en local sur `admin-content-test` (Review Focus 1 à 5 inclus).
- [ ] **Step 4:** Push de la branche `admin` seulement après accord de Quentin ; branch deploy Netlify avec variables d'env de test (`GITHUB_BRANCH=admin-content-test`).
- [ ] **Step 5:** Merge dans `main` uniquement après la réunion du 2026-10-06 et feu vert explicite.
