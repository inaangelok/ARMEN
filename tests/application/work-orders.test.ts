import { describe, expect, it } from "vitest";
import { makeWorkOrderUseCases } from "@/application/use-cases/work-orders";
import { check, workOrder } from "../fixtures";
import { fakeFiles, fakeWorkOrders, fixedClock } from "./fakes";

const setup = (initial = [workOrder({ id: "wo1", status: "in_progress", station_id: "st1" })]) => {
  const orders = fakeWorkOrders(initial);
  const files = fakeFiles();
  return { uc: makeWorkOrderUseCases(orders.repo, files.files, fixedClock()), orders, files };
};

describe("requestService (owner)", () => {
  it("creates an unassigned repair with priority from the issue", async () => {
    const { uc, orders } = setup([]);
    await uc.requestService({ stationId: "st1", issue: "physical_damage", title: "Damaged cabinet door", description: " dent ", preferredDate: "2026-10-10", photos: [] });
    expect(orders.created[0]).toMatchObject({ type: "repair", priority: "high", description: "dent", issue_type: "physical_damage" });
    expect(orders.created[0].assigned_to).toBeUndefined();
  });
  it("refuses a preferred date in the past", async () => {
    const { uc } = setup([]);
    await expect(uc.requestService({ stationId: "st1", issue: "noise", title: "Noise", description: "", preferredDate: "2026-09-01", photos: [] })).rejects.toMatchObject({ code: "DATE_IN_PAST" });
  });
});

describe("createWorkOrder (staff)", () => {
  it("follows the alert's severity and type unless overridden", async () => {
    const { uc, orders } = setup([]);
    await uc.createWorkOrder({ stationId: "st1", title: "SOH low", description: "", assignedTo: "t1", scheduledDate: null, alert: { id: "a1", code: "SOH_LOW", severity: "critical" } });
    expect(orders.created[0]).toMatchObject({ type: "module_replacement", priority: "urgent", issue_type: "alert", alert_id: "a1" });
  });
});

describe("completeWorkOrder", () => {
  it("uploads the signature and closes the order", async () => {
    const { uc, orders, files } = setup();
    const done = await uc.completeWorkOrder({
      workOrder: orders.items.get("wo1")!, checklist: [check(true)], signature: new Blob(["sig"]), signedBy: " Aram ", partsUsed: [{ part: "Pump", qty: 1 }], notes: "Replaced pump", acceptIncomplete: false,
    });
    expect(done).toMatchObject({ status: "done", signed_by: "Aram", signature_url: "signatures/st1/wo1.png", resolution_notes: "Replaced pump" });
    expect(files.uploads).toEqual(["signatures/st1/wo1.png"]);
  });
  it("does not upload or save anything when the signature is missing", async () => {
    const { uc, orders, files } = setup();
    await expect(uc.completeWorkOrder({ workOrder: orders.items.get("wo1")!, checklist: [], signature: null, signedBy: null, partsUsed: [], notes: "", acceptIncomplete: false })).rejects.toMatchObject({ code: "SIGNATURE_REQUIRED" });
    expect(files.uploads).toEqual([]);
    expect(orders.items.get("wo1")!.status).toBe("in_progress");
  });
});

describe("board moves and edits", () => {
  it("moves between open columns", async () => {
    const { uc } = setup([workOrder({ id: "wo1", status: "new" })]);
    expect((await uc.moveWorkOrder(workOrder({ id: "wo1", status: "new" }), "in_progress")).status).toBe("in_progress");
  });
  it("schedules a new order when a date is set", async () => {
    const { uc } = setup([workOrder({ id: "wo1", status: "new" })]);
    expect((await uc.editDetails(workOrder({ id: "wo1", status: "new" }), { scheduled_date: "2026-10-12" })).status).toBe("scheduled");
  });
  it("locks completed orders", async () => {
    const { uc } = setup([workOrder({ id: "wo1", status: "done" })]);
    await expect(uc.editDetails(workOrder({ id: "wo1", status: "done" }), { priority: "high" })).rejects.toMatchObject({ code: "WORK_ORDER_CLOSED" });
  });
  it("stores photos under the station and order", async () => {
    const { uc, files } = setup();
    const photo = Object.assign(new Blob(["x"]), { name: "Cabinet Door.JPG" });
    const wo = await uc.attachPhotos(workOrder({ id: "wo1", station_id: "st1" }), [photo]);
    expect(files.uploads[0]).toMatch(/^photos\/st1\/wo1\/\d+-0\.jpg$/);
    expect(wo.photos).toHaveLength(1);
  });
});
