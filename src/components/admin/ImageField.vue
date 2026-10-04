<script setup lang="ts">
// Une image (couverture, photo d'associé) : aperçu, remplacement, retrait.
import { ref } from 'vue';
import type { Editor } from './useEditor';

const model = defineModel<string | null | undefined>();
const props = defineProps<{ editor: Editor; label: string; hint?: string }>();
const busy = ref(false);
const error = ref('');
const input = ref<HTMLInputElement>();

async function pick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  busy.value = true;
  error.value = '';
  try {
    const previous = model.value;
    model.value = await props.editor.addFile(file);
    props.editor.dropRef(previous);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Envoi impossible';
  } finally {
    busy.value = false;
    input.value!.value = '';
  }
}
function clear() {
  props.editor.dropRef(model.value);
  model.value = undefined;
}
</script>

<template>
  <div class="a-field">
    <span class="a-label">{{ label }}</span>
    <div class="img">
      <div class="thumb">
        <img v-if="model && editor.urlOf(model)" :src="editor.urlOf(model)" alt="" />
        <span v-else-if="model">Image en attente</span>
        <span v-else>Aucune image</span>
      </div>
      <div class="actions">
        <label class="a-btn small">
          {{ busy ? 'Envoi…' : model ? 'Remplacer' : 'Choisir une image' }}
          <input ref="input" type="file" accept="image/*,.heic,.heif" hidden :disabled="busy" @change="pick" />
        </label>
        <button v-if="model" type="button" class="a-btn small ghost danger" @click="clear">Retirer</button>
      </div>
    </div>
    <span v-if="hint" class="hint">{{ hint }}</span>
    <span v-if="error" class="error">{{ error }}</span>
  </div>
</template>

<style scoped>
.img { display: flex; gap: 14px; align-items: center; }
.thumb { width: 140px; aspect-ratio: 4 / 3; border-radius: var(--a-radius); background: #eeebe7; display: grid; place-items: center; overflow: hidden; font-size: 12px; color: var(--a-muted); flex-shrink: 0; }
.thumb img { width: 100%; height: 100%; object-fit: cover; }
.actions { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
</style>
