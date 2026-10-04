import type { Alert, HealthLabel, ModuleReading, Severity, StationSnapshot, StationStatus, WorkOrderStatus, Priority } from "./types";

export type Tone = "ok" | "warn" | "crit" | "info" | "muted";

export const severityTone: Record<Severity, Tone> = { info: "info", warning: "warn", critical: "crit" };
export const healthTone: Record<HealthLabel, Tone> = { good: "ok", attention: "warn", service: "crit" };
export const stationStatusTone: Record<StationStatus, Tone> = { ok: "ok", warning: "warn", critical: "crit", offline: "muted" };
export const woStatusTone: Record<WorkOrderStatus, Tone> = { new: "info", scheduled: "warn", in_progress: "warn", done: "ok" };
export const priorityTone: Record<Priority, Tone> = { low: "muted", normal: "info", high: "warn", urgent: "crit" };

export const toneText: Record<Tone, string> = { ok: "text-ok-fg", warn: "text-warn-fg", crit: "text-crit-fg", info: "text-info-fg", muted: "text-muted-foreground" };
export const toneBg: Record<Tone, string> = { ok: "bg-ok-soft", warn: "bg-warn-soft", crit: "bg-crit-soft", info: "bg-info-soft", muted: "bg-muted" };
export const toneBorder: Record<Tone, string> = { ok: "border-ok/30", warn: "border-warn/40", crit: "border-crit/40", info: "border-info/30", muted: "border-border" };
export const toneFill: Record<Tone, string> = { ok: "#1F8A4C", warn: "#C77700", crit: "#C62828", info: "#2563EB", muted: "#94A3B8" };

const openAlerts = (alerts: Alert[], stationId: string) => alerts.filter((a) => a.station_id === stationId && a.status !== "resolved");

export function worstSeverity(alerts: Alert[]): Severity | null {
  if (alerts.some((a) => a.severity === "critical")) return "critical";
  if (alerts.some((a) => a.severity === "warning")) return "warning";
  if (alerts.length) return "info";
  return null;
}

/** Overall health label shown to owners: Good / Attention / Service needed. */
export function healthLabel(snap: StationSnapshot | undefined, modules: ModuleReading[] | undefined, alerts: Alert[], stationId: string): HealthLabel {
  const open = openAlerts(alerts, stationId);
  const minSoh = modules?.length ? Math.min(...modules.map((m) => m.soh)) : snap?.soh ?? 100;
  if (open.some((a) => a.severity === "critical") || minSoh < 80 || (snap && snap.soh < 80)) return "service";
  if (open.some((a) => a.severity === "warning") || minSoh < 85 || (snap && snap.soh < 85)) return "attention";
  return "good";
}

export function stationStatus(snap: StationSnapshot | undefined, alerts: Alert[], stationId: string, lastSeen: string | null): StationStatus {
  if (!snap || (lastSeen && Date.now() - Date.parse(lastSeen) > 60 * 60_000 && Date.now() - Date.parse(snap.ts) > 60 * 60_000)) return "offline";
  const w = worstSeverity(openAlerts(alerts, stationId));
  return w === "critical" ? "critical" : w === "warning" ? "warning" : "ok";
}

/** Module tile tone from its own readings (SOH, temperature, imbalance). */
export function moduleTone(m: ModuleReading, faulty = false): Tone {
  const spread = m.cell_max_mv - m.cell_min_mv;
  if (faulty || m.soh < 80 || m.temperature > 55 || spread > 100) return "crit";
  if (m.soh < 85 || m.temperature > 45 || spread > 50) return "warn";
  return "ok";
}
