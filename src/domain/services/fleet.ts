import type { Alert, Customer, FleetRow, Station, StationSnapshot } from "../model";
import { healthLabel, stationStatus, worstSeverity } from "./station-health";

/** Builds the fleet overview: one row per station with its live status and open alerts. */
export function buildFleetRows(
  stations: Station[],
  customers: Customer[],
  snapshots: Record<string, StationSnapshot>,
  alerts: Alert[],
  now: number,
): FleetRow[] {
  return stations.map((s) => {
    const snap = snapshots[s.id];
    const open = alerts.filter((a) => a.station_id === s.id && a.status !== "resolved" && a.severity !== "info");
    return {
      station: s,
      customer: customers.find((c) => c.id === s.customer_id),
      snapshot: snap,
      openAlerts: open.length,
      worstSeverity: worstSeverity(open),
      status: stationStatus(snap, alerts, s.id, s.last_seen_at, now),
      health: healthLabel(snap, undefined, alerts, s.id),
    };
  });
}
