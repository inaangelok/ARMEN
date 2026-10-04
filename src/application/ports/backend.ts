import type {
  Alert, AlertRule, ChecklistItem, Customer, DailyEnergy, DocumentRec, EventLogEntry, HistoryPoint, IssueType, Module,
  ModuleAssignment, ModuleGrade, ModuleReading, Priority, Profile, RangeKey, Role, ServiceRecord, ServiceType, Station,
  StationSnapshot, WorkOrder,
} from "@/domain/model";

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
  photos?: File[];
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

/** Everything the UI needs. Implemented by the in-browser demo and by Supabase. */
export interface Api {
  mode: "demo" | "supabase";
  demoAccounts: DemoAccount[];

  // auth & profiles
  getSession(): Promise<Profile | null>;
  signIn(email: string, password: string): Promise<Profile>;
  signOut(): Promise<void>;
  updateMyProfile(patch: Partial<Profile>): Promise<Profile>;
  listProfiles(): Promise<Profile[]>;
  updateProfile(id: string, patch: Partial<Profile>): Promise<void>;
  inviteUser(input: { email: string; full_name: string; role: Role }): Promise<void>;

  // stations & customers
  listStations(): Promise<Station[]>;
  updateStation(id: string, patch: Partial<Station>): Promise<Station>;
  listCustomers(): Promise<Customer[]>;

  // telemetry
  getSnapshots(): Promise<Record<string, StationSnapshot>>;
  getModuleReadings(stationId: string): Promise<ModuleReading[]>;
  getStationHistory(stationId: string, range: RangeKey): Promise<HistoryPoint[]>;
  getModuleHistory(moduleId: string, range: RangeKey): Promise<ModuleHistoryPoint[]>;
  getPowerSeries(stationId: string): Promise<PowerPoint[]>;
  getDaily(stationId: string, fromDay: string, toDay: string): Promise<DailyEnergy[]>;
  getRawTelemetry(stationId: string, limit: number): Promise<ModuleReading[]>;
  subscribeLive(cb: (e: LiveEvent) => void): () => void;
  setSimulation(on: boolean, stationIds: string[]): void;
  isSimulating(): boolean;

  // modules
  listModules(): Promise<Module[]>;
  listAssignments(): Promise<ModuleAssignment[]>;
  markModuleFaulty(moduleId: string, reason: string): Promise<void>;
  replaceModule(input: ReplaceModuleInput): Promise<void>;

  // alerts
  listAlerts(): Promise<Alert[]>;
  setAlertStatus(id: string, status: Alert["status"]): Promise<void>;
  listRules(): Promise<AlertRule[]>;
  updateRule(id: string, patch: Partial<AlertRule>): Promise<void>;

  // work orders
  listWorkOrders(): Promise<WorkOrder[]>;
  listChecklist(workOrderId: string): Promise<ChecklistItem[]>;
  createWorkOrder(input: NewWorkOrder): Promise<WorkOrder>;
  updateWorkOrder(id: string, patch: Partial<WorkOrder>): Promise<WorkOrder>;
  updateChecklistItem(id: string, patch: Partial<ChecklistItem>): Promise<void>;
  uploadFile(bucket: "photos" | "signatures" | "documents", path: string, file: Blob): Promise<string>;
  resolveFileUrl(ref: string): Promise<string | null>;

  // history & documents
  listServiceHistory(): Promise<ServiceRecord[]>;
  listDocuments(): Promise<DocumentRec[]>;
  listEvents(stationId: string): Promise<EventLogEntry[]>;

  /** Stores a Web Push subscription for the signed-in user. */
  savePushSubscription(sub: PushSubscriptionJSON): Promise<void>;

  /** Subscribe to "data changed" notifications (alerts, work orders…) so the UI can refetch. */
  onChange(cb: (topic: string) => void): () => void;
}
