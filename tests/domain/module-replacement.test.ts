import { describe, expect, it } from "vitest";
import { validateReplacement, type DomainError } from "@/domain";
import { module_ } from "../fixtures";

const faulty = module_({ id: "old", serial: "AM5-OLD" });
const spare = module_({ id: "sp", serial: "AM5-SPARE", station_id: null, status: "spare", row: null, slot: null });
const installedElsewhere = module_({ id: "x", serial: "AM5-USED", station_id: "st9" });
const registry = [faulty, spare, installedElsewhere];
const base = { faulty, newSerial: "AM5-SPARE", newGrade: "A" as const, newInitialSoh: 95, reason: "SOH below 80%" };

const codeOf = (patch: Partial<typeof base>) => {
  try {
    validateReplacement({ ...base, ...patch }, registry);
    return "OK";
  } catch (e) {
    return (e as DomainError).code;
  }
};

describe("module replacement rules", () => {
  it("accepts a spare from stock", () => expect(codeOf({})).toBe("OK"));
  it("accepts a brand-new serial", () => expect(codeOf({ newSerial: "AM5-NEW-1" })).toBe("OK"));
  it("rejects a serial installed in another station", () => expect(codeOf({ newSerial: "AM5-USED" })).toBe("SERIAL_IN_USE"));
  it("rejects re-installing the removed module", () => expect(codeOf({ newSerial: "AM5-OLD" })).toBe("SERIAL_SAME_AS_REMOVED"));
  it("needs a serial", () => expect(codeOf({ newSerial: "  " })).toBe("SERIAL_REQUIRED"));
  it("only accepts second-life modules at 80–100 % SOH", () => {
    expect(codeOf({ newInitialSoh: 78 })).toBe("SOH_OUT_OF_RANGE");
    expect(codeOf({ newInitialSoh: 101 })).toBe("SOH_OUT_OF_RANGE");
  });
  it("needs a documented reason", () => expect(codeOf({ reason: "" })).toBe("REASON_REQUIRED"));
  it("cannot replace a module that is not installed", () => expect(codeOf({ faulty: spare })).toBe("MODULE_NOT_INSTALLED"));
});
