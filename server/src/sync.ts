import { type Availability, type FeedUrls, type Range, resolveFeed } from './types.js';
import { parseBusyRanges } from './ical.js';
import { normalizeBookings, clipRanges } from './merge.js';
import { windowStart, windowEnd, addDays } from './dates.js';

export type FetchText = (url: string) => Promise<string>;

/** Build availability for one apartment from its feeds.
 *  Bookings are kept individual (deduped across feeds, NOT merged) so the UI can
 *  render check-in/checkout half-days and same-day turnovers. On a feed failure,
 *  reuse that feed's last-good ranges from `prevByUrl` and mark the result stale.
 *  Returns the fresh per-feed ranges for caching. */
export async function buildAvailability(
  apartmentId: string,
  feeds: FeedUrls,
  fetchText: FetchText,
  now: Date,
  prevByUrl: Record<string, Range[]> = {},
): Promise<{ availability: Availability; byUrl: Record<string, Range[]> }> {
  const refs = [feeds.airbnb, feeds.traum]
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map(resolveFeed);
  const byUrl: Record<string, Range[]> = {};
  let collected: Range[] = [];
  let stale = false;

  for (const { url, checkoutShiftDays } of refs) {
    try {
      let ranges = parseBusyRanges(await fetchText(url));
      // Correct the platform's checkout convention (e.g. traum reports +1 day).
      if (checkoutShiftDays !== 0) {
        ranges = ranges
          .map((r) => ({ from: r.from, to: addDays(r.to, checkoutShiftDays) }))
          .filter((r) => r.to > r.from);
      }
      byUrl[url] = ranges;
      collected = collected.concat(ranges);
    } catch {
      stale = true;
      const prev = prevByUrl[url] ?? [];
      byUrl[url] = prev;
      collected = collected.concat(prev);
    }
  }

  const bookings = normalizeBookings(clipRanges(collected, windowStart(now), windowEnd(now, 12)));
  return {
    availability: { apartmentId, updatedAt: now.toISOString(), stale, bookings },
    byUrl,
  };
}
