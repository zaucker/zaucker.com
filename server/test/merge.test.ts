import { describe, it, expect } from 'vitest';
import { mergeRanges, clipRanges, normalizeBookings } from '../src/merge.js';

describe('normalizeBookings', () => {
  it('collapses the same booking mirrored by both feeds (same start, off-by-one)', () => {
    expect(normalizeBookings([
      { from: '2026-07-06', to: '2026-07-15' },
      { from: '2026-07-06', to: '2026-07-16' },
    ])).toEqual([{ from: '2026-07-06', to: '2026-07-16' }]);
  });

  it('collapses exact duplicates', () => {
    expect(normalizeBookings([
      { from: '2026-07-01', to: '2026-07-08' },
      { from: '2026-07-01', to: '2026-07-08' },
    ])).toEqual([{ from: '2026-07-01', to: '2026-07-08' }]);
  });

  it('snaps a 1-day overlap between different guests into an exact turnover', () => {
    expect(normalizeBookings([
      { from: '2026-06-13', to: '2026-06-28' },
      { from: '2026-06-27', to: '2026-07-05' },
    ])).toEqual([
      { from: '2026-06-13', to: '2026-06-27' }, // trimmed to end where the next begins
      { from: '2026-06-27', to: '2026-07-05' }, // → adjacency at 06-27 renders as a turnover
    ]);
  });

  it('leaves already-clean adjacencies (turnovers) untouched', () => {
    expect(normalizeBookings([
      { from: '2026-07-10', to: '2026-07-15' },
      { from: '2026-07-15', to: '2026-07-20' },
    ])).toEqual([
      { from: '2026-07-10', to: '2026-07-15' },
      { from: '2026-07-15', to: '2026-07-20' },
    ]);
  });

  it('keeps genuine gaps as separate bookings', () => {
    expect(normalizeBookings([
      { from: '2026-07-10', to: '2026-07-15' },
      { from: '2026-07-18', to: '2026-07-20' },
    ])).toHaveLength(2);
  });
});

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
