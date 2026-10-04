import type { ServiceType } from "./work-order";

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
