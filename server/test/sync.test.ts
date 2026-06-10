import { describe, it, expect } from 'vitest';
import { buildAvailability } from '../src/sync.js';

const AIRBNB = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:b1
DTSTART;VALUE=DATE:20260701
DTEND;VALUE=DATE:20260708
END:VEVENT
END:VCALENDAR`;

const TRAUM = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:t1
DTSTART;VALUE=DATE:20260705
DTEND;VALUE=DATE:20260712
END:VEVENT
END:VCALENDAR`;

const now = new Date(2026, 6, 1); // 2026-07-01

describe('buildAvailability', () => {
  it('merges both feeds into one busy set (union, clipped to window)', async () => {
    const fetchText = async (url: string) =>
      url.includes('airbnb') ? AIRBNB : TRAUM;
    const { availability } = await buildAvailability(
      '4_zi_dg',
      { airbnb: 'http://airbnb', traum: 'http://traum' },
      fetchText, now,
    );
    expect(availability.apartmentId).toBe('4_zi_dg');
    expect(availability.stale).toBe(false);
    expect(availability.busy).toEqual([{ from: '2026-07-01', to: '2026-07-12' }]);
  });

  it('marks stale and reuses per-feed last-good when one feed fails', async () => {
    const fetchText = async (url: string) => {
      if (url.includes('airbnb')) return AIRBNB;
      throw new Error('traum down');
    };
    const prevByUrl = { 'http://traum': [{ from: '2026-07-05', to: '2026-07-12' }] };
    const { availability, byUrl } = await buildAvailability(
      '4_zi_dg',
      { airbnb: 'http://airbnb', traum: 'http://traum' },
      fetchText, now, prevByUrl,
    );
    expect(availability.stale).toBe(true);
    expect(availability.busy).toEqual([{ from: '2026-07-01', to: '2026-07-12' }]);
    // fresh airbnb data captured for next cycle, traum keeps last-good
    expect(byUrl['http://airbnb']).toEqual([{ from: '2026-07-01', to: '2026-07-08' }]);
    expect(byUrl['http://traum']).toEqual([{ from: '2026-07-05', to: '2026-07-12' }]);
  });
});
