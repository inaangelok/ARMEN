import { describe, expect, it } from "vitest";
import {
  DomainError, assertCanComplete, assertCanMove, assertNotPast, priorityForAlert, priorityForIssue, serviceTypeForAlert, statusAfterScheduling,
} from "@/domain";
import { NOW, check, workOrder } from "../fixtures";

const code = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    return (e as DomainError).code;
  }
  return "OK";
};

describe("moving a work order on the board", () => {
  it("allows open states to move between each other", () => {
    expect(code(() => assertCanMove(workOrder({ status: "new" }), "scheduled"))).toBe("OK");
    expect(code(() => assertCanMove(workOrder({ status: "in_progress" }), "new"))).toBe("OK");
  });
  it("never jumps straight to done", () => {
    expect(code(() => assertCanMove(workOrder({ status: "in_progress" }), "done"))).toBe("COMPLETE_IN_DIALOG");
  });
  it("keeps completed orders closed", () => {
    expect(code(() => assertCanMove(workOrder({ status: "done" }), "new"))).toBe("WORK_ORDER_CLOSED");
  });
});

describe("completing a work order", () => {
  const wo = workOrder({ status: "in_progress" });
  it("requires the customer's signature", () => {
    expect(code(() => assertCanComplete(wo, { checklist: [check(true)], hasSignature: false, acceptIncomplete: false }))).toBe("SIGNATURE_REQUIRED");
  });
  it("asks for confirmation when checklist items are open", () => {
    const e = (() => {
      try {
        assertCanComplete(wo, { checklist: [check(true), check(false, 1), check(false, 2)], hasSignature: true, acceptIncomplete: false });
      } catch (err) {
        return err as DomainError;
      }
    })();
    expect(e?.code).toBe("CHECKLIST_INCOMPLETE");
    expect(e?.params.open).toBe(2);
  });
  it("completes once confirmed and signed", () => {
    expect(code(() => assertCanComplete(wo, { checklist: [check(false)], hasSignature: true, acceptIncomplete: true }))).toBe("OK");
  });
});

describe("work order defaults", () => {
  it("derives priority and type from the alert", () => {
    expect(priorityForAlert({ severity: "critical" })).toBe("urgent");
    expect(priorityForAlert({ severity: "warning" })).toBe("high");
    expect(priorityForAlert(null)).toBe("normal");
    expect(serviceTypeForAlert({ code: "SOH_LOW" })).toBe("module_replacement");
    expect(serviceTypeForAlert({ code: "MODULE_OVER_TEMP" })).toBe("repair");
  });
  it("treats physical damage reported by owners as high priority", () => {
    expect(priorityForIssue("physical_damage")).toBe("high");
    expect(priorityForIssue("noise")).toBe("normal");
  });
  it("schedules a new order when it gets a date", () => {
    expect(statusAfterScheduling("new", "2026-10-10")).toBe("scheduled");
    expect(statusAfterScheduling("in_progress", "2026-10-10")).toBe("in_progress");
    expect(statusAfterScheduling("new", null)).toBe("new");
  });
  it("rejects dates in the past", () => {
    expect(code(() => assertNotPast("2026-10-03", NOW))).toBe("DATE_IN_PAST");
    expect(code(() => assertNotPast("2026-10-04", NOW))).toBe("OK");
  });
});
