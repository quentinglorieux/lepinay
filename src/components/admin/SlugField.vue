<script setup lang="ts">
// Adresse de la page d'un nouveau contenu, proposée à partir du titre.
import { watch, ref } from 'vue';
import type { Editor } from './useEditor';
import { slugify } from '../../lib/admin/shared';

const props = defineProps<{ editor: Editor; prefix: string }>();
const ed = props.editor;
const touched = ref(false);
watch(
  () => ed.data.title,
  (t) => {
    if (!touched.value) ed.slug.value = t ? slugify(String(t)) : '';
  },
);
function onInput(e: Event) {
  touched.value = true;
  ed.slug.value = (e.target as HTMLInputElement).value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}
</script>

<template>
  <div class="a-field">
    <label for="slug">Adresse de la page</label>
    <div class="slug">
      <span>{{ prefix }}</span>
      <input id="slug" class="a-input" :class="{ invalid: ed.errors.value.slug }" :value="ed.slug.value" @input="onInput" />
    </div>
    <span v-if="ed.errors.value.slug" class="error">{{ ed.errors.value.slug }}</span>
    <span v-else class="hint">Proposée à partir du titre. Elle ne pourra plus changer après la création.</span>
  </div>
</template>

<style scoped>
.slug { display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--a-muted); }
.slug .a-input { flex: 1; }
</style>
