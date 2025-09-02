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
</script>

<template>
  <div>
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

    <div class="grid projects">
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
  </div>
</template>