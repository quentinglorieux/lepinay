<script setup lang="ts">
import { ref } from 'vue';

const model = defineModel<string>({ default: '' });
defineProps<{ label?: string; hint?: string; rows?: number }>();
const area = ref<HTMLTextAreaElement>();

// Entoure la sélection (ou insère en début de ligne) avec la syntaxe Markdown.
function wrap(before: string, after = before, placeholder = 'texte') {
  const el = area.value!;
  const { selectionStart: a, selectionEnd: b, value } = el;
  const selected = value.slice(a, b) || placeholder;
  model.value = value.slice(0, a) + before + selected + after + value.slice(b);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(a + before.length, a + before.length + selected.length);
  });
}
function linePrefix(prefix: string) {
  const el = area.value!;
  const { selectionStart: a, selectionEnd: b, value } = el;
  const start = value.lastIndexOf('\n', a - 1) + 1;
  const block = value.slice(start, b || a);
  const lines = block.split('\n').map((l) => (l.startsWith(prefix) ? l : prefix + l)).join('\n');
  model.value = value.slice(0, start) + lines + value.slice(b || a);
  requestAnimationFrame(() => el.focus());
}
function link() {
  const url = prompt('Adresse du lien (https://…)');
  if (url) wrap('[', `](${url})`, 'texte du lien');
}
</script>

<template>
  <div class="a-field md">
    <label v-if="label">{{ label }}</label>
    <div class="toolbar" role="toolbar" aria-label="Mise en forme">
      <button type="button" class="a-btn small ghost" title="Gras" @click="wrap('**')"><b>G</b></button>
      <button type="button" class="a-btn small ghost" title="Italique" @click="wrap('*')"><i>I</i></button>
      <button type="button" class="a-btn small ghost" title="Intertitre" @click="linePrefix('## ')">Titre</button>
      <button type="button" class="a-btn small ghost" title="Liste à puces" @click="linePrefix('- ')">• Liste</button>
      <button type="button" class="a-btn small ghost" title="Lien" @click="link">Lien</button>
    </div>
    <textarea ref="area" v-model="model" class="a-textarea" :rows="rows ?? 14" spellcheck="true" lang="fr"></textarea>
    <span v-if="hint" class="hint">{{ hint }}</span>
  </div>
</template>

<style scoped>
.toolbar { display: flex; gap: 2px; border: 1px solid var(--a-border); border-bottom: 0; border-radius: var(--a-radius) var(--a-radius) 0 0; padding: 3px; background: #faf9f7; }
.md .a-textarea { border-radius: 0 0 var(--a-radius) var(--a-radius); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13.5px; line-height: 1.6; }
</style>
