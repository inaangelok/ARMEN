import {
  assertCanComplete, assertCanMove, assertEditable, assertNotPast, assertTitle, statusAfterScheduling, priorityForAlert, priorityForIssue, serviceTypeForAlert,
  type Alert, type ChecklistItem, type IssueType, type PartUsed, type Priority, type ServiceType, type WorkOrder, type WorkOrderStatus,
} from "@/domain";
import type { Clock, FileStorage, UploadFile, WorkOrderRepository } from "../ports";

const ext = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") : "jpg");

export interface ServiceRequestInput {
  stationId: string;
  issue: IssueType;
  title: string;
  description: string;
  preferredDate: string | null;
  photos: UploadFile[];
}

export interface CreateWorkOrderInput {
  stationId: string;
  title: string;
  description: string;
  type?: ServiceType;
  priority?: Priority;
  assignedTo: string | null;
  scheduledDate: string | null;
  alert?: Pick<Alert, "id" | "code" | "severity"> | null;
}

export type WorkOrderDetailsPatch = Partial<Pick<WorkOrder, "assigned_to" | "scheduled_date" | "priority" | "parts_used">>;

export interface CompleteWorkOrderInput {
  workOrder: WorkOrder;
  checklist: Pick<ChecklistItem, "done">[];
  signature: Blob | null;
  signedBy: string | null;
  partsUsed: PartUsed[];
  notes: string;
  acceptIncomplete: boolean;
}

export const makeWorkOrderUseCases = (orders: WorkOrderRepository, files: FileStorage, clock: Clock) => ({
  /** An owner asks for service from the app. It lands in the "new" column, unassigned. */
  async requestService(input: ServiceRequestInput): Promise<WorkOrder> {
    assertTitle(input.title);
    assertNotPast(input.preferredDate, clock.now());
    return orders.createWorkOrder({
      station_id: input.stationId,
      type: "repair",
      issue_type: input.issue,
      title: input.title.trim(),
      description: input.description.trim(),
      preferred_date: input.preferredDate,
      priority: priorityForIssue(input.issue),
      photos: input.photos,
    });
  },

  /** Staff open a work order, optionally from an alert (type and priority follow the alert). */
  async createWorkOrder(input: CreateWorkOrderInput): Promise<WorkOrder> {
    assertTitle(input.title);
    assertNotPast(input.scheduledDate, clock.now());
    return orders.createWorkOrder({
      station_id: input.stationId,
      type: input.type ?? serviceTypeForAlert(input.alert),
      issue_type: input.alert ? "alert" : null,
      title: input.title.trim(),
      description: input.description.trim(),
      priority: input.priority ?? priorityForAlert(input.alert),
      assigned_to: input.assignedTo,
      scheduled_date: input.scheduledDate,
      alert_id: input.alert?.id ?? null,
    });
  },

  /** Drag on the Kanban board. Completion must go through completeWorkOrder. */
  async moveWorkOrder(wo: WorkOrder, to: WorkOrderStatus): Promise<WorkOrder> {
    assertCanMove(wo, to);
    return orders.updateWorkOrder(wo.id, { status: to });
  },

  /** Edits planning fields of an open order (technician, date, priority, parts). */
  async editDetails(wo: WorkOrder, patch: WorkOrderDetailsPatch): Promise<WorkOrder> {
    assertEditable(wo);
    const next: Partial<WorkOrder> = { ...patch };
    if ("scheduled_date" in patch) {
      assertNotPast(patch.scheduled_date, clock.now());
      next.status = statusAfterScheduling(wo.status, patch.scheduled_date ?? null);
    }
    return orders.updateWorkOrder(wo.id, next);
  },

  setChecklistItem: (id: string, done: boolean) => orders.updateChecklistItem(id, { done }),

  async attachPhotos(wo: WorkOrder, photos: UploadFile[]): Promise<WorkOrder> {
    const stamp = clock.now();
    const refs = await Promise.all(photos.map((f, i) => files.uploadFile("photos", `${wo.station_id}/${wo.id}/${stamp}-${i}.${ext(f.name)}`, f)));
    return orders.updateWorkOrder(wo.id, { photos: [...wo.photos, ...refs] });
  },

  /** Closes a work order with the customer's signature, parts used and notes. */
  async completeWorkOrder(input: CompleteWorkOrderInput): Promise<WorkOrder> {
    const wo = input.workOrder;
    assertCanComplete(wo, { checklist: input.checklist, hasSignature: !!input.signature || !!wo.signature_url, acceptIncomplete: input.acceptIncomplete });
    const signature_url = input.signature ? await files.uploadFile("signatures", `${wo.station_id}/${wo.id}.png`, input.signature) : wo.signature_url;
    return orders.updateWorkOrder(wo.id, {
      status: "done",
      parts_used: input.partsUsed,
      resolution_notes: input.notes.trim() || null,
      signed_by: input.signedBy?.trim() || null,
      signature_url,
    });
  },

  resolveFileUrl: (ref: string) => files.resolveFileUrl(ref),
});
