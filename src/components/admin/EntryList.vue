<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api, fileUrl, formatDate, type ListItem } from '../../lib/admin/client';
import PublishStatus from './PublishStatus.vue';

const props = defineProps<{ kind: 'project' | 'post' }>();
const items = ref<ListItem[]>([]);
const loading = ref(true);
const error = ref('');
const q = ref('');
const base = props.kind === 'project' ? '/admin/projets' : '/admin/actus';
const title = props.kind === 'project' ? 'Projets' : 'Actualités';

onMounted(async () => {
  try {
    items.value = await api.list(props.kind);
  } catch {
    error.value = 'Chargement impossible. Rechargez la page.';
  } finally {
    loading.value = false;
  }
});

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const shown = computed(() => {
  const key = (i: ListItem) => (props.kind === 'project' ? String(i.year ?? '') : (i.date ?? ''));
  return items.value
    .filter((i) => !q.value || norm(`${i.title} ${i.city ?? ''} ${i.year ?? ''}`).includes(norm(q.value)))
    .sort((a, b) => key(b).localeCompare(key(a)) || a.title.localeCompare(b.title));
});
</script>

<template>
  <div class="head">
    <h1>{{ title }}</h1>
    <a :href="`${base}/nouveau`" class="a-btn primary">{{ kind === 'project' ? '+ Nouveau projet' : '+ Nouvelle actualité' }}</a>
  </div>
  <PublishStatus />
  <input v-model="q" class="a-input search" type="search" placeholder="Rechercher…" aria-label="Rechercher" />
  <p v-if="loading">Chargement…</p>
  <p v-else-if="error" class="a-notice err">{{ error }}</p>
  <p v-else-if="!shown.length">Aucun résultat.</p>
  <ul v-else class="list">
    <li v-for="i in shown" :key="i.slug">
      <a :href="`${base}/${encodeURIComponent(i.slug)}`" class="a-card row">
        <span class="thumb"><img v-if="i.cover" :src="fileUrl(i.cover)" alt="" loading="lazy" /></span>
        <span class="meta">
          <strong>{{ i.title }}</strong>
          <span class="sub">{{ kind === 'project' ? [i.city, i.year].filter(Boolean).join(' · ') : formatDate(i.date) }}</span>
        </span>
        <span v-if="i.draft" class="a-badge">Brouillon</span>
      </a>
    </li>
  </ul>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.search { margin: 16px 0; max-width: 360px; }
.list { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
.row { display: flex; align-items: center; gap: 14px; padding: 8px 14px 8px 8px; text-decoration: none; }
.row:hover { border-color: #c9c3bc; }
.thumb { width: 84px; height: 60px; border-radius: 6px; overflow: hidden; background: #eeebe7; flex-shrink: 0; }
.thumb img { width: 100%; height: 100%; object-fit: cover; display: block; filter: grayscale(100%); }
.meta { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.meta strong { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sub { color: var(--a-muted); font-size: 13px; }
.a-notice { margin-top: 12px; }
</style>
