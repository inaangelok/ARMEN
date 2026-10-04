export type ServiceType =
  | "inspection_6m"
  | "annual_coolant_fire"
  | "repair"
  | "module_replacement"
  | "commissioning";

export type WorkOrderStatus = "new" | "scheduled" | "in_progress" | "done";

export type Priority = "low" | "normal" | "high" | "urgent";

export type IssueType = "alert" | "performance" | "noise" | "physical_damage" | "app_data" | "other";

export interface PartUsed {
  part: string;
  qty: number;
  serial?: string;
}

export interface WorkOrder {
  id: string;
  number: number;
  station_id: string;
  type: ServiceType;
  issue_type: IssueType | null;
  title: string;
  description: string;
  status: WorkOrderStatus;
  priority: Priority;
  preferred_date: string | null;
  scheduled_date: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  photos: string[];
  parts_used: PartUsed[];
  signature_url: string | null;
  signed_by: string | null;
  alert_id: string | null;
  resolution_notes: string | null;
}

export interface ChecklistItem {
  id: string;
  work_order_id: string;
  position: number;
  label_key: string;
  done: boolean;
  note: string | null;
}
