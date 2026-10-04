<script setup lang="ts">
// Liste de valeurs saisie séparée par des virgules (ou une par ligne).
import { computed } from 'vue';

const model = defineModel<string[] | string | null | undefined>();
const props = defineProps<{ label: string; hint?: string; multiline?: boolean; id?: string }>();
const sep = computed(() => (props.multiline ? '\n' : ', '));
const text = computed({
  get: () => (Array.isArray(model.value) ? model.value.join(sep.value) : (model.value ?? '')),
  set: (v: string) => {
    model.value = v
      .split(props.multiline ? /\n/ : /,/)
      .map((s) => s.trim())
      .filter(Boolean);
  },
});
</script>

<template>
  <div class="a-field">
    <label :for="id">{{ label }}</label>
    <textarea v-if="multiline" :id="id" v-model.lazy="text" class="a-textarea" rows="3"></textarea>
    <input v-else :id="id" v-model.lazy="text" class="a-input" type="text" />
    <span v-if="hint" class="hint">{{ hint }}</span>
  </div>
</template>
