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
    '/4-zi-dg': '/dachwohnung',
    '/3-zi-ug': '/gartenwohnung',
    '/3-zi-eg': '/erdgeschoss',
    '/de/': '/',
    '/en/4-zi-dg': '/en/penthouse',
    '/en/3-zi-ug': '/en/garden',
    '/en/3-zi-eg': '/en/ground-floor',
    // Photos page removed (redundant with per-apartment galleries) → send old
    // photo URLs to the respective home page.
    '/fotos': '/',
    '/en/fotos': '/en/',
  },
  integrations: [
    svelte(),
    // Per-page <head> hreflang (Head.astro) already provides complete, correct
    // alternates for our localized slugs; the sitemap i18n option only auto-pairs
    // identical paths, so it is intentionally left off. Hidden / "not available"
    // apartments (erdgeschoss / ground-floor) are reachable by URL but excluded
    // from the sitemap so search engines don't surface unavailable listings.
    sitemap({
      filter: (page) =>
        !page.includes('/erdgeschoss') && !page.includes('/ground-floor'),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
