<script setup lang="ts">
import { computed } from 'vue';
import { useEditor } from './useEditor';
import EditorShell from './EditorShell.vue';
import TextField from './TextField.vue';
import MarkdownField from './MarkdownField.vue';
import ImageField from './ImageField.vue';
import FileField from './FileField.vue';

const ed = useEditor('agence', '');
const d = ed.data;
const err = computed(() => ed.errors.value);
const people = computed<any[]>(() => (d.associates ??= []));

function add() {
  people.value.push({ name: '', role: '', links: {} });
}
function move(i: number, delta: number) {
  const list = people.value;
  const [p] = list.splice(i, 1);
  list.splice(i + delta, 0, p);
}
function removeAt(i: number) {
  const p = people.value[i];
  if (!confirm(`Retirer ${p.name || 'cette personne'} de la page ?`)) return;
  ed.dropRef(p.photo);
  ed.dropRef(p.cv);
  people.value.splice(i, 1);
}
const linkedin = (p: any) =>
  computed({ get: () => p.links?.linkedin ?? '', set: (v: string) => (p.links = { ...(p.links ?? {}), linkedin: v }) });
</script>

<template>
  <EditorShell :editor="ed" title="Page Agence" public-url="/agence">
    <TextField id="title" v-model="d.title" label="Titre de la page (onglet du navigateur)" required :error="err.title" />
    <ImageField v-model="d.cover" :editor="ed" label="Photo principale" />
    <MarkdownField v-model="ed.body.value" label="Texte de présentation" :rows="20" />

    <h2>Associés</h2>
    <div v-for="(p, i) in people" :key="i" class="person a-card">
      <div class="head">
        <strong>{{ p.name || 'Nouvelle personne' }}</strong>
        <div class="tools">
          <button type="button" class="a-btn small ghost" :disabled="i === 0" title="Monter" @click="move(i, -1)">↑</button>
          <button type="button" class="a-btn small ghost" :disabled="i === people.length - 1" title="Descendre" @click="move(i, 1)">↓</button>
          <button type="button" class="a-btn small ghost danger" @click="removeAt(i)">Retirer</button>
        </div>
      </div>
      <div class="a-grid2">
        <TextField :id="`name${i}`" v-model="p.name" label="Nom" required :error="err[`associates.${i}.name`]" />
        <TextField :id="`role${i}`" v-model="p.role" label="Rôle" />
        <TextField :id="`email${i}`" v-model="p.email" label="Email" type="email" :error="err[`associates.${i}.email`]" />
        <TextField :id="`li${i}`" v-model="linkedin(p).value" label="LinkedIn" placeholder="https://www.linkedin.com/in/…" :error="err[`associates.${i}.links.linkedin`]" />
      </div>
      <TextField :id="`bio${i}`" v-model="p.bio" label="Bio courte" multiline />
      <ImageField v-model="p.photo" :editor="ed" label="Photo" />
      <FileField v-model="p.cv" :editor="ed" label="CV (PDF)" />
    </div>
    <button type="button" class="a-btn" @click="add">+ Ajouter une personne</button>
  </EditorShell>
</template>

<style scoped>
.person { padding: 14px 16px 4px; margin-bottom: 14px; }
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.tools { display: flex; gap: 4px; }
</style>
