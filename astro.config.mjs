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
    '/de/': '/',
    '/en/4-zi-dg': '/en/penthouse',
    '/en/3-zi-ug': '/en/garden',
    '/en/3-zi-eg': '/en/ground-floor',
    '/en/fotos': '/en/photos',
  },
  integrations: [
    svelte(),
    // Bare sitemap: per-page <head> hreflang (Head.astro) already provides
    // complete, correct alternates for our localized slugs. The sitemap i18n
    // option only auto-pairs identical paths, so it would emit partial,
    // inconsistent alternates here.
    sitemap(),
  ],
  vite: { plugins: [tailwindcss()] },
});
