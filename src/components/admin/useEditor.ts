// État partagé d'un éditeur de l'admin : chargement, modifications, fichiers
// ajoutés ou retirés, sauvegarde locale de secours et enregistrement.
import { computed, nextTick, reactive, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { api, ApiError, fileUrl, formatDate, refOf, repoPathOf, type Kind } from '../../lib/admin/client';
import { compressImage, isImageFile } from '../../lib/admin/image-client';

type Added = { name: string; url: string; field?: 'cv' };
type Message = { type: 'ok' | 'err' | 'warn'; text: string } | null;

const DEFAULTS: Record<Kind, () => Record<string, any>> = {
  project: () => ({ title: '', categories: [], tags: [], gallery: [] }),
  post: () => ({ title: '', date: new Date().toISOString().slice(0, 10), categories: [], tags: [] }),
  agence: () => ({ title: '', associates: [] }),
};

// Toutes les chaînes d'un objet (pour savoir quels fichiers sont encore utilisés).
function strings(v: any, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

// Année saisie au clavier : nombre si elle tient sur 4 chiffres (comme les fichiers existants).
function normalize(d: Record<string, any>) {
  if (typeof d.year === 'string' && /^\d{4}$/.test(d.year.trim())) d.year = Number(d.year.trim());
  return d;
}

export function useEditor(kind: Kind, initialSlug: string) {
  const isNew = ref(initialSlug === 'nouveau');
  const slug = ref(isNew.value ? '' : initialSlug);
  const loading = ref(true);
  const loadError = ref('');
  const data = reactive<Record<string, any>>(DEFAULTS[kind]());
  const body = ref('');
  const sha = ref<string | null>(null);
  const files = ref<string[]>([]); // images déjà présentes dans le dossier (chemins du repo)
  const added = reactive(new Map<string, Added>());
  const removed = reactive(new Set<string>()); // chemins du repo proposés à la suppression
  const dirty = ref(false);
  const saving = ref<'' | 'draft' | 'publish' | 'delete'>('');
  const message = ref<Message>(null);
  const errors = ref<Record<string, string>>({});
  const uploading = ref(0);
  const storageKey = computed(() => `lca-draft:${kind}:${isNew.value ? 'nouveau' : slug.value}`);

  // ------------------------------------------------------------ chargement
  // Les changements faits par le chargement lui-même ne comptent pas comme des modifications.
  let muted = 0;
  async function load() {
    muted++;
    loading.value = true;
    loadError.value = '';
    try {
      if (!isNew.value || kind === 'agence') {
        const e = await api.entry(kind, kind === 'agence' ? '' : slug.value);
        Object.keys(data).forEach((k) => delete data[k]);
        Object.assign(data, DEFAULTS[kind](), e.data);
        body.value = e.body.replace(/^\n+/, '');
        sha.value = e.sha;
        files.value = e.files;
        isNew.value = false;
      }
      dirty.value = false;
    } catch (e) {
      loadError.value = e instanceof ApiError && e.status === 404 ? 'Contenu introuvable.' : 'Chargement impossible.';
    } finally {
      loading.value = false;
      await nextTick();
      muted--;
    }
  }

  // ------------------------------------------------------------ sauvegarde locale de secours
  function saveLocal() {
    try {
      localStorage.setItem(
        storageKey.value,
        JSON.stringify({ data, body: body.value, sha: sha.value, added: [...added].map(([id, a]) => ({ id, name: a.name, field: a.field })), at: Date.now() }),
      );
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  }
  function clearLocal() {
    try {
      localStorage.removeItem(storageKey.value);
    } catch {
      /* idem */
    }
  }
  function restoreLocal() {
    let saved: any = null;
    try {
      saved = JSON.parse(localStorage.getItem(storageKey.value) ?? 'null');
    } catch {
      return;
    }
    if (!saved || Date.now() - saved.at > 24 * 3600 * 1000) return;
    if (saved.sha !== sha.value) return clearLocal(); // le contenu a changé entre-temps
    const when = new Date(saved.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (!confirm(`Des modifications non enregistrées (${when}) ont été retrouvées. Les récupérer ?`)) return clearLocal();
    Object.keys(data).forEach((k) => delete data[k]);
    Object.assign(data, saved.data);
    body.value = saved.body;
    for (const a of saved.added ?? []) added.set(a.id, { name: a.name, url: '', field: a.field });
    dirty.value = true;
  }

  // ------------------------------------------------------------ images et fichiers
  // URL affichable pour une référence du frontmatter.
  function urlOf(value: unknown): string {
    if (typeof value !== 'string' || !value) return '';
    if (value.startsWith('upload:')) return added.get(value.slice(7))?.url ?? '';
    if (/^(https?:|blob:|data:)/.test(value)) return value;
    return fileUrl(repoPathOf(kind, slug.value || 'nouveau', value));
  }

  // Compresse (images), envoie, et renvoie la référence provisoire "upload:<id>".
  async function addFile(file: File, field?: 'cv'): Promise<string> {
    uploading.value++;
    try {
      let blob: Blob = file;
      let name = file.name;
      if (field !== 'cv' && isImageFile(file)) ({ blob, name } = await compressImage(file));
      const { id } = await api.upload(blob, name);
      added.set(id, { name, url: URL.createObjectURL(blob), field });
      dirty.value = true;
      return `upload:${id}`;
    } finally {
      uploading.value--;
    }
  }

  // Un fichier existant n'est supprimé du repo que s'il n'est plus utilisé nulle part.
  function dropRef(value: unknown) {
    if (typeof value !== 'string' || !value || value.startsWith('upload:')) return;
    removed.add(repoPathOf(kind, slug.value, value));
    dirty.value = true;
  }

  // Galerie effective : liste explicite, sinon toutes les images du dossier (comportement du site).
  const autoGallery = computed(() => files.value.map((p) => refOf(kind, slug.value, p)));
  const gallery = computed<string[]>(() => (data.gallery?.length ? data.gallery : autoGallery.value));
  function setGallery(list: string[]) {
    data.gallery = [...list];
  }

  // ------------------------------------------------------------ enregistrement
  async function save(mode: 'draft' | 'publish') {
    message.value = null;
    errors.value = {};
    if (!String(data.title ?? '').trim()) {
      errors.value = { title: 'Le titre est obligatoire' };
      message.value = { type: 'err', text: 'Le titre est obligatoire.' };
      return false;
    }
    if (isNew.value && kind !== 'agence' && !/^[a-z0-9][a-z0-9-]*$/.test(slug.value)) {
      errors.value = { slug: 'Adresse invalide : lettres minuscules, chiffres et tirets' };
      message.value = { type: 'err', text: 'L’adresse de la page est invalide.' };
      return false;
    }
    if (uploading.value) {
      message.value = { type: 'warn', text: 'Patientez, des images sont encore en cours d’envoi.' };
      return false;
    }
    saving.value = mode;
    try {
      const used = new Set(strings(data));
      const usedPaths = new Set([...used].filter((s) => !s.startsWith('upload:')).map((s) => repoPathOf(kind, slug.value, s)));
      await api.save({
        kind,
        slug: slug.value,
        isNew: isNew.value,
        sha: sha.value,
        data: normalize(JSON.parse(JSON.stringify(data))),
        body: body.value,
        mode,
        added: [...added].filter(([id]) => used.has(`upload:${id}`)).map(([id, a]) => ({ id, name: a.name, field: a.field })),
        removed: [...removed].filter((p) => !usedPaths.has(p)),
      });
      clearLocal();
      const wasNew = isNew.value;
      message.value = {
        type: 'ok',
        text: mode === 'draft' ? 'Brouillon enregistré. Il n’apparaît pas sur le site.' : 'Publié. Le site sera à jour dans 1 à 2 minutes.',
      };
      if (wasNew) {
        const base = kind === 'project' ? '/admin/projets/' : '/admin/actus/';
        sessionStorage.setItem('lca-flash', JSON.stringify(message.value));
        dirty.value = false; // pas d'alerte « quitter la page » sur cette redirection
        location.href = base + slug.value;
        return true;
      }
      added.clear();
      removed.clear();
      const keep = message.value;
      await load();
      message.value = keep;
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const c = e.body?.conflict ?? {};
        const when = c.date ? `${formatDate(c.date)} à ${new Date(c.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '';
        message.value = {
          type: 'err',
          text: isNew.value
            ? 'Un contenu avec cette adresse existe déjà. Changez l’adresse de la page.'
            : `Ce contenu a été modifié par ${c.author ?? 'quelqu’un'} ${when}. Rechargez la page pour voir la nouvelle version (vos modifications restent sauvegardées sur cet ordinateur).`,
        };
      } else if (e instanceof ApiError && e.status === 400 && e.body?.errors) {
        errors.value = e.body.errors;
        message.value = { type: 'err', text: 'Certains champs sont à corriger.' };
      } else {
        message.value = { type: 'err', text: `Enregistrement impossible : ${e instanceof Error ? e.message : 'erreur réseau'}. Réessayez.` };
      }
      return false;
    } finally {
      saving.value = '';
    }
  }

  async function remove() {
    if (kind === 'agence' || !sha.value) return;
    const detail = kind === 'project' ? ' Ses photos seront aussi supprimées.' : '';
    if (!confirm(`Supprimer définitivement « ${data.title} » ?${detail}`)) return;
    saving.value = 'delete';
    try {
      await api.remove(kind, slug.value, sha.value);
      clearLocal();
      dirty.value = false;
      location.href = kind === 'project' ? '/admin/projets' : '/admin/actus';
    } catch (e) {
      message.value = { type: 'err', text: `Suppression impossible : ${e instanceof Error ? e.message : 'erreur réseau'}` };
    } finally {
      saving.value = '';
    }
  }

  // ------------------------------------------------------------ suivi des modifications
  let ready = false;
  watch([() => JSON.stringify(data), body], () => {
    if (!ready || muted) return;
    dirty.value = true;
    saveLocal();
  });
  const beforeUnload = (e: BeforeUnloadEvent) => {
    if (dirty.value) e.preventDefault();
  };
  onMounted(async () => {
    try {
      const flash = sessionStorage.getItem('lca-flash');
      if (flash) {
        sessionStorage.removeItem('lca-flash');
        message.value = JSON.parse(flash);
      }
    } catch {
      /* rien */
    }
    await load();
    ready = true;
    restoreLocal();
    window.addEventListener('beforeunload', beforeUnload);
  });
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload));

  return {
    kind, isNew, slug, loading, loadError, data, body, sha, files, added, removed, dirty, saving, message, errors, uploading,
    urlOf, addFile, dropRef, gallery, autoGallery, setGallery, save, remove,
  };
}

export type Editor = ReturnType<typeof useEditor>;
