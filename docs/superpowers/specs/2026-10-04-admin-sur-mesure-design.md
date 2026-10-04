# Admin sur mesure, Lépinay Champlois Architecture

Date : 2026-10-04. Statut : design validé en conversation, en attente de relecture de la spec.

## 1. Objectif

Permettre à Garance Champlois (non technique), et aux autres membres de l'agence, de modifier le contenu du site (projets, actualités, page Agence) depuis une interface intégrée au site, à l'adresse `/admin`, sans compte GitHub, sans outil tiers et sans toucher au code.

Critères de succès :

- Garance crée un projet complet (texte, infos, photos brutes d'iPhone) et le publie seule, en moins de 10 minutes.
- Ce qu'elle voit dans l'aperçu est identique à la page publiée.
- Le site public reste exactement le même, visuellement et en performance (statique, pré-rendu).
- Aucune modification ne peut en écraser une autre silencieusement.

## 2. Contraintes

- **Front public intouché.** Aucun changement de design, de HTML visible ou de CSS sur le site public. La refonte interne (extraction des vues) doit produire un HTML identique, page par page, aux noms de fichiers d'assets hachés près.
- **Réunion mardi 2026-10-06** : le site en ligne doit rester stable. Tout le travail est fait sur la branche `admin`, testé sur l'URL de branch deploy Netlify, et n'est mergé dans `main` qu'après feu vert explicite.
- Le contenu reste en Markdown + images dans le repo Git (`src/data/...`). Pas de base de données.
- Hébergement Netlify existant (site `pierre-lepinay-architecture`, déploiement depuis `main` de `github.com/quentinglorieux/lepinay`).
- Les édits faits directement dans le code restent possibles.

## 3. Hors périmètre (V1)

- Gestion des comptes depuis l'interface (les comptes sont définis par variable d'environnement).
- Édition des mentions légales (rare, reste dans le code).
- Historique ou restauration de versions dans l'interface (Git garde l'historique).
- Multilingue, planification de publication.

## 4. Architecture

Astro 5.17 reste en `output: 'static'`, avec l'adaptateur `@astrojs/netlify`. Les pages publiques restent pré-rendues. Seules les routes qui exportent `export const prerender = false` deviennent des fonctions Netlify :

- `src/pages/admin/**` : pages de l'admin (login, tableau de bord, listes, éditeurs, aperçu).
- `src/pages/api/admin/**` : endpoints JSON (auth, lecture, upload, enregistrement, statut).

### Unités

| Fichier | Rôle | Dépend de |
|---|---|---|
| `src/lib/admin/auth.ts` | Vérification email + mot de passe (scrypt, `node:crypto`), création et vérification du cookie de session signé (HMAC-SHA256, HttpOnly, Secure, SameSite=Lax, 7 jours). | `ADMIN_USERS`, `ADMIN_SESSION_SECRET` |
| `src/lib/admin/github.ts` | Lecture d'un fichier ou d'un dossier (contenu + SHA) ; commit atomique de N ajouts/suppressions via la Git Data API (blobs, tree, commit, update ref) avec auteur = utilisateur connecté. | `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH` |
| `src/lib/admin/content.ts` | Parse et sérialise frontmatter + Markdown ; schémas zod par type (projet, actu, agence) reprenant les champs existants ; conversion titre vers slug ; construction des chemins de fichiers. | `yaml`, `zod` |
| `src/lib/admin/uploads.ts` | Stockage temporaire des images envoyées (Netlify Blobs, store `admin-uploads`), purge après commit ou après 24 h. | `@netlify/blobs` |
| `src/middleware.ts` | Protège `/admin/**` (redirection vers `/admin/login`) et `/api/admin/**` (401) hors routes de login. N'agit pas sur les pages pré-rendues. | `auth.ts` |
| `src/components/views/ProjectView.astro`, `PostView.astro`, `AgenceView.astro` | Rendu d'une page projet, actu, agence à partir de données simples (chaînes pour les images, HTML du corps). Extrait tel quel des pages actuelles. Utilisé par les pages publiques **et** par l'aperçu. | `Header`, `Footer`, `SEO`, `global.css` |
| `src/components/admin/*.vue` | Interface : `LoginForm`, `Dashboard`, `EntryList`, `ProjectEditor`, `PostEditor`, `AgenceEditor`, `MarkdownField`, `GalleryField`, `ImageField`, `FileField`, `PreviewPane`, `SaveBar`, `PublishStatus`. | API admin |
| `src/lib/admin/image-client.ts` | Compression côté navigateur : décodage (HEIC via `heic2any` chargé à la demande), redimensionnement 2400 px max sur le grand côté, JPEG qualité 82, sans métadonnées. | canvas, `heic2any` |

