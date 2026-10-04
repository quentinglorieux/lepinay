import { getCollection } from 'astro:content';

// Collections publiques : sans les brouillons (draft: true), dans un ordre stable.
// Le tri par id rend l'ordre de base déterministe d'un build à l'autre ; les pages
// appliquent ensuite leur propre tri (année, date) par-dessus.
export async function getPublished<C extends 'projects' | 'posts'>(name: C) {
  const entries = await getCollection(name, (e) => (e.data as { draft?: unknown }).draft !== true);
  return entries.sort((a, b) => a.id.localeCompare(b.id));
}
