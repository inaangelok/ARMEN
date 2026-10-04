import type { AlertRule } from "./alert";

/** Factory alert thresholds for a new fleet (admins can change them later). Same values as supabase/migrations reference data. */
export const DEFAULT_ALERT_RULES: Omit<AlertRule, "id" | "updated_at">[] = [
  { code: "MODULE_OVER_TEMP", kind: "threshold", metric: "module_temp_c", operator: ">", warning_threshold: 45, critical_threshold: 55, event_severity: null, unit: "°C", enabled: true },
  { code: "CELL_IMBALANCE", kind: "threshold", metric: "cell_spread_mv", operator: ">", warning_threshold: 50, critical_threshold: 100, event_severity: null, unit: "mV", enabled: true },
  { code: "SOH_LOW", kind: "threshold", metric: "module_soh_pct", operator: "<", warning_threshold: 85, critical_threshold: 80, event_severity: null, unit: "%", enabled: true },
  { code: "COOLANT_HIGH", kind: "threshold", metric: "coolant_out_c", operator: ">", warning_threshold: 35, critical_threshold: 42, event_severity: null, unit: "°C", enabled: true },
  { code: "COMM_LOST", kind: "threshold", metric: "minutes_since_last_seen", operator: ">", warning_threshold: 10, critical_threshold: 60, event_severity: null, unit: "min", enabled: true },
  { code: "COOLING_PUMP_FAULT", kind: "event", metric: null, operator: null, warning_threshold: null, critical_threshold: null, event_severity: "critical", unit: null, enabled: true },
  { code: "FIRE_SYSTEM_FAULT", kind: "event", metric: null, operator: null, warning_threshold: null, critical_threshold: null, event_severity: "critical", unit: null, enabled: true },
  { code: "FIRE_TRIGGERED", kind: "event", metric: null, operator: null, warning_threshold: null, critical_threshold: null, event_severity: "critical", unit: null, enabled: true },
  { code: "INVERTER_ERROR", kind: "event", metric: null, operator: null, warning_threshold: null, critical_threshold: null, event_severity: "warning", unit: null, enabled: true },
  { code: "GRID_OUTAGE", kind: "event", metric: null, operator: null, warning_threshold: null, critical_threshold: null, event_severity: "info", unit: null, enabled: true },
];
