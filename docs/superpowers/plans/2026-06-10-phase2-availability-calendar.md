# Aggregated Availability Calendar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the embedded traum-ferienwohnungen JS widget with our own per-apartment 12-month free/booked calendar, fed by a small backend service that merges each apartment's Airbnb + traum iCal feeds.

**Architecture:** The public site stays a static Astro build. A new isolated Fastify+TypeScript service in `server/` polls the iCal feeds on a timer, merges them into half-open busy ranges, caches the result (memory + on-disk snapshot), and serves `GET /api/availability/:aptId`. A Svelte island on the availability page fetches that JSON and paints the grid. The proxy routes `/api/*` to the service; in dev, a Vite proxy does the same.

**Tech Stack:** Node 20+ (built-in `fetch`), Fastify 5, `node-ical`, TypeScript (NodeNext ESM), vitest (server + frontend), Svelte 5 island, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-06-10-phase2-availability-calendar-design.md`

---

## File Structure

**New — server (`server/`):**
- `server/package.json`, `server/tsconfig.json`, `server/.gitignore`
- `server/config.example.json` (committed), `server/config.local.json` (gitignored, secrets)
- `server/src/types.ts` — shared types
- `server/src/dates.ts` — YMD + window helpers
- `server/src/merge.ts` — union/adjacent merge + clip
- `server/src/ical.ts` — parse `.ics` → busy ranges
- `server/src/sync.ts` — `buildAvailability` (fetch + parse + merge, per-feed last-good)
- `server/src/store.ts` — on-disk snapshot read/write
- `server/src/config.ts` — load config
- `server/src/index.ts` — `createApp` (route) + `main` (startup + poll loop)
- `server/test/*.test.ts` — vitest
- `server/deploy/zaucker-calendar.service` — systemd unit
- `deploy-server.sh` (repo root) — ship + restart the service

**New — frontend:**
- `src/lib/availability.ts` — pure grid helpers + types
- `src/lib/availability.test.ts` — vitest
- `src/components/AvailabilityCalendar.svelte` — island

**Modified:**
- `src/pages/verfuegbarkeit.astro`, `src/pages/en/availability.astro` — replace widget with island
- `src/i18n/de.yaml`, `src/i18n/en.yaml` — new `avail_*` keys
- `astro.config.mjs` — Vite dev proxy for `/api`
- `.gitignore` — ignore `server/` build/secret artifacts

**Deleted:**
- `src/components/AvailabilityWidget.astro` (the old traum widget)

---

## Task 1: Server scaffold

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/.gitignore`, `server/config.example.json`, `server/src/types.ts`
- Modify: `.gitignore` (repo root)

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "zaucker-calendar",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "fastify": "^5.2.0",
    "node-ical": "^0.20.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

> Note: NodeNext ESM means **intra-package imports use `.js` extensions** (e.g. `import { mergeRanges } from './merge.js'`) even though the source files are `.ts`. This is intentional and required.

- [ ] **Step 3: Create `server/.gitignore`**

```
node_modules/
dist/
.cache/
config.local.json
```

- [ ] **Step 4: Create `server/config.example.json`**

```json
{
  "refreshMinutes": 30,
  "apartments": {
    "4_zi_dg": {
      "airbnb": "https://www.airbnb.com/calendar/ical/REPLACE.ics?s=REPLACE",
      "traum": "https://www.traum-ferienwohnungen.de/REPLACE/export.ics"
    },
    "3_zi_ug": {
      "airbnb": "https://www.airbnb.com/calendar/ical/REPLACE.ics?s=REPLACE",
      "traum": "https://www.traum-ferienwohnungen.de/REPLACE/export.ics"
    }
  }
}
```

- [ ] **Step 5: Create `server/src/types.ts`**

```ts
export interface FeedUrls {
  airbnb?: string;
  traum?: string;
}

export interface Config {
  refreshMinutes: number;
  apartments: Record<string, FeedUrls>;
}

/** Half-open booked night range [from, to): `to` (checkout day) is free. */
export interface Range {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD (exclusive)
}

export interface Availability {
  apartmentId: string;
  updatedAt: string; // ISO timestamp
  stale: boolean;
  busy: Range[];
}
```

- [ ] **Step 6: Add `server/` artifacts to repo-root `.gitignore`**

Append to `.gitignore`:

```
# calendar service build/secret artifacts
server/node_modules/
server/dist/
server/.cache/
server/config.local.json
```

- [ ] **Step 7: Install deps and verify typecheck**

Run: `cd server && npm install && npm run typecheck`
Expected: installs cleanly; `tsc --noEmit` exits 0 (only `types.ts` exists so far — no errors).

- [ ] **Step 8: Commit**

```bash
git add server/package.json server/tsconfig.json server/.gitignore server/config.example.json server/src/types.ts .gitignore
git commit -m "feat(server): scaffold calendar service (package, tsconfig, types, config template)"
```

---

## Task 2: Date helpers

**Files:**
- Create: `server/src/dates.ts`
- Test: `server/test/dates.test.ts`

- [ ] **Step 1: Write the failing test**

`server/test/dates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ymd, windowStart, windowEnd } from '../src/dates.js';

