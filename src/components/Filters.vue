<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{ items: any[] }>()

const active = ref<string[]>([])
function toggle(val: string){
  const i = active.value.indexOf(val)
  if (i > -1) active.value.splice(i, 1)
  else active.value.push(val)
}
function clear(){ active.value = [] }

const allCats = computed(() =>
  Array.from(new Set(props.items.flatMap(p => p?.data?.categories || [])))
)

const filtered = computed(() => {
  if (active.value.length === 0) return props.items
  return props.items.filter(p =>
    (p?.data?.categories || []).some((c:string) => active.value.includes(c))
  )
})

// util: retourne une src quelle que soit la forme (image() ou string)
function imgSrc(cover:any){
  if (!cover) return ''
  // image() -> objet avec .src ; string -> url directe
  return typeof cover === 'string' ? cover : cover.src
}

const mode = ref<'grid' | 'list'>('grid')

const iconGrid = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2zm0 9a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-3zm9-9a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V2zm0 9a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3z"/></svg>`;
const iconList = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M2 12.5a.5.5 0 0 1 .5-.5H14a.5.5 0 0 1 0 1H2.5a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5H14a.5.5 0 0 1 0 1H2.5a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5H14a.5.5 0 0 1 0 1H2.5a.5.5 0 0 1-.5-.5z"/></svg>`;
</script>

<template>
  <div>
    <div class="filters-bar">
      <div class="filters">
        <button class="chip" :class="{active: active.length===0}" @click="clear">Tous</button>
        <button
          v-for="c in allCats"
          :key="c"
          class="chip"
          :class="{active: active.includes(c)}"
          @click="toggle(c)"
        >
          {{ c }}
        </button>
      </div>
      <div class="view-toggle" role="tablist" aria-label="Affichage">
        <button class="chip" :class="{active: mode==='grid'}" @click="mode='grid'" aria-pressed="mode==='grid'" v-html="iconGrid"></button>
        <button class="chip" :class="{active: mode==='list'}" @click="mode='list'" aria-pressed="mode==='list'" v-html="iconList"></button>
      </div>
    </div>

    <div v-if="mode==='grid'" class="grid projects">
      <a
        v-for="p in filtered"
        :key="p.id || p.slug"
        class="card"
        :href="`/projets/${p.slug}`"
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
            {{ (p.data.city ? p.data.city + ' — ' : '') + (p.data.year ?? '') }}
          </div>
          <div class="l3">
            {{ (p.data.categories || []).join(', ') }}
          </div>
        </div>
      </a>
    </div>

    <ul v-else class="projects-list" aria-label="Liste des projets">
      <li v-for="p in filtered" :key="p.id || p.slug">
        <a :href="`/projets/${p.slug}`" class="row" :aria-label="p.data.title">
          <img v-if="imgSrc(p?.data?.cover)" :src="imgSrc(p.data.cover)" :alt="p.data.title" class="thumb" loading="lazy" />
          <div class="meta">
            <div class="l1">{{ p.data.title }}</div>
            <div class="l2">{{ (p.data.city ? p.data.city + ' — ' : '') + (p.data.year ?? '') }}</div>
            <div class="l3">{{ (p.data.categories || []).join(', ') }}</div>
          </div>
        </a>
      </li>
    </ul>
  </div>
</template>

