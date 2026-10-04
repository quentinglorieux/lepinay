// Helpers sans dépendance, utilisables côté serveur et dans le navigateur.

export const PROJECT_CATEGORIES = [
  'Construction',
  'Réhabilitation',
  'Logements',
  'Équipements',
  'Médiathèque',
  'Musée',
] as const;

export function slugify(title: string): string {
  const s = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
  return s || `projet-${Date.now()}`;
}
