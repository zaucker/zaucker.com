# Phase 1 — Astro/Svelte port of zaucker.com

**Date:** 2026-06-09
**Status:** Approved design, ready for implementation planning
**Author:** Fritz Zaucker (with Claude)

## Overview

Port the existing Hugo site **zaucker.com** ("Ferienwohnungen Zaucker" — holiday
apartments in Überlingen am Bodensee) to **Astro + Svelte + Tailwind CSS v4** as a
faithful 1:1 migration of the current content and design, with a **cleaned-up URL
structure**. The existing third-party availability calendar
(traum-ferienwohnungen.de widget) is carried over unchanged.

This is the first of several milestones. It stands alone and, on completion,
**replaces the current live site** as a drop-in static build deployed exactly as
today (rsync). Later phases (own iCal calendar sync, booking form, price
calculator, admin GUI) build on the foundation laid here but are **out of scope**
for Phase 1.

## Goals

- Reproduce the current site's content, layout, and visual design in Astro.
- Bilingual (German default, English) — reuse existing translations verbatim.
- Clean, descriptive URL structure (old URLs redirected).
- Wire up the Svelte integration (proven via a photo-gallery lightbox island) so
  later interactive phases have it ready.
- Keep the data-access path open for a future admin GUI + database, without
  building either now.
- Static build, deployed via rsync — same workflow and server as today.

## Non-goals (deferred to later phases)

- Own iCal calendar sync / aggregated availability (Airbnb, traum-fewo, etc.).
- Booking / inquiry form.
- Price / availability calculator.
- Admin GUI and database persistence.
- Any always-on server process / SSR (Phase 1 is fully static).

## Architecture & tech stack

| Concern | Choice |
|---------|--------|
| Framework | **Astro 5**, `output: 'static'` → builds to `dist/`, rsynced like current `public/` |
| Interactive islands | **`@astrojs/svelte`** (Svelte 5) — wired up now, ready for later phases |
| Styling | **Tailwind CSS v4** via `@tailwindcss/vite`, reusing existing design tokens |
| Images | **`astro:assets`** (sharp) replacing Hugo's `Fill`/`Fit` Lanczos pipeline |
| Availability | Existing **traum-ferienwohnungen.de widget** include, unchanged |
| Fonts | Inter (Google Fonts), as today |

**Design tokens carried over verbatim:** `--color-lake: #2c7bb6`,
`--color-lake-dark: #1a5276`, `--color-alpine: #27ae60`, the stone palette, Inter
font family. Tailwind v4 `@theme` block in the main CSS entry replaces the
hand-compiled `static/css/main.css`.

## URL structure

German is the default language and lives at the **root**; English lives under
**`/en/`**. Apartment pages use **flat, descriptive, localized slugs**.

### German (root)

| Path | Page |
|------|------|
| `/` | Home |
| `/dachgeschoss` | 4-Zi Dachgeschoss apartment |
| `/gartenwohnung` | 3-Zi Gartenwohnung apartment |
| `/erdgeschoss` | 3-Zi Erdgeschoss apartment (**hidden** — page exists, not listed/nav) |
| `/verfuegbarkeit` | Availability & prices (traum-fewo widget) |
| `/fotos` | Photos |
| `/kontakt` | Contact |
| `/infos` | Infos / local tips |
| `/impressum` | Legal notice (German only) |
| `/datenschutz` | Privacy policy (German only) |

### English (`/en/`)

| Path | Page |
|------|------|
| `/en/` | Home |
| `/en/penthouse` | 4-room penthouse |
| `/en/garden` | 3-room garden apartment |
| `/en/ground-floor` | 3-room ground floor (**hidden**) |
| `/en/availability` | Availability & prices |
| `/en/photos` | Photos |
| `/en/contact` | Contact |
| `/en/infos` | Infos / local tips |

Legal pages (Impressum/Datenschutz) remain German-only and are linked from both
language footers, matching current behavior.

### Redirects (old → new)

