<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ next: string }>();
const email = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

async function submit() {
  error.value = '';
  busy.value = true;
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      error.value = body.error ?? 'Connexion impossible';
      return;
    }
    location.href = props.next;
  } catch {
    error.value = 'Connexion impossible. Vérifiez votre réseau.';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form class="login a-card" @submit.prevent="submit">
    <img src="/logo-light.png" alt="Lépinay Champlois Architecture" width="240" height="94" />
    <h1>Administration</h1>
    <div class="a-field">
      <label for="email">Email</label>
      <input id="email" v-model="email" class="a-input" type="email" autocomplete="username" required autofocus />
    </div>
    <div class="a-field">
      <label for="password">Mot de passe</label>
      <input id="password" v-model="password" class="a-input" type="password" autocomplete="current-password" required />
    </div>
    <p v-if="error" class="a-notice err" role="alert">{{ error }}</p>
    <button class="a-btn primary" type="submit" :disabled="busy">{{ busy ? 'Connexion…' : 'Se connecter' }}</button>
  </form>
</template>

<style scoped>
.login { width: min(380px, 100%); margin: 10vh auto 0; padding: 32px 28px; display: flex; flex-direction: column; }
.login img { width: 200px; height: auto; margin: 0 auto 18px; }
.login h1 { text-align: center; font-size: 1.5rem; margin-bottom: 20px; }
.login .a-btn { margin-top: 6px; padding: 10px; }
.login .a-notice { margin: 0 0 12px; }
</style>
