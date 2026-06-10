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
