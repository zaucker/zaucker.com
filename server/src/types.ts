/** A feed is either a plain URL, or a URL plus tuning. `checkoutShiftDays`
 *  corrects a platform's checkout convention (traum reports checkout +1 day,
 *  so it's configured with -1). */
export type FeedRef = string | { url: string; checkoutShiftDays?: number };

export interface FeedUrls {
  airbnb?: FeedRef;
  traum?: FeedRef;
}

export interface ResolvedFeed {
  url: string;
  checkoutShiftDays: number;
}

/** Normalize a FeedRef (string or object) to {url, checkoutShiftDays}. */
export function resolveFeed(ref: FeedRef): ResolvedFeed {
  return typeof ref === 'string'
    ? { url: ref, checkoutShiftDays: 0 }
    : { url: ref.url, checkoutShiftDays: ref.checkoutShiftDays ?? 0 };
}

export interface Config {
  refreshMinutes: number;
  apartments: Record<string, FeedUrls>;
}

/** Half-open booked night range [from, to): `to` (checkout day) is free. */
export interface Range {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD (exclusive)
}

export interface Availability {
  apartmentId: string;
  updatedAt: string; // ISO timestamp
  stale: boolean;
  /** Individual bookings (NOT merged), each a half-open [from=checkin, to=checkout)
   *  range. Kept separate so the UI can render check-in/checkout half-days and
   *  same-day turnovers between different guests. */
  bookings: Range[];
}
