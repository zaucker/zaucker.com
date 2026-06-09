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
  redirects: {
    '/4-zi-dg': '/dachgeschoss',
    '/3-zi-ug': '/gartenwohnung',
    '/3-zi-eg': '/erdgeschoss',
    '/de': '/',
    '/de/': '/',
    '/en/4-zi-dg': '/en/penthouse',
    '/en/3-zi-ug': '/en/garden',
    '/en/3-zi-eg': '/en/ground-floor',
    '/en/fotos': '/en/photos',
  },
  integrations: [
    svelte(),
    sitemap({
      i18n: {
        defaultLocale: 'de',
        locales: { de: 'de-DE', en: 'en-US' },
      },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