describe('dates', () => {
  it('formats a Date as YYYY-MM-DD using local components', () => {
    expect(ymd(new Date(2026, 6, 1))).toBe('2026-07-01'); // month is 0-based: 6 = July
    expect(ymd(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('windowStart is the first day of the current month', () => {
    expect(windowStart(new Date(2026, 6, 15))).toBe('2026-07-01');
  });

  it('windowEnd is the first day of the month `count` months later', () => {
    expect(windowEnd(new Date(2026, 6, 15), 12)).toBe('2027-07-01');
    expect(windowEnd(new Date(2026, 11, 1), 12)).toBe('2027-12-01');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run test/dates.test.ts`
Expected: FAIL — cannot find module `../src/dates.js`.

- [ ] **Step 3: Write minimal implementation**

`server/src/dates.ts`:

```ts
/** Format a Date as YYYY-MM-DD from its local calendar components. */
export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** First day of the month containing `now`. */
export function windowStart(now: Date): string {
  return ymd(new Date(now.getFullYear(), now.getMonth(), 1));
}

/** First day of the month `count` months after the month containing `now`. */
export function windowEnd(now: Date, count: number): string {
  return ymd(new Date(now.getFullYear(), now.getMonth() + count, 1));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run test/dates.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/dates.ts server/test/dates.test.ts
git commit -m "feat(server): date + 12-month-window helpers"
```

---

## Task 3: Merge + clip logic

**Files:**
- Create: `server/src/merge.ts`
- Test: `server/test/merge.test.ts`

- [ ] **Step 1: Write the failing test**

`server/test/merge.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mergeRanges, clipRanges } from '../src/merge.js';

describe('mergeRanges', () => {
  it('merges overlapping ranges', () => {
    expect(mergeRanges([
      { from: '2026-07-01', to: '2026-07-08' },
      { from: '2026-07-05', to: '2026-07-12' },
    ])).toEqual([{ from: '2026-07-01', to: '2026-07-12' }]);
  });

  it('merges adjacent ranges (to === next.from)', () => {
    expect(mergeRanges([
      { from: '2026-07-01', to: '2026-07-08' },
      { from: '2026-07-08', to: '2026-07-10' },
    ])).toEqual([{ from: '2026-07-01', to: '2026-07-10' }]);
  });

  it('keeps disjoint ranges and sorts them', () => {
    expect(mergeRanges([
      { from: '2026-08-01', to: '2026-08-03' },
      { from: '2026-07-01', to: '2026-07-03' },
    ])).toEqual([
      { from: '2026-07-01', to: '2026-07-03' },
      { from: '2026-08-01', to: '2026-08-03' },
    ]);
  });

  it('absorbs a fully nested range', () => {
    expect(mergeRanges([
      { from: '2026-07-01', to: '2026-07-20' },
      { from: '2026-07-05', to: '2026-07-08' },
    ])).toEqual([{ from: '2026-07-01', to: '2026-07-20' }]);
  });
});

describe('clipRanges', () => {
  it('trims ranges to the window and drops those fully outside', () => {
    expect(clipRanges(
      [
        { from: '2026-06-20', to: '2026-07-05' }, // straddles start
        { from: '2026-07-10', to: '2026-07-12' }, // inside
        { from: '2026-05-01', to: '2026-05-10' }, // before window
      ],
      '2026-07-01', '2026-08-01',
    )).toEqual([
      { from: '2026-07-01', to: '2026-07-05' },
      { from: '2026-07-10', to: '2026-07-12' },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run test/merge.test.ts`
Expected: FAIL — cannot find module `../src/merge.js`.

- [ ] **Step 3: Write minimal implementation**

`server/src/merge.ts`:

```ts
import type { Range } from './types.js';

/** Merge overlapping AND adjacent half-open ranges into a minimal sorted set. */
export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) =>
    a.from < b.from ? -1 : a.from > b.from ? 1 : 0,
  );
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.from <= last.to) {
      // overlap, or adjacent (r.from === last.to) → extend
      if (r.to > last.to) last.to = r.to;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

/** Clip ranges to the half-open window [from, to); drop ranges fully outside. */
export function clipRanges(ranges: Range[], from: string, to: string): Range[] {
  const out: Range[] = [];
  for (const r of ranges) {
    const f = r.from < from ? from : r.from;
    const t = r.to > to ? to : r.to;
    if (t > f) out.push({ from: f, to: t });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run test/merge.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/merge.ts server/test/merge.test.ts
git commit -m "feat(server): merge overlapping/adjacent ranges + clip to window"
```

---

## Task 4: iCal parsing

**Files:**
- Create: `server/src/ical.ts`
- Test: `server/test/ical.test.ts`

> Timezone note: `node-ical` returns all-day `DATE` values as `Date` objects at midnight. `parseBusyRanges` formats them with **local** calendar components (`getFullYear/Month/Date`). This is correct for a server running in Europe or UTC (our deploy + typical CI). If you ever run tests in a UTC-negative timezone, set `TZ=UTC` for the test run.

- [ ] **Step 1: Write the failing test**

`server/test/ical.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseBusyRanges } from '../src/ical.js';

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:a1
DTSTART;VALUE=DATE:20260701
DTEND;VALUE=DATE:20260708
SUMMARY:Reserved
END:VEVENT
BEGIN:VEVENT
UID:a2
DTSTART;VALUE=DATE:20260812
DTEND;VALUE=DATE:20260819
SUMMARY:Airbnb (Not available)
END:VEVENT
END:VCALENDAR`;

describe('parseBusyRanges', () => {
  it('extracts half-open [DTSTART, DTEND) ranges from every VEVENT', () => {
    expect(parseBusyRanges(ICS)).toEqual([
      { from: '2026-07-01', to: '2026-07-08' },
      { from: '2026-08-12', to: '2026-08-19' },
    ]);
  });

  it('returns [] for an empty calendar', () => {
    const empty = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//EN\nEND:VCALENDAR`;
    expect(parseBusyRanges(empty)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run test/ical.test.ts`
Expected: FAIL — cannot find module `../src/ical.js`.

- [ ] **Step 3: Write minimal implementation**

`server/src/ical.ts`:

```ts
import ical from 'node-ical';
import type { Range } from './types.js';
import { ymd } from './dates.js';

/** Parse an iCal document into half-open [from, to) night ranges.
 *  Every VEVENT is treated as busy; only the date part is used. */
export function parseBusyRanges(icsText: string): Range[] {
  const parsed = ical.sync.parseICS(icsText);
  const ranges: Range[] = [];
  for (const key of Object.keys(parsed)) {
    const ev = parsed[key] as { type?: string; start?: Date; end?: Date };
    if (!ev || ev.type !== 'VEVENT' || !ev.start || !ev.end) continue;
    const from = ymd(ev.start);
    const to = ymd(ev.end);
    if (to > from) ranges.push({ from, to });
  }
  return ranges;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run test/ical.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/ical.ts server/test/ical.test.ts
git commit -m "feat(server): parse iCal feeds into busy night ranges"
```

---

## Task 5: Availability builder (fetch + merge, per-feed last-good)

**Files:**
- Create: `server/src/sync.ts`
- Test: `server/test/sync.test.ts`

- [ ] **Step 1: Write the failing test**

`server/test/sync.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildAvailability } from '../src/sync.js';

const AIRBNB = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:b1
DTSTART;VALUE=DATE:20260701
DTEND;VALUE=DATE:20260708
END:VEVENT
END:VCALENDAR`;

const TRAUM = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:t1
DTSTART;VALUE=DATE:20260705
DTEND;VALUE=DATE:20260712
END:VEVENT
END:VCALENDAR`;

const now = new Date(2026, 6, 1); // 2026-07-01

describe('buildAvailability', () => {
  it('merges both feeds into one busy set (union, clipped to window)', async () => {
    const fetchText = async (url: string) =>
      url.includes('airbnb') ? AIRBNB : TRAUM;
    const { availability } = await buildAvailability(
      '4_zi_dg',
      { airbnb: 'http://airbnb', traum: 'http://traum' },
      fetchText, now,
    );
    expect(availability.apartmentId).toBe('4_zi_dg');
    expect(availability.stale).toBe(false);
    expect(availability.busy).toEqual([{ from: '2026-07-01', to: '2026-07-12' }]);
  });

  it('marks stale and reuses per-feed last-good when one feed fails', async () => {
    const fetchText = async (url: string) => {
      if (url.includes('airbnb')) return AIRBNB;
      throw new Error('traum down');
    };
    const prevByUrl = { 'http://traum': [{ from: '2026-07-05', to: '2026-07-12' }] };
    const { availability, byUrl } = await buildAvailability(
      '4_zi_dg',
      { airbnb: 'http://airbnb', traum: 'http://traum' },
      fetchText, now, prevByUrl,
    );
    expect(availability.stale).toBe(true);
    expect(availability.busy).toEqual([{ from: '2026-07-01', to: '2026-07-12' }]);
    // fresh airbnb data captured for next cycle, traum keeps last-good
    expect(byUrl['http://airbnb']).toEqual([{ from: '2026-07-01', to: '2026-07-08' }]);
    expect(byUrl['http://traum']).toEqual([{ from: '2026-07-05', to: '2026-07-12' }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run test/sync.test.ts`
Expected: FAIL — cannot find module `../src/sync.js`.

- [ ] **Step 3: Write minimal implementation**

`server/src/sync.ts`:

```ts
import type { Availability, FeedUrls, Range } from './types.js';
import { parseBusyRanges } from './ical.js';
import { mergeRanges, clipRanges } from './merge.js';
import { windowStart, windowEnd } from './dates.js';

export type FetchText = (url: string) => Promise<string>;

/** Build merged availability for one apartment.
 *  On a feed failure, reuse that feed's last-good ranges from `prevByUrl`
 *  and mark the result stale. Returns the fresh per-feed ranges for caching. */
export async function buildAvailability(
  apartmentId: string,
  feeds: FeedUrls,
  fetchText: FetchText,
  now: Date,
  prevByUrl: Record<string, Range[]> = {},
): Promise<{ availability: Availability; byUrl: Record<string, Range[]> }> {
  const urls = [feeds.airbnb, feeds.traum].filter((u): u is string => !!u);
  const byUrl: Record<string, Range[]> = {};
  let collected: Range[] = [];
  let stale = false;

  for (const url of urls) {
    try {
      const ranges = parseBusyRanges(await fetchText(url));
      byUrl[url] = ranges;
      collected = collected.concat(ranges);
    } catch {
      stale = true;
      const prev = prevByUrl[url] ?? [];
      byUrl[url] = prev;
      collected = collected.concat(prev);
    }
  }

  const busy = clipRanges(mergeRanges(collected), windowStart(now), windowEnd(now, 12));
  return {
    availability: { apartmentId, updatedAt: now.toISOString(), stale, busy },
    byUrl,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run test/sync.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/sync.ts server/test/sync.test.ts
git commit -m "feat(server): build merged availability with per-feed last-good fallback"
```

---

## Task 6: Snapshot store

**Files:**
- Create: `server/src/store.ts`
- Test: `server/test/store.test.ts`

- [ ] **Step 1: Write the failing test**

`server/test/store.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { readSnapshot, writeSnapshot } from '../src/store.js';

describe('snapshot store', () => {
  it('round-trips a snapshot through disk', async () => {
    const path = join(tmpdir(), `zaucker-snap-${process.pid}.json`);
    const snap = {
      availability: {
        '4_zi_dg': { apartmentId: '4_zi_dg', updatedAt: '2026-07-01T00:00:00.000Z', stale: false, busy: [{ from: '2026-07-01', to: '2026-07-08' }] },
      },
      byUrl: { 'http://x': [{ from: '2026-07-01', to: '2026-07-08' }] },
    };
    await writeSnapshot(path, snap);
    expect(await readSnapshot(path)).toEqual(snap);
    await rm(path, { force: true });
  });

  it('returns null when the snapshot is missing', async () => {
    expect(await readSnapshot(join(tmpdir(), 'does-not-exist-zzz.json'))).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run test/store.test.ts`
Expected: FAIL — cannot find module `../src/store.js`.

- [ ] **Step 3: Write minimal implementation**

`server/src/store.ts`:

```ts
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Availability, Range } from './types.js';

export interface Snapshot {
  availability: Record<string, Availability>;
  byUrl: Record<string, Range[]>;
}

export async function readSnapshot(path: string): Promise<Snapshot | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Snapshot;
  } catch {
    return null;
  }
}

export async function writeSnapshot(path: string, snap: Snapshot): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(snap), 'utf8');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run test/store.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/store.ts server/test/store.test.ts
git commit -m "feat(server): on-disk snapshot read/write"
```

---

## Task 7: Config loader

**Files:**
- Create: `server/src/config.ts`
- Test: `server/test/config.test.ts`

- [ ] **Step 1: Write the failing test**

`server/test/config.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFile, rm } from 'node:fs/promises';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('loads apartments and defaults refreshMinutes to 30', async () => {
    const path = join(tmpdir(), `zaucker-cfg-${process.pid}.json`);
    await writeFile(path, JSON.stringify({
      apartments: { '4_zi_dg': { airbnb: 'http://a', traum: 'http://t' } },
    }), 'utf8');
    const cfg = await loadConfig(path);
    expect(cfg.refreshMinutes).toBe(30);
    expect(cfg.apartments['4_zi_dg']).toEqual({ airbnb: 'http://a', traum: 'http://t' });
    await rm(path, { force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run test/config.test.ts`
Expected: FAIL — cannot find module `../src/config.js`.

- [ ] **Step 3: Write minimal implementation**

`server/src/config.ts`:

```ts
import { readFile } from 'node:fs/promises';
import type { Config } from './types.js';

export async function loadConfig(path: string): Promise<Config> {
  const raw = JSON.parse(await readFile(path, 'utf8')) as Partial<Config>;
  return {
    refreshMinutes: raw.refreshMinutes ?? 30,
    apartments: raw.apartments ?? {},
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run test/config.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add server/src/config.ts server/test/config.test.ts
git commit -m "feat(server): config loader"
```

---

## Task 8: Fastify app + route + startup loop

**Files:**
- Create: `server/src/index.ts`
- Test: `server/test/route.test.ts`

- [ ] **Step 1: Write the failing test (route via fastify.inject)**

`server/test/route.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createApp, type Cache } from '../src/index.js';
import type { Availability } from '../src/types.js';

function seededCache(): Cache {
  const cache: Cache = new Map<string, Availability>();
  cache.set('4_zi_dg', {
    apartmentId: '4_zi_dg', updatedAt: '2026-07-01T00:00:00.000Z',
    stale: false, busy: [{ from: '2026-07-01', to: '2026-07-08' }],
  });
  return cache;
}

describe('GET /api/availability/:aptId', () => {
  it('returns cached availability', async () => {
    const app = createApp(seededCache());
    const res = await app.inject({ method: 'GET', url: '/api/availability/4_zi_dg' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ apartmentId: '4_zi_dg', stale: false });
    await app.close();
  });

  it('404s for an unknown apartment', async () => {
    const app = createApp(seededCache());
    const res = await app.inject({ method: 'GET', url: '/api/availability/nope' });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run test/route.test.ts`
Expected: FAIL — cannot find module `../src/index.js`.

- [ ] **Step 3: Write minimal implementation**

`server/src/index.ts`:

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Availability, Range } from './types.js';
import { loadConfig } from './config.js';
import { buildAvailability, type FetchText } from './sync.js';
import { readSnapshot, writeSnapshot } from './store.js';

export type Cache = Map<string, Availability>;

/** Build the Fastify app over a (mutable) availability cache. */
export function createApp(cache: Cache): FastifyInstance {
  const app = Fastify({ logger: false });
  app.get<{ Params: { aptId: string } }>(
    '/api/availability/:aptId',
    async (req, reply) => {
      const a = cache.get(req.params.aptId);
      if (!a) {
        reply.code(404);
        return { error: 'unknown apartment' };
      }
      return a;
    },
  );
  return app;
}

/** Fetch a URL as text with a 10s timeout; throws on non-2xx. */
const fetchText: FetchText = async (url) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
};

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const configPath = process.env.CONFIG_PATH ?? join(here, '..', 'config.local.json');
  const cachePath = process.env.CACHE_PATH ?? join(here, '..', '.cache', 'availability.json');
  const port = Number(process.env.PORT ?? 4317);

  const config = await loadConfig(configPath);
  const cache: Cache = new Map();
  let byUrl: Record<string, Range[]> = {};

  const snap = await readSnapshot(cachePath);
  if (snap) {
    for (const [id, a] of Object.entries(snap.availability)) cache.set(id, a);
    byUrl = snap.byUrl ?? {};
  }

  async function refreshAll(): Promise<void> {
    const now = new Date();
    const nextByUrl: Record<string, Range[]> = {};
    for (const [id, feeds] of Object.entries(config.apartments)) {
      const { availability, byUrl: ranges } =
        await buildAvailability(id, feeds, fetchText, now, byUrl);
      cache.set(id, availability);
      Object.assign(nextByUrl, ranges);
    }
    byUrl = nextByUrl;
    await writeSnapshot(cachePath, { availability: Object.fromEntries(cache), byUrl });
  }

  const app = createApp(cache);
  await app.listen({ port, host: '127.0.0.1' });
  app.log.info(`calendar service on :${port}`);
  await refreshAll().catch((e) => app.log.error(e));
  setInterval(() => { void refreshAll().catch(() => {}); }, config.refreshMinutes * 60_000);
}

// Run main() only when executed directly (not when imported by tests).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run test/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full server suite + build**

Run: `cd server && npm test && npm run build`
Expected: all tests PASS; `tsc` emits `dist/` with no errors.

- [ ] **Step 6: Commit**

```bash
git add server/src/index.ts server/test/route.test.ts
git commit -m "feat(server): fastify app, availability route, poll loop + startup"
```

---

## Task 9: Ops — deploy script + systemd unit

**Files:**
- Create: `deploy-server.sh` (repo root, executable)
- Create: `server/deploy/zaucker-calendar.service`
- Create: `server/README.md` (one-time setup runbook)

- [ ] **Step 1: Create `server/deploy/zaucker-calendar.service`**

```ini
[Unit]
Description=Zaucker availability calendar service
After=network.target

[Service]
Type=simple
User=zaucker
WorkingDirectory=/home/zaucker/calendar
ExecStart=/usr/bin/node dist/index.js
Environment=PORT=4317
Environment=CONFIG_PATH=/home/zaucker/calendar/config.local.json
Environment=CACHE_PATH=/home/zaucker/calendar/.cache/availability.json
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Create `deploy-server.sh` (repo root)**

```bash
#!/bin/bash
set -euo pipefail
# Ship the calendar service to the server and restart it.
# Excludes node_modules/dist/.cache (rebuilt remotely) and config.local.json
# (the secret feed URLs live only on the server).
rsync -avr --delete \
  --exclude node_modules --exclude dist --exclude .cache --exclude config.local.json \
  server/ zaucker@web-volki-01-adm:calendar/
ssh zaucker@web-volki-01-adm 'cd calendar && npm ci && npm run build && sudo systemctl restart zaucker-calendar'
```

- [ ] **Step 3: Make it executable**

Run: `chmod +x deploy-server.sh`

- [ ] **Step 4: Create `server/README.md` (one-time setup runbook)**

```markdown
# Calendar service — one-time server setup

1. First deploy populates `~/calendar/` on web-volki-01-adm:
   `./deploy-server.sh`   (will fail at `systemctl restart` until step 3 — that's fine)

2. On the server, create the secret config (NOT committed):
   `cp ~/calendar/config.example.json ~/calendar/config.local.json`
   then edit it and paste the real Airbnb + traum `.ics` URLs per apartment.

3. Install + enable the systemd unit (once):
   `sudo cp ~/calendar/deploy/zaucker-calendar.service /etc/systemd/system/`
   `sudo systemctl daemon-reload`
   `sudo systemctl enable --now zaucker-calendar`

4. Verify: `curl -s localhost:4317/api/availability/4_zi_dg | head`

5. Add a proxy rule so `https://zaucker.com/api/` → `http://localhost:4317`
   (path passed through unchanged — the service serves `/api/...`).

Redeploys after that: just `./deploy-server.sh`.
```

- [ ] **Step 5: Commit**

```bash
git add deploy-server.sh server/deploy/zaucker-calendar.service server/README.md
git commit -m "ops(server): deploy script, systemd unit, setup runbook"
```

---

## Task 10: Frontend grid helpers

**Files:**
- Create: `src/lib/availability.ts`
- Test: `src/lib/availability.test.ts`

> These run under the **root** vitest (alongside the existing `src/lib/*.test.ts`).

- [ ] **Step 1: Write the failing test**

`src/lib/availability.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildMonths, isBooked } from './availability';

describe('buildMonths', () => {
  it('returns 12 month grids starting at the current month', () => {
    const grids = buildMonths(new Date(2026, 6, 15)); // July 2026
    expect(grids).toHaveLength(12);
    expect(grids[0]).toMatchObject({ year: 2026, month: 6 });
    expect(grids[0].days[0]).toBe('2026-07-01');
    expect(grids[0].days.at(-1)).toBe('2026-07-31');
    expect(grids[5]).toMatchObject({ year: 2026, month: 11 }); // December
    expect(grids[6]).toMatchObject({ year: 2027, month: 0 });  // rolls into next year
  });
});

describe('isBooked', () => {
  const ranges = [{ from: '2026-07-01', to: '2026-07-08' }];
  it('marks nights inside [from, to) booked', () => {
    expect(isBooked('2026-07-01', ranges)).toBe(true);
    expect(isBooked('2026-07-07', ranges)).toBe(true);
  });
  it('leaves the checkout day (to) free', () => {
    expect(isBooked('2026-07-08', ranges)).toBe(false);
  });
  it('leaves days outside any range free', () => {
    expect(isBooked('2026-06-30', ranges)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/availability.test.ts`
Expected: FAIL — cannot find module `./availability`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/availability.ts`:

```ts
export interface Range {
  from: string;
  to: string;
}

export interface Availability {
  apartmentId: string;
  updatedAt: string;
  stale: boolean;
  busy: Range[];
}

export interface MonthGrid {
  year: number;
  month: number; // 0-based
  days: string[]; // YYYY-MM-DD for each day of the month
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 12 month grids starting at the month containing `today`. */
export function buildMonths(today: Date, count = 12): MonthGrid[] {
  const grids: MonthGrid[] = [];
  for (let i = 0; i < count; i++) {
    const m0 = today.getMonth() + i;
    const year = today.getFullYear() + Math.floor(m0 / 12);
    const month = ((m0 % 12) + 12) % 12;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) days.push(ymd(year, month, d));
    grids.push({ year, month, days });
  }
  return grids;
}

/** A day (YYYY-MM-DD) is booked if it falls in any half-open [from, to) range. */
export function isBooked(day: string, ranges: Range[]): boolean {
  return ranges.some((r) => day >= r.from && day < r.to);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/availability.test.ts`
Expected: PASS (5 assertions across 2 suites).

- [ ] **Step 5: Commit**

```bash
git add src/lib/availability.ts src/lib/availability.test.ts
git commit -m "feat(web): availability grid helpers (buildMonths, isBooked)"
```

---

## Task 11: AvailabilityCalendar Svelte island

**Files:**
- Create: `src/components/AvailabilityCalendar.svelte`

- [ ] **Step 1: Create the component**

`src/components/AvailabilityCalendar.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { buildMonths, isBooked, type Availability } from '@/lib/availability';

  interface Labels { free: string; booked: string; loading: string; error: string; updated: string; }
  let { apartmentId, locale, labels }:
    { apartmentId: string; locale: string; labels: Labels } = $props();

  let state = $state<'loading' | 'ok' | 'error'>('loading');
  let data = $state<Availability | null>(null);

  const months = buildMonths(new Date(), 12);
  const monthName = (y: number, m: number) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(y, m, 1));
  // Monday-first weekday initials. 2024-01-01 is a Monday, so this yields Mon…Sun.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 1 + i)),
  );
  // Leading blank cells before day 1 (Monday-first).
  const leadBlanks = (y: number, m: number) => (new Date(y, m, 1).getDay() + 6) % 7;

  onMount(async () => {
    try {
      const res = await fetch(`/api/availability/${apartmentId}`);
      if (!res.ok) throw new Error();
      data = await res.json();
      state = 'ok';
    } catch {
      state = 'error';
    }
  });

  const busy = $derived(data?.busy ?? []);
</script>

{#if state === 'loading'}
  <p class="text-stone-500 text-sm">{labels.loading}</p>
{:else if state === 'error'}
  <p class="text-stone-500 text-sm">{labels.error}</p>
{:else}
  <div class="flex items-center gap-4 text-sm text-stone-600 mb-4">
    <span class="inline-flex items-center gap-1.5">
      <span class="w-3.5 h-3.5 rounded-sm bg-white ring-1 ring-stone-300"></span>{labels.free}
    </span>
    <span class="inline-flex items-center gap-1.5">
      <span class="w-3.5 h-3.5 rounded-sm bg-stone-300"></span>{labels.booked}
    </span>
    {#if data}
      <span class="ml-auto text-stone-400">
        {labels.updated}: {new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(data.updatedAt))}
      </span>
    {/if}
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
    {#each months as mo}
      <div>
        <div class="font-display font-semibold text-ink mb-2 capitalize">{monthName(mo.year, mo.month)}</div>
        <div class="grid grid-cols-7 gap-1 text-center text-xs">
          {#each weekdays as wd}
            <div class="text-stone-400 font-medium py-1">{wd}</div>
          {/each}
          {#each Array.from({ length: leadBlanks(mo.year, mo.month) }) as _}
            <div></div>
          {/each}
          {#each mo.days as day}
            <div
              class={`py-1 rounded-sm ${isBooked(day, busy)
                ? 'bg-stone-300 text-stone-500 line-through'
                : 'bg-white ring-1 ring-stone-200 text-stone-700'}`}>
              {Number(day.slice(8))}
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
{/if}
```

- [ ] **Step 2: Typecheck the component build**

Run: `npm run build`
Expected: build succeeds (the component compiles; it isn't wired into a page yet, so this just confirms no syntax/type errors once imported in Task 12 — if your setup tree-shakes unused components, this step mainly confirms the file parses; the real check is Task 12's build).

- [ ] **Step 3: Commit**

```bash
git add src/components/AvailabilityCalendar.svelte
git commit -m "feat(web): AvailabilityCalendar island (12-month free/booked grid)"
```

---

## Task 12: Wire pages + i18n, remove the traum widget

**Files:**
- Modify: `src/i18n/de.yaml`, `src/i18n/en.yaml`
- Modify: `src/pages/verfuegbarkeit.astro`, `src/pages/en/availability.astro`
- Delete: `src/components/AvailabilityWidget.astro`

- [ ] **Step 1: Add i18n keys**

Append to `src/i18n/de.yaml`:

```yaml
avail_free: "frei"
avail_booked: "belegt"
avail_loading: "Belegung wird geladen …"
avail_error: "Belegung momentan nicht verfügbar."
avail_updated: "Stand"
```

Append to `src/i18n/en.yaml`:

```yaml
avail_free: "free"
avail_booked: "booked"
avail_loading: "Loading availability …"
avail_error: "Availability is currently unavailable."
avail_updated: "As of"
```

- [ ] **Step 2: Rewrite `src/pages/verfuegbarkeit.astro`**

Replace the whole file with:

```astro
---
import type { Locale } from '@/lib/types';
import Layout from '@/layouts/Layout.astro';
import AvailabilityCalendar from '@/components/AvailabilityCalendar.svelte';
import { t } from '@/lib/i18n';
import { getVisibleApartments } from '@/lib/apartments';
import { getEntry, render } from 'astro:content';

const locale: Locale = 'de';
const page = await getEntry('pages', 'de/verfuegbarkeit');
const { Content } = await render(page!);
const apartments = getVisibleApartments();
const labels = {
  free: t(locale, 'avail_free'),
  booked: t(locale, 'avail_booked'),
  loading: t(locale, 'avail_loading'),
  error: t(locale, 'avail_error'),
  updated: t(locale, 'avail_updated'),
};
---
<Layout locale={locale} title={page!.data.title} description={page!.data.description ?? ''} currentPath="/verfuegbarkeit" altHref="/en/availability">
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <h1 class="text-4xl font-bold text-stone-900 mb-6">{page!.data.title}</h1>
    {apartments.map(apt => (
      <section class="mt-10">
        <h2 class="text-xl font-semibold text-stone-900 mb-4">{t(locale, apt.name_key)}</h2>
        <AvailabilityCalendar client:visible apartmentId={apt.id} locale={locale} labels={labels} />
      </section>
    ))}
    <div class="prose prose-stone mt-12"><Content /></div>
  </div>
</Layout>
```

- [ ] **Step 3: Rewrite `src/pages/en/availability.astro`**

Replace the whole file with:

```astro
---
import type { Locale } from '@/lib/types';
import Layout from '@/layouts/Layout.astro';
import AvailabilityCalendar from '@/components/AvailabilityCalendar.svelte';
import { t } from '@/lib/i18n';
import { getVisibleApartments } from '@/lib/apartments';
import { getEntry, render } from 'astro:content';

const locale: Locale = 'en';
const page = await getEntry('pages', 'en/availability');
const { Content } = await render(page!);
const apartments = getVisibleApartments();
const labels = {
  free: t(locale, 'avail_free'),
  booked: t(locale, 'avail_booked'),
  loading: t(locale, 'avail_loading'),
  error: t(locale, 'avail_error'),
  updated: t(locale, 'avail_updated'),
};
---
<Layout locale={locale} title={page!.data.title} description={page!.data.description ?? ''} currentPath="/en/availability" altHref="/verfuegbarkeit">
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <h1 class="text-4xl font-bold text-stone-900 mb-6">{page!.data.title}</h1>
    {apartments.map(apt => (
      <section class="mt-10">
        <h2 class="text-xl font-semibold text-stone-900 mb-4">{t(locale, apt.name_key)}</h2>
        <AvailabilityCalendar client:visible apartmentId={apt.id} locale={locale} labels={labels} />
      </section>
    ))}
    <div class="prose prose-stone mt-12"><Content /></div>
  </div>
</Layout>
```

- [ ] **Step 4: Delete the old widget**

Run: `git rm src/components/AvailabilityWidget.astro`

- [ ] **Step 5: Build to verify everything compiles**

Run: `npm run build`
Expected: build succeeds, 17 pages, no errors. (The calendar shows its loading/error state in the static HTML; data is fetched client-side at runtime.)

- [ ] **Step 6: Commit**

```bash
git add src/i18n/de.yaml src/i18n/en.yaml src/pages/verfuegbarkeit.astro src/pages/en/availability.astro
git commit -m "feat(web): use AvailabilityCalendar on availability pages, drop traum widget"
```

---

## Task 13: Vite dev proxy

**Files:**
- Modify: `astro.config.mjs`

- [ ] **Step 1: Add the dev proxy**

In `astro.config.mjs`, change the `vite` line:

```js
  vite: { plugins: [tailwindcss()] },
```

to:

```js
  vite: {
    plugins: [tailwindcss()],
    server: { proxy: { '/api': 'http://localhost:4317' } },
  },
```

- [ ] **Step 2: Verify build still works**

Run: `npm run build`
Expected: build succeeds (the proxy only affects `astro dev`).

- [ ] **Step 3: Commit**

```bash
git add astro.config.mjs
git commit -m "chore(web): dev proxy /api -> calendar service :4317"
```

---

## Task 14: End-to-end manual verification

**Goal:** Confirm the island renders real data against a locally-running service.

- [ ] **Step 1: Create a local fixture config for the service**

Create `server/config.local.json` (gitignored) pointing at any reachable test `.ics` — easiest is two local files served, but for a quick check you can paste the real feed URLs. Minimal shape:

```json
{
  "refreshMinutes": 30,
  "apartments": {
    "4_zi_dg": { "traum": "https://www.traum-ferienwohnungen.de/REPLACE/export.ics" },
    "3_zi_ug": { "traum": "https://www.traum-ferienwohnungen.de/REPLACE/export.ics" }
  }
}
```

- [ ] **Step 2: Run the service**

Run: `cd server && npm run dev`
Expected: logs `calendar service on :4317`. In another shell:
`curl -s localhost:4317/api/availability/4_zi_dg` → JSON with `busy` ranges.

- [ ] **Step 3: Run the site dev server and open the page**

Run (repo root): `npm run dev`
Open `http://localhost:4321/verfuegbarkeit`. Expected: per-apartment 12-month grids with booked days filled/struck-through, free days clean; legend + "Stand" note. The `/api` calls succeed via the Vite proxy.

- [ ] **Step 4: Verify the error state**

Stop the service; reload the page. Expected: each apartment shows the graceful "Belegung momentan nicht verfügbar." line instead of a broken widget.

- [ ] **Step 5: Screenshot review**

Capture the page (Playwright or browser) and confirm the calendar reads cleanly in the site's design system. Tune the free/booked colors in `AvailabilityCalendar.svelte` if needed (commit any tweak separately).

- [ ] **Step 6: Full test sweep**

Run: `npm test` (root) and `cd server && npm test`
Expected: all green.

---

## Notes for the implementer

- **Deploy is two independent steps:** `./deploy.sh` (static site, unchanged) and `./deploy-server.sh` (service). The service also needs the one-time setup in `server/README.md` (config.local.json on the server, systemd unit, proxy rule) before it serves.
- **Secrets never enter the repo or the static HTML** — only `server/config.local.json` on the server holds the feed URLs.
- **No PII:** the service deliberately discards everything but dates from the feeds.
- **Out of scope (later phases):** reservations, publishing our own `.ics`, pushing to Airbnb/traum, auth/admin. The `server/` service and the `Range`/`Availability` types are the seeds for that work.
