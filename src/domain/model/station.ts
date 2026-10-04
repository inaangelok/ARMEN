import type { Region } from "./user";

export type StationSize = "S30" | "M60" | "L100";

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

export type HealthLabel = "good" | "attention" | "service";

export type StationStatus = "ok" | "warning" | "critical" | "offline";

export type OperatingMode = "self_consumption" | "backup_reserve";

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
