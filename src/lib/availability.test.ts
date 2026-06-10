import { describe, it, expect } from 'vitest';
import { buildMonths, isBooked } from './availability';

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

describe('isBooked', () => {
  const ranges = [{ from: '2026-07-01', to: '2026-07-08' }];
  it('marks nights inside [from, to) booked', () => {
    expect(isBooked('2026-07-01', ranges)).toBe(true);
    expect(isBooked('2026-07-07', ranges)).toBe(true);
  });
  it('leaves the checkout day (to) free', () => {
    expect(isBooked('2026-07-08', ranges)).toBe(false);
  });
  it('leaves days outside any range free', () => {
    expect(isBooked('2026-06-30', ranges)).toBe(false);
  });
});
