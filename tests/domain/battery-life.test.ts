import { describe, expect, it } from "vitest";
import { DAY_MS, estimateYearsTo80, yearsUntil } from "@/domain";

const series = (start: number, lossPerYear: number, days = 365) =>
  Array.from({ length: days }, (_, i) => ({ t: i * DAY_MS, soh: start - (lossPerYear * i) / 365 }));

describe("estimateYearsTo80", () => {
  it("extends the SOH trend to the 80 % threshold", () => {
    const est = estimateYearsTo80(series(95, 2));
    expect(est.ratePerYear).toBeCloseTo(2, 1);
    // ends the year at 93 % → 13 points left at 2 %/year
    expect(est.years).toBeCloseTo(6.5, 1);
  });
  it("cannot tell with fewer than 5 points", () => {
    expect(estimateYearsTo80(series(95, 2, 4)).years).toBeNull();
  });
  it("treats a flat trend as 'no end in sight'", () => {
    expect(estimateYearsTo80(series(95, 0)).years).toBeNull();
  });
  it("is zero once SOH is at or below 80 %", () => {
    expect(estimateYearsTo80(series(81, 5)).years).toBe(0);
  });
});

describe("yearsUntil", () => {
  it("counts years to a date", () => {
    expect(yearsUntil("2036-10-04", Date.parse("2026-10-04"))).toBeCloseTo(10, 1);
  });
});
