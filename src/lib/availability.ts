export interface Range {
  from: string;
  to: string;
}

export interface Availability {
  apartmentId: string;
  updatedAt: string;
  stale: boolean;
  /** Individual bookings, each half-open [from=checkin, to=checkout). */
  bookings: Range[];
}

/**
 * Occupancy of a single day, split into morning (am) / afternoon (pm):
 * - `free`     — nobody there
 * - `full`     — occupied all day (an interior night of one booking)
 * - `checkin`  — afternoon only (a guest arrives) → lower-right triangle
 * - `checkout` — morning only (a guest leaves) → upper-left triangle
 * - `turnover` — morning AND afternoon, but a guest leaves and a *different*
 *                guest arrives the same day → both triangles
 */
export type DayState = 'free' | 'full' | 'checkin' | 'checkout' | 'turnover';

export interface MonthGrid {
  year: number;
  month: number; // 0-based
  days: string[]; // YYYY-MM-DD for each day of the month
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 12 month grids starting at the month containing `today`. */
export function buildMonths(today: Date, count = 12): MonthGrid[] {
  const grids: MonthGrid[] = [];
  for (let i = 0; i < count; i++) {
    const m0 = today.getMonth() + i;
    const year = today.getFullYear() + Math.floor(m0 / 12);
    const month = ((m0 % 12) + 12) % 12;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) days.push(ymd(year, month, d));
    grids.push({ year, month, days });
  }
  return grids;
}

/**
 * Classify a day (YYYY-MM-DD) given the individual bookings.
 *
 * For a booking [from, to): the guest stays the nights from..to-1, so they are
 * present the *afternoon* of each night-day (from..to-1) and the *morning* after
 * each night (from+1..to). Thus, across all bookings:
 *   - am occupied  ⇔ ∃ booking with from < day ≤ to
 *   - pm occupied  ⇔ ∃ booking with from ≤ day < to
 *   - interior     ⇔ ∃ booking with from < day < to  (same guest, all day)
 */
export function dayState(day: string, bookings: Range[]): DayState {
  let am = false;
  let pm = false;
  let interior = false;
  for (const b of bookings) {
    if (b.from < day && day <= b.to) am = true;
    if (b.from <= day && day < b.to) pm = true;
    if (b.from < day && day < b.to) interior = true;
  }
  if (interior) return 'full';
  if (am && pm) return 'turnover';
  if (am) return 'checkout';
  if (pm) return 'checkin';
  return 'free';
}
