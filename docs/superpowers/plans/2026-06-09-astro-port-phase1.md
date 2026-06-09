# Astro/Svelte Port (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the live Hugo site zaucker.com with a faithful Astro + Svelte + Tailwind v4 static rebuild on a clean URL structure, keeping the existing traum-ferienwohnungen availability widget.

**Architecture:** Astro 6 static output. Page bodies live in Markdown content collections (per locale); apartment specs/pricing/features stay in YAML read only through a `src/lib/apartments.ts` seam (so a future admin GUI + DB can swap the source). UI strings come from the existing `i18n/*.yaml` via a `t(locale, key)` helper. German renders at the root, English under `/en/`, with localized flat slugs and redirects from the old URLs. Photo galleries use a small Svelte lightbox island; everything else is static HTML. Build → `dist/` → rsync, exactly like today.

**Tech Stack:** Astro 6.4, @astrojs/svelte 8 (Svelte 5.56), @astrojs/sitemap 3, Tailwind CSS v4.3 (`@tailwindcss/vite`), sharp (astro:assets), js-yaml, vitest, Node 24.

Spec: `docs/superpowers/specs/2026-06-09-astro-port-phase1-design.md`

---

## File structure

```
astro.config.mjs                 # integrations, i18n, redirects, site
tsconfig.json                    # strict + path alias @/*
vitest.config.ts                 # node-env unit tests for lib/*
package.json                     # new deps + scripts
deploy.sh                        # rsync dist/ (was public/)
public/robots.txt                # static
src/
  styles/global.css              # tailwind v4 @theme tokens + custom CSS
  i18n/de.yaml, en.yaml          # moved verbatim from /i18n
  data/apartments/*.yaml         # moved from /data, + slug/nav_label/order
  lib/
    types.ts                     # Apartment + related interfaces
    i18n.ts                      # Locale, t(locale,key)
    apartments.ts                # getApartments / getVisibleApartments / getApartment / getApartmentBySlug
    routes.ts                    # pagePath / apartmentPath / nav / alternate-locale
    images.ts                    # apartment image glob -> ImageMetadata[]
  content.config.ts              # 'pages' collection (glob src/content)
  content/
    de/{home,verfuegbarkeit,fotos,kontakt,infos,impressum,datenschutz}.md
    de/apartments/{dachgeschoss,gartenwohnung,erdgeschoss}.md
    en/{home,availability,photos,contact,infos}.md
    en/apartments/{penthouse,garden,ground-floor}.md
  assets/apartments/{4_zi_dg,3_zi_ug}/*.jpg   # images, once per apartment
  components/
    Head.astro Header.astro Footer.astro
    ApartmentCard.astro ApartmentFeatures.astro PricingTable.astro
    GalleryGrid.astro AvailabilityWidget.astro
    Lightbox.svelte
  layouts/Layout.astro
  pages/
    index.astro verfuegbarkeit.astro fotos.astro kontakt.astro
    infos.astro impressum.astro datenschutz.astro [slug].astro 404.astro
    en/index.astro en/availability.astro en/photos.astro
    en/contact.astro en/infos.astro en/[slug].astro
```

**Data shapes (used consistently across all tasks):**

```ts
// src/lib/types.ts
export type Locale = 'de' | 'en';

export interface Apartment {
  id: string;                 // e.g. "4_zi_dg"
  traumfw_id: string;
  hidden: boolean;
  name_key: string;           // i18n key, e.g. "apt_4zidg_name"
  order: number;              // sort order on listings
  slug: Record<Locale, string>;       // { de: "dachgeschoss", en: "penthouse" }
  nav_label: Record<Locale, string>;  // { de: "4 Zi DG", en: "3 bedroom" }
  specs: { rooms: number; bedrooms: number; max_guests: number; area_m2?: number };
  features: Record<string, { key: string }[]>;  // kitchen/bathroom/living/family/service
  pricing: {
    currency: string; extra_guest_per_day: number; linen_per_bed: number;
    cleaning_fee: number; deposit: number;
    seasons: { name_key: string; rate_per_day: number }[];
  };
  minimum_stay: { season_key: string; nights: number }[];
  city_tax: { apr_oct_per_person_per_day: number; nov_mar_per_person_per_day: number };
}
```

---

## Task 1: Scaffold Astro project alongside the Hugo files

**Files:**
- Create: `package.json` (replace), `astro.config.mjs`, `tsconfig.json`, `.gitignore` (modify), `src/pages/index.astro` (temporary smoke page)
- Keep (untouched for now): `content/`, `data/`, `i18n/`, `layouts/`, `hugo.toml`, `static/`, `public/`

- [ ] **Step 1: Replace `package.json`**

```json
{
  "name": "zaucker.com",
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "astro": "^6.4.5",
    "@astrojs/svelte": "^8.1.2",
    "@astrojs/sitemap": "^3.7.3",
    "svelte": "^5.56.3",
    "sharp": "^0.34.5",
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.0",
    "tailwindcss": "^4.3.0",
    "@types/js-yaml": "^4.0.9",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: completes; `node_modules/.bin/astro` exists.

- [ ] **Step 3: Create `astro.config.mjs`** (redirects/content added in later tasks; minimal but valid now)

```js
import { defineConfig } from 'astro';
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
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", "public", "layouts", "resources"],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

- [ ] **Step 5: Update `.gitignore`**

Replace contents with:

```
# build
dist/
.astro/
node_modules/

# legacy hugo (kept until Task 18 removes the files)
public/
resources/
.hugo_build.lock

# misc
*~
zaucker.tar.gz
```

- [ ] **Step 6: Temporary smoke page `src/pages/index.astro`**

```astro
---
---
<html lang="de"><body><h1>Astro up</h1></body></html>
```

- [ ] **Step 7: Verify dev server boots**

Run: `npm run build`
Expected: build succeeds, `dist/index.html` contains "Astro up".

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json .gitignore src/pages/index.astro
git commit -m "chore: scaffold Astro project (Svelte, sitemap, tailwind v4)"
```

---

## Task 2: Global styles & design tokens (Tailwind v4)

**Files:**
- Create: `src/styles/global.css`

- [ ] **Step 1: Create `src/styles/global.css`** — carries over the exact tokens from `static/css/main.css` plus the custom rules.

```css
@import 'tailwindcss';

@theme {
  --font-sans: 'Inter', system-ui, sans-serif;
  --color-lake: #2c7bb6;
  --color-lake-dark: #1a5276;
  --color-alpine: #27ae60;
}

/* Markdown prose (replaces Hugo `prose prose-stone`) */
.prose { color: var(--color-stone-700); line-height: 1.7; }
.prose h2 { font-size: 1.5rem; font-weight: 600; color: var(--color-stone-900); margin: 1.75rem 0 0.75rem; }
.prose h3 { font-size: 1.25rem; font-weight: 600; color: var(--color-stone-900); margin: 1.5rem 0 0.5rem; }
.prose p { margin: 0.75rem 0; }
.prose ul { list-style: disc; padding-left: 1.25rem; margin: 0.75rem 0; }
.prose li { margin: 0.25rem 0; }
.prose a { color: var(--color-lake); text-decoration: underline; }
.prose a:hover { color: var(--color-lake-dark); }
.prose strong { font-weight: 600; color: var(--color-stone-800); }

/* Gallery hover + widget min-height (from main.css) */
.gallery-grid a { display: block; overflow: hidden; }
.gallery-grid img { transition: transform 0.3s ease; }
.gallery-grid a:hover img { transform: scale(1.05); }
html { scroll-behavior: smooth; }
.tfw-widget { min-height: 300px; }
```

- [ ] **Step 2: Build to confirm Tailwind compiles**

Run: `npm run build`
Expected: success, no CSS errors.

- [ ] **Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "feat: global styles and Tailwind v4 design tokens"
```

---

## Task 3: Move i18n + apartment data into src, extend apartment YAML

**Files:**
- Create: `src/i18n/de.yaml`, `src/i18n/en.yaml` (copies of `/i18n/*.yaml`)
- Create: `src/data/apartments/4_zi_dg.yaml`, `3_zi_ug.yaml`, `3_zi_eg.yaml` (from `/data/apartments/*.yaml` + new fields)

- [ ] **Step 1: Copy i18n files**

Run:
```bash
mkdir -p src/i18n && cp i18n/de.yaml i18n/en.yaml src/i18n/
```
Expected: both files present under `src/i18n/`.

- [ ] **Step 2: Add three nav keys to BOTH `src/i18n/de.yaml` and `src/i18n/en.yaml`**

Append to `src/i18n/de.yaml`:
```yaml
nav_photos: "Fotos"
```
Append to `src/i18n/en.yaml`:
```yaml
nav_photos: "Photos"
```
(Used by the Photos nav entry; other labels already exist.)

- [ ] **Step 3: Create `src/data/apartments/4_zi_dg.yaml`** — existing content plus `slug`, `nav_label`, `order`, explicit `hidden: false`.

```yaml
id: "4_zi_dg"
traumfw_id: "67482"
hidden: false
order: 1
name_key: "apt_4zidg_name"
slug:
  de: "dachgeschoss"
  en: "penthouse"
nav_label:
  de: "4 Zi DG"
  en: "3 bedroom"

specs:
  rooms: 4
  bedrooms: 3
  max_guests: 5
  area_m2: 90

features:
  kitchen:
    - key: "stove"
    - key: "fridge"
    - key: "dishwasher"
    - key: "microwave"
    - key: "coffee_maker"
    - key: "toaster"
    - key: "kettle"
  bathroom:
    - key: "bathtub"
    - key: "shower"
    - key: "hairdryer"
  living:
    - key: "cable_tv"
    - key: "bluray"
    - key: "wifi"
    - key: "books_games"
    - key: "balcony_west"
  family:
    - key: "baby_equipment"
    - key: "childrens_toys"
  service:
    - key: "towels_included"
    - key: "linens_available"
    - key: "washing_machine"

pricing:
  currency: "EUR"
  extra_guest_per_day: 15
  linen_per_bed: 15
  cleaning_fee: 130
  deposit: 300
  seasons:
    - name_key: "season_high"
      rate_per_day: 150
    - name_key: "season_mid"
      rate_per_day: 120
    - name_key: "season_low"
      rate_per_day: 100

minimum_stay:
  - season_key: "season_high"
    nights: 7
  - season_key: "season_mid"
    nights: 5
  - season_key: "season_low"
    nights: 3

city_tax:
  apr_oct_per_person_per_day: 4.45
  nov_mar_per_person_per_day: 3.55
```

- [ ] **Step 4: Create `src/data/apartments/3_zi_ug.yaml`**

```yaml
id: "3_zi_ug"
traumfw_id: "73970"
hidden: false
order: 2
name_key: "apt_3ziug_name"
slug:
  de: "gartenwohnung"
  en: "garden"
nav_label:
  de: "3 Zi UG"
  en: "2 bedroom"

specs:
  rooms: 3
  bedrooms: 2
  max_guests: 4
  area_m2: 75

features:
  kitchen:
    - key: "stove"
    - key: "fridge"
    - key: "dishwasher"
    - key: "microwave"
    - key: "coffee_maker"
    - key: "toaster"
  bathroom:
    - key: "bathtub"
    - key: "shower"
    - key: "hairdryer"
  living:
    - key: "cable_tv"
    - key: "bluray"
    - key: "wifi"
    - key: "books_games"
    - key: "garden_terrace"
  family:
    - key: "baby_equipment"
    - key: "childrens_toys"
  service:
    - key: "towels_included"
    - key: "linens_available"
    - key: "washing_machine"

pricing:
  currency: "EUR"
  extra_guest_per_day: 15
  linen_per_bed: 15
  cleaning_fee: 100
  deposit: 300
  seasons:
    - name_key: "season_high"
      rate_per_day: 130
    - name_key: "season_mid"
      rate_per_day: 110
    - name_key: "season_low"
      rate_per_day: 80

minimum_stay:
  - season_key: "season_high"
    nights: 7
  - season_key: "season_mid"
    nights: 5
  - season_key: "season_low"
    nights: 3

city_tax:
  apr_oct_per_person_per_day: 4.45
  nov_mar_per_person_per_day: 3.55
```

