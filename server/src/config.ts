import { readFile } from 'node:fs/promises';
import type { Config } from './types.js';

export async function loadConfig(path: string): Promise<Config> {
  const raw = JSON.parse(await readFile(path, 'utf8')) as Partial<Config>;
  return {
    refreshMinutes: raw.refreshMinutes ?? 30,
    apartments: raw.apartments ?? {},
  };
}