Emitted via Astro's `redirects` config (static redirect pages) and/or configured
at the web server. Old URLs not listed here are unchanged.

| Old | New |
|-----|-----|
| `/4-zi-dg/` | `/dachgeschoss` |
| `/3-zi-ug/` | `/gartenwohnung` |
| `/3-zi-eg/` | `/erdgeschoss` |
| `/de/` | `/` |
| `/en/4-zi-dg/` | `/en/penthouse` |
| `/en/3-zi-ug/` | `/en/garden` |
| `/en/3-zi-eg/` | `/en/ground-floor` |
| `/en/fotos/` | `/en/photos` |

(`/verfuegbarkeit`, `/fotos`, `/kontakt`, `/infos`, `/impressum`, `/datenschutz`,
`/en/availability`, `/en/contact`, `/en/infos` keep their paths.)

## Internationalization (i18n)

- Astro i18n config: `locales: ['de','en']`, `defaultLocale: 'de'`,
  `routing: { prefixDefaultLocale: false }`.
- **UI strings**: the existing `i18n/de.yaml` and `i18n/en.yaml` are reused
  verbatim through a small `t(locale, key)` helper (`src/lib/i18n.ts`). Keys carry
  over unchanged (e.g. `feat_wifi`, `season_high`, `nav_details`).
- **Page content** is authored per-locale in content collections (below).
- Language switcher in the header links the current page to its counterpart in the
  other language (via the slug map).

## Content & data model

Two distinct sources, both abstracted so pages never read files directly.

### 1. Page content → Astro Content Collections

The Markdown bodies currently in `content/{de,en}/**/index.md` become content
collection entries (one per page per locale). Frontmatter carries `title`,
`description`, and `translationKey` (links a page to its other-language
counterpart).

### 2. Apartment config → YAML behind a data-access module

Apartment specs/features/pricing stay in YAML (currently
`data/apartments/*.yaml`). Pages access them **only** through
`src/lib/apartments.ts`:

```
getApartments(): Apartment[]          // visible + hidden, with `hidden` flag
getVisibleApartments(): Apartment[]
getApartment(id): Apartment | null
```

This module is the single seam. A future admin GUI + SQLite (Phase 3+) replaces
the YAML reader inside this module without touching any page or component — this
is the "keep the path open" requirement.

Each apartment gains a **localized slug map** (so URLs and the language switcher
resolve correctly), e.g.:

```yaml
id: "4_zi_dg"
slug:
  de: "dachgeschoss"
  en: "penthouse"
```

## Components

Astro components mirror the current Hugo partials 1:1 (same markup and Tailwind
classes):

| Astro component | Replaces (Hugo) |
|-----------------|-----------------|
| `Layout.astro` (base) | `_default/baseof.html` |
| `Head.astro` | `partials/head.html` |
| `Header.astro` | `partials/header.html` (nav, lang switch, mobile menu) |
| `Footer.astro` | `partials/footer.html` |
| `ApartmentCard.astro` | `partials/apartment-card.html` |
| `ApartmentFeatures.astro` | `partials/apartment-features.html` |
| `PricingTable.astro` | `partials/pricing-table.html` |
| `GalleryGrid.astro` | `partials/gallery-grid.html` |
| `AvailabilityWidget.astro` | `partials/availability-widget.html` |
| `Lightbox.svelte` | GLightbox CDN script |

Page templates (`index.astro`, apartment, `verfuegbarkeit`, `fotos`, default
single) reproduce the current `layouts/` templates.

The mobile-menu toggle (currently inline JS in `baseof.html`) becomes a tiny
Svelte island or scoped `<script>`.

## Images

- Apartment images (currently co-located in `content/{de,en}/<apt>/images/`) move
  to a location `astro:assets` can process (e.g. `src/assets/apartments/<id>/`),
  imported and rendered with `<Image>` / `<Picture>`.
