import type { Availability, FeedUrls, Range } from './types.js';
import { parseBusyRanges } from './ical.js';
import { mergeRanges, clipRanges } from './merge.js';
import { windowStart, windowEnd } from './dates.js';

export type FetchText = (url: string) => Promise<string>;

/** Build merged availability for one apartment.
 *  On a feed failure, reuse that feed's last-good ranges from `prevByUrl`
 *  and mark the result stale. Returns the fresh per-feed ranges for caching. */
export async function buildAvailability(
  apartmentId: string,
  feeds: FeedUrls,
  fetchText: FetchText,
  now: Date,
  prevByUrl: Record<string, Range[]> = {},
): Promise<{ availability: Availability; byUrl: Record<string, Range[]> }> {
  const urls = [feeds.airbnb, feeds.traum].filter((u): u is string => !!u);
  const byUrl: Record<string, Range[]> = {};
  let collected: Range[] = [];
  let stale = false;

  for (const url of urls) {
    try {
      const ranges = parseBusyRanges(await fetchText(url));
      byUrl[url] = ranges;
      collected = collected.concat(ranges);
    } catch {
      stale = true;
      const prev = prevByUrl[url] ?? [];
      byUrl[url] = prev;
      collected = collected.concat(prev);
    }
  }

  const busy = clipRanges(mergeRanges(collected), windowStart(now), windowEnd(now, 12));
  return {
    availability: { apartmentId, updatedAt: now.toISOString(), stale, busy },
    byUrl,
  };
}
