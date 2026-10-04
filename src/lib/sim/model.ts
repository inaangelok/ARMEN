/**
 * Deterministic physical model of an ARMEN battery station.
 *
 * Every value is a pure function of (station config, timestamp), so the browser
 * demo, the Supabase seed script and the gateway simulator all produce exactly
 * the same numbers. No DOM / Node APIs are used here.
 */
import type {
  BatteryMode,
  ModuleReading,
  SizeSpec,
  StationSize,
  StationSnapshot,
  SystemsStatus,
  TodayEnergy,
} from "../types";

export const SIZE_SPECS: Record<StationSize, SizeSpec> = {
  S30: { size: "S30", capacityKwh: 30, modules: 6, rows: 1, cols: 6, massKg: 330, inverterKw: 10, model: "ARMEN Home 30" },
  M60: { size: "M60", capacityKwh: 60, modules: 12, rows: 2, cols: 6, massKg: 610, inverterKw: 20, model: "ARMEN Pro 60" },
  L100: { size: "L100", capacityKwh: 100, modules: 20, rows: 2, cols: 10, massKg: 1000, inverterKw: 30, model: "ARMEN Industrial 100" },
};

export const MODULE_KWH = 5;
export const CELLS_PER_MODULE = 16; // LFP 16S, 51.2 V nominal, 100 Ah
export const STEP_MIN = 15;
export const STEP_MS = STEP_MIN * 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;
export const TZ_OFFSET_MS = 4 * HOUR_MS; // Asia/Yerevan, UTC+4, no DST
export const STEPS_PER_DAY = 96;
const MONTH_MS = 30.44 * DAY_MS;

export type LoadKind = "home" | "shop" | "office" | "cold_storage" | "workshop";

export interface SimModule {
  id: string;
  serial: string;
  row: number;
  slot: number;
  initialSoh: number;
  degrPerMonth: number; // SOH percentage points lost per month
  installMs: number;
  tempOffset: number;
  spreadBase: number; // mV at rest
  socOffset: number;
  overheatSinceMs?: number | null;
}

export interface SimStation {
  id: string;
  serial: string;
  size: StationSize;
  pvKwp: number;
  loadKind: LoadKind;
  loadScale: number;
  reservePct: number;
  tariff: number;
  exportTariff: number;
  installMs: number;
  cycleRate: number; // equivalent full cycles per day
  modules: SimModule[];
  pumpFaultSinceMs?: number | null;
}

