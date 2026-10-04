# Admin du site

Interface d'édition à l'adresse `/admin` : projets, actualités, page Agence.
Chaque enregistrement crée un commit sur `main` (au nom de la personne connectée),
puis Netlify reconstruit le site en 1 à 2 minutes.

## Ajouter ou modifier un compte

1. Sur ton ordinateur, à la racine du repo :

   ```bash
   node scripts/admin-hash-password.mjs "garance@exemple.fr" "Garance Champlois"
   ```

   Le script demande le mot de passe (10 caractères minimum, non affiché) et
   imprime une ligne JSON.

2. Netlify, site *pierre-lepinay-architecture* : Site configuration →
   Environment variables → `ADMIN_USERS`. La valeur est un tableau JSON contenant
   une ligne par personne :

   ```json
   [{"email":"…","name":"…","hash":"scrypt:…:…"}, {"email":"…","name":"…","hash":"scrypt:…:…"}]
   ```

3. Redéployer (Deploys → Trigger deploy) pour que la nouvelle valeur soit prise en compte.

Pour retirer un accès : supprimer la ligne correspondante, puis redéployer.
Pour déconnecter tout le monde : changer `ADMIN_SESSION_SECRET`.

## Variables d'environnement (Netlify)

| Variable | Rôle |
|---|---|
| `ADMIN_USERS` | Comptes (voir ci-dessus). |
| `ADMIN_SESSION_SECRET` | 32 caractères aléatoires minimum (`openssl rand -hex 32`). |
| `GITHUB_TOKEN` | Token GitHub *fine-grained*, repo `quentinglorieux/lepinay` uniquement, permission *Contents : Read and write*. |
| `GITHUB_REPO` | `quentinglorieux/lepinay` (valeur par défaut). |
| `GITHUB_BRANCH` | `main` (valeur par défaut). |
| `NETLIFY_API_TOKEN` | Optionnel : token personnel Netlify, pour afficher l'état de publication. |
| `NETLIFY_SITE_ID` | Optionnel : `9186f363-eb7c-4985-bd7a-aab8837566ae`. |

## Développement local

Créer un `.env` (ignoré par git) avec `ADMIN_USERS`, `ADMIN_SESSION_SECRET`,
`GITHUB_BRANCH=admin-content-test` (pour ne jamais écrire sur `main` en local), puis :

```bash
GITHUB_TOKEN=$(gh auth token) npm run dev
```

## Bon à savoir

- L'admin committe directement sur `main` : faire `git pull` avant de modifier le code en local.
- Un brouillon (`draft: true`) est enregistré dans le repo mais n'apparaît ni sur le site ni dans le sitemap.
- Les images sont compressées dans le navigateur (2400 px, JPEG) avant l'envoi ; les HEIC d'iPhone sont convertis.
- Les CV (PDF) sont rangés dans `public/cv/`.
- `npm test` lance les tests ; `node scripts/compare-dist.mjs <dist-avant> <dist-après>` vérifie qu'un changement de code ne modifie pas le HTML du site.
