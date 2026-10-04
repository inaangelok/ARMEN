export type BatteryMode = "charging" | "discharging" | "idle" | "backup";

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
