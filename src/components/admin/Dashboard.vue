<script setup lang="ts">
import PublishStatus from './PublishStatus.vue';
defineProps<{ name: string }>();
const cards = [
  { href: '/admin/projets', title: 'Projets', text: 'Ajouter un projet, modifier les textes, les informations et les photos.' },
  { href: '/admin/actus', title: 'Actualités', text: 'Annoncer un démarrage de chantier, une livraison, un prix.' },
  { href: '/admin/agence', title: 'Page Agence', text: 'Présentation, photo, associés et CV.' },
];
</script>

<template>
  <h1>Bonjour {{ name.split(' ')[0] }}</h1>
  <PublishStatus />
  <div class="cards">
    <a v-for="c in cards" :key="c.href" :href="c.href" class="a-card card">
      <h2>{{ c.title }}</h2>
      <p>{{ c.text }}</p>
    </a>
  </div>
  <p class="help">
    Chaque modification publiée met le site à jour en une à deux minutes. Un brouillon est enregistré mais reste invisible sur le site jusqu’à sa publication.
  </p>
</template>

<style scoped>
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin: 24px 0; }
.card { padding: 20px 22px; text-decoration: none; transition: transform 0.12s, box-shadow 0.12s; }
.card:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgb(0 0 0 / 8%); }
.card h2 { margin: 0 0 6px; }
.card p { margin: 0; color: var(--a-muted); }
.help { color: var(--a-muted); font-size: 14px; max-width: 70ch; }
.a-notice { margin: 12px 0 0; }
</style>
