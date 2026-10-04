/**
 * Supabase-backed implementation of the Api interface.
 * Access control is enforced in Postgres (RLS + guard triggers); this file only queries.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildDataset } from "../sim/dataset";
import { buildGatewayPayload } from "../sim/payload";
import type {
  Alert, AlertRule, ChecklistItem, Customer, DailyEnergy, DocumentRec, EventLogEntry, HistoryPoint, Module, ModuleAssignment,
  ModuleReading, Profile, Station, StationSnapshot, WorkOrder, ServiceRecord,
} from "../types";
import type { Api, LiveEvent, ModuleHistoryPoint, PowerPoint } from "./types";

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb: SupabaseClient = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  const changeSubs = new Set<(t: string) => void>();
  const emit = (t: string) => changeSubs.forEach((cb) => cb(t));
  let simTimer: ReturnType<typeof setInterval> | null = null;
  let simData: ReturnType<typeof buildDataset> | null = null;

  const check = <T,>(r: { data: T; error: { message: string } | null }): T => {
    if (r.error) throw new Error(r.error.message);
    return r.data;
  };
  const myProfile = async (): Promise<Profile | null> => {
    const { data } = await sb.auth.getUser();
    if (!data.user) return null;
    return check(await sb.from("profiles").select("*").eq("id", data.user.id).single()) as Profile;
  };

  // realtime: alerts + work orders → invalidate queries
  sb.channel("armen-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, (p) => {
      emit("alerts");
      if (p.eventType === "INSERT" || (p.eventType === "UPDATE" && (p.new as Alert).severity === "critical" && (p.old as Partial<Alert>).severity !== "critical"))
        emit(`alert-new:${(p.new as Alert).id}`);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "work_orders" }, () => emit("workorders"))
    .subscribe();

  const api: Api = {
    mode: "supabase",
    demoAccounts: [
      { role: "owner", email: "owner@demo.armencare.am", name: "Aram Petrosyan", password: "ArmenCare2026!" },
      { role: "technician", email: "tech@demo.armencare.am", name: "Davit Hakobyan", password: "ArmenCare2026!" },
      { role: "admin", email: "admin@demo.armencare.am", name: "Ani Grigoryan", password: "ArmenCare2026!" },
    ],

    getSession: myProfile,
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error("invalid_credentials");
      return (await myProfile())!;
    },
    async signOut() {
      api.setSimulation(false, []);
      await sb.auth.signOut();
    },
    async updateMyProfile(patch) {
      const me = await myProfile();
      if (!me) throw new Error("Not signed in");
      const { id: _i, role: _r, email: _e, ...rest } = patch;
      return check(await sb.from("profiles").update(rest).eq("id", me.id).select().single()) as Profile;
    },
    async listProfiles() {
      return check(await sb.from("profiles").select("*").order("full_name")) as Profile[];
    },
    async updateProfile(id, patch) {
      check(await sb.from("profiles").update(patch).eq("id", id));
    },
    async inviteUser(input) {
      // Inviting requires the service role → done by a small Edge Function in production.
      // Here we call the auth admin endpoint through an Edge Function if deployed, else explain.
      const { error } = await sb.functions.invoke("invite-user", { body: input });
      if (error) throw new Error("invite_function_missing");
    },

    async listStations() {
      return check(await sb.from("stations").select("*").order("name")) as Station[];
    },
    async updateStation(id, patch) {
      const { device_key_hash: _d, ...rest } = patch as Station & { device_key_hash?: string };
      const s = check(await sb.from("stations").update(rest).eq("id", id).select().single()) as Station;
      emit("stations");
      return s;
    },
    async listCustomers() {
      return check(await sb.from("customers").select("*")) as Customer[];
    },

    async getSnapshots() {
      const rows = check(await sb.from("station_latest").select("station_id, snapshot")) as { station_id: string; snapshot: StationSnapshot }[];
      return Object.fromEntries(rows.map((r) => [r.station_id, r.snapshot]));
    },
    async getModuleReadings(stationId) {
      const r = check(await sb.from("station_latest").select("modules").eq("station_id", stationId).maybeSingle()) as { modules: ModuleReading[] } | null;
      return r?.modules ?? [];
    },
    async getStationHistory(stationId, range) {
      const rows = check(await sb.rpc("station_history", { p_station: stationId, p_range: range })) as Record<string, unknown>[];
      return rows.map((r) => ({ ts: String(r.ts), soh: num(r.soh), cycles: num(r.cycles), temp_max: num(r.temp_max), temp_avg: num(r.temp_avg), spread_mv: num(r.spread_mv) })) as HistoryPoint[];
    },
    async getModuleHistory(moduleId, range) {
      const rows = check(await sb.rpc("module_history", { p_module: moduleId, p_range: range })) as Record<string, unknown>[];
      return rows.map((r) => ({ ts: String(r.ts), soh: num(r.soh), cycles: 0, temp_max: num(r.temp_max), temp_avg: num(r.temp_max), spread_mv: num(r.spread_mv), soc: r.soc == null ? undefined : num(r.soc), voltage: r.voltage == null ? undefined : num(r.voltage) })) as ModuleHistoryPoint[];
    },
    async getPowerSeries(stationId) {
      const local = new Date(Date.now() + 4 * 3600_000);
      const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 4 * 3600_000;
      const rows = check(
        await sb.from("telemetry").select("ts, pv_kw, load_kw, grid_kw, battery_kw, soc").eq("station_id", stationId).is("module_id", null).gte("ts", new Date(midnight).toISOString()).order("ts").limit(5000),
      ) as Record<string, unknown>[];
      return rows.map((r) => ({ ts: String(r.ts), pv: num(r.pv_kw), load: num(r.load_kw), grid: num(r.grid_kw), battery: num(r.battery_kw), soc: num(r.soc) })) as PowerPoint[];
    },
    async getDaily(stationId, fromDay, toDay) {
      const rows = check(await sb.from("station_daily").select("*").eq("station_id", stationId).gte("day", fromDay).lte("day", toDay).order("day")) as Record<string, unknown>[];
      return rows.map((r) => ({
        station_id: stationId, day: String(r.day), charged_kwh: num(r.charged_kwh), discharged_kwh: num(r.discharged_kwh), solar_kwh: num(r.solar_kwh), load_kwh: num(r.load_kwh),
        grid_import_kwh: num(r.grid_import_kwh), grid_export_kwh: num(r.grid_export_kwh), self_consumption_pct: num(r.self_consumption_pct), savings_amd: num(r.savings_amd), soh: num(r.soh), cycles: num(r.cycles),
      })) as DailyEnergy[];
    },
    async getRawTelemetry(stationId, limit) {
      const rows = check(await sb.from("telemetry").select("module_id, ts, soc, soh, voltage, current, temperature, cell_min_mv, cell_max_mv, bms_fault").eq("station_id", stationId).not("module_id", "is", null).order("ts", { ascending: false }).limit(limit)) as Record<string, unknown>[];
      return rows.map((r) => ({ module_id: String(r.module_id), ts: String(r.ts), soc: num(r.soc), soh: num(r.soh), voltage: num(r.voltage), current: num(r.current), temperature: num(r.temperature), cell_min_mv: num(r.cell_min_mv), cell_max_mv: num(r.cell_max_mv), bms_fault: (r.bms_fault as string) ?? null }));
    },
    subscribeLive(cb) {
      const ch = sb
        .channel(`live-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "station_latest" }, (p) => {
          const row = p.new as { snapshot: StationSnapshot; modules: ModuleReading[] };
          if (row?.snapshot) cb({ snapshot: row.snapshot, modules: row.modules } as LiveEvent);
        })
        .subscribe();
      return () => {
        sb.removeChannel(ch);
      };
    },
    setSimulation(on, stationIds) {
      if (simTimer) clearInterval(simTimer);
      simTimer = null;
      if (on) {
        simData ??= buildDataset(Date.now());
        const send = async () => {
          const readings = stationIds.map((id) => simData!.sims[id]).filter(Boolean).map((sim) => buildGatewayPayload(sim, Date.now(), true));
          if (readings.length) await sb.functions.invoke("ingest", { body: { readings } });
        };
        send();
        simTimer = setInterval(send, 5000);
      }
      emit("simulation");
    },
    isSimulating: () => !!simTimer,

    async listModules() {
      return check(await sb.from("modules").select("*").order("serial")) as Module[];
    },
    async listAssignments() {
      return check(await sb.from("module_assignments").select("*").order("installed_at")) as ModuleAssignment[];
    },
    async markModuleFaulty(moduleId, reason) {
      const m = check(await sb.from("modules").update({ status: "faulty" }).eq("id", moduleId).select().single()) as Module;
      await sb.from("event_log").insert({ station_id: m.station_id, source: "user", code: "MODULE_MARKED_FAULTY", message: `${m.serial} — ${reason}` });
      emit("modules");
    },
    async replaceModule(input) {
      check(await sb.rpc("replace_module", { p_faulty: input.faultyModuleId, p_new_serial: input.newSerial, p_grade: input.newGrade, p_soh: input.newInitialSoh, p_reason: input.reason, p_work_order: input.workOrderId ?? null }));
      emit("modules");
      emit("alerts");
    },

    async listAlerts() {
      return check(await sb.from("alerts").select("*").order("created_at", { ascending: false }).limit(1000)) as Alert[];
    },
    async setAlertStatus(id, status) {
      check(await sb.from("alerts").update({ status }).eq("id", id));
      emit("alerts");
    },
    async listRules() {
      return check(await sb.from("alert_rules").select("*").order("code")) as AlertRule[];
    },
    async updateRule(id, patch) {
      check(await sb.from("alert_rules").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id));
      emit("rules");
    },

    async listWorkOrders() {
      return check(await sb.from("work_orders").select("*").order("created_at", { ascending: false })) as WorkOrder[];
    },
    async listChecklist(woId) {
      return check(await sb.from("checklist_items").select("*").eq("work_order_id", woId).order("position")) as ChecklistItem[];
    },
    async createWorkOrder(input) {
      const { photos, ...rest } = input;
      const id = crypto.randomUUID();
      // upload first: owners cannot update a work order after creating it (RLS)
      const paths = await Promise.all((photos ?? []).map((f, i) => api.uploadFile("photos", `${input.station_id}/${id}/${Date.now()}-${i}-${f.name.replace(/[^\w.-]/g, "_")}`, f)));
      const wo = check(await sb.from("work_orders").insert({ ...rest, id, photos: paths, status: rest.scheduled_date ? "scheduled" : "new" }).select().single()) as WorkOrder;
      emit("workorders");
      return wo;
    },
    async updateWorkOrder(id, patch) {
      const wo = check(await sb.from("work_orders").update(patch).eq("id", id).select().single()) as WorkOrder;
      emit("workorders");
      if (patch.status === "done") {
        emit("alerts");
        emit("stations");
      }
      return wo;
    },
    async updateChecklistItem(id, patch) {
      check(await sb.from("checklist_items").update(patch).eq("id", id));
    },
    async uploadFile(bucket, path, file) {
      check(await sb.storage.from(bucket).upload(path, file, { upsert: true }));
      return `${bucket}:${path}`;
    },
    async resolveFileUrl(ref) {
      if (!ref || ref.startsWith("demo:")) return null;
      if (ref.startsWith("data:") || ref.startsWith("http")) return ref;
      const [bucket, ...rest] = ref.split(":");
      const { data } = await sb.storage.from(bucket).createSignedUrl(rest.join(":"), 3600);
      return data?.signedUrl ?? null;
    },

    async listServiceHistory() {
      return check(await sb.from("service_history").select("*").order("date", { ascending: false })) as ServiceRecord[];
    },
    async listDocuments() {
      const docs = check(await sb.from("documents").select("*").order("created_at", { ascending: false })) as DocumentRec[];
      return docs.map((d) => ({ ...d, storage_path: d.storage_path ? `documents:${d.storage_path}` : null }));
    },
    async listEvents(stationId) {
      return check(await sb.from("event_log").select("*").eq("station_id", stationId).order("ts", { ascending: false }).limit(200)) as EventLogEntry[];
    },

    async savePushSubscription(sub) {
      if (!sub.endpoint || !sub.keys) return;
      check(await sb.from("push_subscriptions").upsert({ endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, { onConflict: "endpoint" }));
    },

    onChange(cb) {
      changeSubs.add(cb);
      return () => changeSubs.delete(cb);
    },
  };
  return api;
}
