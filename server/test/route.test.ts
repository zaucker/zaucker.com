import { describe, it, expect } from 'vitest';
import { createApp, type Cache } from '../src/index.js';
import type { Availability } from '../src/types.js';

function seededCache(): Cache {
  const cache: Cache = new Map<string, Availability>();
  cache.set('4_zi_dg', {
    apartmentId: '4_zi_dg', updatedAt: '2026-07-01T00:00:00.000Z',
    stale: false, bookings: [{ from: '2026-07-01', to: '2026-07-08' }],
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
