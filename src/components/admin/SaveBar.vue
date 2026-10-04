<script setup lang="ts">
import type { Editor } from './useEditor';

const props = defineProps<{ editor: Editor; title: string; back?: string; publicUrl?: string }>();
const ed = props.editor;
</script>

<template>
  <div class="bar">
    <div class="left">
      <a v-if="back" :href="back" class="a-btn ghost small">← Retour</a>
      <strong class="title">{{ title }}</strong>
      <span v-if="ed.data.draft && !ed.isNew.value" class="a-badge">Brouillon</span>
      <span v-if="ed.dirty.value" class="hint">Modifications non enregistrées</span>
      <span v-if="ed.uploading.value" class="hint">Envoi d’images…</span>
    </div>
    <div class="right">
      <a v-if="publicUrl && !ed.isNew.value && !ed.data.draft" :href="publicUrl" target="_blank" rel="noopener" class="a-btn ghost small">Voir sur le site</a>
      <button v-if="ed.kind !== 'agence' && !ed.isNew.value" type="button" class="a-btn small danger ghost" :disabled="!!ed.saving.value" @click="ed.remove()">
        {{ ed.saving.value === 'delete' ? 'Suppression…' : 'Supprimer' }}
      </button>
      <button v-if="ed.kind !== 'agence'" type="button" class="a-btn" :disabled="!!ed.saving.value" @click="ed.save('draft')">
        {{ ed.saving.value === 'draft' ? 'Enregistrement…' : 'Enregistrer le brouillon' }}
      </button>
      <button type="button" class="a-btn primary" :disabled="!!ed.saving.value" @click="ed.save('publish')">
        {{ ed.saving.value === 'publish' ? 'Publication…' : 'Publier' }}
      </button>
    </div>
  </div>
  <p v-if="ed.message.value" :class="['a-notice', ed.message.value.type, 'msg']" role="status">{{ ed.message.value.text }}</p>
</template>

<style scoped>
.bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; background: var(--a-panel); border-bottom: 1px solid var(--a-border); flex-wrap: wrap; }
.left, .right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.title { font-weight: 600; max-width: 40ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hint { color: var(--a-muted); font-size: 13px; }
.msg { margin: 0; border-radius: 0; }
</style>