### Variables d'environnement (Netlify, jamais dans le repo)

- `ADMIN_USERS` : JSON `[{"email":"prenom@exemple.fr","name":"Prénom Nom","hash":"scrypt:<sel>:<hash>"}]`. Un script local `scripts/admin-hash-password.mjs` produit le hash.
- `ADMIN_SESSION_SECRET` : 32 octets aléatoires.
- `GITHUB_TOKEN` : token fine-grained limité au repo `quentinglorieux/lepinay`, permission *Contents: read & write*.
- `GITHUB_REPO=quentinglorieux/lepinay` ; `GITHUB_BRANCH` : `main` en production, `admin-content-test` sur le branch deploy de test (pour ne pas publier sur le site réel pendant les essais).
- `NETLIFY_API_TOKEN` + `NETLIFY_SITE_ID` : lecture du statut du dernier déploiement.

## 5. Modèle de contenu

Inchangé sur disque, plus un champ `draft`.

- **Projet** : `src/data/projects/<slug>/index.md`, couverture et images dans `src/data/projects/<slug>/` et `.../images/`. Champs : `title`, `subtitle`, `status`, `year`, `city`, `country`, `surface`, `budget`, `photographies`, `maitrise_ouvrage`, `maitre_oeuvre`, `architecte`, `bureau_etude` (liste), `entreprise`, `client`, `label`, `categories` (parmi Construction, Réhabilitation, Logements, Équipements, Médiathèque, Musée), `tags`, `cover`, `gallery` (liste ordonnée, optionnelle), `seo.description`, `draft`, corps Markdown. Les champs inconnus présents dans un fichier sont conservés tels quels à la réécriture.
- **Actu** : `src/data/actus/<slug>.md`, image dans `src/data/actus/images/`. Champs : `title`, `subtitle`, `date` (`YYYY-MM-DD`), `city`, `categories`, `tags`, `image`, `draft`, corps.
- **Agence** : `src/data/pages/agence.md`, images dans `src/data/pages/images/`, CV dans `public/cv/` (lien `/cv/<fichier>.pdf`). Champs : `title`, `subtitle`, `cover`, `associates[]` (`name`, `role`, `bio`, `photo`, `email`, `cv`, `links.linkedin`), corps.
- **Brouillons** : `draft: true`. `src/content.config.ts` filtre les brouillons des collections publiques ; ils n'apparaissent ni dans les pages, ni dans les filtres, ni dans le sitemap.
- **Galerie** : si `gallery` est vide ou absente, comportement actuel conservé (toutes les images du dossier `images/`, ordre des noms). Dès que Garance réordonne, la liste est écrite explicitement.
- **Slug** d'un nouveau projet ou d'une actu : dérivé du titre (minuscules, sans accents, tirets, `[a-z0-9-]`), modifiable avant la première publication, figé ensuite. Les dossiers existants dont le nom sort de ce format (`Helene Berr`, `Lisieux`) sont conservés tels quels.

## 6. Écrans

- `/admin/login` : logo, email, mot de passe.
- `/admin` : trois entrées (Projets, Actualités, Page Agence) et bandeau de publication (« Site à jour » / « Publication en cours » / « Échec de publication »).
- `/admin/projets`, `/admin/actus` : liste avec vignette, titre, année ou date, badge Brouillon, recherche, bouton « Nouveau ».
- `/admin/projets/<slug>`, `/admin/actus/<slug>`, `/admin/agence` : éditeur en deux colonnes. Formulaire à gauche, aperçu à droite (iframe, rafraîchi 1 s après la dernière frappe). Barre fixe : « Enregistrer le brouillon », « Publier », « Supprimer » (avec confirmation). Galerie : dépôt par glisser-déposer avec progression, réordonnancement, étoile de couverture, suppression.
- Sur mobile, l'aperçu passe dans un onglet.
- L'admin a son propre style sobre, reprenant la typographie et le logo, dans une feuille de style dédiée. Il ne modifie pas `global.css`.

## 7. Flux de données

**Enregistrer / publier**

