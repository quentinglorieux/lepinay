// @ts-check
import { defineConfig } from 'astro/config';

import vue from '@astrojs/vue';
import netlify from '@astrojs/netlify';

// https://astro.build/config
// Les pages publiques restent pré-rendues (statiques). Seules les routes de
// l'admin (export const prerender = false) tournent en fonctions Netlify.
export default defineConfig({
  site: 'https://pierre-lepinay-architecture.com',
  output: 'static',
  adapter: netlify(),
  integrations: [vue()]
});
