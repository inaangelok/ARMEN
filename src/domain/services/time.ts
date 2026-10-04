/** Time helpers. Domain functions receive `now` as an argument so they stay pure and testable. */
export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const YEAR_MS = 365.25 * DAY_MS;

/** Calendar day (YYYY-MM-DD) of an epoch-ms value in UTC. */
export const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Adds whole calendar months to a YYYY-MM-DD date (day clamped to the month's length). */
export function addMonths(day: string, months: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12), nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}
