export interface Range {
  from: string;
  to: string;
}

export interface Availability {
  apartmentId: string;
  updatedAt: string;
  stale: boolean;
  busy: Range[];
}

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

/** A day (YYYY-MM-DD) is booked if it falls in any half-open [from, to) range. */
export function isBooked(day: string, ranges: Range[]): boolean {
  return ranges.some((r) => day >= r.from && day < r.to);
}
