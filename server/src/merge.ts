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

/**
 * Reconcile bookings collected from both feeds into a clean, non-overlapping list.
 *
 * Airbnb and traum mirror each other's bookings but disagree by a day on
 * checkout (inclusive vs exclusive DTEND), so the same stay or a real turnover
 * arrives as overlapping ranges. We resolve overlaps so genuine same-day
 * turnovers between different guests survive as exact adjacencies:
 *   - same start  → the same booking from both feeds → keep the union
 *   - diff start  → a real turnover reported off-by-one → trim the earlier stay
 *                   to end exactly where the next begins (creates an adjacency)
 *
 * This never frees a night that is actually booked (the trimmed tail is always
 * covered by the following booking). Exact duplicates collapse via the same-start
 * union. Input order doesn't matter; output is sorted by start.
 */
export function normalizeBookings(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) =>
    a.from < b.from ? -1 : a.from > b.from ? 1 : a.to < b.to ? -1 : a.to > b.to ? 1 : 0,
  );
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.from < last.to) {
      if (r.from === last.from) {
        if (r.to > last.to) last.to = r.to; // same booking, both feeds → union
      } else {
        last.to = r.from;                   // off-by-one turnover → snap to adjacency
        out.push({ ...r });
      }
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
