import type { Alert, HealthLabel, ModuleReading, Severity, StationSnapshot, StationStatus } from "../model";
import { SOH_ATTENTION, SOH_END_OF_LIFE } from "../model/catalog";
import { HOUR_MS } from "./time";

/** A station is offline when neither the gateway nor telemetry has been seen for this long. */
export const OFFLINE_AFTER_MS = HOUR_MS;

export type Condition = "ok" | "warning" | "critical";

const openFor = (alerts: Alert[], stationId: string) => alerts.filter((a) => a.station_id === stationId && a.status !== "resolved");

export function worstSeverity(alerts: Alert[]): Severity | null {
  if (alerts.some((a) => a.severity === "critical")) return "critical";
  if (alerts.some((a) => a.severity === "warning")) return "warning";
  if (alerts.length) return "info";
  return null;
}

/** Owner-facing health: Good / Attention / Service needed. */
export function healthLabel(snap: StationSnapshot | undefined, modules: ModuleReading[] | undefined, alerts: Alert[], stationId: string): HealthLabel {
  const open = openFor(alerts, stationId);
  const minSoh = modules?.length ? Math.min(...modules.map((m) => m.soh)) : snap?.soh ?? 100;
  if (open.some((a) => a.severity === "critical") || minSoh < SOH_END_OF_LIFE || (snap && snap.soh < SOH_END_OF_LIFE)) return "service";
  if (open.some((a) => a.severity === "warning") || minSoh < SOH_ATTENTION || (snap && snap.soh < SOH_ATTENTION)) return "attention";
  return "good";
}

/** Operations status of a station (fleet list and map). */
export function stationStatus(snap: StationSnapshot | undefined, alerts: Alert[], stationId: string, lastSeen: string | null, now: number): StationStatus {
  if (!snap || (lastSeen && now - Date.parse(lastSeen) > OFFLINE_AFTER_MS && now - Date.parse(snap.ts) > OFFLINE_AFTER_MS)) return "offline";
  const w = worstSeverity(openFor(alerts, stationId));
  return w === "critical" ? "critical" : w === "warning" ? "warning" : "ok";
}

/** Condition of one module from its own readings (SOH, temperature, cell imbalance). */
export function moduleCondition(m: ModuleReading, faulty = false): Condition {
  const spread = m.cell_max_mv - m.cell_min_mv;
  if (faulty || m.soh < SOH_END_OF_LIFE || m.temperature > 55 || spread > 100) return "critical";
  if (m.soh < SOH_ATTENTION || m.temperature > 45 || spread > 50) return "warning";
  return "ok";
}
