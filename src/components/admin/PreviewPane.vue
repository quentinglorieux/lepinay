<script setup lang="ts">
// Aperçu de la page telle qu'elle sera publiée, rafraîchi 1 s après la dernière modification.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Editor } from './useEditor';

const props = defineProps<{ editor: Editor }>();
const ed = props.editor;
const html = ref('');
const state = ref<'idle' | 'loading' | 'error'>('idle');
let timer: ReturnType<typeof setTimeout> | undefined;
let controller: AbortController | undefined;

// Remplace les références d'images par des URL affichables dans l'aperçu.
function previewData() {
  const d = JSON.parse(JSON.stringify(ed.data));
  if (ed.kind === 'project') {
    d.cover = ed.urlOf(d.cover);
    d.gallery = ed.gallery.value.map((g) => ed.urlOf(g)).filter(Boolean);
  } else if (ed.kind === 'post') {
    d.image = ed.urlOf(d.image);
    d.cover = ed.urlOf(d.cover);
  } else {
    d.cover = ed.urlOf(d.cover);
    d.associates = (d.associates ?? []).map((a: any) => ({ ...a, photo: ed.urlOf(a.photo), cv: a.cv ? ed.urlOf(a.cv) : a.cv }));
  }
  return d;
}

async function refresh() {
  controller?.abort();
  controller = new AbortController();
  state.value = 'loading';
  try {
    const res = await fetch(`/admin/preview/${ed.kind}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: previewData(), body: ed.body.value }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(String(res.status));
    html.value = await res.text();
    state.value = 'idle';
  } catch (e) {
    if ((e as Error).name !== 'AbortError') state.value = 'error';
  }
}

watch(
  [() => JSON.stringify(ed.data), ed.body, () => ed.added.size, ed.loading],
  () => {
    if (ed.loading.value) return;
    clearTimeout(timer);
    timer = setTimeout(refresh, 1000);
  },
);
onMounted(() => {
  if (!ed.loading.value) refresh();
});
onBeforeUnmount(() => {
  clearTimeout(timer);
  controller?.abort();
});
</script>

<template>
  <section class="preview" aria-label="Aperçu">
    <header>
      <span>Aperçu</span>
      <span v-if="state === 'loading'" class="hint">mise à jour…</span>
      <span v-else-if="state === 'error'" class="hint err">aperçu indisponible <button type="button" class="a-btn small" @click="refresh">Réessayer</button></span>
    </header>
    <iframe title="Aperçu de la page" :srcdoc="html"></iframe>
  </section>
</template>

<style scoped>
.preview { display: flex; flex-direction: column; height: 100%; min-height: 0; background: #fff; }
header { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid var(--a-border); font-size: 13px; font-weight: 600; }
.hint { font-weight: 400; color: var(--a-muted); }
.hint.err { color: var(--a-danger); display: inline-flex; gap: 8px; align-items: center; }
iframe { flex: 1; width: 100%; border: 0; background: #fff; }
</style>
