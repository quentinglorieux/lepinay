<script setup lang="ts">
// Un document PDF (CV) déposé dans public/cv.
import { ref } from 'vue';
import type { Editor } from './useEditor';

const model = defineModel<string | null | undefined>();
const props = defineProps<{ editor: Editor; label: string }>();
const busy = ref(false);
const error = ref('');

async function pick(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.type !== 'application/pdf') {
    error.value = 'Seuls les fichiers PDF sont acceptés.';
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    const previous = model.value;
    model.value = await props.editor.addFile(file, 'cv');
    props.editor.dropRef(previous);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Envoi impossible';
  } finally {
    busy.value = false;
    input.value = '';
  }
}
const nameOf = (v: string) =>
  v.startsWith('upload:') ? (props.editor.added.get(v.slice(7))?.name ?? 'Nouveau fichier') : v.split('/').pop();
</script>

<template>
  <div class="a-field">
    <span class="a-label">{{ label }}</span>
    <div class="row">
      <a v-if="model && editor.urlOf(model)" :href="editor.urlOf(model)" target="_blank" rel="noopener">{{ nameOf(model) }}</a>
      <span v-else-if="model">{{ nameOf(model) }}</span>
      <span v-else class="hint">Aucun fichier</span>
      <label class="a-btn small">
        {{ busy ? 'Envoi…' : model ? 'Remplacer' : 'Ajouter un PDF' }}
        <input type="file" accept="application/pdf" hidden :disabled="busy" @change="pick" />
      </label>
      <button v-if="model" type="button" class="a-btn small ghost danger" @click="editor.dropRef(model); model = undefined">Retirer</button>
    </div>
    <span v-if="error" class="error">{{ error }}</span>
  </div>
</template>

<style scoped>
.row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
</style>