- Reproduce the current responsive variants: card hero (~800×500), detail hero
  (~1200×600), thumbnails (~400×300/400×250), lightbox full (fit ~1600×1200),
  quality ~85–90. sharp replaces Lanczos; visual parity is the target.

## Photo gallery / lightbox (Svelte island)

A `Lightbox.svelte` component replaces GLightbox:

- Renders the existing gallery grid; clicking a thumbnail opens a fullscreen
  overlay with the large image.
- Keyboard (←/→/Esc), touch swipe, prev/next, loop — matching GLightbox behavior
  used today.
- Grouped by album/apartment (the `data-gallery` grouping today).
- Hydrated with `client:visible`.

No CDN dependency; this also validates the Svelte build pipeline for later phases.

## Styling

- Tailwind v4 via `@tailwindcss/vite`, single CSS entry with an `@theme` block
  defining the custom tokens (`lake`, `lake-dark`, `alpine`).
- `prose` styling for Markdown content (Tailwind typography plugin or equivalent
  scoped styles) to match current `prose prose-stone`.
- Keep the small custom CSS (gallery hover, smooth scroll, widget min-height).

## Build & deploy

- `astro build` → `dist/`.
- `deploy.sh` updated to rsync `dist/` (instead of `public/`) to
  `zaucker@web-volki-01-adm:public_html/zaucker.com/`.
- No server process, no scheduled job in Phase 1 — identical operational model to
  today.
- `mise.toml` / toolchain: drop Hugo, keep Node; add Astro/Svelte/Tailwind via
  `package.json`.

## Proposed project structure

```
src/
  assets/apartments/<id>/*.jpg     # processed by astro:assets
  components/
    Head.astro Header.astro Footer.astro
    ApartmentCard.astro ApartmentFeatures.astro PricingTable.astro
    GalleryGrid.astro AvailabilityWidget.astro
    Lightbox.svelte
  layouts/Layout.astro
  content/                          # content collections (de/en page bodies)
  data/apartments/*.yaml            # apartment config (moved from /data)
  lib/
    apartments.ts                   # data-access seam (YAML now, DB later)
    i18n.ts                         # t(locale, key) over de.yaml/en.yaml
    slugs.ts                        # locale slug <-> page resolution
  pages/
    index.astro                     # de home
    [apartment].astro or explicit   # de apartment pages
    verfuegbarkeit.astro fotos.astro kontakt.astro infos.astro
    impressum.astro datenschutz.astro
    en/ ...                         # english mirror
  styles/global.css                 # tailwind v4 @theme + custom CSS
astro.config.mjs                    # i18n, redirects, integrations
```

(Exact page-routing mechanism — explicit per-locale `.astro` files vs. dynamic
routes driven by collections — to be settled in the implementation plan; ~9 pages
× 2 locales is small enough for either.)

## Risks & open questions

- **Image parity**: sharp output differs subtly from Hugo/Lanczos; aim for visual
  parity, not byte-identical. Verify hero/thumbnail crops look right.
- **Localized routing**: Astro i18n with localized (non-mirrored) slugs needs a
  deliberate slug map; the language switcher must resolve cross-locale via
  `translationKey` + slug map.
- **Redirects**: confirm whether redirects are emitted by Astro (static redirect
  pages) or configured at the web server (nginx/Apache) — likely the latter is
  cleaner for true 301s; document the mapping either way.
- **Hidden apartment** (`erdgeschoss`/`ground-floor`): page builds and is
  reachable by URL but excluded from nav, homepage cards, photos, and availability
  listings — same as today's `hidden: true`.

## Definition of done (Phase 1)

- All pages above render in both languages with content/design matching current
  site.
- Clean URLs live; old URLs redirect.
- Photo galleries open in the Svelte lightbox; apartment galleries grouped.
- traum-fewo availability widget works on `/verfuegbarkeit` and `/en/availability`.
- Language switcher, mobile menu, footer, SEO meta (canonical, hreflang, OG) all
  function.
- `astro build` produces a static `dist/`; `deploy.sh` rsyncs it successfully.
```
