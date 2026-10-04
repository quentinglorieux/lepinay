<script setup lang="ts">
import { computed } from 'vue';
import { useEditor } from './useEditor';
import EditorShell from './EditorShell.vue';
import TextField from './TextField.vue';
import ListField from './ListField.vue';
import MarkdownField from './MarkdownField.vue';
import ImageField from './ImageField.vue';
import SlugField from './SlugField.vue';

const props = defineProps<{ slug: string }>();
const ed = useEditor('post', props.slug);
const d = ed.data;
const err = computed(() => ed.errors.value);
</script>

<template>
  <EditorShell
    :editor="ed"
    :title="ed.isNew.value ? 'Nouvelle actualité' : d.title || 'Actualité'"
    back="/admin/actus"
    :public-url="`/actus/${ed.slug.value}`"
  >
    <TextField id="title" v-model="d.title" label="Titre" required :error="err.title" />
    <SlugField v-if="ed.isNew.value" :editor="ed" prefix="/actus/" />
    <TextField id="subtitle" v-model="d.subtitle" label="Sous-titre" />
    <div class="a-grid2">
      <TextField id="date" v-model="d.date" label="Date" type="date" :error="err.date" />
      <TextField id="city" v-model="d.city" label="Ville" placeholder="Triel-sur-Seine (78)" />
    </div>
    <ImageField v-model="d.image" :editor="ed" label="Image" />
    <MarkdownField v-model="ed.body.value" label="Texte" />
    <ListField id="cats" v-model="d.categories" label="Catégories" hint="Ex. : chantier, prix, consultation (séparées par des virgules)." />
    <ListField id="tags" v-model="d.tags" label="Mots-clés" hint="Séparés par des virgules. Affichés sous l’actualité." />
  </EditorShell>
</template>
