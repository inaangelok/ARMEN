import { SOH_END_OF_LIFE } from "../model/catalog";
import { DAY_MS, YEAR_MS } from "./time";

export interface LifeEstimate {
  /** Years until SOH reaches 80 %; null when the trend is too flat (or there is too little data) to tell. */
  years: number | null;
  /** SOH loss in percentage points per year (positive = degrading). */
  ratePerYear: number;
}

/**
 * Remaining useful life of a second-life battery: a least-squares line through the SOH history,
 * extended to the 80 % end-of-life threshold.
 */
export function estimateYearsTo80(points: { t: number; soh: number }[]): LifeEstimate {
  if (points.length < 5) return { years: null, ratePerYear: 0 };
  const n = points.length;
  const mx = points.reduce((a, p) => a + p.t, 0) / n;
  const my = points.reduce((a, p) => a + p.soh, 0) / n;
  let num = 0, den = 0;
  for (const p of points) {
    num += (p.t - mx) * (p.soh - my);
    den += (p.t - mx) ** 2;
  }
  const slopePerMs = den === 0 ? 0 : num / den;
  const ratePerYear = -slopePerMs * 365 * DAY_MS;
  const current = points[n - 1].soh;
  if (current <= SOH_END_OF_LIFE) return { years: 0, ratePerYear };
  if (ratePerYear <= 0.05) return { years: null, ratePerYear };
  return { years: (current - SOH_END_OF_LIFE) / ratePerYear, ratePerYear };
}

/** Years left until a date (negative when it has passed). */
export const yearsUntil = (isoDate: string, now: number) => (Date.parse(isoDate) - now) / YEAR_MS;
