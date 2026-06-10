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
