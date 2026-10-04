import type { Severity } from "./alert";
import type { Customer } from "./customer";
import type { HealthLabel, Station, StationStatus } from "./station";
import type { StationSnapshot } from "./telemetry";

export interface FleetRow {
  station: Station;
  customer: Customer | undefined;
  snapshot: StationSnapshot | undefined;
  openAlerts: number;
  worstSeverity: Severity | null;
  status: StationStatus;
  health: HealthLabel;
}
