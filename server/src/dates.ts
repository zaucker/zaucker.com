/** Format a Date as YYYY-MM-DD from its local calendar components. */
export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Shift a YYYY-MM-DD string by `days` (may be negative). UTC math, no DST drift. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** First day of the month containing `now`. */
export function windowStart(now: Date): string {
  return ymd(new Date(now.getFullYear(), now.getMonth(), 1));
}

/** First day of the month `count` months after the month containing `now`. */
export function windowEnd(now: Date, count: number): string {
  return ymd(new Date(now.getFullYear(), now.getMonth() + count, 1));
}
