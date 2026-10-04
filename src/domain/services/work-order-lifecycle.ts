import type { Alert, ChecklistItem, IssueType, Priority, ServiceType, WorkOrder, WorkOrderStatus } from "../model";
import { DomainError } from "../errors/domain-error";
import { isoDay } from "./time";

/**
 * Work-order lifecycle:  new → scheduled → in_progress → done
 * Orders can move back while open (e.g. re-scheduled), but "done" is final and
 * can only be reached through completion (checklist + customer signature).
 */
const ALLOWED: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  new: ["scheduled", "in_progress"],
  scheduled: ["new", "in_progress"],
  in_progress: ["new", "scheduled"],
  done: [],
};

export function assertCanMove(wo: Pick<WorkOrder, "status">, to: WorkOrderStatus): void {
  if (wo.status === "done") throw new DomainError("WORK_ORDER_CLOSED");
  if (to === "done") throw new DomainError("COMPLETE_IN_DIALOG");
  if (!ALLOWED[wo.status].includes(to)) throw new DomainError("INVALID_TRANSITION", { from: wo.status, to });
}

export interface CompletionInput {
  checklist: Pick<ChecklistItem, "done">[];
  hasSignature: boolean;
  /** The technician confirmed finishing with open checklist items. */
  acceptIncomplete: boolean;
}

/** A work order may be closed only with the customer's signature; open checklist items need explicit confirmation. */
export function assertCanComplete(wo: Pick<WorkOrder, "status">, input: CompletionInput): void {
  if (wo.status === "done") throw new DomainError("WORK_ORDER_CLOSED");
  const open = input.checklist.filter((c) => !c.done).length;
  if (open > 0 && !input.acceptIncomplete) throw new DomainError("CHECKLIST_INCOMPLETE", { open });
  if (!input.hasSignature) throw new DomainError("SIGNATURE_REQUIRED");
}

/** Priority of a customer service request, from what the customer reported. */
export const priorityForIssue = (issue: IssueType): Priority => (issue === "physical_damage" ? "high" : "normal");

/** Priority of a work order raised from an alert. */
export const priorityForAlert = (alert: Pick<Alert, "severity"> | null | undefined): Priority =>
  alert?.severity === "critical" ? "urgent" : alert?.severity === "warning" ? "high" : "normal";

/** Service type for a work order raised from an alert. */
export const serviceTypeForAlert = (alert: Pick<Alert, "code"> | null | undefined): ServiceType => (alert?.code === "SOH_LOW" ? "module_replacement" : "repair");

/** Validates a requested or scheduled date: must be today or later. */
export function assertNotPast(day: string | null | undefined, now: number): void {
  if (day && day < isoDay(now)) throw new DomainError("DATE_IN_PAST");
}

export function assertTitle(title: string): void {
  if (!title.trim()) throw new DomainError("TITLE_REQUIRED");
}

/** Giving a new order a date schedules it; other states are kept. */
export const statusAfterScheduling = (status: WorkOrderStatus, scheduledDate: string | null): WorkOrderStatus =>
  status === "new" && scheduledDate ? "scheduled" : status;

export function assertEditable(wo: Pick<WorkOrder, "status">): void {
  if (wo.status === "done") throw new DomainError("WORK_ORDER_CLOSED");
}
