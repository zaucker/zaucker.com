import Fastify, { type FastifyInstance } from 'fastify';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Availability, Range } from './types.js';
import { loadConfig } from './config.js';
import { buildAvailability, type FetchText } from './sync.js';
import { readSnapshot, writeSnapshot } from './store.js';

export type Cache = Map<string, Availability>;

/** Force a re-sync of one apartment; resolves to fresh availability, or null if
 *  the apartment is unknown. */
export type RefreshFn = (aptId: string) => Promise<Availability | null>;

/** Build the Fastify app over a (mutable) availability cache. */
export function createApp(cache: Cache, refresh?: RefreshFn): FastifyInstance {
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

  app.post<{ Params: { aptId: string } }>(
    '/api/availability/:aptId/refresh',
    async (req, reply) => {
      if (!refresh) {
        reply.code(503);
        return { error: 'refresh unavailable' };
      }
      const a = await refresh(req.params.aptId);
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

  /** Re-sync one apartment's feeds into the cache (no snapshot write). */
  async function refreshApartment(aptId: string): Promise<Availability | null> {
    const feeds = config.apartments[aptId];
    if (!feeds) return null;
    const { availability, byUrl: ranges } =
      await buildAvailability(aptId, feeds, fetchText, new Date(), byUrl);
    cache.set(aptId, availability);
    Object.assign(byUrl, ranges);
    return availability;
  }

  const persist = () =>
    writeSnapshot(cachePath, { availability: Object.fromEntries(cache), byUrl });

  async function refreshAll(): Promise<void> {
    for (const id of Object.keys(config.apartments)) {
      await refreshApartment(id);
    }
    await persist();
  }

  const app = createApp(cache, async (aptId) => {
    const a = await refreshApartment(aptId);
    if (a) await persist();
    return a;
  });

  await app.listen({ port, host: '127.0.0.1' });
  app.log.info(`calendar service on :${port}`);
  await refreshAll().catch((e) => app.log.error(e));
  setInterval(() => {
    void refreshAll().catch((e) => app.log.error(e));
  }, config.refreshMinutes * 60_000);
}

// Run main() only when executed directly (not when imported by tests).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main();
}