1. Chaque image ajoutée est compressée dans le navigateur, puis envoyée seule à `POST /api/admin/upload` (moins de 6 Mo par requête) ; réponse : un identifiant temporaire.
2. `POST /api/admin/save` reçoit : type, slug, champs, corps, fichiers ajoutés (identifiant temporaire + nom de fichier), fichiers supprimés, SHA d'origine du `.md`, mode (`draft` ou `publish`).
3. Le serveur vérifie la session, valide via le schéma, construit lui-même les chemins, relit le SHA courant sur GitHub. S'il diffère : réponse 409 avec l'auteur et l'heure du dernier commit sur ce fichier.
4. Un commit unique contient le `.md` et les fichiers. Message : `Admin : <action> <type> « <titre> »`. Auteur : nom et email de l'utilisateur connecté.
5. Le push déclenche le build Netlify existant. `GET /api/admin/status` alimente le bandeau.

**Aperçu**

`/admin/preview/<type>` est une page Astro rendue côté serveur qui accepte un `POST` avec l'état courant du formulaire et rend la vue correspondante (`ProjectView` etc.), donc la même mise en page que le site. Le Markdown du corps est converti en HTML avec le même moteur que les collections Astro. Les images déjà dans le repo sont servies par `GET /api/admin/file?path=...` (lecture GitHub, authentifiée). Les images nouvelles non commitées sont remplacées côté navigateur par des URL `blob:` locales. Le HTML est injecté dans l'iframe via `srcdoc`.

**Lecture**

L'admin lit toujours le contenu via l'API GitHub (jamais la version figée au build), pour refléter les modifications avant la fin du build.

## 8. Erreurs

- Session expirée : retour au login ; l'état du formulaire est sauvegardé en `localStorage` et proposé à la reconnexion.
- Conflit (409) : message « Modifié par X à HH:MM. Rechargez pour voir la nouvelle version. » ; aucune écriture.
- Erreur GitHub ou réseau : message clair et bouton « Réessayer » ; l'état du formulaire est conservé.
- Validation : erreurs affichées sous les champs concernés ; l'enregistrement est refusé tant que le titre manque.
- Upload : une image qui échoue est marquée en rouge avec « Réessayer », les autres continuent.
- Quitter la page avec des modifications non enregistrées : confirmation du navigateur.

## 9. Sécurité

- Mots de passe hashés (scrypt, sel aléatoire), comparaison en temps constant.
- Limitation des tentatives de login : 5 échecs par email sur 15 minutes (compteur dans Netlify Blobs).
- Cookie HttpOnly, Secure, SameSite=Lax ; toutes les routes d'écriture exigent `POST` et vérifient l'en-tête `Origin`.
- Les chemins de fichiers sont construits côté serveur à partir du type, du slug et d'un nom de fichier assaini, jamais pris tels quels du client.
- Le token GitHub ne quitte jamais le serveur ; ses droits sont limités au seul repo.
- `/admin` est en `noindex`, exclu du sitemap et interdit dans `robots.txt` (déjà le cas).

## 10. Tests

- **Non-régression du front (bloquant)** : build de `main` et de `admin`, puis comparaison HTML de chaque page de `dist/` après normalisation des noms d'assets hachés. Toute différence est un échec. Captures d'écran Playwright avant/après des pages Accueil, Agence, Actualités, un projet, une actu, en clair et en sombre.
- **Unitaires (vitest)** : `content.ts` (parse/sérialise aller-retour sur tous les fichiers existants, sans perte de champ), `auth.ts` (hash, vérification, cookie, expiration), construction des chemins et des slugs, filtrage des brouillons.
- **Intégration** : `github.ts` contre un faux `fetch` (commit atomique, 409 sur SHA obsolète).
- **Bout en bout** sur le branch deploy, branche de contenu `admin-content-test` : login, création de projet avec photos HEIC et JPEG, réordonnancement, brouillon invisible, publication, conflit simulé, suppression.

## 11. Mise en ligne

1. Développement sur la branche `admin`, branch deploy Netlify activé pour cette branche, écritures dirigées vers `admin-content-test`.
2. Après la réunion du mardi 2026-10-06 et feu vert : création des comptes, variables d'environnement de production, merge dans `main`.
3. Retour arrière : revert du merge ; le contenu Markdown reste valable sans l'admin.

## 12. Nettoyage inclus

- Suppression de Sveltia (`public/admin/index.html`, `public/admin/config.yml`), remplacé par les routes `/admin`.

## 13. Ce dont on a besoin de Quentin

- Un token GitHub fine-grained (repo `lepinay`, Contents read & write).
- Un token Netlify personnel (lecture du statut de déploiement).
- Les emails des comptes à créer (Garance, Quentin, Pierre ?) ; les mots de passe sont choisis par chacun via le script de hash.