- [ ] **Step 5: Create `src/data/apartments/3_zi_eg.yaml`** (hidden)

```yaml
id: "3_zi_eg"
traumfw_id: ""
hidden: true
order: 3
name_key: "apt_3zieg_name"
slug:
  de: "erdgeschoss"
  en: "ground-floor"
nav_label:
  de: "3 Zi EG"
  en: "3 room"

specs:
  rooms: 3
  bedrooms: 2
  max_guests: 6
  area_m2: 80

features:
  kitchen:
    - key: "stove"
    - key: "fridge"
    - key: "dishwasher"
    - key: "microwave"
    - key: "coffee_maker"
    - key: "toaster"
  bathroom:
    - key: "bathtub"
    - key: "shower"
    - key: "hairdryer"
  living:
    - key: "cable_tv"
    - key: "bluray"
    - key: "wifi"
    - key: "books_games"
  family:
    - key: "baby_equipment"
    - key: "childrens_toys"
  service:
    - key: "towels_included"
    - key: "linens_available"
    - key: "washing_machine"

pricing:
  currency: "EUR"
  extra_guest_per_day: 15
  linen_per_bed: 15
  cleaning_fee: 100
  deposit: 300
  seasons:
    - name_key: "season_high"
      rate_per_day: 130
    - name_key: "season_mid"
      rate_per_day: 110
    - name_key: "season_low"
      rate_per_day: 80

minimum_stay:
  - season_key: "season_high"
    nights: 7
  - season_key: "season_mid"
    nights: 5
  - season_key: "season_low"
    nights: 3

city_tax:
  apr_oct_per_person_per_day: 4.45
  nov_mar_per_person_per_day: 3.55
```

- [ ] **Step 6: Commit**

```bash
git add src/i18n src/data
git commit -m "chore: move i18n + apartment data into src, add slug/nav/order fields"
```

---

## Task 4: `src/lib/types.ts` + i18n module (TDD)

**Files:**
- Create: `src/lib/types.ts`, `src/lib/i18n.ts`, `vitest.config.ts`
- Test: `src/lib/i18n.test.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
```

- [ ] **Step 2: Create `src/lib/types.ts`** (the `Locale` + `Apartment` interfaces from the File Structure section above — copy them verbatim).

- [ ] **Step 3: Write failing test `src/lib/i18n.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { t } from './i18n';

describe('t', () => {
  it('returns the German string for a key', () => {
    expect(t('de', 'nav_details')).toBe('Details');
  });
  it('returns the English string for a key', () => {
    expect(t('en', 'nav_details')).toBe('Details');
  });
  it('returns a localized feature label', () => {
    expect(t('de', 'feat_wifi')).toBe('WLAN (kostenlos)');
    expect(t('en', 'feat_wifi')).toBe('Wi-Fi (free)');
  });
  it('falls back to the key when missing', () => {
    expect(t('de', 'does_not_exist')).toBe('does_not_exist');
  });
});
```

- [ ] **Step 4: Run test — verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./i18n`.

- [ ] **Step 5: Implement `src/lib/i18n.ts`**

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import type { Locale } from './types';

function load(locale: Locale): Record<string, string> {
  const path = fileURLToPath(new URL(`../i18n/${locale}.yaml`, import.meta.url));
  return yaml.load(readFileSync(path, 'utf8')) as Record<string, string>;
}

const STRINGS: Record<Locale, Record<string, string>> = {
  de: load('de'),
  en: load('en'),
};

/** Translate a key for a locale; returns the key itself if missing. */
export function t(locale: Locale, key: string): string {
  return STRINGS[locale]?.[key] ?? key;
}
```

- [ ] **Step 6: Run test — verify it passes**

Run: `npm test`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/i18n.ts src/lib/i18n.test.ts vitest.config.ts
git commit -m "feat: i18n helper over existing translation yaml (TDD)"
```

---

## Task 5: `src/lib/apartments.ts` data-access seam (TDD)

**Files:**
- Create: `src/lib/apartments.ts`
- Test: `src/lib/apartments.test.ts`

- [ ] **Step 1: Write failing test `src/lib/apartments.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  getApartments, getVisibleApartments, getApartment, getApartmentBySlug,
} from './apartments';

