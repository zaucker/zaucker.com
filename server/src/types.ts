export interface FeedUrls {
  airbnb?: string;
  traum?: string;
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
  busy: Range[];
}
