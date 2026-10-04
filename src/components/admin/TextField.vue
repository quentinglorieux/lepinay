<script setup lang="ts">
const model = defineModel<string | number | null | undefined>();
defineProps<{ label: string; hint?: string; error?: string; type?: string; placeholder?: string; required?: boolean; multiline?: boolean; id?: string }>();
</script>

<template>
  <div class="a-field">
    <label :for="id">{{ label }}<span v-if="required" aria-hidden="true"> *</span></label>
    <textarea v-if="multiline" :id="id" v-model="model" class="a-textarea" :class="{ invalid: error }" rows="3" :placeholder="placeholder"></textarea>
    <input v-else :id="id" v-model="model" class="a-input" :class="{ invalid: error }" :type="type ?? 'text'" :placeholder="placeholder" :required="required" />
    <span v-if="error" class="error">{{ error }}</span>
    <span v-else-if="hint" class="hint">{{ hint }}</span>
  </div>
</template>
