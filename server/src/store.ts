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
