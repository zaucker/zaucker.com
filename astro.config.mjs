import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://zaucker.com',
  output: 'static',
  trailingSlash: 'ignore',
  i18n: {
    locales: ['de', 'en'],
    defaultLocale: 'de',
    routing: { prefixDefaultLocale: false },
  },
  integrations: [svelte(), sitemap()],
  vite: { plugins: [tailwindcss()] },
});
