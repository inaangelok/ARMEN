export type Severity = "info" | "warning" | "critical";

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
