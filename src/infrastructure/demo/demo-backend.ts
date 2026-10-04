/**
 * In-browser demo backend. Builds the seeded dataset in memory and answers every
 * API call with role-based scoping that mirrors the Supabase RLS policies.
 * Changes live for the browser session only.
 */
import { alertKey, evaluateRules } from "@/domain/services/alert-rules";
import { buildDataset, DEMO_PASSWORD, uuidFrom, type Dataset } from "@/infrastructure/simulation/dataset";
import {
  clearModelCaches,
  cyclesAt,
  DAY_MS,
  dailyAgg,
  dayKey,
  dayStartMs,
  daySteps,
  energyOfSteps,
  HOUR_MS,
  localDayIndex,
  moduleSoh,
  modulesAt,
  round,
  snapshotAt,
  stationSoh,
  STEP_MS,
  type SimModule,
} from "@/infrastructure/simulation/model";
import type {
  Alert, AlertCode, DailyEnergy, HistoryPoint, ModuleReading, Profile, RangeKey, Station, StationSnapshot, WorkOrder,
} from "@/domain/model";
import { CHECKLIST_TEMPLATES } from "@/domain/services/maintenance";
import type { Backend, LiveEvent, ModuleHistoryPoint, PowerPoint } from "@/application/ports";

const SESSION_KEY = "armen-care-demo-session";
const store = {
  get(k: string) {
    try { return window.localStorage.getItem(k); } catch { return null; }
  },
  set(k: string, v: string | null) {
    try { if (v === null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); } catch { /* storage unavailable */ }
  },
};

const delay = <T,>(v: T, ms = 60): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), ms));
const iso = (ms: number) => new Date(ms).toISOString();
let idSeq = 0;
const newId = (p: string) => uuidFrom(`${p}:${Date.now()}:${idSeq++}:${Math.random()}`);

const EVALUATED: AlertCode[] = ["MODULE_OVER_TEMP", "CELL_IMBALANCE", "SOH_LOW", "COOLANT_HIGH", "COOLING_PUMP_FAULT", "FIRE_SYSTEM_FAULT", "FIRE_TRIGGERED", "INVERTER_ERROR", "GRID_OUTAGE"];

