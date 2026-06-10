# Phase 2 (Step 1) — Aggregated Availability Calendar

**Date:** 2026-06-10
**Status:** Approved design, ready for implementation planning
**Scope:** Read-only aggregated availability calendar. Steps 2 (local
reservations + push) and 3 (bidirectional remote sync) are explicitly out of
scope here but the architecture is shaped to grow into them.

## Goal

Replace the embedded traum-ferienwohnungen JS widget on the availability page
with our own calendar. For each apartment, show a 12-month grid where each day
is **free** or **booked**, where "booked" is the merged union of the apartment's
Airbnb and traum-ferienwohnungen iCal feeds.

## Context

- The public site is a fully static Astro build (`dist/` rsynced to
  `web-volki-01-adm`, served behind a proxy). No backend today.
- Apartments carry a `traumfw_id` in `src/data/apartments/*.yaml`. Both
  apartments (`4_zi_dg`, `3_zi_ug`) are listed on **both** Airbnb and traum, and
  the owner has the `.ics` export URL for each.
- Today's cross-sync is one-directional iCal: traum is the booking "master" and
  Airbnb imports traum's `.ics`. The reverse fails by design — if traum imports
  an external calendar, it disables booking entry in its own UI. This is the
  central tension for the later bidirectional step, and the best argument for our
  own app eventually becoming the master (out of scope here).

## Non-goals (this step)

Creating/storing reservations; publishing our own `.ics`; pushing to
Airbnb/traum; any auth/admin UI; per-night pricing in the grid; a combined
cross-apartment view. Listed so they bolt on later without rework.

## Architecture (Approach A: static site + separate API service)

Three moving parts:

1. **`server/` — a new Fastify + TypeScript service** (subdirectory in this
   repo, its own `package.json`). Runs on `web-volki-01-adm` under **systemd**
   (auto-restart on crash/reboot), listening on `localhost:4317`.
2. **Proxy rule** — the proxy routes `/api/*` to `localhost:4317`; all other
   paths keep serving the static site as now.
3. **`AvailabilityCalendar.svelte`** — a client island on the availability page
   that calls `/api/availability/:aptId` and paints the grid. The static site's
   build/deploy is otherwise unchanged.

The public site keeps its static resilience, caching, and SEO. The service is
isolated, independently testable, and is the seed of the future reservations
backend.

### Repo layout

```
zaucker.com/
  src/...                  # existing static site (unchanged build/deploy)
  server/                  # NEW — the calendar service
    package.json           # own deps: fastify, node-ical
    src/
      index.ts             # Fastify app + routes
      sync.ts              # poll + parse + merge feeds
      config.ts            # loads apartment -> feed-URL map
    config.local.json      # NEW (gitignored) — the secret .ics URLs
    config.example.json    # committed template
    .cache/                # NEW (gitignored) — on-disk snapshot
    test/...               # vitest: parse + merge fixtures
  deploy.sh                # static deploy (unchanged)
  deploy-server.sh         # NEW — ship + restart the service
```

### Deploy model

Two independent deploys that never block each other:

- **Static site:** `./deploy.sh` (rsync `dist/`), as today.
- **Service:** `./deploy-server.sh` — rsync `server/`, `npm ci`, `tsc`,
  `systemctl restart` the unit.

### Secrets

The Airbnb (and traum) `.ics` URLs carry private tokens. They live **only** in
`server/config.local.json` on the server — never committed, never in static HTML.

## Config

`server/config.local.json` (gitignored), with a committed `config.example.json`
documenting the shape:

```json
{
  "refreshMinutes": 30,
  "apartments": {
    "4_zi_dg": {
      "airbnb": "https://www.airbnb.com/calendar/ical/12345.ics?s=…",
      "traum":  "https://www.traum-ferienwohnungen.de/.../export.ics"
    },
    "3_zi_ug": { "airbnb": "https://…", "traum": "https://…" }
  }
}
```

Apartment ids match the existing YAML. A missing/empty feed URL means that source
is skipped for that apartment.

## API contract

`GET /api/availability/:aptId`:

```json
{
  "apartmentId": "4_zi_dg",
  "updatedAt": "2026-06-10T08:00:00Z",
  "stale": false,
  "busy": [
    { "from": "2026-07-01", "to": "2026-07-08" },
    { "from": "2026-08-12", "to": "2026-08-19" }
  ]
}
```