describe('apartments data access', () => {
  it('loads all three apartments sorted by order', () => {
    const all = getApartments();
    expect(all.map(a => a.id)).toEqual(['4_zi_dg', '3_zi_ug', '3_zi_eg']);
  });
  it('excludes hidden apartments from the visible list', () => {
    expect(getVisibleApartments().map(a => a.id)).toEqual(['4_zi_dg', '3_zi_ug']);
  });
  it('looks up by id', () => {
    expect(getApartment('4_zi_dg')?.slug.en).toBe('penthouse');
    expect(getApartment('nope')).toBeUndefined();
  });
  it('looks up by localized slug', () => {
    expect(getApartmentBySlug('de', 'gartenwohnung')?.id).toBe('3_zi_ug');
    expect(getApartmentBySlug('en', 'penthouse')?.id).toBe('4_zi_dg');
    expect(getApartmentBySlug('de', 'penthouse')).toBeUndefined();
  });
  it('parses pricing seasons', () => {
    const dg = getApartment('4_zi_dg')!;
    expect(dg.pricing.seasons[0]).toEqual({ name_key: 'season_high', rate_per_day: 150 });
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./apartments`.

- [ ] **Step 3: Implement `src/lib/apartments.ts`**

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import type { Apartment, Locale } from './types';

const dir = fileURLToPath(new URL('../data/apartments/', import.meta.url));

const APARTMENTS: Apartment[] = readdirSync(dir)
  .filter(f => f.endsWith('.yaml'))
  .map(f => yaml.load(readFileSync(dir + f, 'utf8')) as Apartment)
  .sort((a, b) => a.order - b.order);

export function getApartments(): Apartment[] {
  return APARTMENTS;
}
export function getVisibleApartments(): Apartment[] {
  return APARTMENTS.filter(a => !a.hidden);
}
export function getApartment(id: string): Apartment | undefined {
  return APARTMENTS.find(a => a.id === id);
}
export function getApartmentBySlug(locale: Locale, slug: string): Apartment | undefined {
  return APARTMENTS.find(a => a.slug[locale] === slug);
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/apartments.ts src/lib/apartments.test.ts
git commit -m "feat: apartment data-access seam over yaml (TDD)"
```

---

## Task 6: `src/lib/routes.ts` URL + nav helpers (TDD)

**Files:**
- Create: `src/lib/routes.ts`
- Test: `src/lib/routes.test.ts`

- [ ] **Step 1: Write failing test `src/lib/routes.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { pagePath, apartmentPath, getNav, alternatePageKey, PAGE_ROUTES } from './routes';
import { getApartment } from './apartments';

describe('routes', () => {
  it('resolves localized page paths', () => {
    expect(pagePath('de', 'home')).toBe('/');
    expect(pagePath('en', 'home')).toBe('/en/');
    expect(pagePath('de', 'availability')).toBe('/verfuegbarkeit');
    expect(pagePath('en', 'availability')).toBe('/en/availability');
  });
  it('resolves apartment paths by locale slug', () => {
    const dg = getApartment('4_zi_dg')!;
    expect(apartmentPath('de', dg)).toBe('/dachgeschoss');
    expect(apartmentPath('en', dg)).toBe('/en/penthouse');
  });
  it('builds an ordered nav including visible apartments', () => {
    const labels = getNav('de').map(i => i.label);
    expect(labels).toEqual(['4 Zi DG', '3 Zi UG', 'Fotos', 'Verfügbarkeit', 'Kontakt', 'Infos']);
    expect(getNav('de')[0].href).toBe('/dachgeschoss');
  });
  it('maps page keys for the language switch', () => {
    expect(alternatePageKey('availability')).toBe('availability');
    expect(PAGE_ROUTES.impressum.en).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./routes`.

- [ ] **Step 3: Implement `src/lib/routes.ts`**

```ts
import type { Apartment, Locale } from './types';
import { getVisibleApartments } from './apartments';
import { t } from './i18n';

export type PageKey =
  | 'home' | 'availability' | 'photos' | 'contact' | 'infos'
  | 'impressum' | 'datenschutz';

/** Localized path for each static page. `en: null` = German-only page. */
export const PAGE_ROUTES: Record<PageKey, { de: string; en: string | null }> = {
  home:        { de: '/',              en: '/en/' },
  availability:{ de: '/verfuegbarkeit',en: '/en/availability' },
  photos:      { de: '/fotos',         en: '/en/photos' },
  contact:     { de: '/kontakt',       en: '/en/contact' },
  infos:       { de: '/infos',         en: '/en/infos' },
  impressum:   { de: '/impressum',     en: null },
  datenschutz: { de: '/datenschutz',   en: null },
};

export function pagePath(locale: Locale, key: PageKey): string {
  const p = PAGE_ROUTES[key][locale];
  if (p === null) return PAGE_ROUTES[key].de; // legal pages: always the German URL
  return p;
}

export function apartmentPath(locale: Locale, apt: Apartment): string {
  return locale === 'en' ? `/en/${apt.slug.en}` : `/${apt.slug.de}`;
}

export interface NavItem { label: string; href: string }

/** Header nav: visible apartments first, then Photos, Availability, Contact, Infos. */
export function getNav(locale: Locale): NavItem[] {
  const apts = getVisibleApartments().map(a => ({
    label: a.nav_label[locale],
    href: apartmentPath(locale, a),
  }));
  return [
    ...apts,
    { label: t(locale, 'nav_photos'),            href: pagePath(locale, 'photos') },
    { label: t(locale, 'section_availability'),  href: pagePath(locale, 'availability') },
    { label: t(locale, 'nav_contact_us'),        href: pagePath(locale, 'contact') },
    { label: locale === 'de' ? 'Infos' : 'Infos',href: pagePath(locale, 'infos') },
  ];
}

/** Page keys share an identity across locales (used by the language switcher). */
export function alternatePageKey(key: PageKey): PageKey {
  return key;
}
```

> Note: `section_availability` ("Verfügbarkeit"/"Availability") and `nav_contact_us` ("Kontakt aufnehmen"/"Contact us") exist in the i18n files. The test asserts the German nav reads `Verfügbarkeit` and `Kontakt`; adjust the German values of `nav_contact_us` only if the test demands exact "Kontakt". **Implementer check:** the test expects `Kontakt`, but `nav_contact_us` is "Kontakt aufnehmen". Use a dedicated short label instead — see Step 4.

- [ ] **Step 4: Add short nav labels to i18n and use them**

Append to `src/i18n/de.yaml`:
```yaml
nav_contact_short: "Kontakt"
nav_availability_short: "Verfügbarkeit"
nav_infos: "Infos"
```
Append to `src/i18n/en.yaml`:
```yaml
nav_contact_short: "Contact"
nav_availability_short: "Availability"
nav_infos: "Infos"
```
Then change the three non-apartment entries in `getNav` to:
```ts
    { label: t(locale, 'nav_photos'),            href: pagePath(locale, 'photos') },
    { label: t(locale, 'nav_availability_short'),href: pagePath(locale, 'availability') },
    { label: t(locale, 'nav_contact_short'),     href: pagePath(locale, 'contact') },
    { label: t(locale, 'nav_infos'),             href: pagePath(locale, 'infos') },
```

- [ ] **Step 5: Run test — verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/routes.ts src/lib/routes.test.ts src/i18n
git commit -m "feat: route + nav helpers with localized slugs (TDD)"
```

---

## Task 7: Migrate apartment images into `src/assets` + image helper

**Files:**
- Create: `src/assets/apartments/4_zi_dg/*.jpg`, `src/assets/apartments/3_zi_ug/*.jpg`
- Create: `src/lib/images.ts`

- [ ] **Step 1: Copy images (once per apartment, language-independent)**

Run:
```bash
mkdir -p src/assets/apartments/4_zi_dg src/assets/apartments/3_zi_ug
cp content/de/4-zi-dg/images/*.jpg src/assets/apartments/4_zi_dg/
cp content/de/3-zi-ug/images/*.jpg src/assets/apartments/3_zi_ug/
ls src/assets/apartments/4_zi_dg src/assets/apartments/3_zi_ug
```
Expected: 10 files for `4_zi_dg`, 8 for `3_zi_ug`. (`3_zi_eg` has no images — that is fine.)

- [ ] **Step 2: Create `src/lib/images.ts`** — eager-glob apartment images, sorted by filename.

```ts
import type { ImageMetadata } from 'astro';

// Eager-import every apartment image so astro:assets can optimize it.
const FILES = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/apartments/**/*.{jpg,jpeg,png,webp}',
  { eager: true },
);

/** Returns optimized image metadata for an apartment id, sorted by filename. */
export function apartmentImages(apartmentId: string): ImageMetadata[] {
  return Object.entries(FILES)
    .filter(([path]) => path.includes(`/apartments/${apartmentId}/`))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, mod]) => mod.default);
}
```

- [ ] **Step 3: Build to confirm the glob resolves**

Run: `npm run build`
Expected: success (the smoke index page still builds; glob just compiles).

- [ ] **Step 4: Commit**

```bash
git add src/assets src/lib/images.ts
git commit -m "feat: apartment images in src/assets + glob helper"
```

---

## Task 8: Content collection + Markdown migration

**Files:**
- Create: `src/content.config.ts`
- Create: `src/content/de/*.md`, `src/content/de/apartments/*.md`, `src/content/en/*.md`, `src/content/en/apartments/*.md`

- [ ] **Step 1: Create `src/content.config.ts`**

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
  }),
});

export const collections = { pages };
```

> Entry ids become the path without extension, e.g. `de/home`, `en/apartments/penthouse`.

- [ ] **Step 2: Create the German page bodies.** Each file is the markdown body from the current Hugo content with simplified frontmatter (`title`, `description` only).

`src/content/de/home.md`:
```markdown
---
title: "FeWo Zaucker"
description: "Ferienwohnungen in Überlingen am Bodensee – ruhige Lage am Burgberg mit Blick auf Stadt, See und Alpen."
---

## Lage und Umgebung

Das 1988 gebaute Haus ist sehr ruhig am Burgberg in Überlingen gelegen (Sackgasse). Die unverbaubare Hanglage bietet auf der Südseite einen herrlichen Blick auf die Stadt Überlingen, den See und die Alpen.

Mehrere Kinderspielplätze in der näheren Umgebung.

Direkt vor dem Haus befinden sich Autostellplätze, die nächste Bushaltestelle ist ca. 5 Minuten zu Fuss entfernt.

Der Bahnhof Überlingen, die Innenstadt und der See sind in ca. 15 Minuten zu Fuss erreichbar. Verschiedene Einkaufsmöglichkeiten ebenfalls in Fussdistanz.

Die Wohnungen wurden 2013/2014/2015/2018 renoviert und neu möbliert/ausgestattet.
```

`src/content/de/verfuegbarkeit.md`:
```markdown
---
title: "Verfügbarkeit & Preise"
description: "Aktuelle Verfügbarkeit und Preise der Ferienwohnungen Zaucker in Überlingen."
---

Aktuelle Belegungskalender unserer Ferienwohnungen. Mindestaufenthalt und Preisdetails finden Sie unterhalb der Kalender.

### Mindestaufenthalt

- **Hauptsaison** (Juli–August): 7 Tage
- **Mittelsaison** (Weihnachten/Neujahr): 5 Tage
- **Nebensaison**: 3 Tage

### Zahlungsbedingungen

- Anzahlung: EUR 300 bei Buchung
- Restzahlung: 30 Tage vor Anreise
- Ferienbuchungen erfordern Vorauszahlung

### Stornierung

Rückerstattung nur bei Vermittlung eines Ersatzgastes. Reiserücktrittsversicherung empfohlen.

### Langzeitmiete Winter

Reduzierte Tarife November–April für Mietdauer ab 3 Monaten.
```

`src/content/de/fotos.md`:
```markdown
---
title: "Fotos"
description: "Bilder unserer Ferienwohnungen in Überlingen am Bodensee."
---
```

`src/content/de/kontakt.md`:
```markdown
---
title: "Kontakt"
description: "Kontaktieren Sie uns für Buchungsanfragen."
---

## Kontakt

**Fritz Zaucker**

**Telefon:** +41 62 775 9903

**E-Mail:** [fewo@zaucker.com](mailto:fewo@zaucker.com)

**Adresse der Ferienwohnungen:**
Werner-Haberland-Weg 51
D-88662 Überlingen
Deutschland

## Wegbeschreibung

Von der Autobahn A81 Ausfahrt Überlingen. Folgen Sie der Beschilderung Richtung Stadtzentrum. Am Burgberg links abbiegen in den Werner-Haberland-Weg.
```

`src/content/de/infos.md`:
```markdown
---
title: "Infos"
description: "Nützliche Informationen und Ausflugstipps rund um Überlingen am Bodensee."
---

## Überlingen

- [Reiseinformationen Überlingen](https://www.ueberlingen-bodensee.de/)
- [Stadt Überlingen](https://www.ueberlingen.de/)

## Touristisches

- [Haustierhof Reutemühle](https://www.haustierhof-reutemuehle.de/) – Streichelzoo
- [Bodensee-Therme Überlingen](https://www.bodensee-therme.de/) – Thermalbad
- [Meersburger Therme](https://www.meersburg-therme.de/) – Thermalbad
- [Ravensburger Spieleland](https://www.spieleland.de/) – Freizeitpark
- [Affenberg Salem](https://www.affenberg-salem.de/) – Affenpark
- [Sea Life Konstanz](https://www.visitsealife.com/konstanz/) – Aquarium
- [Auto und Traktor Museum](https://www.autoundtraktor.museum/) – Museum
```

`src/content/de/impressum.md`:
```markdown
---
title: "Impressum"
description: "Angaben gemäss § 5 TMG"
---

## Angaben gemäss § 5 TMG

**Friedrich Zaucker**
Ferienwohnungen Zaucker

**Adresse der Ferienwohnungen:**
Werner-Haberland-Weg 51
D-88662 Überlingen
Deutschland

**Postadresse:**
Fritz Zaucker
Platanen 42
CH-4600 Olten
Schweiz

**Kontakt:**
Telefon: +41 79 675 0630
Fax: +41 62 775 9905
E-Mail: [fritz@zaucker.com](mailto:fritz@zaucker.com)

## Streitschlichtung

Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: [https://ec.europa.eu/consumers/odr](https://ec.europa.eu/consumers/odr). Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.

## Haftung für Inhalte

Als Diensteanbieter sind wir gemäss § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.

## Haftung für Links

Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.

## Urheberrecht

Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung ausserhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers. Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet.
```

`src/content/de/datenschutz.md`:
```markdown
---
title: "Datenschutz"
description: "Datenschutzerklärung"
---

## Datenschutzerklärung

**Verantwortliche Stelle:**
Ferienwohnungen Zaucker
Platanen 42
CH-4600 Olten
Schweiz

## Zugriffsdaten

Bei jedem Zugriff auf unsere Website werden vom Webserver automatisch Zugriffsdaten (Browsertyp, IP-Adresse, Referrer) erfasst. Diese Daten werden maximal 7 Tage gespeichert und dienen ausschliesslich der Sicherstellung eines störungsfreien Betriebs.

## Cookies

Unsere Website verwendet Cookies ausschliesslich für die Benutzerfreundlichkeit und Sicherheit. Es werden keine Tracking-Cookies eingesetzt.

## Kontaktdaten

Wenn Sie uns per E-Mail oder Telefon kontaktieren, werden Ihre Angaben zwecks Bearbeitung der Anfrage gespeichert. Diese Daten werden nicht an Dritte weitergegeben.

## Ihre Rechte

Sie haben das Recht auf unentgeltliche Auskunft über Ihre gespeicherten personenbezogenen Daten sowie ein Recht auf Berichtigung, Löschung und Datenübertragbarkeit.

**Kontakt:** [fewo@zaucker.com](mailto:fewo@zaucker.com)
```

- [ ] **Step 3: Create German apartment bodies.** Frontmatter `title`/`description` only; structured data comes from YAML.

`src/content/de/apartments/dachgeschoss.md`:
```markdown
---
title: "4-Zimmer Dachgeschoss-Wohnung"
description: "Geräumige Ferienwohnung im Dachgeschoss mit 3 Schlafzimmern und Balkon – ideal für bis zu 5 Personen."
---

## Räumlichkeiten

- Geräumiger Wohn-/Essbereich
- Ausgestattete, separate Küche mit Geschirrspüler
- Grosses Elternschlafzimmer (Doppelbett 1.80m)
- Zweites Schlafzimmer (2 Betten à 0.90m)
- Drittes Schlafzimmer (Einzelbett)
- Badezimmer mit Badewanne und Dusche
- Balkon auf der Westseite

## Ausstattung

- Kabel-TV, Blu-ray/DVD Player
- Kostenloses DSL Internet und WLAN
- Babyausstattung vorhanden
- Kinderspielzeug und -bücher
- Herd, Kühlschrank, Kaffeemaschine, Toaster, Mikrowelle, Wasserkocher, Geschirrspüler
- Handtücher und Föhn
- Bettzeug kann gegen Gebühr gemietet werden; eigenes Bettzeug kann mitgebracht werden
- Waschmaschine nach Absprache
```

`src/content/de/apartments/gartenwohnung.md`:
```markdown
---
title: "3-Zimmer Gartenwohnung"
description: "Gemütliche Ferienwohnung im Tiefparterre mit direktem Zugang zum Garten – ideal für bis zu 4 Personen."
---

## Räumlichkeiten

- Wohn-/Essbereich mit Ausziehcouch (2 x 1.50m)
- Schlafzimmer mit Doppelbett (2 x 1.80m)
- Zweites Schlafzimmer mit zwei Einzelbetten (je 1.00m) und Lavabo
- Separate, geschlossene Küche mit Geschirrspüler
- Badezimmer mit Badewanne und Duschvorhang
- Gedeckter Gartensitzplatz
- Alle Räume mit direktem Zugang zum Garten

## Ausstattung

- Kabel-TV, Blu-Ray/DVD Player
- Kostenloses Internet (DSL, WLAN)
- Babyausstattung vorhanden
- Kinderspiele und -bücher
- Herd, Kühlschrank, Kaffeemaschine, Toaster, Mikrowelle, Geschirrspüler
- Handtücher und Föhn
- Bettzeug kann gegen Gebühr gemietet werden; eigenes Bettzeug kann mitgebracht werden
- Waschmaschine nach Absprache
```

`src/content/de/apartments/erdgeschoss.md`:
```markdown
---
title: "3-Zimmer Erdgeschoss-Wohnung"
description: "Ferienwohnung im Erdgeschoss mit Balkon – für bis zu 6 Personen."
---

Diese Wohnung ist derzeit nicht verfügbar.
```

- [ ] **Step 4: Create English page bodies.**

`src/content/en/home.md`:
```markdown
---
title: "Apt Zaucker"
description: "Holiday apartments in Überlingen on Lake Constance – quiet hillside location with panoramic views."
---

## Location and Surroundings

The house, built in 1988, is situated peacefully on Burgberg hill in Überlingen (cul-de-sac). The unobstructed hillside position offers magnificent views of the town of Überlingen, Lake Constance, and the Alps from the south side.

Several children's playgrounds in the immediate vicinity.

Parking spaces directly in front of the house, the nearest bus stop is approximately 5 minutes on foot.

The Überlingen train station, town centre, and lake are reachable in about 15 minutes on foot. Various shopping facilities also within walking distance.

The apartments were renovated and newly furnished in 2013/2014/2015/2018.
```

`src/content/en/availability.md`:
```markdown
---
title: "Availability & Prices"
description: "Current availability and pricing for our holiday apartments in Überlingen."
---

Current occupancy calendars for our apartments. Minimum stay and pricing details can be found below the calendars.

### Minimum Stay

- **High season** (July–August): 7 days
- **Mid season** (Christmas/New Year): 5 days
- **Low season**: 3 days

### Payment Terms

- Deposit: EUR 300 on booking
- Balance: due 30 days before arrival
- Holiday bookings require full prepayment

### Cancellation

Refund only if a replacement guest is found. Travel cancellation insurance recommended.

### Long-term Winter Rental

Reduced rates November–April for stays of 3 months or more.
```

`src/content/en/photos.md`:
```markdown
---
title: "Photos"
description: "Photos of our holiday apartments in Überlingen on Lake Constance."
---
```

`src/content/en/contact.md`:
```markdown
---
title: "Contact"
description: "Contact us for booking enquiries."
---

## Contact

**Fritz Zaucker**

**Phone:** +41 62 775 9903

**Email:** [fewo@zaucker.com](mailto:fewo@zaucker.com)

**Apartment address:**
Werner-Haberland-Weg 51
D-88662 Überlingen
Germany

## Directions

From the A81 motorway, take the Überlingen exit. Follow signs towards the town centre. At Burgberg, turn left onto Werner-Haberland-Weg.
```

`src/content/en/infos.md`:
```markdown
---
title: "Infos"
description: "Useful information and excursion tips around Überlingen on Lake Constance."
---

## Überlingen

- [Travel information Überlingen](https://www.ueberlingen-bodensee.de/)
- [City of Überlingen](https://www.ueberlingen.de/)

## Tourist Attractions

- [Haustierhof Reutemühle](https://www.haustierhof-reutemuehle.de/) – Petting farm
- [Bodensee-Therme Überlingen](https://www.bodensee-therme.de/) – Thermal spa
- [Meersburger Therme](https://www.meersburg-therme.de/) – Thermal spa
- [Ravensburger Spieleland](https://www.spieleland.de/) – Amusement park
- [Affenberg Salem](https://www.affenberg-salem.de/) – Monkey park
- [Sea Life Konstanz](https://www.visitsealife.com/konstanz/) – Aquarium
- [Auto und Traktor Museum](https://www.autoundtraktor.museum/) – Museum
```

- [ ] **Step 5: Create English apartment bodies.**

`src/content/en/apartments/penthouse.md`:
```markdown
---
title: "3-Bedroom Penthouse Apartment"
description: "Spacious penthouse with 3 bedrooms and west-facing balcony – ideal for up to 5 guests."
---

## Rooms

- Spacious living/dining area
- Fully equipped separate kitchen with dishwasher
- Large master bedroom (double bed 1.80m)
- Second bedroom (2 single beds, 0.90m each)
- Third bedroom (single bed)
- Bathroom with bathtub and shower
- West-facing balcony

## Amenities

- Cable TV, Blu-ray/DVD player
- Free DSL internet and Wi-Fi
- Baby equipment available
- Children's toys and books
- Stove, refrigerator, coffee maker, toaster, microwave, kettle, dishwasher
- Towels and hairdryer
- Bed linen available for a small fee; you may also bring your own
- Washing machine available on request
```

`src/content/en/apartments/garden.md`:
```markdown
---
title: "2-Bedroom Garden Apartment"
description: "Cosy ground-level apartment with direct garden access – ideal for up to 4 guests."
---

## Rooms

- Living/dining area with pull-out sofa (2 x 1.50m)
- Bedroom with double bed (2 x 1.80m)
- Second bedroom with twin beds (1.00m each) and wash basin
- Separate enclosed kitchen with dishwasher
- Bathroom with bathtub and shower curtain
- Covered garden seating area
- All rooms with direct garden access

## Amenities

- Cable TV, Blu-Ray/DVD player
- Free internet (DSL, Wi-Fi)
- Baby equipment available
- Children's games and books
- Stove, refrigerator, coffee maker, toaster, microwave, dishwasher
- Towels and hairdryer
- Bed linen available for a small fee; you may also bring your own
- Washing machine available on request
```

`src/content/en/apartments/ground-floor.md`:
```markdown
---
title: "3-Room Ground Floor Apartment"
description: "Ground floor apartment with balcony – for up to 6 guests."
---

This apartment is currently not available.
```

- [ ] **Step 6: Build to confirm the collection parses**

Run: `npm run build`
Expected: success, no content schema errors.

- [ ] **Step 7: Commit**

```bash
git add src/content.config.ts src/content
git commit -m "feat: page + apartment markdown content collection (de/en)"
```

---

## Task 9: Layout, Head, Header, Footer components

**Files:**
- Create: `src/layouts/Layout.astro`, `src/components/Head.astro`, `src/components/Header.astro`, `src/components/Footer.astro`

These reproduce `baseof.html`, `head.html`, `header.html`, `footer.html`. The site params (owner name, address, phone, email) move into a small constant inside `Head`/`Footer` (from `hugo.toml [params]`).

- [ ] **Step 1: Create `src/components/Head.astro`**

```astro
---
import type { Locale } from '@/lib/types';
interface Props {
  locale: Locale;
  title: string;
  description: string;
  canonical: string;        // absolute URL
  alternates?: { lang: Locale; href: string }[]; // absolute URLs
  isHome?: boolean;
}
const { locale, title, description, canonical, alternates = [], isHome = false } = Astro.props;
const siteTitle = locale === 'de' ? 'FeWo Zaucker' : 'Apt Zaucker';
const fullTitle = isHome ? siteTitle : `${title} · ${siteTitle}`;
import '@/styles/global.css';
---
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{fullTitle}</title>
<meta name="description" content={description} />
<link rel="canonical" href={canonical} />
{alternates.map(a => <link rel="alternate" hreflang={a.lang} href={a.href} />)}
<link rel="alternate" hreflang="x-default" href="https://zaucker.com/" />
<meta property="og:type" content="website" />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:url" content={canonical} />
<meta property="og:site_name" content={siteTitle} />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Create `src/components/Header.astro`** (nav + language switch + mobile menu)

```astro
---
import type { Locale } from '@/lib/types';
import { getNav, pagePath } from '@/lib/routes';
interface Props { locale: Locale; currentPath: string; altHref: string | null; }
const { locale, currentPath, altHref } = Astro.props;
const nav = getNav(locale);
const siteTitle = locale === 'de' ? 'FeWo Zaucker' : 'Apt Zaucker';
const homeHref = pagePath(locale, 'home');
const switchLabel = locale === 'de' ? 'English' : 'Deutsch';
const otherLang = locale === 'de' ? 'en' : 'de';
---
<header class="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-stone-100 shadow-sm">
  <nav class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
    <div class="flex items-center justify-between h-16">
      <a href={homeHref} class="flex items-center gap-2 font-semibold text-stone-900 hover:text-lake transition-colors">
        <span class="text-lg">{siteTitle}</span>
      </a>
      <div class="hidden md:flex items-center gap-1">
        {nav.map(item => (
          <a href={item.href}
             class={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentPath === item.href ? 'text-lake bg-lake/10' : 'text-stone-700 hover:text-lake hover:bg-stone-50'}`}>
            {item.label}
          </a>
        ))}
        {altHref && (
          <a href={altHref} hreflang={otherLang}
             class="ml-3 px-3 py-1.5 rounded border border-stone-200 text-sm text-stone-600 hover:border-lake hover:text-lake transition-colors">
            {switchLabel}
          </a>
        )}
      </div>
      <button id="mobile-menu-btn" class="md:hidden p-2 rounded-md text-stone-600 hover:text-lake"
              aria-expanded="false" aria-controls="mobile-menu">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>
    <div id="mobile-menu" class="hidden md:hidden pb-3 border-t border-stone-100">
      {nav.map(item => (
        <a href={item.href} class="block px-3 py-2 text-sm font-medium text-stone-700 hover:text-lake hover:bg-stone-50 rounded-md">
          {item.label}
        </a>
      ))}
      {altHref && <a href={altHref} class="block px-3 py-2 text-sm text-stone-500">{switchLabel}</a>}
    </div>
  </nav>
</header>
```

- [ ] **Step 3: Create `src/components/Footer.astro`**

```astro
---
import type { Locale } from '@/lib/types';
import { t } from '@/lib/i18n';
import { pagePath } from '@/lib/routes';
interface Props { locale: Locale; }
const { locale } = Astro.props;
const owner = {
  name: 'Ferienwohnungen Zaucker',
  email: 'fewo@zaucker.com',
  phone: '+41 62 775 9903',
  address: 'Werner-Haberland-Weg 51',
  city: 'D-88662 Überlingen',
};
const year = 2026; // build year; bump as needed (no runtime clock in static build)
const legal = [
  { label: locale === 'de' ? 'Impressum' : 'Legal Notice', href: pagePath(locale, 'impressum') },
  { label: locale === 'de' ? 'Datenschutz' : 'Privacy Policy', href: pagePath(locale, 'datenschutz') },
];
---
<footer class="mt-16 bg-stone-900 text-stone-300">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <h3 class="text-white font-semibold mb-3">{t(locale, 'contact_address')}</h3>
        <address class="not-italic text-sm space-y-1">
          <p>{owner.name}</p>
          <p>{owner.address}</p>
          <p>{owner.city}</p>
          <p><a href={`tel:${owner.phone}`} class="hover:text-white transition-colors">{owner.phone}</a></p>
          <p><a href={`mailto:${owner.email}`} class="hover:text-white transition-colors">{owner.email}</a></p>
        </address>
      </div>
      <div>
        <h3 class="text-white font-semibold mb-3">{t(locale, 'nav_legal')}</h3>
        <ul class="text-sm space-y-1">
          {legal.map(l => <li><a href={l.href} class="hover:text-white transition-colors">{l.label}</a></li>)}
          <li class="pt-2 text-stone-500">© {year} {owner.name}</li>
        </ul>
      </div>
    </div>
  </div>
</footer>
```

- [ ] **Step 4: Create `src/layouts/Layout.astro`** (base shell + mobile-menu script)

```astro
---
import type { Locale } from '@/lib/types';
import Head from '@/components/Head.astro';
import Header from '@/components/Header.astro';
import Footer from '@/components/Footer.astro';
interface Props {
  locale: Locale;
  title: string;
  description: string;
  currentPath: string;       // e.g. Astro.url.pathname
  altHref: string | null;    // counterpart URL in the other locale (path), or null
  isHome?: boolean;
}
const { locale, title, description, currentPath, altHref, isHome = false } = Astro.props;
const origin = 'https://zaucker.com';
const canonical = origin + currentPath;
const alternates = altHref
  ? [{ lang: locale, href: canonical }, { lang: (locale === 'de' ? 'en' : 'de') as Locale, href: origin + altHref }]
  : [];
---
<!DOCTYPE html>
<html lang={locale} class="scroll-smooth">
  <head>
    <Head locale={locale} title={title} description={description} canonical={canonical} alternates={alternates} isHome={isHome} />
  </head>
  <body class="min-h-screen flex flex-col bg-white text-stone-800">
    <Header locale={locale} currentPath={currentPath} altHref={altHref} />
    <main class="flex-1" id="main-content">
      <slot />
    </main>
    <Footer locale={locale} />
    <script>
      const btn = document.getElementById('mobile-menu-btn');
      const menu = document.getElementById('mobile-menu');
      if (btn && menu) {
        btn.addEventListener('click', () => {
          menu.classList.toggle('hidden');
          btn.setAttribute('aria-expanded', String(!menu.classList.contains('hidden')));
        });
      }
    </script>
  </body>
</html>
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: success (smoke index still present; components compile).

- [ ] **Step 6: Commit**

```bash
git add src/layouts src/components/Head.astro src/components/Header.astro src/components/Footer.astro
git commit -m "feat: base layout, head, header (nav+lang switch), footer"
```

---

## Task 10: Presentational components — ApartmentFeatures, PricingTable, ApartmentCard

**Files:**
- Create: `src/components/ApartmentFeatures.astro`, `src/components/PricingTable.astro`, `src/components/ApartmentCard.astro`

- [ ] **Step 1: Create `src/components/ApartmentFeatures.astro`** (from `apartment-features.html`)

```astro
---
import type { Apartment, Locale } from '@/lib/types';
import { t } from '@/lib/i18n';
interface Props { apt: Apartment; locale: Locale; }
const { apt, locale } = Astro.props;
const categories = [
  { key: 'kitchen',  label_key: 'section_kitchen' },
  { key: 'bathroom', label_key: 'section_bathroom' },
  { key: 'living',   label_key: 'section_living' },
  { key: 'family',   label_key: 'section_family' },
  { key: 'service',  label_key: 'section_service' },
];
---
<section class="mt-10">
  <h2 class="text-2xl font-semibold text-stone-900 mb-6">{t(locale, 'section_features')}</h2>
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 p-4 bg-stone-50 rounded-xl">
    <div class="text-center"><div class="text-3xl font-bold text-lake">{apt.specs.rooms}</div><div class="text-sm text-stone-500">{t(locale, 'unit_rooms')}</div></div>
    <div class="text-center"><div class="text-3xl font-bold text-lake">{apt.specs.bedrooms}</div><div class="text-sm text-stone-500">{t(locale, 'section_bedrooms')}</div></div>
    <div class="text-center"><div class="text-3xl font-bold text-lake">{apt.specs.max_guests}</div><div class="text-sm text-stone-500">{t(locale, 'unit_persons_max')}</div></div>
    {apt.specs.area_m2 && (
      <div class="text-center"><div class="text-3xl font-bold text-lake">{apt.specs.area_m2}</div><div class="text-sm text-stone-500">m²</div></div>
    )}
  </div>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    {categories.map(cat => {
      const features = apt.features[cat.key];
      return features && features.length > 0 && (
        <div class="border border-stone-200 rounded-xl p-5">
          <h3 class="font-semibold text-stone-800 mb-3">{t(locale, cat.label_key)}</h3>
          <ul class="space-y-1.5">
            {features.map(f => (
              <li class="flex items-center gap-2 text-sm text-stone-700">
                <svg class="w-4 h-4 text-alpine flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>
                {t(locale, `feat_${f.key}`)}
              </li>
            ))}
          </ul>
        </div>
      );
    })}
  </div>
</section>
```

- [ ] **Step 2: Create `src/components/PricingTable.astro`** (from `pricing-table.html`)

```astro
---
import type { Apartment, Locale } from '@/lib/types';
import { t } from '@/lib/i18n';
interface Props { apt: Apartment; locale: Locale; }
const { apt, locale } = Astro.props;
const minStayFor = (seasonKey: string) =>
  apt.minimum_stay.find(m => m.season_key === seasonKey)?.nights ?? 0;
---
<section class="mt-12">
  <h2 class="text-2xl font-semibold text-stone-900 mb-6">{t(locale, 'section_pricing')}</h2>
  <div class="overflow-x-auto rounded-xl border border-stone-200">
    <table class="w-full text-sm">
      <thead>
        <tr class="bg-stone-50 border-b border-stone-200">
          <th class="text-left px-4 py-3 font-semibold text-stone-700">{t(locale, 'table_season')}</th>
          <th class="text-left px-4 py-3 font-semibold text-stone-700"></th>
          <th class="text-right px-4 py-3 font-semibold text-stone-700">{t(locale, 'price_per_day')}</th>
          <th class="text-right px-4 py-3 font-semibold text-stone-700">{t(locale, 'booking_min_stay')}</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-stone-100">
        {apt.pricing.seasons.map((season, i) => (
          <tr class={`${i % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'} hover:bg-lake/5 transition-colors`}>
            <td class="px-4 py-3 font-medium text-stone-800">{t(locale, season.name_key)}</td>
            <td class="px-4 py-3 text-stone-600">{t(locale, `${season.name_key}_desc`)}</td>
            <td class="px-4 py-3 text-right font-semibold text-lake">€{season.rate_per_day}</td>
            <td class="px-4 py-3 text-right text-stone-600">{minStayFor(season.name_key)} {t(locale, 'booking_nights')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  <div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
    <div class="bg-stone-50 rounded-lg p-3 text-center"><div class="text-xs text-stone-500 mb-1">{t(locale, 'price_cleaning')}</div><div class="font-semibold text-stone-800">€{apt.pricing.cleaning_fee}</div></div>
    <div class="bg-stone-50 rounded-lg p-3 text-center"><div class="text-xs text-stone-500 mb-1">{t(locale, 'price_deposit')}</div><div class="font-semibold text-stone-800">€{apt.pricing.deposit}</div></div>
    <div class="bg-stone-50 rounded-lg p-3 text-center"><div class="text-xs text-stone-500 mb-1">{t(locale, 'price_extra_guest')}</div><div class="font-semibold text-stone-800">€{apt.pricing.extra_guest_per_day}/{t(locale, 'price_per_day')}</div></div>
    <div class="bg-stone-50 rounded-lg p-3 text-center"><div class="text-xs text-stone-500 mb-1">{t(locale, 'price_city_tax')}</div><div class="font-semibold text-stone-800">€{apt.city_tax.nov_mar_per_person_per_day}–{apt.city_tax.apr_oct_per_person_per_day}</div></div>
  </div>
  <p class="mt-4 text-sm text-stone-500 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">{t(locale, 'booking_deposit_text')}</p>
</section>
```

- [ ] **Step 3: Create `src/components/ApartmentCard.astro`** (from `apartment-card.html`)

```astro
---
import type { Apartment, Locale } from '@/lib/types';
import { t } from '@/lib/i18n';
import { apartmentPath } from '@/lib/routes';
import { apartmentImages } from '@/lib/images';
import { Image } from 'astro:assets';
interface Props { apt: Apartment; locale: Locale; title: string; description?: string; }
const { apt, locale, title, description } = Astro.props;
const href = apartmentPath(locale, apt);
const images = apartmentImages(apt.id);
const hero = images[0];
const seasons = apt.pricing.seasons;
const minRate = seasons[seasons.length - 1].rate_per_day;
const maxRate = seasons[0].rate_per_day;
---
<article class="group rounded-2xl border border-stone-200 overflow-hidden hover:shadow-lg transition-shadow duration-300 bg-white">
  {hero ? (
    <a href={href} class="block overflow-hidden aspect-[8/5]">
      <Image src={hero} alt={title} width={800} height={500} class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
    </a>
  ) : (
    <a href={href} class="block aspect-[8/5] bg-stone-100 flex items-center justify-center"><span class="text-stone-400 text-lg">{title}</span></a>
  )}
  <div class="p-6">
    <div class="flex flex-wrap gap-2 mb-3">
      <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-lake/10 text-lake">{apt.specs.rooms} {t(locale, 'unit_rooms')}</span>
      <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-700">{t(locale, 'nav_from')} {apt.specs.max_guests} {t(locale, 'unit_persons_max')}</span>
      {apt.specs.area_m2 && <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-700">ca. {apt.specs.area_m2} m²</span>}
    </div>
    <h2 class="text-xl font-semibold text-stone-900 mb-2"><a href={href} class="hover:text-lake transition-colors">{title}</a></h2>
    {description && <p class="text-stone-600 text-sm mb-4 line-clamp-2">{description}</p>}
    <div class="flex items-center justify-between">
      <div class="text-sm text-stone-500">{t(locale, 'nav_from')} <span class="text-lg font-bold text-stone-900">€{minRate}</span> – €{maxRate} {t(locale, 'price_per_day')}</div>
      <a href={href} class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-lake text-white text-sm font-medium hover:bg-lake-dark transition-colors">
        {t(locale, 'nav_details')}
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
      </a>
    </div>
  </div>
</article>
```

- [ ] **Step 4: Add `line-clamp-2` safety** — Tailwind v4 includes `line-clamp` utilities by default; no plugin needed. Build to confirm.

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/components/ApartmentFeatures.astro src/components/PricingTable.astro src/components/ApartmentCard.astro
git commit -m "feat: apartment features, pricing table, and card components"
```

---

## Task 11: Svelte Lightbox island + GalleryGrid

**Files:**
- Create: `src/components/Lightbox.svelte`, `src/components/GalleryGrid.astro`

The `Lightbox.svelte` island receives a list of `{ thumb, full, alt }` and renders the grid + an overlay viewer (keyboard ←/→/Esc, prev/next, loop, click-out to close), replacing GLightbox.

- [ ] **Step 1: Create `src/components/Lightbox.svelte`** (Svelte 5 runes)

```svelte
<script lang="ts">
  interface Item { thumb: string; full: string; alt: string; w: number; h: number; }
  let { items, columns = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' }:
    { items: Item[]; columns?: string } = $props();

  let open = $state(false);
  let index = $state(0);

  function show(i: number) { index = i; open = true; }
  function close() { open = false; }
  function next() { index = (index + 1) % items.length; }
  function prev() { index = (index - 1 + items.length) % items.length; }

  function onKey(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
  }
</script>

<svelte:window on:keydown={onKey} />

<div class={`gallery-grid grid ${columns} gap-2`}>
  {#each items as item, i}
    <button type="button" class="block overflow-hidden rounded-lg group aspect-[4/3]" onclick={() => show(i)} aria-label={item.alt}>
      <img src={item.thumb} width={item.w} height={item.h} alt={item.alt} loading="lazy"
           class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
    </button>
  {/each}
</div>

{#if open}
  <div class="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center" onclick={close} role="presentation">
    <button class="absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none" onclick={close} aria-label="Close">×</button>
    <button class="absolute left-4 text-white/80 hover:text-white text-4xl px-3" onclick={(e) => { e.stopPropagation(); prev(); }} aria-label="Previous">‹</button>
    <img src={items[index].full} alt={items[index].alt} class="max-h-[90vh] max-w-[90vw] object-contain" onclick={(e) => e.stopPropagation()} />
    <button class="absolute right-4 text-white/80 hover:text-white text-4xl px-3" onclick={(e) => { e.stopPropagation(); next(); }} aria-label="Next">›</button>
  </div>
{/if}
```

- [ ] **Step 2: Create `src/components/GalleryGrid.astro`** — optimizes images via astro:assets, then hands plain URLs to the island.

```astro
---
import type { Locale } from '@/lib/types';
import { t } from '@/lib/i18n';
import { getImage } from 'astro:assets';
import Lightbox from '@/components/Lightbox.svelte';
import type { ImageMetadata } from 'astro';
interface Props { images: ImageMetadata[]; alt: string; locale: Locale; }
const { images, alt, locale } = Astro.props;

const items = await Promise.all(images.map(async (img) => {
  const thumb = await getImage({ src: img, width: 400, height: 300, format: 'webp', quality: 85 });
  const full = await getImage({ src: img, width: 1600, height: 1200, fit: 'inside', format: 'webp', quality: 90 });
  return { thumb: thumb.src, full: full.src, alt, w: thumb.attributes.width ?? 400, h: thumb.attributes.height ?? 300 };
}));
---
{items.length > 0 ? (
  <Lightbox client:visible items={items} />
) : (
  <p class="text-stone-400 italic">{t(locale, 'no_photos')}</p>
)}
```

- [ ] **Step 3: Build to confirm Svelte island + image optimization compile**

Run: `npm run build`
Expected: success; `dist/_astro/` contains optimized webp images.

- [ ] **Step 4: Commit**

```bash
git add src/components/Lightbox.svelte src/components/GalleryGrid.astro
git commit -m "feat: Svelte lightbox island + gallery grid with astro:assets"
```

---

## Task 12: AvailabilityWidget component

**Files:**
- Create: `src/components/AvailabilityWidget.astro` (from `availability-widget.html`)

- [ ] **Step 1: Create `src/components/AvailabilityWidget.astro`**

```astro
---
import type { Apartment, Locale } from '@/lib/types';
import { t } from '@/lib/i18n';
interface Props { apt: Apartment; locale: Locale; }
const { apt, locale } = Astro.props;
---
{apt.traumfw_id && (
  <div class="mt-8">
    <h3 class="text-xl font-semibold text-stone-900 mb-4">
      {t(locale, apt.name_key)} – {t(locale, 'section_availability')}
    </h3>
    <div class="rounded-xl border border-stone-200 overflow-hidden bg-white p-4">
      <a class="traumfewo-calendar"
         href={`https://www.traum-ferienwohnungen.de/${apt.traumfw_id}.htm#kalender`}
         title={t(locale, apt.name_key)}
         data-listing={apt.traumfw_id}
         data-language={locale}
         data-months="6"
         data-color-free="45cf45"
         data-color-booked="ed8e97"
         data-columns="6">
        <img style="display: none;" src="//static.traum-ferienwohnungen.de/images/widgets/logo.png" alt="Traum-Ferienwohnungen.de" width="200" />
      </a>
    </div>
  </div>
)}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/AvailabilityWidget.astro
git commit -m "feat: traum-ferienwohnungen availability widget component"
```

---

## Task 13: Homepage (de + en)

**Files:**
- Create/replace: `src/pages/index.astro` (replaces smoke page), `src/pages/en/index.astro`

Reproduces `layouts/index.html`: hero, 4 highlights, apartment cards, body content.

- [ ] **Step 1: Create `src/pages/index.astro`**

```astro
---
import type { Locale } from '@/lib/types';
import Layout from '@/layouts/Layout.astro';
import ApartmentCard from '@/components/ApartmentCard.astro';
import { t } from '@/lib/i18n';
import { getVisibleApartments } from '@/lib/apartments';
import { pagePath, apartmentPath } from '@/lib/routes';
import { getEntry, render } from 'astro:content';

const locale: Locale = 'de';
const page = await getEntry('pages', 'de/home');
const { Content } = await render(page!);
const apartments = getVisibleApartments();
const subtitle = 'Ferienwohnungen in Überlingen am Bodensee';
const apartmentBodies = import.meta.glob('/src/content/de/apartments/*.md', { eager: true }) as Record<string, any>;
function aptMeta(apt: typeof apartments[number]) {
  const mod = apartmentBodies[`/src/content/de/apartments/${apt.slug.de}.md`];
  return { title: mod.frontmatter.title as string, description: mod.frontmatter.description as string };
}
---
<Layout locale={locale} title={page!.data.title} description={page!.data.description ?? ''} currentPath="/" altHref="/en/" isHome>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
    <section class="py-20 text-center">
      <h1 class="text-5xl sm:text-6xl font-bold text-stone-900 mb-6 leading-tight">FeWo Zaucker</h1>
      <p class="text-xl text-stone-600 max-w-2xl mx-auto mb-8 leading-relaxed">{subtitle}</p>
      <div class="flex flex-wrap gap-4 justify-center">
        <a href={pagePath(locale, 'availability')} class="px-8 py-4 rounded-xl bg-lake text-white text-lg font-semibold hover:bg-lake-dark transition-colors shadow-lg shadow-lake/30">{t(locale, 'nav_check_availability')}</a>
        <a href="#wohnungen" class="px-8 py-4 rounded-xl border-2 border-stone-200 text-stone-700 text-lg font-medium hover:border-lake hover:text-lake transition-colors">{t(locale, 'nav_our_apartments')}</a>
      </div>
    </section>
    <section class="py-12 grid grid-cols-2 sm:grid-cols-4 gap-6 border-y border-stone-100">
      <div class="text-center"><div class="text-3xl mb-2">🏔️</div><p class="text-sm text-stone-600 font-medium">{t(locale, 'highlight_view')}</p></div>
      <div class="text-center"><div class="text-3xl mb-2">🚶</div><p class="text-sm text-stone-600 font-medium">{t(locale, 'highlight_walk')}</p></div>
      <div class="text-center"><div class="text-3xl mb-2">🅿️</div><p class="text-sm text-stone-600 font-medium">{t(locale, 'highlight_parking')}</p></div>
      <div class="text-center"><div class="text-3xl mb-2">🌿</div><p class="text-sm text-stone-600 font-medium">{t(locale, 'highlight_quiet')}</p></div>
    </section>
    <section id="wohnungen" class="py-16">
      <h2 class="text-3xl font-bold text-stone-900 mb-10 text-center">{t(locale, 'nav_our_apartments')}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        {apartments.map(apt => { const m = aptMeta(apt); return <ApartmentCard apt={apt} locale={locale} title={m.title} description={m.description} />; })}
      </div>
    </section>
    <section class="py-12 max-w-3xl mx-auto text-stone-700 leading-relaxed prose"><Content /></section>
  </div>
</Layout>
```

- [ ] **Step 2: Create `src/pages/en/index.astro`** (English mirror)

```astro
---
import type { Locale } from '@/lib/types';
import Layout from '@/layouts/Layout.astro';
import ApartmentCard from '@/components/ApartmentCard.astro';
import { t } from '@/lib/i18n';
import { getVisibleApartments } from '@/lib/apartments';
import { pagePath } from '@/lib/routes';
import { getEntry, render } from 'astro:content';

const locale: Locale = 'en';
const page = await getEntry('pages', 'en/home');
const { Content } = await render(page!);
const apartments = getVisibleApartments();
const subtitle = 'Holiday apartments in Überlingen on Lake Constance';
const apartmentBodies = import.meta.glob('/src/content/en/apartments/*.md', { eager: true }) as Record<string, any>;
function aptMeta(apt: typeof apartments[number]) {
  const mod = apartmentBodies[`/src/content/en/apartments/${apt.slug.en}.md`];
  return { title: mod.frontmatter.title as string, description: mod.frontmatter.description as string };
}
---
<Layout locale={locale} title={page!.data.title} description={page!.data.description ?? ''} currentPath="/en/" altHref="/" isHome>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
    <section class="py-20 text-center">
      <h1 class="text-5xl sm:text-6xl font-bold text-stone-900 mb-6 leading-tight">Apt Zaucker</h1>
      <p class="text-xl text-stone-600 max-w-2xl mx-auto mb-8 leading-relaxed">{subtitle}</p>
      <div class="flex flex-wrap gap-4 justify-center">
        <a href={pagePath(locale, 'availability')} class="px-8 py-4 rounded-xl bg-lake text-white text-lg font-semibold hover:bg-lake-dark transition-colors shadow-lg shadow-lake/30">{t(locale, 'nav_check_availability')}</a>
        <a href="#wohnungen" class="px-8 py-4 rounded-xl border-2 border-stone-200 text-stone-700 text-lg font-medium hover:border-lake hover:text-lake transition-colors">{t(locale, 'nav_our_apartments')}</a>
      </div>
    </section>
    <section class="py-12 grid grid-cols-2 sm:grid-cols-4 gap-6 border-y border-stone-100">
      <div class="text-center"><div class="text-3xl mb-2">🏔️</div><p class="text-sm text-stone-600 font-medium">{t(locale, 'highlight_view')}</p></div>
      <div class="text-center"><div class="text-3xl mb-2">🚶</div><p class="text-sm text-stone-600 font-medium">{t(locale, 'highlight_walk')}</p></div>
      <div class="text-center"><div class="text-3xl mb-2">🅿️</div><p class="text-sm text-stone-600 font-medium">{t(locale, 'highlight_parking')}</p></div>
      <div class="text-center"><div class="text-3xl mb-2">🌿</div><p class="text-sm text-stone-600 font-medium">{t(locale, 'highlight_quiet')}</p></div>
    </section>
    <section id="wohnungen" class="py-16">
      <h2 class="text-3xl font-bold text-stone-900 mb-10 text-center">{t(locale, 'nav_our_apartments')}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        {apartments.map(apt => { const m = aptMeta(apt); return <ApartmentCard apt={apt} locale={locale} title={m.title} description={m.description} />; })}
      </div>
    </section>
    <section class="py-12 max-w-3xl mx-auto text-stone-700 leading-relaxed prose"><Content /></section>
  </div>
</Layout>
```

- [ ] **Step 3: Build & verify both homepages exist**

Run: `npm run build && ls dist/index.html dist/en/index.html`
Expected: both files exist; `dist/index.html` contains "FeWo Zaucker" and apartment cards.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro src/pages/en/index.astro
git commit -m "feat: bilingual homepage (hero, highlights, apartment cards)"
```

---

## Task 14: Apartment detail pages (dynamic, de + en)

**Files:**
- Create: `src/pages/[slug].astro`, `src/pages/en/[slug].astro`

Reproduces `apartment/single.html`: breadcrumb, title/description, hero + thumbnail strip gallery, content, features, pricing, CTA. Uses the Lightbox island for the hero gallery.

- [ ] **Step 1: Create `src/pages/[slug].astro`**

```astro
---
import type { Locale } from '@/lib/types';
import Layout from '@/layouts/Layout.astro';
import ApartmentFeatures from '@/components/ApartmentFeatures.astro';
import PricingTable from '@/components/PricingTable.astro';
import GalleryGrid from '@/components/GalleryGrid.astro';
import { t } from '@/lib/i18n';
import { getApartments } from '@/lib/apartments';
import { apartmentImages } from '@/lib/images';
import { pagePath } from '@/lib/routes';
import { getEntry, render } from 'astro:content';

export function getStaticPaths() {
  return getApartments().map(apt => ({ params: { slug: apt.slug.de }, props: { apartmentId: apt.id } }));
}
const locale: Locale = 'de';
const { apartmentId } = Astro.props;
const apt = getApartments().find(a => a.id === apartmentId)!;
const page = await getEntry('pages', `de/apartments/${apt.slug.de}`);
const { Content } = await render(page!);
const images = apartmentImages(apt.id);
const altHref = `/en/${apt.slug.en}`;
---
<Layout locale={locale} title={page!.data.title} description={page!.data.description ?? ''} currentPath={`/${apt.slug.de}`} altHref={altHref}>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="flex items-center gap-2 text-sm text-stone-400 mb-4">
      <a href={pagePath(locale, 'home')} class="hover:text-lake">Home</a><span>/</span><span>{page!.data.title}</span>
    </div>
    <h1 class="text-4xl font-bold text-stone-900 mb-4">{page!.data.title}</h1>
    {page!.data.description && <p class="text-xl text-stone-600 leading-relaxed mb-8">{page!.data.description}</p>}
    {images.length > 0 && (
      <div class="mb-10"><GalleryGrid images={images} alt={page!.data.title} locale={locale} /></div>
    )}
    <div class="prose prose-stone max-w-none mb-8"><Content /></div>
    <ApartmentFeatures apt={apt} locale={locale} />
    <PricingTable apt={apt} locale={locale} />
    <div class="mt-12 p-6 bg-lake/5 border border-lake/20 rounded-2xl text-center">
      <h3 class="text-xl font-semibold text-stone-900 mb-2">{t(locale, 'nav_interested')}</h3>
      <p class="text-stone-600 mb-4">{t(locale, 'nav_interested_text')}</p>
      <div class="flex flex-wrap gap-3 justify-center">
        <a href={pagePath(locale, 'availability')} class="px-6 py-3 rounded-lg bg-lake text-white font-medium hover:bg-lake-dark transition-colors">{t(locale, 'nav_check_availability')}</a>
        <a href={pagePath(locale, 'contact')} class="px-6 py-3 rounded-lg border border-lake text-lake font-medium hover:bg-lake hover:text-white transition-colors">{t(locale, 'nav_contact_us')}</a>
      </div>
    </div>
  </div>
</Layout>
```

> Note: the original showed a 1-big-hero + 4-thumbnail strip. Here the full gallery uses `GalleryGrid` (lightbox) for simplicity and parity with the photos page. If the implementer wants the exact hero+strip layout, that is a presentational refinement, not a behavioral change.

- [ ] **Step 2: Create `src/pages/en/[slug].astro`**

```astro
---
import type { Locale } from '@/lib/types';
import Layout from '@/layouts/Layout.astro';
import ApartmentFeatures from '@/components/ApartmentFeatures.astro';
import PricingTable from '@/components/PricingTable.astro';
import GalleryGrid from '@/components/GalleryGrid.astro';
import { t } from '@/lib/i18n';
import { getApartments } from '@/lib/apartments';
import { apartmentImages } from '@/lib/images';
import { pagePath } from '@/lib/routes';
import { getEntry, render } from 'astro:content';

export function getStaticPaths() {
  return getApartments().map(apt => ({ params: { slug: apt.slug.en }, props: { apartmentId: apt.id } }));
}
const locale: Locale = 'en';
const { apartmentId } = Astro.props;
const apt = getApartments().find(a => a.id === apartmentId)!;
const page = await getEntry('pages', `en/apartments/${apt.slug.en}`);
const { Content } = await render(page!);
const images = apartmentImages(apt.id);
const altHref = `/${apt.slug.de}`;
---
<Layout locale={locale} title={page!.data.title} description={page!.data.description ?? ''} currentPath={`/en/${apt.slug.en}`} altHref={altHref}>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="flex items-center gap-2 text-sm text-stone-400 mb-4">
      <a href={pagePath(locale, 'home')} class="hover:text-lake">Home</a><span>/</span><span>{page!.data.title}</span>
    </div>
    <h1 class="text-4xl font-bold text-stone-900 mb-4">{page!.data.title}</h1>
    {page!.data.description && <p class="text-xl text-stone-600 leading-relaxed mb-8">{page!.data.description}</p>}
    {images.length > 0 && (
      <div class="mb-10"><GalleryGrid images={images} alt={page!.data.title} locale={locale} /></div>
    )}
    <div class="prose prose-stone max-w-none mb-8"><Content /></div>
    <ApartmentFeatures apt={apt} locale={locale} />
    <PricingTable apt={apt} locale={locale} />
    <div class="mt-12 p-6 bg-lake/5 border border-lake/20 rounded-2xl text-center">
      <h3 class="text-xl font-semibold text-stone-900 mb-2">{t(locale, 'nav_interested')}</h3>
      <p class="text-stone-600 mb-4">{t(locale, 'nav_interested_text')}</p>
      <div class="flex flex-wrap gap-3 justify-center">
        <a href={pagePath(locale, 'availability')} class="px-6 py-3 rounded-lg bg-lake text-white font-medium hover:bg-lake-dark transition-colors">{t(locale, 'nav_check_availability')}</a>
        <a href={pagePath(locale, 'contact')} class="px-6 py-3 rounded-lg border border-lake text-lake font-medium hover:bg-lake hover:text-white transition-colors">{t(locale, 'nav_contact_us')}</a>
      </div>
    </div>
  </div>
</Layout>
```

- [ ] **Step 3: Build & verify apartment URLs**

Run: `npm run build && ls dist/dachgeschoss/index.html dist/gartenwohnung/index.html dist/erdgeschoss/index.html dist/en/penthouse/index.html dist/en/garden/index.html dist/en/ground-floor/index.html`
Expected: all six exist.

- [ ] **Step 4: Commit**

```bash
git add src/pages/\[slug\].astro src/pages/en/\[slug\].astro
git commit -m "feat: bilingual apartment detail pages with gallery, features, pricing"
```

---

## Task 15: Availability + Photos pages (de + en)

**Files:**
- Create: `src/pages/verfuegbarkeit.astro`, `src/pages/en/availability.astro`, `src/pages/fotos.astro`, `src/pages/en/photos.astro`

- [ ] **Step 1: Create `src/pages/verfuegbarkeit.astro`** (widget per visible apartment + pricing comparison + traum-fewo boot script)

```astro
---
import type { Locale } from '@/lib/types';
import Layout from '@/layouts/Layout.astro';
import AvailabilityWidget from '@/components/AvailabilityWidget.astro';
import PricingTable from '@/components/PricingTable.astro';
import { t } from '@/lib/i18n';
import { getVisibleApartments } from '@/lib/apartments';
import { apartmentPath } from '@/lib/routes';
import { getEntry, render } from 'astro:content';

const locale: Locale = 'de';
const page = await getEntry('pages', 'de/verfuegbarkeit');
const { Content } = await render(page!);
const apartments = getVisibleApartments();
const apartmentBodies = import.meta.glob('/src/content/de/apartments/*.md', { eager: true }) as Record<string, any>;
const titleOf = (apt: typeof apartments[number]) => apartmentBodies[`/src/content/de/apartments/${apt.slug.de}.md`].frontmatter.title as string;
---
<Layout locale={locale} title={page!.data.title} description={page!.data.description ?? ''} currentPath="/verfuegbarkeit" altHref="/en/availability">
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <h1 class="text-4xl font-bold text-stone-900 mb-4">{page!.data.title}</h1>
    <div class="prose prose-stone mb-8"><Content /></div>
    {apartments.map(apt => <AvailabilityWidget apt={apt} locale={locale} />)}
    <section class="mt-16">
      <h2 class="text-2xl font-semibold text-stone-900 mb-6">{t(locale, 'section_pricing')}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        {apartments.map(apt => (
          <div>
            <h3 class="text-lg font-semibold text-stone-800 mb-3"><a href={apartmentPath(locale, apt)} class="hover:text-lake">{titleOf(apt)}</a></h3>
            <PricingTable apt={apt} locale={locale} />
          </div>
        ))}
      </div>
    </section>
  </div>
  <script is:inline>
    !function(d,s,id){var js,fjs=d.getElementsByTagName(s)[0];if(!d.getElementById(id)){js=d.createElement(s);js.id=id;js.src="//www.traum-ferienwohnungen.de/widgets/boot.js";fjs.parentNode.insertBefore(js,fjs);}}(document,"script","traumfewo-widget-js");
  </script>
</Layout>
```

- [ ] **Step 2: Create `src/pages/en/availability.astro`** (same, English content + paths)

```astro
---
import type { Locale } from '@/lib/types';
import Layout from '@/layouts/Layout.astro';
import AvailabilityWidget from '@/components/AvailabilityWidget.astro';
import PricingTable from '@/components/PricingTable.astro';
import { t } from '@/lib/i18n';
import { getVisibleApartments } from '@/lib/apartments';
import { apartmentPath } from '@/lib/routes';
import { getEntry, render } from 'astro:content';

const locale: Locale = 'en';
const page = await getEntry('pages', 'en/availability');
const { Content } = await render(page!);
const apartments = getVisibleApartments();
const apartmentBodies = import.meta.glob('/src/content/en/apartments/*.md', { eager: true }) as Record<string, any>;
const titleOf = (apt: typeof apartments[number]) => apartmentBodies[`/src/content/en/apartments/${apt.slug.en}.md`].frontmatter.title as string;
---
<Layout locale={locale} title={page!.data.title} description={page!.data.description ?? ''} currentPath="/en/availability" altHref="/verfuegbarkeit">
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <h1 class="text-4xl font-bold text-stone-900 mb-4">{page!.data.title}</h1>
    <div class="prose prose-stone mb-8"><Content /></div>
    {apartments.map(apt => <AvailabilityWidget apt={apt} locale={locale} />)}
    <section class="mt-16">
      <h2 class="text-2xl font-semibold text-stone-900 mb-6">{t(locale, 'section_pricing')}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        {apartments.map(apt => (
          <div>
            <h3 class="text-lg font-semibold text-stone-800 mb-3"><a href={apartmentPath(locale, apt)} class="hover:text-lake">{titleOf(apt)}</a></h3>
            <PricingTable apt={apt} locale={locale} />
          </div>
        ))}
      </div>
    </section>
  </div>
  <script is:inline>
    !function(d,s,id){var js,fjs=d.getElementsByTagName(s)[0];if(!d.getElementById(id)){js=d.createElement(s);js.id=id;js.src="//www.traum-ferienwohnungen.de/widgets/boot.js";fjs.parentNode.insertBefore(js,fjs);}}(document,"script","traumfewo-widget-js");
  </script>
</Layout>
```

- [ ] **Step 3: Create `src/pages/fotos.astro`** (one gallery section per visible apartment)

```astro
---
import type { Locale } from '@/lib/types';
import Layout from '@/layouts/Layout.astro';
import GalleryGrid from '@/components/GalleryGrid.astro';
import { t } from '@/lib/i18n';
import { getVisibleApartments } from '@/lib/apartments';
import { apartmentImages } from '@/lib/images';
import { getEntry, render } from 'astro:content';

const locale: Locale = 'de';
const page = await getEntry('pages', 'de/fotos');
const apartments = getVisibleApartments();
const apartmentBodies = import.meta.glob('/src/content/de/apartments/*.md', { eager: true }) as Record<string, any>;
const titleOf = (apt: typeof apartments[number]) => apartmentBodies[`/src/content/de/apartments/${apt.slug.de}.md`].frontmatter.title as string;
---
<Layout locale={locale} title={page!.data.title} description={page!.data.description ?? ''} currentPath="/fotos" altHref="/en/photos">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <h1 class="text-4xl font-bold text-stone-900 mb-8">{page!.data.title}</h1>
    {apartments.map(apt => {
      const images = apartmentImages(apt.id);
      return (
        <section class="mb-16">
          <h2 class="text-2xl font-semibold text-stone-900 mb-6 flex items-center gap-3">
            {titleOf(apt)}
            {images.length > 0 && <span class="text-base font-normal text-stone-400">({images.length} {t(locale, 'nav_photos_count')})</span>}
          </h2>
          <GalleryGrid images={images} alt={titleOf(apt)} locale={locale} />
        </section>
      );
    })}
  </div>
</Layout>
```

- [ ] **Step 4: Create `src/pages/en/photos.astro`**

```astro
---
import type { Locale } from '@/lib/types';
import Layout from '@/layouts/Layout.astro';
import GalleryGrid from '@/components/GalleryGrid.astro';
import { t } from '@/lib/i18n';
import { getVisibleApartments } from '@/lib/apartments';
import { apartmentImages } from '@/lib/images';
import { getEntry } from 'astro:content';

const locale: Locale = 'en';
const page = await getEntry('pages', 'en/photos');
const apartments = getVisibleApartments();
const apartmentBodies = import.meta.glob('/src/content/en/apartments/*.md', { eager: true }) as Record<string, any>;
const titleOf = (apt: typeof apartments[number]) => apartmentBodies[`/src/content/en/apartments/${apt.slug.en}.md`].frontmatter.title as string;
---
<Layout locale={locale} title={page!.data.title} description={page!.data.description ?? ''} currentPath="/en/photos" altHref="/fotos">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <h1 class="text-4xl font-bold text-stone-900 mb-8">{page!.data.title}</h1>
    {apartments.map(apt => {
      const images = apartmentImages(apt.id);
      return (
        <section class="mb-16">
          <h2 class="text-2xl font-semibold text-stone-900 mb-6 flex items-center gap-3">
            {titleOf(apt)}
            {images.length > 0 && <span class="text-base font-normal text-stone-400">({images.length} {t(locale, 'nav_photos_count')})</span>}
          </h2>
          <GalleryGrid images={images} alt={titleOf(apt)} locale={locale} />
        </section>
      );
    })}
  </div>
</Layout>
```

- [ ] **Step 5: Build & verify**

Run: `npm run build && ls dist/verfuegbarkeit/index.html dist/en/availability/index.html dist/fotos/index.html dist/en/photos/index.html`
Expected: all four exist; `dist/verfuegbarkeit/index.html` contains `traumfewo-calendar`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/verfuegbarkeit.astro src/pages/en/availability.astro src/pages/fotos.astro src/pages/en/photos.astro
git commit -m "feat: availability (widget+pricing) and photos pages (de/en)"
```

---

## Task 16: Simple content pages + 404 (de + en)

**Files:**
- Create: `src/pages/kontakt.astro`, `src/pages/infos.astro`, `src/pages/impressum.astro`, `src/pages/datenschutz.astro`, `src/pages/en/contact.astro`, `src/pages/en/infos.astro`, `src/pages/404.astro`

All simple pages share one body shape (title + prose). To stay DRY, create one helper component first.

- [ ] **Step 1: Create `src/components/MarkdownPage.astro`**

```astro
---
import type { Locale } from '@/lib/types';
import Layout from '@/layouts/Layout.astro';
import { getEntry, render } from 'astro:content';
interface Props { locale: Locale; entryId: string; currentPath: string; altHref: string | null; }
const { locale, entryId, currentPath, altHref } = Astro.props;
const page = await getEntry('pages', entryId);
const { Content } = await render(page!);
---
<Layout locale={locale} title={page!.data.title} description={page!.data.description ?? ''} currentPath={currentPath} altHref={altHref}>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <h1 class="text-4xl font-bold text-stone-900 mb-8">{page!.data.title}</h1>
    <div class="prose prose-stone max-w-none"><Content /></div>
  </div>
</Layout>
```

- [ ] **Step 2: Create the seven page files** (each is a thin wrapper)

`src/pages/kontakt.astro`:
```astro
---
import MarkdownPage from '@/components/MarkdownPage.astro';
---
<MarkdownPage locale="de" entryId="de/kontakt" currentPath="/kontakt" altHref="/en/contact" />
```

`src/pages/infos.astro`:
```astro
---
import MarkdownPage from '@/components/MarkdownPage.astro';
---
<MarkdownPage locale="de" entryId="de/infos" currentPath="/infos" altHref="/en/infos" />
```

`src/pages/impressum.astro`:
```astro
---
import MarkdownPage from '@/components/MarkdownPage.astro';
---
<MarkdownPage locale="de" entryId="de/impressum" currentPath="/impressum" altHref={null} />
```

`src/pages/datenschutz.astro`:
```astro
---
import MarkdownPage from '@/components/MarkdownPage.astro';
---
<MarkdownPage locale="de" entryId="de/datenschutz" currentPath="/datenschutz" altHref={null} />
```

`src/pages/en/contact.astro`:
```astro
---
import MarkdownPage from '@/components/MarkdownPage.astro';
---
<MarkdownPage locale="en" entryId="en/contact" currentPath="/en/contact" altHref="/kontakt" />
```

`src/pages/en/infos.astro`:
```astro
---
import MarkdownPage from '@/components/MarkdownPage.astro';
---
<MarkdownPage locale="en" entryId="en/infos" currentPath="/en/infos" altHref="/infos" />
```

- [ ] **Step 3: Create `src/pages/404.astro`** (German 404, from `layouts/404.html`)

```astro
---
import Layout from '@/layouts/Layout.astro';
import { t } from '@/lib/i18n';
import { pagePath } from '@/lib/routes';
---
<Layout locale="de" title="404" description="" currentPath="/404" altHref={null}>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
    <h1 class="text-6xl font-bold text-stone-300 mb-4">404</h1>
    <p class="text-xl text-stone-600 mb-8">{t('de', 'error_404_text')}</p>
    <a href={pagePath('de', 'home')} class="px-6 py-3 rounded-lg bg-lake text-white font-medium hover:bg-lake-dark transition-colors">{t('de', 'error_404_home')}</a>
  </div>
</Layout>
```

- [ ] **Step 4: Build & verify**

Run: `npm run build && ls dist/kontakt/index.html dist/infos/index.html dist/impressum/index.html dist/datenschutz/index.html dist/en/contact/index.html dist/en/infos/index.html dist/404.html`
Expected: all exist.

- [ ] **Step 5: Commit**

```bash
git add src/components/MarkdownPage.astro src/pages/kontakt.astro src/pages/infos.astro src/pages/impressum.astro src/pages/datenschutz.astro src/pages/en/contact.astro src/pages/en/infos.astro src/pages/404.astro
git commit -m "feat: contact/infos/legal pages (de/en) + 404"
```

---

## Task 17: Redirects, robots.txt, sitemap config

**Files:**
- Modify: `astro.config.mjs` (add `redirects`)
- Create: `public/robots.txt`

- [ ] **Step 1: Add `redirects` to `astro.config.mjs`** — insert this key into the `defineConfig({...})` object (e.g. after `i18n`):

```js
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
```

- [ ] **Step 2: Create `public/robots.txt`**

```
User-agent: *
Allow: /

Sitemap: https://zaucker.com/sitemap-index.xml
```

- [ ] **Step 3: Build & verify redirects + sitemap emitted**

Run: `npm run build && ls dist/4-zi-dg/index.html dist/sitemap-index.xml dist/robots.txt`
Expected: all exist; `dist/4-zi-dg/index.html` contains a redirect to `/dachgeschoss`.

- [ ] **Step 4: Commit**

```bash
git add astro.config.mjs public/robots.txt
git commit -m "feat: legacy-URL redirects, robots.txt, sitemap"
```

---

## Task 18: Remove Hugo, update deploy, final verification

**Files:**
- Delete: `hugo.toml`, `layouts/`, `i18n/` (root), `data/` (root), `content/` (root), `static/`, `mise.toml` (Hugo tools), `.hugo_build.lock`, `public/` (old Hugo output), `deploy.sh~`, `package-lock.json` stale entries (regenerated)
- Modify: `deploy.sh`, `mise.toml`

- [ ] **Step 1: Update `deploy.sh`** to rsync `dist/`

```bash
#! /bin/bash
set -euo pipefail
npm run build
rsync -avr --delete dist/ zaucker@web-volki-01-adm:public_html/zaucker.com/
```

> `--delete` removes stale files server-side. Confirm with Fritz before first use; remove the flag if the target dir is shared.

- [ ] **Step 2: Update `mise.toml`** (drop Hugo/sass, keep Node)

```toml
[tools]
node = "24.9.0"
```

- [ ] **Step 3: Remove Hugo artifacts now that nothing references them**

Run:
```bash
git rm -r --cached hugo.toml layouts i18n data content static .hugo_build.lock deploy.sh~ 2>/dev/null
rm -rf hugo.toml layouts i18n data content static .hugo_build.lock deploy.sh~ public resources
```
> `src/i18n`, `src/data`, `src/content` are kept — only the **root** copies are removed.

- [ ] **Step 4: Full clean build + test**

Run: `npm test && npm run build`
Expected: all vitest tests pass; build succeeds.

- [ ] **Step 5: Verify the full URL set**

Run:
```bash
find dist -name '*.html' | sed 's|^dist||' | sort
```
Expected (at least): `/index.html`, `/dachgeschoss/`, `/gartenwohnung/`, `/erdgeschoss/`, `/verfuegbarkeit/`, `/fotos/`, `/kontakt/`, `/infos/`, `/impressum/`, `/datenschutz/`, `/404.html`, and the `/en/...` mirror, plus redirect stubs for old URLs.

- [ ] **Step 6: Visual smoke test with the dev server** (use the `run` or `webapp-testing` skill)

Run: `npm run preview` and check in a browser / Playwright:
- Home (de + en): hero, 4 highlights, 2 apartment cards with images.
- Apartment page: gallery opens lightbox; arrow keys + Esc work; features + pricing render.
- `/verfuegbarkeit`: traum-fewo calendar widget loads; pricing comparison shows.
- `/fotos`: galleries per apartment, counts correct (10 + 8).
- Language switcher toggles between matching de/en pages.
- Mobile menu toggles at narrow width.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove Hugo, deploy dist/, finalize Phase 1 port"
```

---

## Self-review notes (addressed)

- **Spec coverage:** tech stack (T1–T2), i18n (T4), data abstraction (T5), routes/redirects (T6, T17), images (T7), content (T8), all components (T9–T12), all pages incl. hidden apartment via `getApartments` in `getStaticPaths` (T13–T16), traum-fewo widget (T12/T15), Svelte lightbox (T11), SEO meta/canonical/hreflang (T9 Head + Layout), sitemap/robots (T17), static rsync deploy (T18). Covered.
- **Hidden apartment:** `erdgeschoss`/`ground-floor` builds (in `getStaticPaths` via `getApartments`) but is excluded from nav, homepage, photos, and availability (those use `getVisibleApartments`). Matches `hidden: true`.
- **Naming consistency:** `Locale`, `Apartment`, `getApartments/getVisibleApartments/getApartment/getApartmentBySlug`, `pagePath/apartmentPath/getNav`, `apartmentImages`, entry ids `de/...`/`en/...` are used identically across all tasks.
- **Known refinement (non-blocking):** the apartment detail gallery uses `GalleryGrid` rather than the original 1-hero+4-thumb strip; behavior (lightbox) matches, layout is a minor presentational choice left to the implementer.
- **Footer year** is a build-time constant (no runtime clock in a static build); bump when rebuilding across a year boundary.
