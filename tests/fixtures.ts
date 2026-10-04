// Small builders for domain objects used across tests. Override only what a test cares about.
import type { Alert, ChecklistItem, Module, ModuleReading, Profile, Station, StationSnapshot, WorkOrder } from "@/domain";

export const NOW = Date.parse("2026-10-04T09:00:00Z");

export const station = (o: Partial<Station> = {}): Station => ({
  id: "st1", name: "Test Home", customer_id: "c1", size: "S30", model: "ARMEN Home 30", serial: "ARM-S30-0001",
  install_date: "2025-03-10", warranty_end: "2035-03-10", address: "Ashtarak", community: "Ashtarak", region: "Aragatsotn",
  lat: 40.3, lng: 44.36, pv_kwp: 12, technician_id: "t1", operating_mode: "self_consumption", backup_reserve_pct: 20,
  tariff_amd: 48, export_tariff_amd: 30, last_service_date: null, next_service_date: "2026-11-01", last_seen_at: new Date(NOW).toISOString(),
  ...o,
});

export const snapshot = (o: Partial<StationSnapshot> = {}): StationSnapshot => ({
  station_id: "st1", ts: new Date(NOW).toISOString(), soc: 60, soh: 93, mode: "idle", pv_kw: 0, load_kw: 1, grid_kw: 1, battery_kw: 0,
  voltage: 310, current: 0, temp_max: 28, temp_avg: 26, coolant_in_temp: 22, coolant_out_temp: 25, cell_spread_mv: 20,
  systems: {
    pump: { status: "ok", flow_lpm: 12 }, fire: { state: "armed", pressure_bar: 3.2 }, dc_isolator: "closed",
    inverter: { state: "ok", code: null, temp_c: 38 }, transformer: { state: "ok", temp_c: 40 }, comm: "online",
  },
  today: { stored_kwh: 0, used_kwh: 0, solar_kwh: 0, load_kwh: 0, grid_import_kwh: 0, grid_export_kwh: 0, self_consumption_pct: 0, savings_amd: 0 },
  ...o,
});

export const reading = (o: Partial<ModuleReading> = {}): ModuleReading => ({
  module_id: "m1", ts: new Date(NOW).toISOString(), soc: 60, soh: 93, voltage: 52, current: 0, temperature: 27, cell_min_mv: 3260, cell_max_mv: 3280, bms_fault: null, ...o,
});

export const alert = (o: Partial<Alert> = {}): Alert => ({
  id: "a1", station_id: "st1", module_id: null, code: "MODULE_OVER_TEMP", severity: "warning", status: "open", params: {},
  created_at: new Date(NOW).toISOString(), acknowledged_at: null, resolved_at: null, ...o,
});

export const module_ = (o: Partial<Module> = {}): Module => ({
  id: "m1", serial: "AM5-25A-00001", station_id: "st1", row: 1, slot: 1, grade: "A", status: "active", install_date: "2025-03-10",
  manufacture_date: "2021-05-01", origin: "Nissan Leaf 40 kWh", initial_soh: 94, ...o,
});

export const workOrder = (o: Partial<WorkOrder> = {}): WorkOrder => ({
  id: "wo1", number: 1001, station_id: "st1", type: "repair", issue_type: null, title: "Fix", description: "", status: "new", priority: "normal",
  preferred_date: null, scheduled_date: null, assigned_to: null, created_by: null, created_at: new Date(NOW).toISOString(), completed_at: null,
  photos: [], parts_used: [], signature_url: null, signed_by: null, alert_id: null, resolution_notes: null, ...o,
});

export const check = (done: boolean, i = 0): ChecklistItem => ({ id: `c${i}`, work_order_id: "wo1", position: i, label_key: "x", done, note: null });

export const profile = (o: Partial<Profile> = {}): Profile => ({
  id: "u1", full_name: "Aram", email: "a@b.am", phone: null, role: "owner", language: "hy", region: null,
  notify_email: true, notify_push: false, notify_warning: true, notify_info: false, ...o,
});
