# Comment modifier le site

## 1. Prérequis
- Installer les dépendances depuis la racine du projet : `npm install`. Cela met en place Astro, Vue et tous les outils nécessaires.
- Utiliser la version de Node recommandée par Astro (16+). Vous pouvez vérifier `package.json` pour les scripts et dépendances spécifiques.

## 2. Tester localement
- `npm run dev` : lance le serveur local (par défaut sur http://localhost:4321). Recharge automatique et compilation à la volée.


## 3. Comprendre la structure principale
- `src/pages/` contient les routes publiques (`index.astro`, `agence.astro`, `actus.astro`, etc.). Chaque fichier `.astro` devient une page accessible.
- `src/components/` réunit les morceaux réutilisables. Par exemple, `Header.astro` gère la navigation et le bouton de changement de thème, `Footer.astro` le pied de page, `ProjectCard.astro` les vignettes de projets.
- `public/` stocke les actifs statiques (logo, PDFs, images globales). Référencer directement `/logo.svg` depuis les composants.
- `src/styles/global.css` contient les règles globales (couleurs, typographie, mode sombre). Modifiez-le pour ajuster la charte graphique.

## 4. Modifier le contenu éditorial
- Les détails des projets et actualités sont principalement dans `src/content/` :
	- `content/actus/` et `content/pages/` rassemblent des fichiers Markdown (`.md`). Éditez leur frontmatter (titre, résumé, date, image) et le corps Markdown pour changer les textes.
	- `content/projects/{nom}/index.md` contient chaque projet. Les images associées vont dans `content/projects/{nom}/images/` et sont exposées via `src/pages/projets/[slug].astro`.
- Les fichiers Markdown sont assemblés par les pages dynamiques (ex. `src/pages/actus/[slug].astro`). Il suffit de modifier ou ajouter un fichier Markdown pour que la route existante s’actualise.

