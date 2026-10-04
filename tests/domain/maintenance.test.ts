import { describe, expect, it } from "vitest";
import { CHECKLIST_TEMPLATES, addMonths, nextServiceDate, serviceSchedule, validateInvite, validateOperatingMode } from "@/domain";
import { NOW, station } from "../fixtures";

describe("calendar arithmetic", () => {
  it("adds months and clamps to the month end", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-08-15", 6)).toBe("2027-02-15");
  });
});

describe("maintenance plan", () => {
  it("schedules the next inspection 6 months and the annual check 12 months later", () => {
    expect(nextServiceDate("inspection_6m", "2026-10-04")).toBe("2027-04-04");
    expect(nextServiceDate("annual_coolant_fire", "2026-10-04")).toBe("2027-10-04");
    expect(nextServiceDate("repair", "2026-10-04")).toBeNull();
  });
  it("finds the next annual check from the installation date", () => {
    expect(serviceSchedule(station({ install_date: "2025-03-10" }), NOW).annual).toBe("2027-03-10");
    expect(serviceSchedule(station({ install_date: "2024-11-20" }), NOW).annual).toBe("2026-11-20");
  });
  it("has a checklist for every service type", () => {
    for (const items of Object.values(CHECKLIST_TEMPLATES)) expect(items.length).toBeGreaterThan(3);
  });
});

describe("other validations", () => {
  it("keeps the backup reserve within 10–80 %", () => {
    expect(() => validateOperatingMode("backup_reserve", 50)).not.toThrow();
    expect(() => validateOperatingMode("backup_reserve", 95)).toThrow("RESERVE_OUT_OF_RANGE");
    expect(() => validateOperatingMode("self_consumption", 0)).not.toThrow();
  });
  it("checks invitations", () => {
    expect(() => validateInvite("tech@armen.am", "Davit")).not.toThrow();
    expect(() => validateInvite("not-an-email", "Davit")).toThrow("EMAIL_INVALID");
    expect(() => validateInvite("tech@armen.am", " ")).toThrow("NAME_REQUIRED");
  });
});