// ---------------------------------------------------------------- randomness
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic pseudo-random number in [0,1) for a set of keys. */
export function rnd(...keys: (string | number)[]): number {
  let t = hashStr(keys.join("|")) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

// ---------------------------------------------------------------- time
export const localDayIndex = (ms: number) => Math.floor((ms + TZ_OFFSET_MS) / DAY_MS);
export const dayStartMs = (dayIdx: number) => dayIdx * DAY_MS - TZ_OFFSET_MS;
export const localHour = (ms: number) => (((ms + TZ_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS / HOUR_MS;
const dayOfYear = (ms: number) => {
  const d = new Date(ms + TZ_OFFSET_MS);
  return Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY_MS) + 1;
};
const localDow = (ms: number) => new Date(ms + TZ_OFFSET_MS).getUTCDay();
export const dayKey = (dayIdx: number) => new Date(dayIdx * DAY_MS).toISOString().slice(0, 10);

const season = (ms: number) => Math.sin((2 * Math.PI * (dayOfYear(ms) - 80)) / 365); // +1 summer, -1 winter

// ---------------------------------------------------------------- solar & load
export function solarKw(st: SimStation, ms: number): number {
  const s = season(ms);
  const dayLen = 12 + 2.9 * s;
  const noon = 12.4;
  const h = localHour(ms);
  const sunrise = noon - dayLen / 2;
  const x = (h - sunrise) / dayLen;
  if (x <= 0 || x >= 1) return 0;
  const shape = Math.pow(Math.sin(Math.PI * x), 1.3);
  const amp = 0.72 + 0.23 * s;
  const day = localDayIndex(ms);
  const clear = clamp(0.42 + 0.58 * rnd(st.id, "clear", day) + 0.12 * s, 0.25, 1);
  const flicker = 1 - 0.18 * rnd(st.id, "cloud", Math.floor(ms / STEP_MS)) * (1 - clear);
  return Math.max(0, st.pvKwp * 0.82 * amp * shape * clear * flicker);
}

const bump = (h: number, center: number, width: number) => Math.exp(-((h - center) ** 2) / (2 * width ** 2));

export function loadKw(st: SimStation, ms: number): number {
  const h = localHour(ms);
  const dow = localDow(ms);
  const weekend = dow === 0 || dow === 6;
  const winter = Math.max(0, -season(ms));
  let kw: number;
  switch (st.loadKind) {
    case "home":
      kw = 0.35 + 1.1 * bump(h, 7.8, 1) + 0.45 * bump(h, 13.5, 1.5) + 2.3 * bump(h, 20.3, 1.8) + winter * 1.2 * bump(h, 21, 3);
      if (weekend) kw += 0.5 * bump(h, 12, 3);
      break;
    case "shop":
      kw = 0.6 + (h >= 8 && h < 21.5 ? 2.4 + 0.6 * bump(h, 18, 2) : 0) + winter * 0.8 * (h >= 8 && h < 21 ? 1 : 0);
      break;
    case "office":
      kw = weekend ? 0.55 : 0.45 + (h >= 9 && h < 18.5 ? 3.0 + 0.8 * bump(h, 11, 1.5) : 0);
      break;
    case "cold_storage":
      kw = 3.6 + 1.6 * (Math.sin((ms / HOUR_MS) * 2.4) > 0.2 ? 1 : 0) + (h >= 8 && h < 19 ? 1.8 : 0) + 1.2 * Math.max(0, season(ms));
      break;
    case "workshop":
      kw = weekend ? 0.8 : 0.8 + (h >= 9 && h < 18 ? 5.5 * (0.7 + 0.3 * rnd(st.id, "ws", Math.floor(ms / HOUR_MS))) : 0);
      break;
  }
  const noise = 0.88 + 0.24 * rnd(st.id, "load", Math.floor(ms / STEP_MS));
  return Math.max(0.1, kw * st.loadScale * noise);
}

// ---------------------------------------------------------------- SOH / cycles
export function moduleSoh(m: SimModule, ms: number): number {
  const months = Math.max(0, (ms - m.installMs) / MONTH_MS);
  const wiggle = (rnd(m.id, "sohw", Math.floor(ms / DAY_MS)) - 0.5) * 0.06;
  return clamp(m.initialSoh - m.degrPerMonth * months + wiggle, 50, 100);
}

export function stationSoh(st: SimStation, ms: number): number {
  const v = st.modules.map((m) => moduleSoh(m, ms));
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export const cyclesAt = (st: SimStation, ms: number) => Math.max(0, ((ms - st.installMs) / DAY_MS) * st.cycleRate);

// ---------------------------------------------------------------- daily energy simulation
export interface Step {
  ms: number;
  pv: number;
  load: number;
  battery: number; // + charge
  grid: number; // + import
  soc: number; // at end of step
  mode: BatteryMode;
}

function isOutage(st: SimStation, ms: number): boolean {
  const day = localDayIndex(ms);
  if (rnd(st.id, "outage", day) > 0.035) return false;
  const start = 9 + rnd(st.id, "outs", day) * 9;
  const len = 1 + rnd(st.id, "outl", day) * 2;
  const h = localHour(ms);
  return h >= start && h < start + len;
}

function simulateDay(st: SimStation, dayIdx: number, startSoc: number): Step[] {
  const spec = SIZE_SPECS[st.size];
  const steps: Step[] = [];
  let soc = startSoc;
  const start = dayStartMs(dayIdx);
  const usable = spec.capacityKwh * (stationSoh(st, start) / 100);
  const dt = STEP_MIN / 60;
  for (let i = 0; i < STEPS_PER_DAY; i++) {
    const ms = start + i * STEP_MS;
    const pv = solarKw(st, ms);
    const load = loadKw(st, ms);
    const outage = isOutage(st, ms);
    const reserve = outage ? 5 : st.reservePct;
    const maxCharge = Math.min(spec.inverterKw, (((100 - soc) / 100) * usable) / dt / 0.95);
    const maxDischarge = Math.min(spec.inverterKw, Math.max(0, ((soc - reserve) / 100) * usable) / dt);
    const net = pv - load;
    let battery: number;
    let grid: number;
    if (net >= 0) {
      battery = Math.min(net, maxCharge);
      grid = outage ? 0 : -(net - battery);
    } else {
      battery = -Math.min(-net, maxDischarge);
      grid = outage ? 0 : -net + battery;
    }
    soc = clamp(soc + ((battery > 0 ? battery * 0.95 : battery) * dt * 100) / usable, 0, 100);
    const mode: BatteryMode = outage ? "backup" : battery > 0.15 ? "charging" : battery < -0.15 ? "discharging" : "idle";
    steps.push({ ms, pv, load, battery, grid, soc, mode });
  }
  return steps;
}

const dayCache = new Map<string, Step[]>();

/** 96 fifteen-minute steps for a local day. Starting SOC is chained from the previous day. */
export function daySteps(st: SimStation, dayIdx: number): Step[] {
  const key = `${st.id}:${st.reservePct}:${dayIdx}`;
  const hit = dayCache.get(key);
  if (hit) return hit;
  const seedStart = (d: number) => st.reservePct + 8 + rnd(st.id, "soc0", d) * 30;
  const prev = simulateDay(st, dayIdx - 1, seedStart(dayIdx - 1));
  const steps = simulateDay(st, dayIdx, prev[prev.length - 1].soc);
  if (dayCache.size > 6000) dayCache.clear();
  dayCache.set(key, steps);
  return steps;
}

export function stepAt(st: SimStation, ms: number): { step: Step; index: number; steps: Step[] } {
  const day = localDayIndex(ms);
  const steps = daySteps(st, day);
  const index = clamp(Math.floor((ms - dayStartMs(day)) / STEP_MS), 0, STEPS_PER_DAY - 1);
  return { step: steps[index], index, steps };
}

export function energyOfSteps(st: SimStation, steps: Step[]): TodayEnergy {
  const dt = STEP_MIN / 60;
  let stored = 0, used = 0, solar = 0, load = 0, imp = 0, exp = 0;
  for (const s of steps) {
    if (s.battery > 0) stored += s.battery * dt; else used += -s.battery * dt;
    solar += s.pv * dt;
    load += s.load * dt;
    if (s.grid > 0) imp += s.grid * dt; else exp += -s.grid * dt;
  }
  const selfPct = solar > 0.01 ? clamp(((solar - exp) / solar) * 100, 0, 100) : 0;
  const savings = (load - imp) * st.tariff + exp * st.exportTariff;
  return {
    stored_kwh: round(stored, 1),
    used_kwh: round(used, 1),
    solar_kwh: round(solar, 1),
    load_kwh: round(load, 1),
    grid_import_kwh: round(imp, 1),
    grid_export_kwh: round(exp, 1),
    self_consumption_pct: round(selfPct, 0),
    savings_amd: Math.round(savings),
  };
}

// ---------------------------------------------------------------- thermal / electrical
function coolantIn(st: SimStation, ms: number): number {
  const base = 21.5 + 2.5 * season(ms) + 0.8 * Math.sin(((localHour(ms) - 9) / 24) * 2 * Math.PI);
  if (st.pumpFaultSinceMs && ms >= st.pumpFaultSinceMs) {
    const h = (ms - st.pumpFaultSinceMs) / HOUR_MS;
    return base + Math.min(12, h * 2.4);
  }
  return base;
}

/** LFP open-circuit voltage per cell in mV. */
function ocvMv(soc: number): number {
  if (soc < 5) return 2900 + soc * 50;
  if (soc < 15) return 3150 + (soc - 5) * 8;
  if (soc < 90) return 3230 + (soc - 15) * 1.4;
  return 3335 + (soc - 90) * 9;
}

export interface ModuleState extends ModuleReading {
  row: number;
  slot: number;
}

export function modulesAt(st: SimStation, ms: number, jitter = 0): ModuleState[] {
  const spec = SIZE_SPECS[st.size];
  const { step } = stepAt(st, ms);
  const cin = coolantIn(st, ms);
  const pumpFault = !!st.pumpFaultSinceMs && ms >= st.pumpFaultSinceMs;
  const loadFrac = Math.abs(step.battery) / spec.inverterKw;
  const nominalString = (spec.cols * CELLS_PER_MODULE * 3.2);
  const stringCurrent = (step.battery * 1000) / nominalString / spec.rows;
  const j = (k: string) => (jitter ? (Math.random() - 0.5) * jitter * (k === "t" ? 0.6 : 1) : 0);
  return st.modules.map((m) => {
    const soh = moduleSoh(m, ms);
    const weak = soh < 82;
    let temp = cin + 2 + 6.5 * loadFrac + m.tempOffset + (rnd(m.id, "t", Math.floor(ms / STEP_MS)) - 0.5) * 0.6;
    if (pumpFault) temp += Math.min(10, 3 + ((ms - st.pumpFaultSinceMs!) / HOUR_MS) * 1.6);
    if (m.overheatSinceMs && ms >= m.overheatSinceMs) {
      const h = (ms - m.overheatSinceMs) / HOUR_MS;
      temp += Math.min(33, 15 + h * 1.0) + 4 * loadFrac;
    }
    temp += j("t");
    const soc = clamp(step.soc + m.socOffset * (weak ? 3 : 1), 0, 100);
    const cellMean = ocvMv(soc) + stringCurrent * 0.6 * (weak ? 1.6 : 1);
    const spread = m.spreadBase + 12 * loadFrac + (weak ? 18 * loadFrac : 0) + rnd(m.id, "sp", Math.floor(ms / STEP_MS)) * 4 + j("s");
    let fault: string | null = null;
    if (temp > 45) fault = "BMS_OT_W";
    if (temp > 55) fault = "BMS_OT_C";
    if (weak) fault = fault ?? "BMS_CAP_LOW";
    return {
      module_id: m.id,
      row: m.row,
      slot: m.slot,
      ts: new Date(ms).toISOString(),
      soc: round(soc, 1),
      soh: round(soh, 1),
      voltage: round((CELLS_PER_MODULE * cellMean) / 1000, 2),
      current: round(stringCurrent + j("i"), 1),
      temperature: round(temp, 1),
      cell_min_mv: Math.round(cellMean - spread * 0.55),
      cell_max_mv: Math.round(cellMean + spread * 0.45),
      bms_fault: fault,
    };
  });
}

export function systemsAt(st: SimStation, ms: number, battery: number): SystemsStatus {
  const spec = SIZE_SPECS[st.size];
  const pumpFault = !!st.pumpFaultSinceMs && ms >= st.pumpFaultSinceMs;
  const frac = Math.abs(battery) / spec.inverterKw;
  return {
    pump: { status: pumpFault ? "fault" : "ok", flow_lpm: pumpFault ? 0 : round(11.5 + 2 * frac + rnd(st.id, "flow", Math.floor(ms / STEP_MS)) * 0.6, 1) },
    fire: { state: "armed", pressure_bar: round(3.1 + rnd(st.id, "fp", localDayIndex(ms)) * 0.25, 2) },
    dc_isolator: "closed",
    inverter: { state: "ok", code: null, temp_c: round(31 + 16 * frac, 1) },
    transformer: { state: "ok", temp_c: round(34 + 14 * frac, 1) },
    comm: "online",
  };
}

/** SOC between two 15-minute steps (smooth values for live views). */
function interpSoc(steps: Step[], index: number, ms: number): number {
  const step = steps[index];
  const start = index > 0 ? steps[index - 1].soc : step.soc - ((step.battery > 0 ? step.battery * 0.95 : step.battery) * 0.25 * 100) / 100;
  const frac = clamp((ms - step.ms) / STEP_MS, 0, 1);
  return start + (step.soc - start) * frac;
}

/** Full station snapshot at a moment. `jitter` adds live-looking noise (used by the simulator). */
export function snapshotAt(st: SimStation, ms: number, jitter = 0): StationSnapshot {
  const { step, index, steps } = stepAt(st, ms);
  const mods = modulesAt(st, ms, jitter);
  const spec = SIZE_SPECS[st.size];
  const n = (v: number, pct: number) => (jitter ? v * (1 + (Math.random() - 0.5) * pct) : v);
  const pv = n(step.pv, 0.06);
  const load = n(step.load, 0.08);
  let battery = step.battery;
  let grid = step.grid;
  if (jitter) {
    // keep the power balance consistent after adding noise
    const delta = pv - load - (step.pv - step.load);
    if (step.mode === "backup") battery += delta;
    else grid -= delta;
  }
  const temps = mods.map((m) => m.temperature);
  const spreads = mods.map((m) => m.cell_max_mv - m.cell_min_mv);
  const voltage = mods.slice(0, spec.cols).reduce((a, m) => a + m.voltage, 0);
  const cin = coolantIn(st, ms) + (jitter ? (Math.random() - 0.5) * 0.2 : 0);
  const systems = systemsAt(st, ms, battery);
  const pumpOk = systems.pump.status === "ok";
  const today = energyOfSteps(st, steps.slice(0, index + 1));
  return {
    station_id: st.id,
    ts: new Date(ms).toISOString(),
    soc: round(interpSoc(steps, index, ms), 1),
    soh: round(stationSoh(st, ms), 1),
    mode: step.mode,
    pv_kw: round(pv, 2),
    load_kw: round(load, 2),
    grid_kw: round(grid, 2),
    battery_kw: round(battery, 2),
    voltage: round(voltage, 1),
    current: round((battery * 1000) / Math.max(1, voltage), 1),
    temp_max: round(Math.max(...temps), 1),
    temp_avg: round(temps.reduce((a, b) => a + b, 0) / temps.length, 1),
    coolant_in_temp: round(cin, 1),
    coolant_out_temp: round(cin + (pumpOk ? 2.2 + 3.2 * (Math.abs(battery) / spec.inverterKw) : 1.1), 1),
    cell_spread_mv: Math.round(Math.max(...spreads)),
    systems,
    today,
  };
}

// ---------------------------------------------------------------- aggregates for charts
export interface DailyAgg {
  day: string;
  dayIdx: number;
  energy: TodayEnergy;
  soh: number;
  cycles: number;
  temp_max: number;
  temp_avg: number;
  spread_mv: number;
  moduleSoh: Record<string, number>;
  moduleTempMax: Record<string, number>;
  moduleSpread: Record<string, number>;
}

const aggCache = new Map<string, DailyAgg>();

export function dailyAgg(st: SimStation, dayIdx: number): DailyAgg {
  const key = `${st.id}:${st.reservePct}:${dayIdx}:${st.modules.map((m) => m.id).join(",").length}`;
  const hit = aggCache.get(key);
  if (hit) return hit;
  const steps = daySteps(st, dayIdx);
  const start = dayStartMs(dayIdx);
  // sample module temps at 4 points (night, morning, afternoon peak, evening peak)
  const samples = [3, 10, 14, 20].map((h) => modulesAt(st, start + h * HOUR_MS));
  const moduleTempMax: Record<string, number> = {};
  const moduleSpread: Record<string, number> = {};
  const moduleSohMap: Record<string, number> = {};
  let tsum = 0, tcount = 0;
  for (const s of samples)
    for (const m of s) {
      moduleTempMax[m.module_id] = Math.max(moduleTempMax[m.module_id] ?? -99, m.temperature);
      moduleSpread[m.module_id] = Math.max(moduleSpread[m.module_id] ?? 0, m.cell_max_mv - m.cell_min_mv);
      tsum += m.temperature;
      tcount++;
    }
  for (const m of st.modules) moduleSohMap[m.id] = round(moduleSoh(m, start + 12 * HOUR_MS), 2);
  const agg: DailyAgg = {
    day: dayKey(dayIdx),
    dayIdx,
    energy: energyOfSteps(st, steps),
    soh: round(stationSoh(st, start + 12 * HOUR_MS), 2),
    cycles: round(cyclesAt(st, start + DAY_MS), 1),
    temp_max: round(Math.max(...Object.values(moduleTempMax)), 1),
    temp_avg: round(tsum / tcount, 1),
    spread_mv: Math.round(Math.max(...Object.values(moduleSpread))),
    moduleSoh: moduleSohMap,
    moduleTempMax,
    moduleSpread,
  };
  if (aggCache.size > 10000) aggCache.clear();
  aggCache.set(key, agg);
  return agg;
}

export function clearModelCaches() {
  dayCache.clear();
  aggCache.clear();
}

/** Linear-regression based remaining-life estimate (years until SOH reaches 80%). */
export function estimateYearsTo80(points: { t: number; soh: number }[]): { years: number | null; ratePerYear: number } {
  if (points.length < 5) return { years: null, ratePerYear: 0 };
  const n = points.length;
  const mx = points.reduce((a, p) => a + p.t, 0) / n;
  const my = points.reduce((a, p) => a + p.soh, 0) / n;
  let num = 0, den = 0;
  for (const p of points) {
    num += (p.t - mx) * (p.soh - my);
    den += (p.t - mx) ** 2;
  }
  const slopePerMs = den === 0 ? 0 : num / den;
  const ratePerYear = -slopePerMs * 365 * DAY_MS;
  const current = points[n - 1].soh;
  if (current <= 80) return { years: 0, ratePerYear };
  if (ratePerYear <= 0.05) return { years: null, ratePerYear };
  return { years: (current - 80) / ratePerYear, ratePerYear };
}
