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
