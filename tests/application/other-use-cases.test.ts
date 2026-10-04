import { describe, expect, it } from "vitest";
import { makeAlertUseCases } from "@/application/use-cases/alerts";
import { makeAuthUseCases } from "@/application/use-cases/auth";
import { makeModuleUseCases } from "@/application/use-cases/modules";
import { makeStationUseCases } from "@/application/use-cases/stations";
import { makeUserUseCases } from "@/application/use-cases/users";
import { module_, profile } from "../fixtures";
import { fakeAlerts, fakeAuth, fakeModules, fakeStations, fakeUsers, fixedClock } from "./fakes";

describe("replaceModule", () => {
  const faulty = module_({ id: "old", serial: "AM5-OLD" });
  it("validates against the module registry before calling the backend", async () => {
    const m = fakeModules([faulty, module_({ id: "x", serial: "AM5-USED", station_id: "st2" })]);
    const uc = makeModuleUseCases(m.repo);
    await expect(uc.replaceModule({ faulty, newSerial: "AM5-USED", newGrade: "A", newInitialSoh: 95, reason: "fade", workOrderId: null })).rejects.toMatchObject({ code: "SERIAL_IN_USE" });
    expect(m.replaced).toEqual([]);
  });
  it("passes a clean command to the backend", async () => {
    const m = fakeModules([faulty]);
    await makeModuleUseCases(m.repo).replaceModule({ faulty, newSerial: " AM5-NEW ", newGrade: "B", newInitialSoh: 90, reason: " fade ", workOrderId: "wo1" });
    expect(m.replaced[0]).toEqual({ faultyModuleId: "old", newSerial: "AM5-NEW", newGrade: "B", newInitialSoh: 90, reason: "fade", workOrderId: "wo1" });
  });
});

describe("alert rules", () => {
  it("saves valid thresholds", async () => {
    const a = fakeAlerts();
    await makeAlertUseCases(a.repo).updateThresholds({ id: "r1", kind: "threshold", operator: ">" }, 40, 55);
    expect(a.ruleUpdates).toEqual([["r1", { warning_threshold: 40, critical_threshold: 55 }]]);
  });
  it("turns rule validation into a domain error", async () => {
    const a = fakeAlerts();
    await expect(makeAlertUseCases(a.repo).updateThresholds({ id: "r1", kind: "threshold", operator: ">" }, 60, 55)).rejects.toMatchObject({ code: "THRESHOLD_ORDER" });
    expect(a.ruleUpdates).toEqual([]);
  });
  it("acknowledges and resolves", async () => {
    const a = fakeAlerts();
    const uc = makeAlertUseCases(a.repo);
    await uc.acknowledgeAlert("a1");
    await uc.resolveAlert("a2");
    expect(a.statuses).toEqual([["a1", "acknowledged"], ["a2", "resolved"]]);
  });
});

describe("stations", () => {
  it("validates the backup reserve", async () => {
    const s = fakeStations();
    const uc = makeStationUseCases(s.repo, s.repo, fixedClock());
    await expect(uc.setOperatingMode("st1", "backup_reserve", 95)).rejects.toMatchObject({ code: "RESERVE_OUT_OF_RANGE" });
    expect((await uc.setOperatingMode("st1", "backup_reserve", 40)).backup_reserve_pct).toBe(40);
  });
});

describe("auth", () => {
  const noPush = { enable: async () => "denied" as const };
  it("keeps the language chosen on the login screen", async () => {
    const a = fakeAuth(profile({ language: "hy" }));
    const p = await makeAuthUseCases(a.auth, noPush, { savePushSubscription: async () => {} }).signIn("a@b.am", "pw", "en");
    expect(p.language).toBe("en");
  });
  it("turns on push only when the browser grants permission", async () => {
    const a = fakeAuth();
    const saved: unknown[] = [];
    const granted = { enable: async (save: (s: { endpoint: string }) => Promise<void>) => (await save({ endpoint: "https://push" }), "granted" as const) };
    const r = await makeAuthUseCases(a.auth, granted, { savePushSubscription: async (s) => void saved.push(s) }).enablePushNotifications();
    expect(r.permission).toBe("granted");
    expect(r.profile?.notify_push).toBe(true);
    expect(saved).toHaveLength(1);
  });
});

describe("users", () => {
  it("normalises invitations", async () => {
    const u = fakeUsers();
    await makeUserUseCases(u.repo).inviteUser({ email: " Tech@ARMEN.am ", full_name: " Davit ", role: "technician" });
    expect(u.invites[0]).toEqual({ email: "tech@armen.am", full_name: "Davit", role: "technician" });
  });
});
