import ical from 'node-ical';
import type { Range } from './types.js';
import { ymd } from './dates.js';

/** Parse an iCal document into half-open [from, to) night ranges.
 *  Every VEVENT is treated as busy; only the date part is used. */
export function parseBusyRanges(icsText: string): Range[] {
  const parsed = ical.sync.parseICS(icsText);
  const ranges: Range[] = [];
  for (const key of Object.keys(parsed)) {
    const ev = parsed[key] as { type?: string; start?: Date; end?: Date };
    if (!ev || ev.type !== 'VEVENT' || !ev.start || !ev.end) continue;
    const from = ymd(ev.start);
    const to = ymd(ev.end);
    if (to > from) ranges.push({ from, to });
  }
  return ranges;
}
