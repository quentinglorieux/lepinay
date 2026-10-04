<script setup lang="ts">
// Bandeau d'état de la publication du site (Netlify).
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { api, formatDate } from '../../lib/admin/client';

const state = ref<'ready' | 'building' | 'error' | 'unknown' | 'loading'>('loading');
const updatedAt = ref<string>();
let timer: ReturnType<typeof setTimeout> | undefined;

async function poll() {
  try {
    const s = await api.status();
    state.value = s.state;
    updatedAt.value = s.updatedAt;
  } catch {
    state.value = 'unknown';
  }
  if (state.value === 'building') timer = setTimeout(poll, 10_000);
}
onMounted(poll);
onBeforeUnmount(() => clearTimeout(timer));
const time = (iso?: string) => (iso ? `${formatDate(iso)} à ${new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '');
</script>

<template>
  <p v-if="state === 'ready'" class="a-notice ok">Site à jour<span v-if="updatedAt"> (dernière publication le {{ time(updatedAt) }})</span>.</p>
  <p v-else-if="state === 'building'" class="a-notice warn">Publication en cours… Le site sera à jour dans une à deux minutes.</p>
  <p v-else-if="state === 'error'" class="a-notice err">La dernière publication a échoué. Prévenez Quentin.</p>
</template>
