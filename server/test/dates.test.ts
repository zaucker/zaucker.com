import { describe, it, expect } from 'vitest';
import { ymd, windowStart, windowEnd, addDays } from '../src/dates.js';

describe('addDays', () => {
  it('shifts a date by positive/negative days across month boundaries', () => {
    expect(addDays('2026-07-16', -1)).toBe('2026-07-15');
    expect(addDays('2026-07-01', -1)).toBe('2026-06-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('dates', () => {
  it('formats a Date as YYYY-MM-DD using local components', () => {
    expect(ymd(new Date(2026, 6, 1))).toBe('2026-07-01'); // month is 0-based: 6 = July
    expect(ymd(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('windowStart is the first day of the current month', () => {
    expect(windowStart(new Date(2026, 6, 15))).toBe('2026-07-01');
  });

  it('windowEnd is the first day of the month `count` months later', () => {
    expect(windowEnd(new Date(2026, 6, 15), 12)).toBe('2027-07-01');
    expect(windowEnd(new Date(2026, 11, 1), 12)).toBe('2027-12-01');
  });
});
