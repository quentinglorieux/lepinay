<script setup lang="ts">
// Galerie d'un projet : ajout (glisser-déposer ou bouton), ordre, couverture, suppression.
import { reactive, ref } from 'vue';
import type { Editor } from './useEditor';
import { isImageFile } from '../../lib/admin/image-client';

const props = defineProps<{ editor: Editor }>();
const ed = props.editor;

type Pending = { key: number; name: string; error?: string };
const pending = reactive<Pending[]>([]);
const over = ref(false);
const dragFrom = ref<number | null>(null);
let seq = 0;

// Limite le nombre d'envois simultanés.
function limiter(max: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= max) await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}

async function addFiles(list: FileList | File[]) {
  const files = [...list].filter(isImageFile);
  const items = files.map((f) => reactive<Pending>({ key: ++seq, name: f.name }));
  pending.push(...items);
  const limit = limiter(3);
  const results = files.map((f, i) =>
    limit(() => ed.addFile(f)).catch((e) => {
      items[i].error = e instanceof Error ? e.message : 'Échec de l’envoi';
      return null;
    }),
  );
  // Ajout à la galerie dans l'ordre de sélection, au fur et à mesure.
  for (let i = 0; i < files.length; i++) {
    const ref_ = await results[i];
    if (!ref_) continue;
    ed.setGallery([...ed.gallery.value, ref_]);
    if (!ed.data.cover) ed.data.cover = ref_;
    pending.splice(pending.indexOf(items[i]), 1);
  }
}

function onDrop(e: DragEvent) {
  over.value = false;
  if (dragFrom.value !== null) return;
  if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
}
function onPick(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files) addFiles(input.files);
  input.value = '';
}

function move(from: number, to: number) {
  const list = [...ed.gallery.value];
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  ed.setGallery(list);
}
function dropOn(index: number) {
  if (dragFrom.value !== null && dragFrom.value !== index) move(dragFrom.value, index);
  dragFrom.value = null;
}
function removeAt(index: number) {
  const list = [...ed.gallery.value];
  const [item] = list.splice(index, 1);
  ed.setGallery(list);
  ed.dropRef(item);
  if (ed.data.cover === item) ed.data.cover = list[0];
}
</script>

<template>
  <div class="a-field">
    <span class="a-label">Photos du projet</span>
    <span class="hint">Glissez-déposez pour changer l’ordre. L’étoile choisit l’image de couverture (page d’accueil).</span>
    <div
      class="drop"
      :class="{ over }"
      @dragover.prevent="over = dragFrom === null"
      @dragleave="over = false"
      @drop.prevent="onDrop"
    >
      <ul class="grid">
        <li
          v-for="(item, i) in ed.gallery.value"
          :key="item"
          draggable="true"
          :class="{ dragging: dragFrom === i }"
          @dragstart="dragFrom = i"
          @dragend="dragFrom = null"
          @dragover.prevent
          @drop.prevent.stop="dropOn(i)"
        >
          <img v-if="ed.urlOf(item)" :src="ed.urlOf(item)" alt="" loading="lazy" />
          <span v-else class="missing">Image en attente</span>
          <div class="tools">
            <button type="button" :class="['star', { on: ed.data.cover === item }]" :title="ed.data.cover === item ? 'Image de couverture' : 'Choisir comme couverture'" @click="ed.data.cover = item">★</button>
            <span class="order">{{ i + 1 }}</span>
            <button type="button" class="del" title="Supprimer cette photo" @click="removeAt(i)">✕</button>
          </div>
        </li>
        <li v-for="p in pending" :key="'p' + p.key" class="pending" :class="{ failed: p.error }">
          <span>{{ p.error ? `${p.name} : ${p.error}` : 'Compression et envoi…' }}</span>
          <button v-if="p.error" type="button" class="a-btn small" @click="pending.splice(pending.indexOf(p), 1)">Fermer</button>
        </li>
        <li class="add">
          <label>
            <span>+ Ajouter des photos</span>
            <small>ou déposez-les ici (JPEG, PNG, HEIC)</small>
            <input type="file" accept="image/*,.heic,.heif" multiple hidden @change="onPick" />
          </label>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.drop { border: 1.5px dashed transparent; border-radius: 12px; padding: 4px; transition: border-color 0.15s, background 0.15s; }
.drop.over { border-color: var(--a-taupe); background: #f0ece6; }
.grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.grid li { position: relative; aspect-ratio: 4 / 3; border-radius: var(--a-radius); overflow: hidden; background: #eeebe7; cursor: grab; }
.grid li.dragging { opacity: 0.4; }
.grid img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
.missing { display: grid; place-items: center; height: 100%; font-size: 12px; color: var(--a-muted); }
.tools { position: absolute; inset: auto 0 0 0; display: flex; align-items: center; justify-content: space-between; padding: 4px 6px; background: linear-gradient(transparent, rgb(0 0 0 / 55%)); }
.tools button { border: 0; background: rgb(255 255 255 / 85%); border-radius: 99px; width: 26px; height: 26px; cursor: pointer; font-size: 13px; line-height: 1; color: #333; }
.tools .star.on { background: #f5c542; color: #000; }
.tools .del:hover { background: #fbe4e2; color: var(--a-danger); }
.order { color: #fff; font-size: 12px; font-weight: 600; }
.pending { display: grid; place-items: center; text-align: center; padding: 10px; font-size: 12px; color: var(--a-muted); cursor: default; }
.pending.failed { background: #fbe4e2; color: var(--a-danger); }
.add { background: transparent !important; border: 1.5px dashed var(--a-border); cursor: pointer; }
.add label { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 4px; cursor: pointer; text-align: center; padding: 8px; }
.add span { font-weight: 600; font-size: 14px; }
.add small { color: var(--a-muted); font-size: 11.5px; }
</style>
