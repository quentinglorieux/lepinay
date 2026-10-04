<script setup lang="ts">
import { computed } from 'vue';
import { useEditor } from './useEditor';
import EditorShell from './EditorShell.vue';
import TextField from './TextField.vue';
import ListField from './ListField.vue';
import MarkdownField from './MarkdownField.vue';
import ImageField from './ImageField.vue';
import GalleryField from './GalleryField.vue';
import SlugField from './SlugField.vue';
import { PROJECT_CATEGORIES } from '../../lib/admin/shared';

const props = defineProps<{ slug: string }>();
const ed = useEditor('project', props.slug);
const d = ed.data;
const err = computed(() => ed.errors.value);

function toggleCategory(c: string) {
  const list: string[] = Array.isArray(d.categories) ? [...d.categories] : [];
  const i = list.indexOf(c);
  if (i >= 0) list.splice(i, 1);
  else list.push(c);
  d.categories = PROJECT_CATEGORIES.filter((x) => list.includes(x));
}
const seo = computed({
  get: () => d.seo?.description ?? '',
  set: (v: string) => (d.seo = { ...(d.seo ?? {}), description: v }),
});
</script>

<template>
  <EditorShell
    :editor="ed"
    :title="ed.isNew.value ? 'Nouveau projet' : d.title || 'Projet'"
    back="/admin/projets"
    :public-url="`/projets/${ed.slug.value}`"
  >
    <TextField id="title" v-model="d.title" label="Titre" required :error="err.title" />
    <SlugField v-if="ed.isNew.value" :editor="ed" prefix="/projets/" />
    <TextField id="subtitle" v-model="d.subtitle" label="Sous-titre" placeholder="Ex. : Construction de logements neufs" />

    <div class="a-field">
      <span class="a-label">Catégories</span>
      <div class="a-chips">
        <label v-for="c in PROJECT_CATEGORIES" :key="c" :class="['a-chip', { on: d.categories?.includes(c) }]">
          <input type="checkbox" :checked="d.categories?.includes(c)" hidden @change="toggleCategory(c)" />{{ c }}
        </label>
      </div>
      <span class="hint">Servent aux filtres de la page d’accueil.</span>
      <span v-if="err.categories" class="error">{{ err.categories }}</span>
    </div>

    <h2>Informations</h2>
    <div class="a-grid2">
      <TextField id="status" v-model="d.status" label="Phase" placeholder="Livré, Chantier en cours…" />
      <TextField id="year" v-model="d.year" label="Année" placeholder="2024 ou 2012-2016" :error="err.year" />
      <TextField id="city" v-model="d.city" label="Ville" placeholder="Paris (75012)" />
      <TextField id="surface" v-model="d.surface" label="Surface" placeholder="865 m² SDP" />
      <TextField id="budget" v-model="d.budget" label="Budget" placeholder="2 300 000 € HT" />
      <TextField id="label" v-model="d.label" label="Label / certification" />
    </div>
    <TextField id="moa" v-model="d.maitrise_ouvrage" label="Maîtrise d’ouvrage" />
    <TextField id="moe" v-model="d.maitre_oeuvre" label="Maîtrise d’œuvre" />
    <ListField id="be" v-model="d.bureau_etude" label="Bureaux d’études" hint="Un par ligne." multiline />
    <div class="a-grid2">
      <TextField id="entreprise" v-model="d.entreprise" label="Entreprise générale" />
      <TextField id="photos" v-model="d.photographies" label="Crédit photo" />
    </div>

    <h2>Images</h2>
    <ImageField v-model="d.cover" :editor="ed" label="Image de couverture" hint="Affichée sur la page d’accueil et en haut de la page du projet." />
    <GalleryField :editor="ed" />

    <h2>Texte</h2>
    <MarkdownField v-model="ed.body.value" />

    <h2>Référencement</h2>
    <TextField id="seo" v-model="seo" label="Description pour Google" hint="Une ou deux phrases (environ 150 caractères). Laisser vide pour une description automatique." multiline />
    <ListField id="tags" v-model="d.tags" label="Mots-clés" hint="Séparés par des virgules." />
  </EditorShell>
</template>
