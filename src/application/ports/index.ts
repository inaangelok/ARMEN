// Ports: what the application needs from the outside world. Infrastructure adapters implement them.
// Each port is small (interface segregation), so a use case depends only on what it uses.
import type {
  Alert, AlertRule, ChecklistItem, Customer, DailyEnergy, DocumentRec, EventLogEntry, HistoryPoint, Module, ModuleAssignment,
  ModuleReading, Profile, RangeKey, Role, ServiceRecord, Station, StationSnapshot, WorkOrder,
} from "@/domain";
import type { DemoAccount, LiveEvent, ModuleHistoryPoint, NewWorkOrder, PowerPoint, ReplaceModuleInput, StorageBucket, WebPushSubscription } from "./dto";

export type * from "./dto";

export interface AuthPort {
  getSession(): Promise<Profile | null>;
  signIn(email: string, password: string): Promise<Profile>;
  signOut(): Promise<void>;
  updateMyProfile(patch: Partial<Profile>): Promise<Profile>;
}

export interface UserRepository {
  listProfiles(): Promise<Profile[]>;
  updateProfile(id: string, patch: Partial<Pick<Profile, "role" | "region" | "full_name" | "phone">>): Promise<void>;
  inviteUser(input: { email: string; full_name: string; role: Role }): Promise<void>;
}

export interface StationRepository {
  listStations(): Promise<Station[]>;
  updateStation(id: string, patch: Partial<Station>): Promise<Station>;
  listCustomers(): Promise<Customer[]>;
}

export interface TelemetryPort {
  getSnapshots(): Promise<Record<string, StationSnapshot>>;
  getModuleReadings(stationId: string): Promise<ModuleReading[]>;
  getStationHistory(stationId: string, range: RangeKey): Promise<HistoryPoint[]>;
  getModuleHistory(moduleId: string, range: RangeKey): Promise<ModuleHistoryPoint[]>;
  getPowerSeries(stationId: string): Promise<PowerPoint[]>;
  getDaily(stationId: string, fromDay: string, toDay: string): Promise<DailyEnergy[]>;
  getRawTelemetry(stationId: string, limit: number): Promise<ModuleReading[]>;
}

export interface RealtimePort {
  /** Live telemetry pushed by the backend. Returns an unsubscribe function. */
  subscribeLive(cb: (e: LiveEvent) => void): () => void;
  /** "Data changed" notifications (alerts, work orders…) so views can refresh. */
  onChange(cb: (topic: string) => void): () => void;
}

export interface SimulationPort {
  setSimulation(on: boolean, stationIds: string[]): void;
  isSimulating(): boolean;
}

export interface ModuleRepository {
  listModules(): Promise<Module[]>;
  listAssignments(): Promise<ModuleAssignment[]>;
  markModuleFaulty(moduleId: string, reason: string): Promise<void>;
  replaceModule(input: ReplaceModuleInput): Promise<void>;
}

export interface AlertRepository {
  listAlerts(): Promise<Alert[]>;
  setAlertStatus(id: string, status: Alert["status"]): Promise<void>;
  listRules(): Promise<AlertRule[]>;
  updateRule(id: string, patch: Partial<AlertRule>): Promise<void>;
}

export interface WorkOrderRepository {
  listWorkOrders(): Promise<WorkOrder[]>;
  listChecklist(workOrderId: string): Promise<ChecklistItem[]>;
  createWorkOrder(input: NewWorkOrder): Promise<WorkOrder>;
  updateWorkOrder(id: string, patch: Partial<WorkOrder>): Promise<WorkOrder>;
  updateChecklistItem(id: string, patch: Partial<ChecklistItem>): Promise<void>;
}

export interface FileStorage {
  uploadFile(bucket: StorageBucket, path: string, file: Blob): Promise<string>;
  resolveFileUrl(ref: string): Promise<string | null>;
}

export interface RecordsRepository {
  listServiceHistory(): Promise<ServiceRecord[]>;
  listDocuments(): Promise<DocumentRec[]>;
  listEvents(stationId: string): Promise<EventLogEntry[]>;
}

export interface PushSubscriptionStore {
  savePushSubscription(sub: WebPushSubscription): Promise<void>;
}

export type PushPermission = "granted" | "denied" | "default" | "unsupported";

/** Asks the device for notification permission and registers for Web Push. */
export interface PushRegistrar {
  enable(save: (sub: WebPushSubscription) => Promise<void>): Promise<PushPermission>;
}

export interface Clock {
  now(): number;
}

/** Facts about the connected backend that the UI shows (demo banner, quick-login accounts). */
export interface BackendInfo {
  mode: "demo" | "supabase";
  demoAccounts: DemoAccount[];
}

/** Everything one backend adapter (in-browser demo or Supabase) provides. */
export type Backend = BackendInfo &
  AuthPort &
  UserRepository &
  StationRepository &
  TelemetryPort &
  RealtimePort &
  SimulationPort &
  ModuleRepository &
  AlertRepository &
  WorkOrderRepository &
  FileStorage &
  RecordsRepository &
  PushSubscriptionStore;


