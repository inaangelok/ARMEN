/**
 * Builds the complete demo dataset (12 stations across Aragatsotn and Yerevan).
 * Used by the in-browser demo store AND by scripts/seed.ts, which writes the same
 * data into Supabase — so both modes show identical stations, alerts and history.
 */
import { CHECKLIST_TEMPLATES } from "@/domain/services/maintenance";
import { DEFAULT_ALERT_RULES } from "@/domain/model/default-alert-rules";
import type {
  Alert,
  AlertRule,
  ChecklistItem,
  Customer,
  DocumentRec,
  EventLogEntry,
  Module,
  ModuleAssignment,
  ModuleGrade,
  Profile,
  Region,
  ServiceRecord,
  ServiceType,
  Station,
  StationSize,
  WorkOrder,
} from "@/domain/model";
import {
  DAY_MS,
  HOUR_MS,
  SIZE_SPECS,
  type LoadKind,
  type SimModule,
  type SimStation,
  daySteps,
  localDayIndex,
  modulesAt,
  rnd,
  round,
  STEP_MS,
} from "@/infrastructure/simulation/model";

const MONTH_MS = 30.44 * DAY_MS;

/** Deterministic UUID (v4 layout) derived from a key, so ids are stable across runs. */
export function uuidFrom(key: string): string {
  const hex = Array.from({ length: 4 }, (_, i) => Math.floor(rnd(key, "uuid", i) * 0xffffffff).toString(16).padStart(8, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export interface Dataset {
  nowMs: number;
  profiles: Profile[];
  customers: Customer[];
  stations: Station[];
  modules: Module[];
  assignments: ModuleAssignment[];
  sims: Record<string, SimStation>;
  alerts: Alert[];
  rules: AlertRule[];
  workOrders: WorkOrder[];
  checklist: ChecklistItem[];
  serviceHistory: ServiceRecord[];
  documents: DocumentRec[];
  events: EventLogEntry[];
  passwords: Record<string, string>;
  /** dataset user key ("owner", "tech1", …) → e-mail; used by the seed script to map auth users */
  userEmails: Record<string, string>;
}

interface StationSeed {
  key: string;
  name: string;
  size: StationSize;
  region: Region;
  community: string;
  address: string;
  lat: number;
  lng: number;
  pv: number;
  load: LoadKind;
  scale: number;
  installMonthsAgo: number;
  customer: string;
  tech: "tech1" | "tech2";
  anomaly?: "overheat" | "pump" | "weak";
}

const STATIONS: StationSeed[] = [
  { key: "st01", name: "Petrosyan Home", size: "S30", region: "Aragatsotn", community: "Ashtarak", address: "Ashtarak, Narekatsi St. 14", lat: 40.2992, lng: 44.3618, pv: 12, load: "home", scale: 1.1, installMonthsAgo: 14, customer: "c01", tech: "tech1", anomaly: "overheat" },
  { key: "st02", name: "Oshakan Guesthouse", size: "M60", region: "Aragatsotn", community: "Oshakan", address: "Oshakan, Mesrop Mashtots St. 3", lat: 40.2638, lng: 44.3129, pv: 25, load: "shop", scale: 1.5, installMonthsAgo: 22, customer: "c01", tech: "tech1" },
  { key: "st03", name: "Aparan Bakery", size: "M60", region: "Aragatsotn", community: "Aparan", address: "Aparan, Bakunts St. 21", lat: 40.5934, lng: 44.3586, pv: 22, load: "shop", scale: 1.7, installMonthsAgo: 9, customer: "c02", tech: "tech1" },
  { key: "st04", name: "Talin Agro Cold Storage", size: "L100", region: "Aragatsotn", community: "Talin", address: "Talin, Industrial zone 2", lat: 40.3912, lng: 43.8772, pv: 40, load: "cold_storage", scale: 1.15, installMonthsAgo: 16, customer: "c03", tech: "tech1", anomaly: "pump" },
  { key: "st05", name: "Hakobyan Home", size: "S30", region: "Aragatsotn", community: "Byurakan", address: "Byurakan, Observatory St. 8", lat: 40.3383, lng: 44.2721, pv: 10, load: "home", scale: 0.95, installMonthsAgo: 7, customer: "c04", tech: "tech1" },
  { key: "st06", name: "Karbi Winery", size: "L100", region: "Aragatsotn", community: "Karbi", address: "Karbi, Vineyard Rd. 1", lat: 40.3301, lng: 44.3755, pv: 45, load: "workshop", scale: 1.25, installMonthsAgo: 26, customer: "c05", tech: "tech1" },
  { key: "st07", name: "Kentron Café", size: "S30", region: "Yerevan", community: "Kentron", address: "Yerevan, Pushkin St. 27", lat: 40.1788, lng: 44.5128, pv: 8, load: "shop", scale: 0.85, installMonthsAgo: 11, customer: "c06", tech: "tech2" },
  { key: "st08", name: "Arabkir Dental Clinic", size: "M60", region: "Yerevan", community: "Arabkir", address: "Yerevan, Komitas Ave. 49", lat: 40.2052, lng: 44.5091, pv: 18, load: "office", scale: 1.35, installMonthsAgo: 19, customer: "c07", tech: "tech2", anomaly: "weak" },
  { key: "st09", name: "Malatia Family Home", size: "S30", region: "Yerevan", community: "Malatia-Sebastia", address: "Yerevan, Sebastia St. 112", lat: 40.1702, lng: 44.4502, pv: 11, load: "home", scale: 1.0, installMonthsAgo: 5, customer: "c08", tech: "tech2" },
  { key: "st10", name: "Nor Nork Mini-Market", size: "M60", region: "Yerevan", community: "Nor Nork", address: "Yerevan, Gai Ave. 16", lat: 40.1993, lng: 44.5803, pv: 20, load: "shop", scale: 1.45, installMonthsAgo: 13, customer: "c09", tech: "tech2" },
  { key: "st11", name: "Erebuni Auto Service", size: "L100", region: "Yerevan", community: "Erebuni", address: "Yerevan, Erebuni St. 5/2", lat: 40.1402, lng: 44.5301, pv: 35, load: "workshop", scale: 1.05, installMonthsAgo: 24, customer: "c10", tech: "tech2" },
  { key: "st12", name: "Davtashen Residence", size: "S30", region: "Yerevan", community: "Davtashen", address: "Yerevan, Davtashen 3rd district 18", lat: 40.2281, lng: 44.4949, pv: 12, load: "home", scale: 1.2, installMonthsAgo: 4, customer: "c11", tech: "tech2" },
];

const CUSTOMERS: { key: string; name: string; kind: "home" | "business"; owner: string; phone: string; email: string }[] = [
  { key: "c01", name: "Aram Petrosyan", kind: "home", owner: "owner", phone: "+374 91 234567", email: "owner@demo.armencare.am" },
  { key: "c02", name: "Aparan Hats LLC (Bakery)", kind: "business", owner: "o02", phone: "+374 93 112233", email: "info@aparanbakery.example" },
  { key: "c03", name: "Talin Agro LLC", kind: "business", owner: "o03", phone: "+374 94 556677", email: "ops@talinagro.example" },
  { key: "c04", name: "Lusine Hakobyan", kind: "home", owner: "o04", phone: "+374 77 445566", email: "lusine.h@example.com" },
  { key: "c05", name: "Karbi Wine House", kind: "business", owner: "o05", phone: "+374 98 778899", email: "hello@karbiwine.example" },
  { key: "c06", name: "Kentron Café", kind: "business", owner: "o06", phone: "+374 55 101010", email: "cafe@kentron.example" },
  { key: "c07", name: "Arabkir Dental Clinic", kind: "business", owner: "o07", phone: "+374 10 262626", email: "admin@arabkirdental.example" },
  { key: "c08", name: "Gevorg Mkrtchyan", kind: "home", owner: "o08", phone: "+374 91 909090", email: "gevorg.m@example.com" },
  { key: "c09", name: "Nor Nork Market", kind: "business", owner: "o09", phone: "+374 99 343434", email: "market@nornork.example" },
  { key: "c10", name: "Erebuni Auto Service", kind: "business", owner: "o10", phone: "+374 96 121314", email: "service@erebuniauto.example" },
  { key: "c11", name: "Mariam Avetisyan", kind: "home", owner: "o11", phone: "+374 93 676767", email: "mariam.a@example.com" },
];

const STAFF: { key: string; name: string; email: string; role: "technician" | "admin"; region: Region | null; phone: string }[] = [
  { key: "tech1", name: "Davit Hakobyan", email: "tech@demo.armencare.am", role: "technician", region: "Aragatsotn", phone: "+374 91 555001" },
  { key: "tech2", name: "Narek Sargsyan", email: "tech2@demo.armencare.am", role: "technician", region: "Yerevan", phone: "+374 91 555002" },
  { key: "admin", name: "Ani Grigoryan", email: "admin@demo.armencare.am", role: "admin", region: null, phone: "+374 10 555000" },
];

export const DEMO_PASSWORD = "ArmenCare2026!";

export { DEFAULT_ALERT_RULES as DEFAULT_RULES };

const iso = (ms: number) => new Date(ms).toISOString();
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function buildDataset(nowMs = Date.now(), userIds: Record<string, string> = {}): Dataset {
  // Align "now" to the simulated 15-min grid so seeded data ends at a real step.
  const now = nowMs;
  const uid = (k: string) => userIds[k] ?? uuidFrom("user:" + k);

  // -------------------------------------------------------------- people
  const profiles: Profile[] = [];
  const passwords: Record<string, string> = {};
  for (const s of STAFF) {
    profiles.push({ id: uid(s.key), full_name: s.name, email: s.email, phone: s.phone, role: s.role, language: "hy", region: s.region, notify_email: true, notify_push: true, notify_warning: true, notify_info: false });
    passwords[s.email] = DEMO_PASSWORD;
  }
  const customers: Customer[] = CUSTOMERS.map((c) => {
    profiles.push({ id: uid(c.owner), full_name: c.name, email: c.email, phone: c.phone, role: "owner", language: "hy", region: null, notify_email: true, notify_push: true, notify_warning: true, notify_info: false });
    passwords[c.email] = DEMO_PASSWORD;
    return { id: uuidFrom("cust:" + c.key), name: c.name, kind: c.kind, phone: c.phone, email: c.email, owner_id: uid(c.owner) };
  });
  const custId = (k: string) => uuidFrom("cust:" + k);

  // -------------------------------------------------------------- stations + modules
  const stations: Station[] = [];
  const modules: Module[] = [];
  const assignments: ModuleAssignment[] = [];
  const sims: Record<string, SimStation> = {};
  let moduleSeq = 1000;
  const serialFor = (grade: ModuleGrade, ms: number) => `AM5-${new Date(ms).getUTCFullYear().toString().slice(2)}${grade}-${(moduleSeq++).toString().padStart(5, "0")}`;

  STATIONS.forEach((s, i) => {
    const spec = SIZE_SPECS[s.size];
    const id = uuidFrom("station:" + s.key);
    const installMs = Math.floor((now - s.installMonthsAgo * MONTH_MS) / DAY_MS) * DAY_MS + 9 * HOUR_MS;
    const warrantyEnd = new Date(installMs);
    warrantyEnd.setUTCFullYear(warrantyEnd.getUTCFullYear() + 10);
    const serial = `ARM-${s.size}-${new Date(installMs).getUTCFullYear()}-${(101 + i).toString().padStart(4, "0")}`;
    const simMods: SimModule[] = [];
    for (let r = 1; r <= spec.rows; r++)
      for (let c = 1; c <= spec.cols; c++) {
        const mk = `${s.key}:r${r}s${c}`;
        const isWeak = s.anomaly === "weak" && r === 2 && c === 3;
        const isHot = s.anomaly === "overheat" && r === 1 && c === 4;
        const replacedEarlier = s.key === "st06" && r === 1 && c === 7;
        const grade: ModuleGrade = isWeak ? "C" : rnd(mk, "g") < 0.7 ? "A" : "B";
        const modInstall = replacedEarlier ? installMs + 18 * MONTH_MS : installMs;
        const initialSoh = isWeak ? 84.6 : grade === "A" ? 94 + rnd(mk, "s0") * 4 : 89 + rnd(mk, "s0") * 3.5;
        const monthsSince = (now - modInstall) / MONTH_MS;
        const degr = isWeak ? (initialSoh - 78) / monthsSince : 0.1 + rnd(mk, "dg") * 0.1;
        const mid = uuidFrom("module:" + mk);
        const serialNo = serialFor(grade, modInstall - 40 * DAY_MS);
        simMods.push({
          id: mid,
          serial: serialNo,
          row: r,
          slot: c,
          initialSoh,
          degrPerMonth: degr,
          installMs: modInstall,
          tempOffset: (rnd(mk, "to") - 0.5) * 2.4,
          spreadBase: isWeak ? 54 : 9 + rnd(mk, "sb") * 9,
          socOffset: (rnd(mk, "so") - 0.5) * 2,
          overheatSinceMs: isHot ? now - 20 * HOUR_MS : null,
        });
        modules.push({
          id: mid, serial: serialNo, station_id: id, row: r, slot: c, grade, status: "active",
          install_date: isoDate(modInstall), manufacture_date: isoDate(modInstall - (200 + rnd(mk, "mf") * 400) * DAY_MS),
          origin: `2nd-life EV pack EVP-${Math.floor(1000 + rnd(mk, "ev") * 8999)}`, initial_soh: round(initialSoh, 1),
        });
        assignments.push({ id: uuidFrom("asg:" + mk), module_id: mid, station_id: id, row: r, slot: c, installed_at: iso(modInstall), removed_at: null, grade_at_install: grade, soh_at_install: round(initialSoh, 1), soh_at_removal: null, removal_reason: null, work_order_id: null });
        if (replacedEarlier) {
          // historical module that failed and was swapped out (traceability demo)
          const oldId = uuidFrom("module:" + mk + ":old");
          const oldSerial = serialFor("B", installMs - 60 * DAY_MS);
          modules.push({ id: oldId, serial: oldSerial, station_id: null, row: null, slot: null, grade: "B", status: "replaced", install_date: isoDate(installMs), manufacture_date: isoDate(installMs - 300 * DAY_MS), origin: "2nd-life EV pack EVP-3307", initial_soh: 90.2 });
          assignments.push({ id: uuidFrom("asg:" + mk + ":old"), module_id: oldId, station_id: id, row: r, slot: c, installed_at: iso(installMs), removed_at: iso(modInstall), grade_at_install: "B", soh_at_install: 90.2, soh_at_removal: 79.4, removal_reason: "SOH below 80% (capacity fade)", work_order_id: uuidFrom("wo:st06-repl") });
        }
      }
    const reserve = s.load === "home" ? 20 : 15;
    stations.push({
      id, name: s.name, customer_id: custId(s.customer), size: s.size, model: spec.model, serial,
      install_date: isoDate(installMs), warranty_end: isoDate(warrantyEnd.getTime()), address: s.address, community: s.community,
      region: s.region, lat: s.lat, lng: s.lng, pv_kwp: s.pv, technician_id: uid(s.tech),
      operating_mode: s.load === "home" ? "backup_reserve" : "self_consumption", backup_reserve_pct: reserve,
      tariff_amd: 48, export_tariff_amd: 30, last_service_date: null, next_service_date: null, last_seen_at: iso(now),
    });
    sims[id] = {
      id, serial, size: s.size, pvKwp: s.pv, loadKind: s.load, loadScale: s.scale, reservePct: reserve, tariff: 48, exportTariff: 30,
      installMs, cycleRate: 0.55 + rnd(s.key, "cy") * 0.3, modules: simMods,
      pumpFaultSinceMs: s.anomaly === "pump" ? now - 5 * HOUR_MS : null,
    };
  });

  // spare modules in the warehouse
  for (let k = 0; k < 6; k++) {
    const grade: ModuleGrade = k < 4 ? "A" : "B";
    const mid = uuidFrom("module:spare:" + k);
    modules.push({ id: mid, serial: serialFor(grade, now - 90 * DAY_MS), station_id: null, row: null, slot: null, grade, status: "spare", install_date: null, manufacture_date: isoDate(now - (300 + k * 20) * DAY_MS), origin: `2nd-life EV pack EVP-${5100 + k * 7}`, initial_soh: grade === "A" ? 95.5 - k * 0.4 : 90.8 });
  }

  const st = (k: string) => stations.find((x) => x.id === uuidFrom("station:" + k))!;
  const mod = (k: string) => modules.find((m) => m.id === uuidFrom("module:" + k))!;

  // -------------------------------------------------------------- alerts
  const alerts: Alert[] = [];
  const addAlert = (key: string, a: Omit<Alert, "id">) => alerts.push({ id: uuidFrom("alert:" + key), ...a });
  const hot = modulesAt(sims[st("st01").id], now).find((m) => m.row === 1 && m.slot === 4)!;
  addAlert("hot", { station_id: st("st01").id, module_id: mod("st01:r1s4").id, code: "MODULE_OVER_TEMP", severity: "critical", status: "open", params: { module: "1-4", value: hot.temperature, threshold: 55 }, created_at: iso(now - 7.5 * HOUR_MS), acknowledged_at: null, resolved_at: null });
  addAlert("hot-w", { station_id: st("st01").id, module_id: mod("st01:r1s4").id, code: "MODULE_OVER_TEMP", severity: "warning", status: "resolved", params: { module: "1-4", value: 46.3, threshold: 45 }, created_at: iso(now - 19 * HOUR_MS), acknowledged_at: iso(now - 18 * HOUR_MS), resolved_at: iso(now - 7.5 * HOUR_MS) });
  addAlert("pump", { station_id: st("st04").id, module_id: null, code: "COOLING_PUMP_FAULT", severity: "critical", status: "acknowledged", params: { code: "CP-F03" }, created_at: iso(now - 5 * HOUR_MS), acknowledged_at: iso(now - 4.6 * HOUR_MS), resolved_at: null });
  const pumpHot = modulesAt(sims[st("st04").id], now).reduce((a, b) => (a.temperature > b.temperature ? a : b));
  addAlert("pump-temp", { station_id: st("st04").id, module_id: pumpHot.module_id, code: "MODULE_OVER_TEMP", severity: "warning", status: "open", params: { module: `${pumpHot.row}-${pumpHot.slot}`, value: Math.max(45.4, pumpHot.temperature), threshold: 45 }, created_at: iso(now - 1.2 * HOUR_MS), acknowledged_at: null, resolved_at: null });
  addAlert("weak", { station_id: st("st08").id, module_id: mod("st08:r2s3").id, code: "SOH_LOW", severity: "critical", status: "acknowledged", params: { module: "2-3", value: 78.0, threshold: 80 }, created_at: iso(now - 9 * DAY_MS), acknowledged_at: iso(now - 9 * DAY_MS + 3 * HOUR_MS), resolved_at: null });
  addAlert("weak-w", { station_id: st("st08").id, module_id: mod("st08:r2s3").id, code: "SOH_LOW", severity: "warning", status: "resolved", params: { module: "2-3", value: 84.9, threshold: 85 }, created_at: iso(now - 230 * DAY_MS), acknowledged_at: iso(now - 229 * DAY_MS), resolved_at: iso(now - 9 * DAY_MS) });
  addAlert("weak-imb", { station_id: st("st08").id, module_id: mod("st08:r2s3").id, code: "CELL_IMBALANCE", severity: "warning", status: "open", params: { module: "2-3", value: 63, threshold: 50 }, created_at: iso(now - 2 * DAY_MS), acknowledged_at: null, resolved_at: null });
  addAlert("comm", { station_id: st("st03").id, module_id: null, code: "COMM_LOST", severity: "warning", status: "resolved", params: { minutes: 128 }, created_at: iso(now - 40 * DAY_MS), acknowledged_at: iso(now - 40 * DAY_MS + HOUR_MS), resolved_at: iso(now - 40 * DAY_MS + 2.2 * HOUR_MS) });
  addAlert("inv", { station_id: st("st10").id, module_id: null, code: "INVERTER_ERROR", severity: "warning", status: "resolved", params: { code: "E-207" }, created_at: iso(now - 22 * DAY_MS), acknowledged_at: iso(now - 22 * DAY_MS + 0.5 * HOUR_MS), resolved_at: iso(now - 22 * DAY_MS + 3 * HOUR_MS) });
  addAlert("fire", { station_id: st("st02").id, module_id: null, code: "FIRE_SYSTEM_FAULT", severity: "critical", status: "resolved", params: { value: 1.4 }, created_at: iso(now - 55 * DAY_MS), acknowledged_at: iso(now - 55 * DAY_MS + 0.3 * HOUR_MS), resolved_at: iso(now - 54 * DAY_MS) });

  // grid outages detected by the model over the last 30 days → info alerts
  const today = localDayIndex(now);
  for (const s of stations) {
    for (let d = today - 30; d <= today; d++) {
      const steps = daySteps(sims[s.id], d).filter((x) => x.mode === "backup" && x.ms < now);
      if (!steps.length) continue;
      addAlert(`out:${s.id}:${d}`, { station_id: s.id, module_id: null, code: "GRID_OUTAGE", severity: "info", status: "resolved", params: { minutes: steps.length * 15 }, created_at: iso(steps[0].ms), acknowledged_at: null, resolved_at: iso(steps[steps.length - 1].ms + STEP_MS) });
    }
  }

  // -------------------------------------------------------------- work orders, service history
  const workOrders: WorkOrder[] = [];
  const checklist: ChecklistItem[] = [];
  const serviceHistory: ServiceRecord[] = [];
  const documents: DocumentRec[] = [];
  let woNum = 1001;
  const addWO = (key: string, w: Partial<WorkOrder> & Pick<WorkOrder, "station_id" | "type" | "title" | "status">, doneCount?: number) => {
    const id = uuidFrom("wo:" + key);
    const wo: WorkOrder = {
      id, number: 0, issue_type: null, description: "", priority: "normal", preferred_date: null, scheduled_date: null,
      assigned_to: null, created_by: uid("admin"), created_at: iso(now), completed_at: null, photos: [], parts_used: [],
      signature_url: null, signed_by: null, alert_id: null, resolution_notes: null, ...w,
    };
    workOrders.push(wo);
    const tpl = CHECKLIST_TEMPLATES[wo.type];
    const done = wo.status === "done" ? tpl.length : doneCount ?? 0;
    tpl.forEach((label, i) => checklist.push({ id: uuidFrom(`cl:${key}:${i}`), work_order_id: id, position: i, label_key: label, done: i < done, note: null }));
    return wo;
  };

  // periodic inspections in the past for every station
  for (const s of stations) {
    const sk = STATIONS.find((x) => uuidFrom("station:" + x.key) === s.id)!;
    const installMs = sims[s.id].installMs;
    addWO(`${sk.key}-comm`, { station_id: s.id, type: "commissioning", title: "Installation & commissioning", status: "done", assigned_to: s.technician_id, created_at: iso(installMs - 3 * DAY_MS), scheduled_date: isoDate(installMs), completed_at: iso(installMs + 6 * HOUR_MS), signed_by: CUSTOMERS.find((c) => c.key === sk.customer)!.name, signature_url: "demo:signature", parts_used: [{ part: `${SIZE_SPECS[s.size].model} cabinet`, qty: 1, serial: s.serial }] });
    serviceHistory.push({ id: uuidFrom("sh:comm:" + s.id), station_id: s.id, work_order_id: uuidFrom(`wo:${sk.key}-comm`), date: isoDate(installMs), type: "commissioning", summary: "System installed, commissioned and handed over to the customer.", technician_id: s.technician_id });
    let last = installMs;
    for (let k = 1; ; k++) {
      const due = installMs + k * 6 * MONTH_MS;
      if (due > now - 3 * DAY_MS) break;
      const annual = k % 2 === 0;
      const type: ServiceType = annual ? "annual_coolant_fire" : "inspection_6m";
      const doneMs = due + Math.floor(rnd(s.id, "svc", k) * 10 - 4) * DAY_MS;
      if (doneMs > now - DAY_MS) break;
      const key = `${sk.key}-svc${k}`;
      addWO(key, { station_id: s.id, type, title: annual ? "Annual coolant & fire-system check" : "6-monthly inspection", status: "done", assigned_to: s.technician_id, created_at: iso(doneMs - 14 * DAY_MS), scheduled_date: isoDate(doneMs), completed_at: iso(doneMs + 3 * HOUR_MS), signed_by: CUSTOMERS.find((c) => c.key === sk.customer)!.name, signature_url: "demo:signature", parts_used: annual ? [{ part: "Glycol coolant 30% (L)", qty: SIZE_SPECS[s.size].modules * 0.8 }, { part: "Fire-water inline filter", qty: 1 }] : [{ part: "Air filter set", qty: 1 }], resolution_notes: "All checks passed." });
      serviceHistory.push({ id: uuidFrom("sh:" + key), station_id: s.id, work_order_id: uuidFrom("wo:" + key), date: isoDate(doneMs), type, summary: annual ? "Coolant replaced, cooling loop pressure-tested, fire suppression valves and compartment flooding verified." : "Visual inspection, DC torque check, BMS log review and cell balance check. No issues found.", technician_id: s.technician_id });
      documents.push({ id: uuidFrom("doc:" + key), station_id: s.id, kind: "service_report", title: `Service report WO`, storage_path: null, created_at: iso(doneMs + 4 * HOUR_MS), size_kb: 180 + Math.floor(rnd(key, "kb") * 120) });
      last = doneMs;
    }
    s.last_service_date = last === installMs ? isoDate(installMs) : isoDate(last);
    // next due: 6 months after last
    let next = last + 6 * MONTH_MS;
    if (next < now) next = now + (3 + rnd(s.id, "nx") * 20) * DAY_MS;
    s.next_service_date = isoDate(next);
  }

  // replaced module history on st06
  const st06 = st("st06");
  const replMs = sims[st06.id].installMs + 18 * MONTH_MS;
  addWO("st06-repl", { station_id: st06.id, type: "module_replacement", title: "Replace module 1-7 (SOH 79.4%)", status: "done", priority: "high", assigned_to: st06.technician_id, created_at: iso(replMs - 6 * DAY_MS), scheduled_date: isoDate(replMs), completed_at: iso(replMs + 4 * HOUR_MS), signed_by: "Karbi Wine House", signature_url: "demo:signature", parts_used: [{ part: "Battery module 5 kWh (grade A)", qty: 1, serial: modules.find((m) => m.id === uuidFrom("module:st06:r1s7"))!.serial }], resolution_notes: "Faulty module returned to warehouse for grading." });
  serviceHistory.push({ id: uuidFrom("sh:st06-repl"), station_id: st06.id, work_order_id: uuidFrom("wo:st06-repl"), date: isoDate(replMs), type: "module_replacement", summary: "Module 1-7 replaced (capacity fade). New module balanced and verified.", technician_id: st06.technician_id });

  // historical fire-system fault repair on st02
  const st02 = st("st02");
  addWO("st02-fire", { station_id: st02.id, type: "repair", title: "Fire suppression low water pressure", description: "Pressure dropped to 1.4 bar. Check supply valve and pressure sensor.", status: "done", priority: "urgent", assigned_to: st02.technician_id, alert_id: uuidFrom("alert:fire"), created_at: iso(now - 55 * DAY_MS + HOUR_MS), scheduled_date: isoDate(now - 55 * DAY_MS), completed_at: iso(now - 54 * DAY_MS), signed_by: "Aram Petrosyan", signature_url: "demo:signature", parts_used: [{ part: "Pressure regulator valve PRV-15", qty: 1 }], resolution_notes: "Faulty pressure regulator replaced; pressure restored to 3.2 bar." });
  serviceHistory.push({ id: uuidFrom("sh:st02-fire"), station_id: st02.id, work_order_id: uuidFrom("wo:st02-fire"), date: isoDate(now - 54 * DAY_MS), type: "repair", summary: "Fire suppression pressure regulator replaced; system re-armed at 3.2 bar.", technician_id: st02.technician_id });

  // open work orders
  const st01 = st("st01"), st04 = st("st04"), st08 = st("st08"), st05 = st("st05"), st10 = st("st10"), st06b = st("st06");
  addWO("open-hot", { station_id: st01.id, type: "repair", issue_type: "alert", title: "Module 1-4 over-temperature", description: "Auto-created from critical alert. Module 1-4 above 55 °C while coolant inlet is normal — check cooling plate contact and module slave BMS sensor.", status: "new", priority: "urgent", alert_id: uuidFrom("alert:hot"), created_at: iso(now - 7.4 * HOUR_MS) });
  addWO("open-noise", { station_id: st10.id, type: "repair", issue_type: "noise", title: "Humming noise from the cabinet at night", description: "Customer reports a low humming noise from the battery cabinet between 22:00 and 02:00.", status: "new", priority: "low", preferred_date: isoDate(now + 5 * DAY_MS), created_by: uid("o09"), created_at: iso(now - 1.3 * DAY_MS) });
  addWO("open-repl", { station_id: st08.id, type: "module_replacement", issue_type: "alert", title: "Replace weak module 2-3 (SOH 78%)", description: "Module 2-3 below 80% SOH with high cell imbalance. Replace with grade A spare.", status: "scheduled", priority: "high", assigned_to: st08.technician_id, alert_id: uuidFrom("alert:weak"), scheduled_date: isoDate(now + 3 * DAY_MS), created_at: iso(now - 8 * DAY_MS) });
  addWO("open-insp", { station_id: st05.id, type: "inspection_6m", title: "6-monthly inspection", status: "scheduled", assigned_to: st05.technician_id, scheduled_date: isoDate(now + 6 * DAY_MS), created_at: iso(now - 10 * DAY_MS) });
  addWO("open-annual", { station_id: st06b.id, type: "annual_coolant_fire", title: "Annual coolant & fire-system check", status: "scheduled", assigned_to: st06b.technician_id, scheduled_date: isoDate(now + 12 * DAY_MS), created_at: iso(now - 4 * DAY_MS) });
  addWO("open-pump", { station_id: st04.id, type: "repair", issue_type: "alert", title: "Cooling pump fault (CP-F03)", description: "Coolant flow 0 L/min. Pump not responding. Station limited to 50% power until fixed.", status: "in_progress", priority: "urgent", assigned_to: st04.technician_id, alert_id: uuidFrom("alert:pump"), scheduled_date: isoDate(now), created_at: iso(now - 4.5 * HOUR_MS), parts_used: [{ part: "Coolant circulation pump CP-24V", qty: 1 }] }, 3);
  st04.next_service_date = isoDate(now);
  st05.next_service_date = isoDate(now + 6 * DAY_MS);
  st06b.next_service_date = isoDate(now + 12 * DAY_MS);
  st08.next_service_date = isoDate(now + 3 * DAY_MS);

  // number work orders chronologically
  workOrders.sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach((w) => (w.number = woNum++));
  documents.forEach((d) => {
    if (d.kind === "service_report") {
      const w = workOrders.find((x) => x.station_id === d.station_id && x.completed_at && Math.abs(Date.parse(x.completed_at) - Date.parse(d.created_at)) < DAY_MS);
      d.title = `Service report WO-${w?.number ?? ""}`;
    }
  });

  // maintenance due → info alerts
  for (const s of stations) {
    if (s.next_service_date && Date.parse(s.next_service_date) - now < 14 * DAY_MS && Date.parse(s.next_service_date) >= now - DAY_MS) {
      addAlert("due:" + s.id, { station_id: s.id, module_id: null, code: "MAINTENANCE_DUE", severity: "info", status: "open", params: { date: s.next_service_date }, created_at: iso(now - 2 * DAY_MS), acknowledged_at: null, resolved_at: null });
    }
  }

  // documents for every station
  for (const s of stations) {
    const installMs = sims[s.id].installMs;
    documents.push(
      { id: uuidFrom("doc:w:" + s.id), station_id: s.id, kind: "warranty", title: `Warranty certificate ${s.serial}`, storage_path: null, created_at: iso(installMs), size_kb: 210 },
      { id: uuidFrom("doc:i:" + s.id), station_id: s.id, kind: "installation_certificate", title: `Installation certificate ${s.serial}`, storage_path: null, created_at: iso(installMs + 6 * HOUR_MS), size_kb: 340 },
      { id: uuidFrom("doc:m:" + s.id), station_id: s.id, kind: "manual", title: `${s.model} — user manual`, storage_path: null, created_at: iso(installMs), size_kb: 2400 },
      { id: uuidFrom("doc:s:" + s.id), station_id: s.id, kind: "safety_manual", title: "Fire safety & emergency guide", storage_path: null, created_at: iso(installMs), size_kb: 860 },
    );
  }

  // -------------------------------------------------------------- event log
  const events: EventLogEntry[] = [];
  for (const a of alerts) {
    events.push({ id: uuidFrom("ev:a:" + a.id), station_id: a.station_id, ts: a.created_at, source: a.code.startsWith("FIRE") ? "fire" : a.code.includes("PUMP") || a.code.includes("COOLANT") ? "cooling" : a.code === "INVERTER_ERROR" || a.code === "GRID_OUTAGE" ? "pcs" : a.code === "MAINTENANCE_DUE" ? "system" : "bms", code: a.code, message: JSON.stringify(a.params) });
    if (a.resolved_at) events.push({ id: uuidFrom("ev:r:" + a.id), station_id: a.station_id, ts: a.resolved_at, source: "system", code: "ALERT_CLEARED", message: a.code });
  }
  for (const s of stations) {
    const fwMs = now - (10 + rnd(s.id, "fw") * 40) * DAY_MS;
    events.push({ id: uuidFrom("ev:fw:" + s.id), station_id: s.id, ts: iso(fwMs), source: "system", code: "FIRMWARE_UPDATED", message: "BMS 3.4.2 / PCS 2.11.0" });
    events.push({ id: uuidFrom("ev:boot:" + s.id), station_id: s.id, ts: iso(fwMs + 4 * 60_000), source: "system", code: "SYSTEM_RESTART", message: "" });
  }
  for (const w of workOrders) {
    if (w.completed_at) events.push({ id: uuidFrom("ev:wo:" + w.id), station_id: w.station_id, ts: w.completed_at, source: "user", code: "SERVICE_COMPLETED", message: `WO-${w.number}` });
  }
  events.sort((a, b) => b.ts.localeCompare(a.ts));

  const rules: AlertRule[] = DEFAULT_ALERT_RULES.map((r) => ({ ...r, id: uuidFrom("rule:" + r.code), updated_at: iso(now - 30 * DAY_MS) }));

  const userEmails: Record<string, string> = Object.fromEntries([...STAFF.map((s) => [s.key, s.email]), ...CUSTOMERS.map((c) => [c.owner, c.email])]);
  return { userEmails, nowMs: now, profiles, customers, stations, modules, assignments, sims, alerts, rules, workOrders, checklist, serviceHistory, documents, events, passwords };
}

