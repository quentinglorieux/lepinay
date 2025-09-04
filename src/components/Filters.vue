<script setup lang="ts">
import { ref, computed } from "vue";

const props = defineProps<{ items: any[] }>();

const active = ref<string[]>([]);
function toggle(val: string) {
  const i = active.value.indexOf(val);
  if (i > -1) active.value.splice(i, 1);
  else active.value.push(val);
}
function clear() {
  active.value = [];
}

const allCats = computed(() =>
  Array.from(new Set(props.items.flatMap((p) => p?.data?.categories || [])))
);

const filtered = computed(() => {
  if (active.value.length === 0) return props.items;
  return props.items.filter((p) =>
    (p?.data?.categories || []).some((c: string) => active.value.includes(c))
  );
});

// util: retourne une src quelle que soit la forme (image() ou string)
function imgSrc(cover: any) {
  if (!cover) return "";
  // image() -> objet avec .src ; string -> url directe
  return typeof cover === "string" ? cover : cover.src;
}

const mode = ref<"grid" | "list">("grid");

const iconGrid = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="7" height="7"/>
  <rect x="14" y="3" width="7" height="7"/>
  <rect x="14" y="14" width="7" height="7"/>
  <rect x="3" y="14" width="7" height="7"/>
</svg>`;

const iconList = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="4" y1="6" x2="20" y2="6"/>
  <line x1="4" y1="12" x2="20" y2="12"/>
  <line x1="4" y1="18" x2="20" y2="18"/>
</svg>`;
</script>

<template>
  <div>
    <div class="filters-bar">
      <div class="filters">
        <button
          class="chip"
          :class="{ active: active.length === 0 }"
          @click="clear"
        >
          Tous
        </button>
        <button
          v-for="c in allCats"
          :key="c"
          class="chip"
          :class="{ active: active.includes(c) }"
          @click="toggle(c)"
        >
          {{ c }}
        </button>
      </div>
      <div class="view-toggle" role="tablist" aria-label="Affichage">
        <button
          class="chip"
          :class="{ active: mode === 'grid' }"
          @click="mode = 'grid'"
          aria-pressed="mode==='grid'"
          v-html="iconGrid"
        ></button>
        <button
          class="chip"
          :class="{ active: mode === 'list' }"
          @click="mode = 'list'"
          aria-pressed="mode==='list'"
          v-html="iconList"
        ></button>
      </div>
    </div>

    <div v-if="mode === 'grid'" class="grid projects">
      <a
        v-for="p in filtered"
        :key="p.id || p.slug"
        class="card"
        :href="`/projets/${p.id}`"
        :aria-label="p.data.title"
      >
        <img
          v-if="imgSrc(p?.data?.cover)"
          :src="imgSrc(p.data.cover)"
          :alt="p.data.title"
          loading="lazy"
        />
        <div class="overlay"></div>
        <div class="meta">
          <div class="l1">{{ p.data.title }}</div>
          <div class="l2">
            {{ (p.data.city ? p.data.city + " — " : "") + (p.data.year ?? "") }}
          </div>
          <div class="l3">
            {{ (p.data.categories || []).join(", ") }}
          </div>
        </div>
      </a>
    </div>

    <ul v-else class="projects-list" aria-label="Liste des projets">
      <li v-for="p in filtered" :key="p.id || p.slug">
        <a :href="`/projets/${p.id}`" class="row" :aria-label="p.data.title">
          <img
            v-if="imgSrc(p?.data?.cover)"
            :src="imgSrc(p.data.cover)"
            :alt="p.data.title"
            class="thumb"
            loading="lazy"
          />
          <div class="meta">
            <div class="l1">{{ p.data.title }}</div>
            <div class="l2">
              {{
                (p.data.city ? p.data.city + " — " : "") + (p.data.year ?? "")
              }}
            </div>
            <div class="l3">{{ (p.data.categories || []).join(", ") }}</div>
          </div>
        </a>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* LIST MODE: base layout */
.projects-list {
  list-style: none;
  padding: 0px;
  margin: 0;
  display: grid;
  gap: 10px;
}
.projects-list .row {
  display: flex;
  gap: 14px;
  align-items: stretch;
  text-decoration: none;
  color: inherit;
  border: 0px solid var(--accent);
  background: var(--bg2);
  padding: 10px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.projects-list .row:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  background: var(--filter-hover);
}

:root[data-theme="dark"] .projects-list .row:hover {
  background: var(--overlay);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}
.projects-list .thumb {
  width: 30%;
  max-width: 300px;
  object-fit: cover;
  aspect-ratio: 1 / 1;
  filter: grayscale(100%);
  display: block;
}
.projects-list .meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.projects-list .l1 {
  font-weight: 600;
  margin-bottom: 6px;
}
.projects-list .l2,
.projects-list .l3 {
  color: var(--muted);
}

/* Large screens: 2 columns + alternating image position */
@media (min-width: 1024px) {
  .projects-list {
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  /* .projects-list > li:nth-child(even) .row {
    flex-direction: row-reverse;
  }
  .projects-list > li:nth-child(even) .meta {
    text-align: right;
    align-items: flex-end;
  } */
}

/* Small screens: single column, image on top */
@media (max-width: 180px) {
  .projects-list .row {
    flex-direction: column;
  }
  .projects-list .thumb {
    width: 100%;
    max-width: none;
    height: 200px;
  }
}
</style>
