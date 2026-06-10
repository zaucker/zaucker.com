import { describe, it, expect } from 'vitest';
import { buildAvailability } from '../src/sync.js';

// Same booking reported by both platforms (they sync to each other).
const SAME = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:x1
DTSTART;VALUE=DATE:20260701
DTEND;VALUE=DATE:20260708
END:VEVENT
END:VCALENDAR`;

// Two consecutive (back-to-back) bookings in one feed.
const CONSECUTIVE = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:c1
DTSTART;VALUE=DATE:20260710
DTEND;VALUE=DATE:20260715
END:VEVENT
BEGIN:VEVENT
UID:c2
DTSTART;VALUE=DATE:20260715
DTEND;VALUE=DATE:20260720
END:VEVENT
END:VCALENDAR`;

const now = new Date(2026, 6, 1); // 2026-07-01

describe('buildAvailability', () => {
  it('dedupes the same booking reported by both feeds', async () => {
    const fetchText = async () => SAME; // both feeds return the identical booking
    const { availability } = await buildAvailability(
      '4_zi_dg',
      { airbnb: 'http://airbnb', traum: 'http://traum' },
      fetchText, now,
    );
    expect(availability.apartmentId).toBe('4_zi_dg');
    expect(availability.stale).toBe(false);
    expect(availability.bookings).toEqual([{ from: '2026-07-01', to: '2026-07-08' }]);
  });

  it('keeps consecutive bookings separate (does NOT merge the turnover)', async () => {
    const fetchText = async () => CONSECUTIVE;
    const { availability } = await buildAvailability(
      '4_zi_dg',
      { traum: 'http://traum' },
      fetchText, now,
    );
    expect(availability.bookings).toEqual([
      { from: '2026-07-10', to: '2026-07-15' },
      { from: '2026-07-15', to: '2026-07-20' },
    ]);
  });

  it('marks stale and reuses per-feed last-good when one feed fails', async () => {
    const fetchText = async (url: string) => {
      if (url.includes('airbnb')) return SAME;
      throw new Error('traum down');
    };
    const prevByUrl = { 'http://traum': [{ from: '2026-08-01', to: '2026-08-05' }] };
    const { availability, byUrl } = await buildAvailability(
      '4_zi_dg',
      { airbnb: 'http://airbnb', traum: 'http://traum' },
      fetchText, now, prevByUrl,
    );
    expect(availability.stale).toBe(true);
    // airbnb's fresh booking + traum's last-good, both kept (sorted)
    expect(availability.bookings).toEqual([
      { from: '2026-07-01', to: '2026-07-08' },
      { from: '2026-08-01', to: '2026-08-05' },
    ]);
    expect(byUrl['http://airbnb']).toEqual([{ from: '2026-07-01', to: '2026-07-08' }]);
    expect(byUrl['http://traum']).toEqual([{ from: '2026-08-01', to: '2026-08-05' }]);
  });
});
