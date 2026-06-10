/** Format a Date as YYYY-MM-DD from its local calendar components. */
export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** First day of the month containing `now`. */
export function windowStart(now: Date): string {
  return ymd(new Date(now.getFullYear(), now.getMonth(), 1));
}

/** First day of the month `count` months after the month containing `now`. */
export function windowEnd(now: Date, count: number): string {
  return ymd(new Date(now.getFullYear(), now.getMonth() + count, 1));
}