- `busy` = merged booked ranges, **half-open `[from, to)`**: `to` is the checkout
  day and is **available** for a new check-in (matches iCal `DTEND` semantics and
  hospitality turnover). `2026-07-01 … 2026-07-08` = booked nights 1st–7th; the
  8th is free.
- `stale: true` means a feed fetch failed and we're serving last-good cache.
- Unknown `aptId` -> `404`.
- Returns **only dates** — guest names/summaries are discarded server-side; no PII
  leaves the service.

## Merge semantics

1. From each feed, take all-day `VEVENT`s -> `[DTSTART, DTEND)` night ranges.
2. **Union** Airbnb + traum ranges; merge overlapping **and** adjacent ranges
   (Airbnb 1–8 ∪ traum 5–12 -> 1–12).
3. Clip to the window: today -> +12 months (drop past/distant events).

## Sync & resilience

- A background timer refreshes every `refreshMinutes` (default 30). Requests are
  served **from cache** — never a live external fetch in the request path, so the
  API is always fast.
- Each feed fetch has a ~10s timeout. If one feed fails, keep its last-good data
  and mark the merged result `stale`; the other feed still updates.
- The merged result is persisted to `server/.cache/availability.json` so a
  restart serves immediately, before the first poll completes.
- Malformed iCal: log and skip the offending event, don't fail the whole feed.

## Frontend widget

`AvailabilityCalendar.svelte`, one instance per apartment on the availability
page:

- On mount, fetches `/api/availability/:aptId` (same origin via proxy — no CORS).
- Renders **12 months** from the current month in a responsive grid (1 month/col
  on mobile -> 3 on desktop). Each day is **free** or **booked** (booked = the day
  falls in a merged `[from, to)` range).
- **States:** loading skeleton -> calendar on success; if the API is
  unreachable, a graceful error line so the page never looks broken.
- A small **legend** (frei / belegt) and an optional subtle "Stand: …" freshness
  note reflecting the API `stale`/`updatedAt`.
- Styled in the site design system. Exact free/booked colors are dialed in with
  screenshots during implementation (likely a muted fill for booked vs. clean
  sand for free, not the old widget's loud green/red).

This **replaces** the embedded traum JS widget and its `<script>` in both
`verfuegbarkeit.astro` and `en/availability.astro`.

### Dev experience

In `npm run dev`, a Vite dev-proxy forwards `/api` -> `localhost:4317`, so the
service runs locally and the island works against it. New i18n keys:
`avail_free`, `avail_booked`, `avail_loading`, `avail_error`, `avail_updated`.

## Testing

- **Service (vitest):** parse `.ics` fixtures -> night ranges; union/adjacent
  merge; 12-month clip; stale-on-fetch-failure. Fixtures mimic real Airbnb- and
  traum-style exports.
- **Frontend (vitest):** the pure grid helpers — `buildMonths(today)` and
  `isBooked(day, ranges)` — unit-tested; Svelte rendering kept thin on top.

## Addendum (2026-06-10): half-day rendering

After seeing the first version, the owner asked the calendar to match the old
traum widget's **half-day triangles** so a same-day turnover between two guests is
visible. This changed two things from the original "free/booked only" plan:

- **The service keeps bookings individual** (deduped across feeds, but NOT
  merged): `Availability.bookings: Range[]` replaces the merged `busy`. Each
  booking is half-open `[from=checkin, to=checkout)`. Exact duplicates (the same
  booking mirrored into both feeds) are removed via `dedupeRanges`.
- **The UI classifies each day** with `dayState(day, bookings)` →
  `free | full | checkin | checkout | turnover`:
  - am occupied ⇔ ∃ booking `from < day ≤ to`; pm occupied ⇔ ∃ `from ≤ day < to`;
    interior ⇔ ∃ `from < day < to`.
  - `full` (interior) = solid; `checkin` = afternoon (lower-right triangle);
    `checkout` = morning (upper-left triangle); `turnover` (a checkout AND a
    different check-in on the same day) = both triangles.
  - Triangles are drawn with a diagonal `linear-gradient` split along the
    anti-diagonal, stopping just short of centre (booked to 47% / from 53%, a
    46–54% gap for turnovers) so a turnover shows two distinct triangles with a
    thin free sliver between them.

## How this grows (later phases, not now)

The same service later gains `POST /reservations`, a SQLite store, and
`GET /calendar/:apt.ics` (a combined feed both platforms import) — making our app
the booking master and resolving the traum import-disables-booking tension.