export function createDemoBackend(): Backend {
  const ds: Dataset = buildDataset(Date.now());
  let me: Profile | null = null;
  const sessionEmail = store.get(SESSION_KEY);
  if (sessionEmail) me = ds.profiles.find((p) => p.email === sessionEmail) ?? null;
  // demo data is rebuilt on every page load, so keep the language the viewer last picked
  const savedLang = store.get("armen-care-lang");
  if (me && (savedLang === "hy" || savedLang === "en" || savedLang === "ru")) me.language = savedLang;

  const snapshots: Record<string, StationSnapshot> = {};
  const moduleLatest: Record<string, ModuleReading[]> = {};
  const liveTrail: Record<string, PowerPoint[]> = {};
  const refresh = (sid: string, ms: number, jitter = 0) => {
    const sim = ds.sims[sid];
    snapshots[sid] = snapshotAt(sim, ms, jitter);
    moduleLatest[sid] = modulesAt(sim, ms, jitter).map(({ row: _r, slot: _s, ...m }) => m);
  };
  for (const s of ds.stations) refresh(s.id, ds.nowMs);

  const liveSubs = new Set<(e: LiveEvent) => void>();
  const changeSubs = new Set<(t: string) => void>();
  const emit = (topic: string) => changeSubs.forEach((cb) => cb(topic));
  let simTimer: ReturnType<typeof setInterval> | null = null;
  const falseTicks = new Map<string, number>();

  // ------------------------------------------------------------ scoping
  const visibleStationIds = (): Set<string> => {
    if (!me) return new Set();
    if (me.role === "admin") return new Set(ds.stations.map((s) => s.id));
    if (me.role === "technician") return new Set(ds.stations.filter((s) => s.technician_id === me!.id).map((s) => s.id));
    const custIds = new Set(ds.customers.filter((c) => c.owner_id === me!.id).map((c) => c.id));
    return new Set(ds.stations.filter((s) => custIds.has(s.customer_id)).map((s) => s.id));
  };
  const requireUser = () => {
    if (!me) throw new Error("Not signed in");
    return me;
  };
  const requireStaff = () => {
    const u = requireUser();
    if (u.role === "owner") throw new Error("Not allowed");
    return u;
  };
  const scoped = <T extends { station_id: string | null }>(rows: T[]) => {
    const v = visibleStationIds();
    return rows.filter((r) => r.station_id && v.has(r.station_id));
  };

  // ------------------------------------------------------------ alerts engine
  function evaluate(sid: string, immediateResolve = false) {
    const snap = snapshots[sid];
    const sim = ds.sims[sid];
    const mods = moduleLatest[sid];
    const candidates = evaluateRules(
      ds.rules,
      snap,
      mods.map((m) => {
        const sm = sim.modules.find((x) => x.id === m.module_id)!;
        return { ...m, row: sm.row, slot: sm.slot };
      }),
    );
    const now = Date.now();
    const open = ds.alerts.filter((a) => a.station_id === sid && a.status !== "resolved");
    let changed = false;
    for (const c of candidates) {
      const key = alertKey(c);
      falseTicks.delete(sid + key);
      const existing = open.find((a) => alertKey(a) === key);
      if (existing) {
        if (existing.severity !== "critical" && c.severity === "critical") {
          existing.severity = "critical";
          existing.params = c.params;
          existing.status = "open";
          changed = true;
          emit(`alert-new:${existing.id}`);
        }
        continue;
      }
      const a: Alert = { id: newId("alert"), station_id: sid, module_id: c.module_id, code: c.code as AlertCode, severity: c.severity, status: "open", params: c.params, created_at: iso(now), acknowledged_at: null, resolved_at: null };
      ds.alerts.unshift(a);
      ds.events.unshift({ id: newId("ev"), station_id: sid, ts: a.created_at, source: "bms", code: a.code, message: JSON.stringify(a.params) });
      changed = true;
      emit(`alert-new:${a.id}`);
    }
    const active = new Set(candidates.map(alertKey));
    const enabled = new Set(ds.rules.filter((r) => r.enabled).map((r) => r.code));
    for (const a of open) {
      if (!EVALUATED.includes(a.code)) continue;
      const key = alertKey(a);
      if (active.has(key) && enabled.has(a.code)) continue;
      const n = (falseTicks.get(sid + key) ?? 0) + 1;
      falseTicks.set(sid + key, n);
      if (immediateResolve || n >= 5 || !enabled.has(a.code)) {
        a.status = "resolved";
        a.resolved_at = iso(now);
        ds.events.unshift({ id: newId("ev"), station_id: sid, ts: a.resolved_at, source: "system", code: "ALERT_CLEARED", message: a.code });
        changed = true;
      }
    }
    if (changed) emit("alerts");
  }

  function tick() {
    const now = Date.now();
    for (const s of ds.stations) {
      refresh(s.id, now, 1);
      ds.stations.find((x) => x.id === s.id)!.last_seen_at = iso(now);
      const snap = snapshots[s.id];
      (liveTrail[s.id] ??= []).push({ ts: snap.ts, pv: snap.pv_kw, load: snap.load_kw, grid: snap.grid_kw, battery: snap.battery_kw, soc: snap.soc });
      if (liveTrail[s.id].length > 400) liveTrail[s.id].shift();
      evaluate(s.id);
      liveSubs.forEach((cb) => cb({ snapshot: snap, modules: moduleLatest[s.id] }));
    }
  }

  // ------------------------------------------------------------ history helpers
  function historyFor(sid: string, range: RangeKey, moduleId?: string): ModuleHistoryPoint[] {
    const sim = ds.sims[sid];
    const now = Date.now();
    const out: ModuleHistoryPoint[] = [];
    if (range === "12m") {
      const today = localDayIndex(now);
      const first = Math.max(today - 365, localDayIndex(sim.installMs) + 1);
      for (let d = first; d <= today; d++) {
        const a = dailyAgg(sim, d);
        if (moduleId) {
          if (!(moduleId in a.moduleSoh)) continue;
          out.push({ ts: iso(dayStartMs(d) + 12 * HOUR_MS), soh: a.moduleSoh[moduleId], cycles: a.cycles, temp_max: a.moduleTempMax[moduleId], temp_avg: a.moduleTempMax[moduleId], spread_mv: a.moduleSpread[moduleId] });
        } else out.push({ ts: iso(dayStartMs(d) + 12 * HOUR_MS), soh: a.soh, cycles: a.cycles, temp_max: a.temp_max, temp_avg: a.temp_avg, spread_mv: a.spread_mv });
      }
      return out;
    }
    const days = range === "7d" ? 7 : 30;
    const step = range === "7d" ? HOUR_MS : 4 * HOUR_MS;
    const start = Math.ceil((now - days * DAY_MS) / step) * step;
    for (let t = Math.max(start, sim.installMs); t <= now; t += step) {
      const mods = modulesAt(sim, t);
      if (moduleId) {
        const m = mods.find((x) => x.module_id === moduleId);
        const sm = sim.modules.find((x) => x.id === moduleId);
        if (!m || !sm || t < sm.installMs) continue;
        out.push({ ts: iso(t), soh: round(moduleSoh(sm, t), 2), cycles: round(cyclesAt(sim, t), 1), temp_max: m.temperature, temp_avg: m.temperature, spread_mv: m.cell_max_mv - m.cell_min_mv, soc: m.soc, voltage: m.voltage });
      } else {
        const temps = mods.map((m) => m.temperature);
        out.push({ ts: iso(t), soh: round(stationSoh(sim, t), 2), cycles: round(cyclesAt(sim, t), 1), temp_max: Math.max(...temps), temp_avg: round(temps.reduce((a, b) => a + b, 0) / temps.length, 1), spread_mv: Math.max(...mods.map((m) => m.cell_max_mv - m.cell_min_mv)) });
      }
    }
    return out;
  }

  const moduleStation = (moduleId: string) => ds.modules.find((m) => m.id === moduleId)?.station_id ?? ds.assignments.find((a) => a.module_id === moduleId)?.station_id ?? null;

  // ------------------------------------------------------------ API
  const api: Backend = {
    mode: "demo",
    demoAccounts: [
      { role: "owner", email: "owner@demo.armencare.am", name: "Aram Petrosyan", password: DEMO_PASSWORD },
      { role: "technician", email: "tech@demo.armencare.am", name: "Davit Hakobyan", password: DEMO_PASSWORD },
      { role: "admin", email: "admin@demo.armencare.am", name: "Ani Grigoryan", password: DEMO_PASSWORD },
    ],

    async getSession() {
      return delay(me, 0);
    },
    async signIn(email, password) {
      const p = ds.profiles.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
      if (!p || ds.passwords[p.email] !== password) throw new Error("invalid_credentials");
      me = p;
      store.set(SESSION_KEY, p.email);
      return delay(p);
    },
    async signOut() {
      me = null;
      store.set(SESSION_KEY, null);
      if (simTimer) clearInterval(simTimer);
      simTimer = null;
    },
    async updateMyProfile(patch) {
      const u = requireUser();
      Object.assign(u, patch, { id: u.id, role: u.role });
      return delay(u);
    },
    async listProfiles() {
      const u = requireUser();
      if (u.role === "admin") return delay(ds.profiles);
      const v = visibleStationIds();
      const techs = new Set(ds.stations.filter((s) => v.has(s.id)).map((s) => s.technician_id));
      const owners = new Set(ds.customers.filter((c) => ds.stations.some((s) => v.has(s.id) && s.customer_id === c.id)).map((c) => c.owner_id));
      return delay(ds.profiles.filter((p) => p.id === u.id || techs.has(p.id) || (u.role === "technician" && (owners.has(p.id) || p.role !== "owner"))));
    },
    async updateProfile(id, patch) {
      if (requireUser().role !== "admin") throw new Error("Not allowed");
      Object.assign(ds.profiles.find((p) => p.id === id)!, patch);
      emit("profiles");
      return delay(undefined);
    },
    async inviteUser(input) {
      if (requireUser().role !== "admin") throw new Error("Not allowed");
      ds.profiles.push({ id: newId("user"), full_name: input.full_name, email: input.email, phone: null, role: input.role, language: "hy", region: null, notify_email: true, notify_push: false, notify_warning: true, notify_info: false });
      ds.passwords[input.email] = DEMO_PASSWORD;
      emit("profiles");
      return delay(undefined);
    },

    async listStations() {
      const v = visibleStationIds();
      return delay(ds.stations.filter((s) => v.has(s.id)));
    },
    async updateStation(id, patch) {
      const u = requireUser();
      const s = ds.stations.find((x) => x.id === id && visibleStationIds().has(x.id));
      if (!s) throw new Error("Not found");
      const allowed: Partial<Station> = u.role === "owner" ? { operating_mode: patch.operating_mode, backup_reserve_pct: patch.backup_reserve_pct } : patch;
      Object.entries(allowed).forEach(([k, val]) => val !== undefined && ((s as unknown as Record<string, unknown>)[k] = val));
      const sim = ds.sims[id];
      sim.reservePct = s.operating_mode === "backup_reserve" ? s.backup_reserve_pct : 10;
      clearModelCaches();
      refresh(id, simTimer ? Date.now() : ds.nowMs);
      emit("stations");
      return delay(s);
    },
    async listCustomers() {
      const v = visibleStationIds();
      const ids = new Set(ds.stations.filter((s) => v.has(s.id)).map((s) => s.customer_id));
      return delay(ds.customers.filter((c) => ids.has(c.id)));
    },

    async getSnapshots() {
      const v = visibleStationIds();
      return delay(Object.fromEntries(Object.entries(snapshots).filter(([k]) => v.has(k))), 30);
    },
    async getModuleReadings(stationId) {
      if (!visibleStationIds().has(stationId)) return [];
      return delay(moduleLatest[stationId] ?? [], 30);
    },
    async getStationHistory(stationId, range) {
      if (!visibleStationIds().has(stationId)) return [];
      return delay(historyFor(stationId, range) as HistoryPoint[], 120);
    },
    async getModuleHistory(moduleId, range) {
      const sid = moduleStation(moduleId);
      if (!sid || !visibleStationIds().has(sid)) return [];
      return delay(historyFor(sid, range, moduleId), 120);
    },
    async getPowerSeries(stationId) {
      if (!visibleStationIds().has(stationId)) return [];
      const sim = ds.sims[stationId];
      const now = simTimer ? Date.now() : ds.nowMs;
      const steps = daySteps(sim, localDayIndex(now)).filter((s) => s.ms <= now);
      const pts: PowerPoint[] = steps.map((s) => ({ ts: iso(s.ms), pv: round(s.pv), load: round(s.load), grid: round(s.grid), battery: round(s.battery), soc: round(s.soc, 1) }));
      const trail = (liveTrail[stationId] ?? []).filter((p) => Date.parse(p.ts) > (steps.at(-1)?.ms ?? 0));
      return delay([...pts, ...trail], 40);
    },
    async getDaily(stationId, fromDay, toDay) {
      if (!visibleStationIds().has(stationId)) return [];
      const sim = ds.sims[stationId];
      const s = ds.stations.find((x) => x.id === stationId)!;
      const from = Math.max(Math.floor(Date.parse(fromDay) / DAY_MS), localDayIndex(sim.installMs) + 1);
      const now = Date.now();
      const to = Math.min(Math.floor(Date.parse(toDay) / DAY_MS), localDayIndex(now));
      const out: DailyEnergy[] = [];
      for (let d = from; d <= to; d++) {
        const a = dailyAgg(sim, d);
        const energy = d === localDayIndex(now) ? energyOfSteps(sim, daySteps(sim, d).filter((x) => x.ms <= now)) : a.energy;
        out.push({ station_id: s.id, day: dayKey(d), charged_kwh: energy.stored_kwh, discharged_kwh: energy.used_kwh, solar_kwh: energy.solar_kwh, load_kwh: energy.load_kwh, grid_import_kwh: energy.grid_import_kwh, grid_export_kwh: energy.grid_export_kwh, self_consumption_pct: energy.self_consumption_pct, savings_amd: energy.savings_amd, soh: a.soh, cycles: a.cycles });
      }
      return delay(out, 120);
    },
    async getRawTelemetry(stationId, limit) {
      requireStaff();
      if (!visibleStationIds().has(stationId)) return [];
      const sim = ds.sims[stationId];
      const now = simTimer ? Date.now() : ds.nowMs;
      const rows: ModuleReading[] = [...(moduleLatest[stationId] ?? [])];
      for (let t = Math.floor(now / STEP_MS) * STEP_MS; rows.length < limit; t -= STEP_MS)
        rows.push(...modulesAt(sim, t).map(({ row: _r, slot: _s, ...m }) => m));
      return delay(rows.slice(0, limit), 60);
    },
    subscribeLive(cb) {
      const v = visibleStationIds();
      const wrapped = (e: LiveEvent) => v.has(e.snapshot.station_id) && cb(e);
      liveSubs.add(wrapped);
      return () => liveSubs.delete(wrapped);
    },
    setSimulation(on) {
      if (on && !simTimer) {
        tick();
        simTimer = setInterval(tick, 3000);
      } else if (!on && simTimer) {
        clearInterval(simTimer);
        simTimer = null;
      }
      emit("simulation");
    },
    isSimulating: () => !!simTimer,

    async listModules() {
      const u = requireUser();
      if (u.role === "admin") return delay(ds.modules);
      const v = visibleStationIds();
      const seen = new Set(ds.assignments.filter((a) => v.has(a.station_id)).map((a) => a.module_id));
      return delay(ds.modules.filter((m) => (m.station_id && v.has(m.station_id)) || seen.has(m.id) || (u.role === "technician" && m.status === "spare")));
    },
    async listAssignments() {
      return delay(scoped(ds.assignments));
    },
    async markModuleFaulty(moduleId, reason) {
      requireStaff();
      const m = ds.modules.find((x) => x.id === moduleId)!;
      m.status = "faulty";
      ds.events.unshift({ id: newId("ev"), station_id: m.station_id!, ts: iso(Date.now()), source: "user", code: "MODULE_MARKED_FAULTY", message: `${m.serial} — ${reason}` });
      emit("modules");
      return delay(undefined);
    },
    async replaceModule(input) {
      const u = requireStaff();
      const old = ds.modules.find((x) => x.id === input.faultyModuleId);
      if (!old || !old.station_id) throw new Error("Module not installed");
      const sid = old.station_id;
      const sim = ds.sims[sid];
      const now = Date.now();
      const oldSim = sim.modules.find((x) => x.id === old.id)!;
      const sohAtRemoval = round(moduleSoh(oldSim, now), 1);
      const asg = ds.assignments.find((a) => a.module_id === old.id && !a.removed_at);
      if (asg) Object.assign(asg, { removed_at: iso(now), soh_at_removal: sohAtRemoval, removal_reason: input.reason, work_order_id: input.workOrderId ?? null });
      const row = old.row!, slot = old.slot!;
      Object.assign(old, { status: "replaced", station_id: null, row: null, slot: null });
      let nm = ds.modules.find((x) => x.serial.toLowerCase() === input.newSerial.trim().toLowerCase());
      if (nm && nm.station_id) throw new Error("serial_in_use");
      if (!nm) {
        nm = { id: newId("module"), serial: input.newSerial.trim(), station_id: null, row: null, slot: null, grade: input.newGrade, status: "spare", install_date: null, manufacture_date: iso(now).slice(0, 10), origin: "Registered at replacement", initial_soh: input.newInitialSoh };
        ds.modules.push(nm);
      }
      Object.assign(nm, { station_id: sid, row, slot, status: "active", grade: input.newGrade, install_date: iso(now).slice(0, 10), initial_soh: input.newInitialSoh });
      ds.assignments.push({ id: newId("asg"), module_id: nm.id, station_id: sid, row, slot, installed_at: iso(now), removed_at: null, grade_at_install: input.newGrade, soh_at_install: input.newInitialSoh, soh_at_removal: null, removal_reason: null, work_order_id: input.workOrderId ?? null });
      const newSim: SimModule = { id: nm.id, serial: nm.serial, row, slot, initialSoh: input.newInitialSoh, degrPerMonth: 0.12, installMs: now - DAY_MS, tempOffset: 0, spreadBase: 12, socOffset: 0, overheatSinceMs: null };
      sim.modules = sim.modules.map((m) => (m.id === old.id ? newSim : m));
      clearModelCaches();
      refresh(sid, simTimer ? now : ds.nowMs);
      for (const a of ds.alerts) if (a.module_id === old.id && a.status !== "resolved") Object.assign(a, { status: "resolved", resolved_at: iso(now) });
      ds.events.unshift({ id: newId("ev"), station_id: sid, ts: iso(now), source: "user", code: "MODULE_REPLACED", message: `${row}-${slot}: ${old.serial} → ${nm.serial} (${u.full_name})` });
      evaluate(sid, true);
      emit("modules");
      emit("alerts");
      return delay(undefined);
    },

    async listAlerts() {
      return delay(scoped(ds.alerts).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    },
    async setAlertStatus(id, status) {
      const a = scoped(ds.alerts).find((x) => x.id === id);
      if (!a) throw new Error("Not found");
      a.status = status;
      if (status === "acknowledged") a.acknowledged_at = iso(Date.now());
      if (status === "resolved") a.resolved_at = iso(Date.now());
      emit("alerts");
      return delay(undefined);
    },
    async listRules() {
      requireStaff();
      return delay(ds.rules);
    },
    async updateRule(id, patch) {
      if (requireUser().role !== "admin") throw new Error("Not allowed");
      Object.assign(ds.rules.find((r) => r.id === id)!, patch, { updated_at: iso(Date.now()) });
      for (const s of ds.stations) evaluate(s.id, true);
      emit("rules");
      return delay(undefined);
    },

    async listWorkOrders() {
      return delay(scoped(ds.workOrders).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    },
    async listChecklist(woId) {
      const wo = scoped(ds.workOrders).find((w) => w.id === woId);
      if (!wo) return [];
      return delay(ds.checklist.filter((c) => c.work_order_id === woId).sort((a, b) => a.position - b.position));
    },
    async createWorkOrder(input) {
      const u = requireUser();
      if (!visibleStationIds().has(input.station_id)) throw new Error("Not allowed");
      const photos = await Promise.all((input.photos ?? []).map((f) => api.uploadFile("photos", f.name, f)));
      const wo: WorkOrder = {
        id: newId("wo"), number: Math.max(...ds.workOrders.map((w) => w.number)) + 1, station_id: input.station_id, type: input.type,
        issue_type: input.issue_type ?? null, title: input.title, description: input.description ?? "", status: input.scheduled_date ? "scheduled" : "new",
        priority: input.priority ?? "normal", preferred_date: input.preferred_date ?? null, scheduled_date: input.scheduled_date ?? null,
        assigned_to: u.role === "owner" ? null : input.assigned_to ?? null, created_by: u.id, created_at: iso(Date.now()), completed_at: null,
        photos, parts_used: [], signature_url: null, signed_by: null, alert_id: input.alert_id ?? null, resolution_notes: null,
      };
      ds.workOrders.unshift(wo);
      CHECKLIST_TEMPLATES[wo.type].forEach((label, i) => ds.checklist.push({ id: newId("cl"), work_order_id: wo.id, position: i, label_key: label, done: false, note: null }));
      emit("workorders");
      return delay(wo);
    },
    async updateWorkOrder(id, patch) {
      const u = requireUser();
      const wo = scoped(ds.workOrders).find((w) => w.id === id);
      if (!wo) throw new Error("Not found");
      if (u.role === "owner") throw new Error("Not allowed");
      const wasDone = wo.status === "done";
      Object.assign(wo, patch);
      if (wo.status === "scheduled" && !wo.scheduled_date) wo.scheduled_date = iso(Date.now()).slice(0, 10);
      if (wo.status === "done" && !wasDone) {
        wo.completed_at = iso(Date.now());
        const st = ds.stations.find((s) => s.id === wo.station_id)!;
        ds.serviceHistory.unshift({ id: newId("sh"), station_id: wo.station_id, work_order_id: wo.id, date: wo.completed_at.slice(0, 10), type: wo.type, summary: wo.resolution_notes || wo.title, technician_id: wo.assigned_to });
        if (wo.type === "inspection_6m" || wo.type === "annual_coolant_fire") {
          st.last_service_date = wo.completed_at.slice(0, 10);
          st.next_service_date = iso(Date.now() + 182 * DAY_MS).slice(0, 10);
        }
        if (wo.alert_id) {
          const a = ds.alerts.find((x) => x.id === wo.alert_id);
          if (a && a.status !== "resolved") Object.assign(a, { status: "resolved", resolved_at: wo.completed_at });
        }
        if (wo.type === "repair" && wo.alert_id && ds.sims[wo.station_id].pumpFaultSinceMs && ds.alerts.find((x) => x.id === wo.alert_id)?.code === "COOLING_PUMP_FAULT") {
          ds.sims[wo.station_id].pumpFaultSinceMs = null;
          clearModelCaches();
          refresh(wo.station_id, simTimer ? Date.now() : ds.nowMs);
        }
        if (wo.type === "repair" && ds.alerts.find((x) => x.id === wo.alert_id)?.code === "MODULE_OVER_TEMP") {
          ds.sims[wo.station_id].modules.forEach((m) => (m.overheatSinceMs = null));
          clearModelCaches();
          refresh(wo.station_id, simTimer ? Date.now() : ds.nowMs);
        }
        ds.events.unshift({ id: newId("ev"), station_id: wo.station_id, ts: wo.completed_at, source: "user", code: "SERVICE_COMPLETED", message: `WO-${wo.number}` });
        evaluate(wo.station_id, true);
        emit("alerts");
        emit("stations");
      }
      emit("workorders");
      return delay(wo);
    },
    async updateChecklistItem(id, patch) {
      requireStaff();
      Object.assign(ds.checklist.find((c) => c.id === id)!, patch);
      emit("checklist");
      return delay(undefined, 20);
    },
    async uploadFile(_bucket, _path, file) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
    },
    async resolveFileUrl(ref) {
      if (!ref || ref.startsWith("demo:")) return null;
      return ref;
    },

    async listServiceHistory() {
      return delay(scoped(ds.serviceHistory).sort((a, b) => b.date.localeCompare(a.date)));
    },
    async listDocuments() {
      return delay(scoped(ds.documents).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    },
    async listEvents(stationId) {
      requireStaff();
      return delay(ds.events.filter((e) => e.station_id === stationId).slice(0, 200));
    },

    async savePushSubscription() {
      /* demo: browser notifications are shown locally, no push server */
    },

    onChange(cb) {
      changeSubs.add(cb);
      return () => changeSubs.delete(cb);
    },
  };
  return api;
}
