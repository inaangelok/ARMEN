// Domain types shared by the UI, the demo simulator and the Supabase provider.
// Column names mirror the Postgres schema in supabase/migrations.

export type Role = "owner" | "technician" | "admin";
export type Lang = "hy" | "en" | "ru";
export type StationSize = "S30" | "M60" | "L100";
export type Region = "Aragatsotn" | "Yerevan";
export type HealthLabel = "good" | "attention" | "service";
export type Severity = "info" | "warning" | "critical";
export type StationStatus = "ok" | "warning" | "critical" | "offline";
export type BatteryMode = "charging" | "discharging" | "idle" | "backup";
export type OperatingMode = "self_consumption" | "backup_reserve";
export type ModuleGrade = "A" | "B" | "C";
export type ModuleStatus = "active" | "faulty" | "replaced" | "spare";

export interface SizeSpec {
  size: StationSize;
  capacityKwh: number;
  modules: number;
  rows: number;
  cols: number;
  massKg: number;
  inverterKw: number;
  model: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: Role;
  language: Lang;
  region: Region | null;
  notify_email: boolean;
  notify_push: boolean;
  notify_warning: boolean;
  notify_info: boolean;
}

export interface Customer {
  id: string;
  name: string;
  kind: "home" | "business";
  phone: string;
  email: string;
  owner_id: string | null;
}

export interface Station {
  id: string;
  name: string;
  customer_id: string;
  size: StationSize;
  model: string;
  serial: string;
  install_date: string; // ISO date
  warranty_end: string; // ISO date
  address: string;
  community: string;
  region: Region;
  lat: number;
  lng: number;
  pv_kwp: number;
  technician_id: string | null;
  operating_mode: OperatingMode;
  backup_reserve_pct: number;
  tariff_amd: number; // grid import price per kWh
  export_tariff_amd: number; // credit per exported kWh
  last_service_date: string | null;
  next_service_date: string | null;
  last_seen_at: string | null;
}

export interface Module {
  id: string;
  serial: string;
  station_id: string | null;
  row: number | null; // 1-based
  slot: number | null; // 1-based
  grade: ModuleGrade;
  status: ModuleStatus;
  install_date: string | null;
  manufacture_date: string;
  origin: string; // e.g. donor EV pack for second-life modules
  initial_soh: number;
}

export interface ModuleAssignment {
  id: string;
  module_id: string;
  station_id: string;
  row: number;
  slot: number;
  installed_at: string;
  removed_at: string | null;
  grade_at_install: ModuleGrade;
  soh_at_install: number;
  soh_at_removal: number | null;
  removal_reason: string | null;
  work_order_id: string | null;
}

export interface SystemsStatus {
  pump: { status: "ok" | "fault" | "off"; flow_lpm: number };
  fire: { state: "armed" | "triggered" | "fault"; pressure_bar: number };
  dc_isolator: "closed" | "open";
  inverter: { state: "ok" | "fault" | "standby"; code: string | null; temp_c: number };
  transformer: { state: "ok" | "warning"; temp_c: number };
  comm: "online" | "offline";
}

export interface TodayEnergy {
  stored_kwh: number; // charged into battery
  used_kwh: number; // discharged from battery
  solar_kwh: number;
  load_kwh: number;
  grid_import_kwh: number;
  grid_export_kwh: number;
  self_consumption_pct: number;
  savings_amd: number;
}

/** Latest station-level reading plus derived values (one per station). */
export interface StationSnapshot {
  station_id: string;
  ts: string;
  soc: number;
  soh: number;
  mode: BatteryMode;
  pv_kw: number;
  load_kw: number;
  grid_kw: number; // + import, - export
  battery_kw: number; // + charging, - discharging
  voltage: number;
  current: number;
  temp_max: number;
  temp_avg: number;
  coolant_in_temp: number;
  coolant_out_temp: number;
  cell_spread_mv: number;
  systems: SystemsStatus;
  today: TodayEnergy;
}

export interface ModuleReading {
  module_id: string;
  ts: string;
  soc: number;
  soh: number;
  voltage: number;
  current: number;
  temperature: number;
  cell_min_mv: number;
  cell_max_mv: number;
  bms_fault: string | null;
}

export type RangeKey = "7d" | "30d" | "12m";

export interface HistoryPoint {
  ts: string;
  soh: number;
  cycles: number;
  temp_max: number;
  temp_avg: number;
  spread_mv: number;
}

export interface DailyEnergy {
  station_id: string;
  day: string; // YYYY-MM-DD
  charged_kwh: number;
  discharged_kwh: number;
  solar_kwh: number;
  load_kwh: number;
  grid_import_kwh: number;
  grid_export_kwh: number;
  self_consumption_pct: number;
  savings_amd: number;
  soh: number;
  cycles: number;
}

export type AlertCode =
  | "MODULE_OVER_TEMP"
  | "CELL_IMBALANCE"
  | "SOH_LOW"
  | "COOLANT_HIGH"
  | "COOLING_PUMP_FAULT"
  | "COMM_LOST"
  | "FIRE_SYSTEM_FAULT"
  | "FIRE_TRIGGERED"
  | "INVERTER_ERROR"
  | "GRID_OUTAGE"
  | "MAINTENANCE_DUE";

export interface Alert {
  id: string;
  station_id: string;
  module_id: string | null;
  code: AlertCode;
  severity: Severity;
  status: "open" | "acknowledged" | "resolved";
  params: Record<string, string | number>;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

export interface AlertRule {
  id: string;
  code: AlertCode;
  kind: "threshold" | "event";
  metric: string | null;
  operator: ">" | "<" | null;
  warning_threshold: number | null;
  critical_threshold: number | null;
  event_severity: Severity | null;
  unit: string | null;
  enabled: boolean;
  updated_at: string;
}

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

export interface ServiceRecord {
  id: string;
  station_id: string;
  work_order_id: string | null;
  date: string;
  type: ServiceType;
  summary: string;
  technician_id: string | null;
}

export type DocumentKind = "warranty" | "installation_certificate" | "manual" | "safety_manual" | "service_report";

export interface DocumentRec {
  id: string;
  station_id: string;
  kind: DocumentKind;
  title: string;
  storage_path: string | null;
  created_at: string;
  size_kb: number;
}

export interface EventLogEntry {
  id: string;
  station_id: string;
  ts: string;
  source: "bms" | "pcs" | "fire" | "cooling" | "system" | "user";
  code: string;
  message: string;
}

export interface FleetRow {
  station: Station;
  customer: Customer | undefined;
  snapshot: StationSnapshot | undefined;
  openAlerts: number;
  worstSeverity: Severity | null;
  status: StationStatus;
  health: HealthLabel;
}
