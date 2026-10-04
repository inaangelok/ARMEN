// Visual tones: how domain states look on screen. The rules that decide the states live in the domain.
import { moduleCondition, type Condition, type HealthLabel, type ModuleReading, type Priority, type Severity, type StationStatus, type WorkOrderStatus } from "@/domain";

export type Tone = "ok" | "warn" | "crit" | "info" | "muted";

export const severityTone: Record<Severity, Tone> = { info: "info", warning: "warn", critical: "crit" };
export const healthTone: Record<HealthLabel, Tone> = { good: "ok", attention: "warn", service: "crit" };
export const stationStatusTone: Record<StationStatus, Tone> = { ok: "ok", warning: "warn", critical: "crit", offline: "muted" };
export const woStatusTone: Record<WorkOrderStatus, Tone> = { new: "info", scheduled: "warn", in_progress: "warn", done: "ok" };
export const priorityTone: Record<Priority, Tone> = { low: "muted", normal: "info", high: "warn", urgent: "crit" };
export const conditionTone: Record<Condition, Tone> = { ok: "ok", warning: "warn", critical: "crit" };

export const toneText: Record<Tone, string> = { ok: "text-ok-fg", warn: "text-warn-fg", crit: "text-crit-fg", info: "text-info-fg", muted: "text-muted-foreground" };
export const toneBg: Record<Tone, string> = { ok: "bg-ok-soft", warn: "bg-warn-soft", crit: "bg-crit-soft", info: "bg-info-soft", muted: "bg-muted" };
export const toneBorder: Record<Tone, string> = { ok: "border-ok/30", warn: "border-warn/40", crit: "border-crit/40", info: "border-info/30", muted: "border-border" };
export const toneFill: Record<Tone, string> = { ok: "#1F8A4C", warn: "#C77700", crit: "#C62828", info: "#2563EB", muted: "#94A3B8" };

/** Module tile tone (domain condition → colour). */
export const moduleTone = (m: ModuleReading, faulty = false): Tone => conditionTone[moduleCondition(m, faulty)];
