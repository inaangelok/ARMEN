import { describe, expect, it } from "vitest";
import { buildFleetRows, healthLabel, moduleCondition, stationStatus, worstSeverity } from "@/domain";
import { NOW, alert, reading, snapshot, station } from "../fixtures";

describe("worstSeverity", () => {
  it("returns the most severe open alert", () => {
    expect(worstSeverity([alert({ severity: "info" }), alert({ severity: "critical" })])).toBe("critical");
    expect(worstSeverity([alert({ severity: "warning" })])).toBe("warning");
    expect(worstSeverity([])).toBeNull();
  });
});

describe("healthLabel", () => {
  it("is good when nothing is wrong", () => {
    expect(healthLabel(snapshot(), [reading()], [], "st1")).toBe("good");
  });
  it("needs service below 80 % SOH even without alerts", () => {
    expect(healthLabel(snapshot(), [reading({ soh: 79.5 })], [], "st1")).toBe("service");
  });
  it("needs attention between 80 and 85 % SOH", () => {
    expect(healthLabel(snapshot(), [reading({ soh: 83 })], [], "st1")).toBe("attention");
  });
  it("ignores resolved alerts and alerts of other stations", () => {
    const alerts = [alert({ severity: "critical", status: "resolved" }), alert({ severity: "critical", station_id: "other" })];
    expect(healthLabel(snapshot(), undefined, alerts, "st1")).toBe("good");
  });
});

describe("stationStatus", () => {
  it("is offline when neither gateway nor telemetry was seen for an hour", () => {
    const old = new Date(NOW - 2 * 3600_000).toISOString();
    expect(stationStatus(snapshot({ ts: old }), [], "st1", old, NOW)).toBe("offline");
  });
  it("is offline without any snapshot", () => {
    expect(stationStatus(undefined, [], "st1", null, NOW)).toBe("offline");
  });
  it("reflects the worst open alert", () => {
    expect(stationStatus(snapshot(), [alert({ severity: "critical" })], "st1", null, NOW)).toBe("critical");
    expect(stationStatus(snapshot(), [alert({ severity: "warning", status: "acknowledged" })], "st1", null, NOW)).toBe("warning");
    expect(stationStatus(snapshot(), [], "st1", null, NOW)).toBe("ok");
  });
});

describe("moduleCondition", () => {
  it.each([
    [{ temperature: 56 }, "critical"],
    [{ temperature: 46 }, "warning"],
    [{ cell_min_mv: 3200, cell_max_mv: 3310 }, "critical"],
    [{ cell_min_mv: 3200, cell_max_mv: 3260 }, "warning"],
    [{ soh: 84 }, "warning"],
    [{}, "ok"],
  ] as const)("%o → %s", (patch, expected) => {
    expect(moduleCondition(reading(patch))).toBe(expected);
  });
  it("a module marked faulty is always critical", () => {
    expect(moduleCondition(reading(), true)).toBe("critical");
  });
});

describe("buildFleetRows", () => {
  it("counts only open warning/critical alerts per station", () => {
    const rows = buildFleetRows(
      [station()],
      [{ id: "c1", name: "Aram", kind: "home", phone: "", email: "", owner_id: null }],
      { st1: snapshot() },
      [alert({ severity: "info" }), alert({ id: "a2", severity: "critical" }), alert({ id: "a3", status: "resolved" })],
      NOW,
    );
    expect(rows[0]).toMatchObject({ openAlerts: 1, worstSeverity: "critical", status: "critical", health: "service" });
    expect(rows[0].customer?.name).toBe("Aram");
  });
});
