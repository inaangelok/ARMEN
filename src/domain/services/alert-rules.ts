// Alert rule evaluation (domain service).
// Pure TypeScript with NO imports, so the very same file also runs in the Supabase Edge Function (Deno):
// `npm run sync:shared` copies it to supabase/functions/_shared/rules.ts and a unit test keeps the two identical.

export type RuleSeverity = "info" | "warning" | "critical";

export interface RuleLike {
  code: string;
  kind: "threshold" | "event";
  metric: string | null;
  operator: ">" | "<" | null;
  warning_threshold: number | null;
  critical_threshold: number | null;
  event_severity: RuleSeverity | null;
  enabled: boolean;
}

export interface ModuleInput {
  module_id: string | null;
  row: number;
  slot: number;
  soh: number;
  temperature: number;
  cell_min_mv: number;
  cell_max_mv: number;
}

export interface StationInput {
  coolant_out_temp: number;
  minutes_since_last_seen?: number;
  mode?: string;
  systems: {
    pump: { status: string };
    fire: { state: string; pressure_bar: number };
    inverter: { state: string; code: string | null };
  };
}

export interface AlertCandidate {
  code: string;
  severity: RuleSeverity;
  module_id: string | null;
  params: Record<string, string | number>;
}

function level(rule: RuleLike, value: number): RuleSeverity | null {
  const cmp = (t: number | null) => t !== null && (rule.operator === "<" ? value < t : value > t);
  if (cmp(rule.critical_threshold)) return "critical";
  if (cmp(rule.warning_threshold)) return "warning";
  return null;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Returns every alert condition currently true for a station reading. */
export function evaluateRules(rules: RuleLike[], station: StationInput, modules: ModuleInput[]): AlertCandidate[] {
  const out: AlertCandidate[] = [];
  const byCode = new Map(rules.filter((r) => r.enabled).map((r) => [r.code, r]));

  const perModule = (code: string, value: (m: ModuleInput) => number) => {
    const rule = byCode.get(code);
    if (!rule) return;
    for (const m of modules) {
      const v = value(m);
      const sev = level(rule, v);
      if (sev)
        out.push({
          code,
          severity: sev,
          module_id: m.module_id,
          params: { module: `${m.row}-${m.slot}`, value: r1(v), threshold: (sev === "critical" ? rule.critical_threshold : rule.warning_threshold) ?? 0 },
        });
    }
  };
  perModule("MODULE_OVER_TEMP", (m) => m.temperature);
  perModule("CELL_IMBALANCE", (m) => m.cell_max_mv - m.cell_min_mv);
  perModule("SOH_LOW", (m) => m.soh);

  const coolant = byCode.get("COOLANT_HIGH");
  if (coolant) {
    const sev = level(coolant, station.coolant_out_temp);
    if (sev) out.push({ code: "COOLANT_HIGH", severity: sev, module_id: null, params: { value: r1(station.coolant_out_temp), threshold: (sev === "critical" ? coolant.critical_threshold : coolant.warning_threshold) ?? 0 } });
  }
  const comm = byCode.get("COMM_LOST");
  if (comm && station.minutes_since_last_seen !== undefined) {
    const sev = level(comm, station.minutes_since_last_seen);
    if (sev) out.push({ code: "COMM_LOST", severity: sev, module_id: null, params: { minutes: Math.round(station.minutes_since_last_seen) } });
  }

  const event = (code: string, cond: boolean, params: Record<string, string | number> = {}) => {
    const rule = byCode.get(code);
    if (rule && cond) out.push({ code, severity: rule.event_severity ?? "warning", module_id: null, params });
  };
  event("COOLING_PUMP_FAULT", station.systems.pump.status === "fault", { code: "CP-F03" });
  event("FIRE_TRIGGERED", station.systems.fire.state === "triggered");
  event("FIRE_SYSTEM_FAULT", station.systems.fire.state === "fault" || station.systems.fire.pressure_bar < 2, { value: station.systems.fire.pressure_bar });
  event("INVERTER_ERROR", station.systems.inverter.state === "fault", { code: station.systems.inverter.code ?? "" });
  event("GRID_OUTAGE", station.mode === "backup");
  return out;
}

/** Key used to de-duplicate open alerts (one open alert per code + module). */
export const alertKey = (a: { code: string; module_id: string | null }) => `${a.code}:${a.module_id ?? "-"}`;

/**
 * Thresholds must be ordered in the direction of the rule: for "value > threshold" rules the
 * critical level is above the warning level, for "value < threshold" rules it is below.
 */
export function validateThresholds(operator: ">" | "<" | null, warning: number, critical: number): void {
  if (!Number.isFinite(warning) || !Number.isFinite(critical)) throw new RuleValidationError("THRESHOLD_NOT_NUMBER");
  const ok = operator === "<" ? critical < warning : critical > warning;
  if (!ok) throw new RuleValidationError("THRESHOLD_ORDER");
}

/** Thrown by validateThresholds. Kept dependency-free so this file can also run in the Deno Edge Function. */
export class RuleValidationError extends Error {
  constructor(readonly code: "THRESHOLD_ORDER" | "THRESHOLD_NOT_NUMBER") {
    super(code);
    this.name = "RuleValidationError";
  }
}
