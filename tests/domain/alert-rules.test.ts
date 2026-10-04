import { describe, expect, it } from "vitest";
import { DEFAULT_ALERT_RULES, RuleValidationError, alertKey, evaluateRules, validateThresholds, type RuleLike } from "@/domain";

const rules = DEFAULT_ALERT_RULES as RuleLike[];
const station = (o: Partial<Parameters<typeof evaluateRules>[1]> = {}) => ({
  coolant_out_temp: 25,
  mode: "idle",
  systems: { pump: { status: "ok" }, fire: { state: "armed", pressure_bar: 3.2 }, inverter: { state: "ok", code: null } },
  ...o,
});
const mod = (o = {}) => ({ module_id: "m1", row: 1, slot: 4, soh: 93, temperature: 27, cell_min_mv: 3260, cell_max_mv: 3280, ...o });

describe("evaluateRules", () => {
  it("raises nothing for a healthy station", () => {
    expect(evaluateRules(rules, station(), [mod()])).toEqual([]);
  });
  it("raises a critical over-temperature with the module position", () => {
    const [a] = evaluateRules(rules, station(), [mod({ temperature: 56.04 })]);
    expect(a).toMatchObject({ code: "MODULE_OVER_TEMP", severity: "critical", module_id: "m1", params: { module: "1-4", value: 56, threshold: 55 } });
  });
  it("uses warning level between the thresholds", () => {
    expect(evaluateRules(rules, station(), [mod({ temperature: 50 })])[0].severity).toBe("warning");
  });
  it("handles 'below' rules such as low SOH", () => {
    expect(evaluateRules(rules, station(), [mod({ soh: 79 })])[0]).toMatchObject({ code: "SOH_LOW", severity: "critical" });
  });
  it("raises event alerts from the station systems", () => {
    const codes = evaluateRules(rules, station({ systems: { pump: { status: "fault" }, fire: { state: "armed", pressure_bar: 1.4 }, inverter: { state: "ok", code: null } } }), []).map((a) => a.code);
    expect(codes).toEqual(expect.arrayContaining(["COOLING_PUMP_FAULT", "FIRE_SYSTEM_FAULT"]));
  });
  it("skips disabled rules", () => {
    const off = rules.map((r) => (r.code === "MODULE_OVER_TEMP" ? { ...r, enabled: false } : r));
    expect(evaluateRules(off, station(), [mod({ temperature: 70 })])).toEqual([]);
  });
  it("de-duplicates by code and module", () => {
    expect(alertKey({ code: "SOH_LOW", module_id: "m1" })).toBe("SOH_LOW:m1");
    expect(alertKey({ code: "GRID_OUTAGE", module_id: null })).toBe("GRID_OUTAGE:-");
  });
});

describe("validateThresholds", () => {
  it("needs critical above warning for '>' rules", () => {
    expect(() => validateThresholds(">", 45, 55)).not.toThrow();
    expect(() => validateThresholds(">", 55, 45)).toThrow(RuleValidationError);
  });
  it("needs critical below warning for '<' rules", () => {
    expect(() => validateThresholds("<", 85, 80)).not.toThrow();
    expect(() => validateThresholds("<", 80, 85)).toThrow(RuleValidationError);
  });
  it("rejects missing numbers", () => {
    expect(() => validateThresholds(">", Number.NaN, 55)).toThrow(RuleValidationError);
  });
});
