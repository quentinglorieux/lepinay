<script setup lang="ts">
// Mise en page commune des éditeurs : barre d'actions, formulaire à gauche, aperçu à droite.
import { ref } from 'vue';
import SaveBar from './SaveBar.vue';
import PreviewPane from './PreviewPane.vue';
import type { Editor } from './useEditor';

defineProps<{ editor: Editor; title: string; back?: string; publicUrl?: string }>();
const tab = ref<'form' | 'preview'>('form');
</script>

<template>
  <div class="shell">
    <SaveBar :editor="editor" :title="title" :back="back" :public-url="publicUrl" />
    <div class="tabs" role="tablist">
      <button type="button" role="tab" :aria-selected="tab === 'form'" @click="tab = 'form'">Contenu</button>
      <button type="button" role="tab" :aria-selected="tab === 'preview'" @click="tab = 'preview'">Aperçu</button>
    </div>
    <p v-if="editor.loading.value" class="state">Chargement…</p>
    <p v-else-if="editor.loadError.value" class="state a-notice err">{{ editor.loadError.value }}</p>
    <div v-else class="cols" :data-tab="tab">
      <form class="form" @submit.prevent>
        <slot />
      </form>
      <PreviewPane :editor="editor" class="pane" />
    </div>
  </div>
</template>

<style scoped>
.shell { display: flex; flex-direction: column; height: calc(100vh - 61px); }
.cols { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(380px, 520px) 1fr; }
.form { overflow-y: auto; padding: 20px 22px 60px; border-right: 1px solid var(--a-border); }
.pane { min-height: 0; }
.state { padding: 24px; }
.tabs { display: none; }
@media (max-width: 900px) {
  .shell { height: auto; }
  .cols { display: block; }
  .form { border: 0; padding: 16px 14px 60px; }
  .pane { height: 80vh; }
  .cols[data-tab='form'] .pane, .cols[data-tab='preview'] .form { display: none; }
  .tabs { display: flex; border-bottom: 1px solid var(--a-border); background: var(--a-panel); }
  .tabs button { flex: 1; border: 0; background: none; padding: 10px; font: inherit; color: var(--a-muted); border-bottom: 2px solid transparent; }
  .tabs button[aria-selected='true'] { color: var(--a-fg); border-bottom-color: var(--a-fg); }
}
</style>
