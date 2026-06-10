import { describe, it, expect } from 'vitest';
import { buildMonths, dayState } from './availability';

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

describe('dayState — single booking [10, 15)', () => {
  const b = [{ from: '2026-07-10', to: '2026-07-15' }];
  it('check-in day (from) is afternoon-only', () => {
    expect(dayState('2026-07-10', b)).toBe('checkin');
  });
  it('interior nights are full', () => {
    expect(dayState('2026-07-11', b)).toBe('full');
    expect(dayState('2026-07-14', b)).toBe('full');
  });
  it('checkout day (to) is morning-only', () => {
    expect(dayState('2026-07-15', b)).toBe('checkout');
  });
  it('days outside are free', () => {
    expect(dayState('2026-07-09', b)).toBe('free');
    expect(dayState('2026-07-16', b)).toBe('free');
  });
});

describe('dayState — turnover (different guests, same day)', () => {
  const b = [
    { from: '2026-07-05', to: '2026-07-10' },
    { from: '2026-07-10', to: '2026-07-15' },
  ];
  it('the shared day is a turnover (both halves, two guests)', () => {
    expect(dayState('2026-07-10', b)).toBe('turnover');
  });
  it('surrounding interior days stay full', () => {
    expect(dayState('2026-07-07', b)).toBe('full');
    expect(dayState('2026-07-12', b)).toBe('full');
  });
  it('outer ends are checkin / checkout', () => {
    expect(dayState('2026-07-05', b)).toBe('checkin');
    expect(dayState('2026-07-15', b)).toBe('checkout');
  });
});

describe('dayState — one-night booking [10, 11)', () => {
  const b = [{ from: '2026-07-10', to: '2026-07-11' }];
  it('is checkin on the night and checkout the next morning', () => {
    expect(dayState('2026-07-10', b)).toBe('checkin');
    expect(dayState('2026-07-11', b)).toBe('checkout');
  });
});
