// Data shapes that cross the application boundary (inputs to ports and use cases).
import type { HistoryPoint, IssueType, ModuleGrade, ModuleReading, Priority, Role, ServiceType, StationSnapshot } from "@/domain";

export interface PowerPoint {
  ts: string;
  pv: number;
  load: number;
  grid: number;
  battery: number;
  soc: number;
}

export interface ModuleHistoryPoint extends HistoryPoint {
  soc?: number;
  voltage?: number;
}

export interface NewWorkOrder {
  station_id: string;
  type: ServiceType;
  issue_type?: IssueType | null;
  title: string;
  description?: string;
  priority?: Priority;
  preferred_date?: string | null;
  scheduled_date?: string | null;
  assigned_to?: string | null;
  alert_id?: string | null;
  photos?: UploadFile[];
}

export interface ReplaceModuleInput {
  faultyModuleId: string;
  newSerial: string;
  newGrade: ModuleGrade;
  newInitialSoh: number;
  reason: string;
  workOrderId?: string | null;
}

export interface LiveEvent {
  snapshot: StationSnapshot;
  modules?: ModuleReading[];
}

export interface DemoAccount {
  role: Role;
  email: string;
  name: string;
  password: string;
}

/** A file chosen by the user (a browser File satisfies this). */
export type UploadFile = Blob & { readonly name: string };

/** Web Push subscription as produced by PushSubscription.toJSON(). */
export interface WebPushSubscription {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: Record<string, string>;
}

export type StorageBucket = "photos" | "signatures" | "documents";
