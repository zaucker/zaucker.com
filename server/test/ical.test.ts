import { describe, it, expect } from 'vitest';
import { parseBusyRanges } from '../src/ical.js';

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:a1
DTSTART;VALUE=DATE:20260701
DTEND;VALUE=DATE:20260708
SUMMARY:Reserved
END:VEVENT
BEGIN:VEVENT
UID:a2
DTSTART;VALUE=DATE:20260812
DTEND;VALUE=DATE:20260819
SUMMARY:Airbnb (Not available)
END:VEVENT
END:VCALENDAR`;

describe('parseBusyRanges', () => {
  it('extracts half-open [DTSTART, DTEND) ranges from every VEVENT', () => {
    expect(parseBusyRanges(ICS)).toEqual([
      { from: '2026-07-01', to: '2026-07-08' },
      { from: '2026-08-12', to: '2026-08-19' },
    ]);
  });

  it('returns [] for an empty calendar', () => {
    const empty = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//EN\nEND:VCALENDAR`;
    expect(parseBusyRanges(empty)).toEqual([]);
  });
});
