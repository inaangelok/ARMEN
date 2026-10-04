// ARMEN Care — telemetry ingestion endpoint.
//
// POST /functions/v1/ingest
// Auth (one of):
//   • x-device-key: <station gateway key>   (real hardware: MQTT/Modbus gateway on the station controller)
//   • Authorization: Bearer <user JWT> and "simulated": true   (demo simulator; only when ALLOW_SIMULATION=true)
// Body: a single reading or { "readings": [ ... ] } — see README "Telemetry payload".
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { notifyAlert } from "../_shared/notify.ts";
import { alertKey, evaluateRules, type RuleLike } from "../_shared/rules.ts";

interface ModulePayload {
  row: number;
  slot: number;
  serial?: string;
  soc: number;
  soh: number;
  voltage: number;
  current: number;
  temperature: number;
  cell_min_mv: number;
  cell_max_mv: number;
  bms_fault?: string | null;
}

interface Reading {
  station_serial: string;
  ts?: string;
  simulated?: boolean;
  soc: number;
  mode: "charging" | "discharging" | "idle" | "backup";
  pv_kw: number;
  load_kw: number;
  grid_kw: number;
  battery_kw: number;
  voltage: number;
  current: number;
  coolant_in_temp: number;
  coolant_out_temp: number;
  cycles?: number;
  systems: {
    pump: { status: "ok" | "fault" | "off"; flow_lpm: number };
    fire: { state: "armed" | "triggered" | "fault"; pressure_bar: number };
    dc_isolator: "closed" | "open";
    inverter: { state: "ok" | "fault" | "standby"; code: string | null; temp_c: number };
    transformer: { state: "ok" | "warning"; temp_c: number };
  };
  modules: ModulePayload[];
}

const EVALUATED = ["MODULE_OVER_TEMP", "CELL_IMBALANCE", "SOH_LOW", "COOLANT_HIGH", "COOLING_PUMP_FAULT", "FIRE_SYSTEM_FAULT", "FIRE_TRIGGERED", "INVERTER_ERROR", "GRID_OUTAGE"];
const MAX_INTERVAL_H = 0.25; // never integrate energy over more than 15 minutes (gaps)

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function validate(r: Reading): string | null {
  if (!r || typeof r !== "object") return "reading must be an object";
  if (!r.station_serial) return "station_serial is required";
  for (const k of ["soc", "pv_kw", "load_kw", "grid_kw", "battery_kw", "coolant_in_temp", "coolant_out_temp"] as const)
    if (typeof r[k] !== "number" || Number.isNaN(r[k])) return `${k} must be a number`;
  if (!Array.isArray(r.modules)) return "modules must be an array";
  if (!r.systems?.pump || !r.systems?.fire || !r.systems?.inverter) return "systems.pump, systems.fire and systems.inverter are required";
  return null;
}

/** Local (Asia/Yerevan, UTC+4) calendar day of a timestamp. */
const localDay = (ms: number) => new Date(ms + 4 * 3600_000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  let body: Reading | { readings: Reading[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const readings: Reading[] = "readings" in body ? body.readings : [body];
  if (!readings.length || readings.length > 200) return json({ error: "send 1–200 readings per request" }, 400);

  // ---------------------------------------------------------------- authentication
  const deviceKey = req.headers.get("x-device-key");
  let simulatingUser: string | null = null;
  if (!deviceKey) {
    if (Deno.env.get("ALLOW_SIMULATION") !== "true") return json({ error: "x-device-key required" }, 401);
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data } = await admin.auth.getUser(jwt);
    if (!data.user) return json({ error: "unauthorized" }, 401);
    simulatingUser = data.user.id;
  }

  const results: unknown[] = [];
  for (const r of readings) {
    const err = validate(r);
    if (err) {
      results.push({ station_serial: r?.station_serial, error: err });
      continue;
    }
    const { data: station } = await admin.from("stations").select("*").eq("serial", r.station_serial).maybeSingle();
    if (!station) {
      results.push({ station_serial: r.station_serial, error: "unknown station" });
      continue;
    }
    if (deviceKey) {
      if (!station.device_key_hash || station.device_key_hash !== (await sha256(deviceKey))) {
        results.push({ station_serial: r.station_serial, error: "invalid device key" });
        continue;
      }
    } else {
      if (!r.simulated) {
        results.push({ station_serial: r.station_serial, error: "user tokens may only send simulated readings" });
        continue;
      }
      // the user must be allowed to see this station (same rule as RLS)
      const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: req.headers.get("authorization")! } },
        auth: { persistSession: false },
      });
      const { data: visible } = await userClient.from("stations").select("id").eq("id", station.id).maybeSingle();
      if (!visible) {
        results.push({ station_serial: r.station_serial, error: "forbidden" });
        continue;
      }
    }
    results.push(await ingestOne(admin, station, r));
  }
  return json({ ok: true, simulated_by: simulatingUser, results });
});

// deno-lint-ignore no-explicit-any
async function ingestOne(admin: SupabaseClient, station: any, r: Reading) {
  const tsMs = r.ts ? Date.parse(r.ts) : Date.now();
  const ts = new Date(tsMs).toISOString();

  // map physical positions to registered modules
  const { data: registered } = await admin.from("modules").select("id, serial, row, slot").eq("station_id", station.id);
  const byPos = new Map((registered ?? []).map((m) => [`${m.row}-${m.slot}`, m]));
  const modules = r.modules.map((m) => {
    const reg = byPos.get(`${m.row}-${m.slot}`);
    return { ...m, module_id: reg?.id ?? null, mismatch: !!(reg && m.serial && m.serial !== reg.serial) };
  });

  const sohs = modules.map((m) => m.soh);
  const temps = modules.map((m) => m.temperature);
  const spreads = modules.map((m) => m.cell_max_mv - m.cell_min_mv);
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const soh = Math.round(avg(sohs) * 10) / 10;
  const tempMax = temps.length ? Math.max(...temps) : r.coolant_out_temp;
  const tempAvg = Math.round(avg(temps) * 10) / 10;
  const spread = spreads.length ? Math.max(...spreads) : 0;

  // ---------------------------------------------------------------- telemetry rows
  const { error: telErr } = await admin.from("telemetry").insert([
    {
      station_id: station.id, module_id: null, ts, soc: r.soc, soh, voltage: r.voltage, current: r.current, temperature: tempMax,
      coolant_in_temp: r.coolant_in_temp, coolant_out_temp: r.coolant_out_temp, pv_kw: r.pv_kw, load_kw: r.load_kw, grid_kw: r.grid_kw,
      battery_kw: r.battery_kw, mode: r.mode, temp_avg: tempAvg, cell_spread_mv: spread, cycles: r.cycles ?? null, systems: r.systems,
    },
    ...modules.filter((m) => m.module_id).map((m) => ({
      station_id: station.id, module_id: m.module_id, ts, soc: m.soc, soh: m.soh, voltage: m.voltage, current: m.current,
      temperature: m.temperature, cell_min_mv: m.cell_min_mv, cell_max_mv: m.cell_max_mv, bms_fault: m.bms_fault ?? null,
    })),
  ]);
  if (telErr) return { station_serial: r.station_serial, error: telErr.message };

  for (const m of modules.filter((x) => x.mismatch))
    await admin.from("event_log").insert({ station_id: station.id, ts, source: "bms", code: "MODULE_SERIAL_MISMATCH", message: `${m.row}-${m.slot}: ${m.serial}` });

  // ---------------------------------------------------------------- daily energy roll-up
  const { data: prev } = await admin.from("station_latest").select("ts").eq("station_id", station.id).maybeSingle();
  const dtH = prev ? Math.min(MAX_INTERVAL_H, Math.max(0, (tsMs - Date.parse(prev.ts)) / 3600_000)) : 0;
  const { data: daily } = await admin.rpc("add_daily_energy", {
    p_station: station.id, p_day: localDay(tsMs),
    p_charged: Math.max(0, r.battery_kw) * dtH, p_discharged: Math.max(0, -r.battery_kw) * dtH,
    p_solar: r.pv_kw * dtH, p_load: r.load_kw * dtH, p_import: Math.max(0, r.grid_kw) * dtH, p_export: Math.max(0, -r.grid_kw) * dtH,
    p_soh: soh, p_cycles: r.cycles ?? null, p_temp_max: tempMax, p_temp_avg: tempAvg, p_spread: spread,
  });

  const snapshot = {
    station_id: station.id, ts, soc: r.soc, soh, mode: r.mode, pv_kw: r.pv_kw, load_kw: r.load_kw, grid_kw: r.grid_kw, battery_kw: r.battery_kw,
    voltage: r.voltage, current: r.current, temp_max: tempMax, temp_avg: tempAvg, coolant_in_temp: r.coolant_in_temp, coolant_out_temp: r.coolant_out_temp,
    cell_spread_mv: spread, systems: { ...r.systems, comm: "online" },
    today: daily
      ? { stored_kwh: +daily.charged_kwh, used_kwh: +daily.discharged_kwh, solar_kwh: +daily.solar_kwh, load_kwh: +daily.load_kwh, grid_import_kwh: +daily.grid_import_kwh, grid_export_kwh: +daily.grid_export_kwh, self_consumption_pct: +daily.self_consumption_pct, savings_amd: +daily.savings_amd }
      : null,
  };
  const moduleRows = modules.filter((m) => m.module_id).map((m) => ({ module_id: m.module_id, ts, soc: m.soc, soh: m.soh, voltage: m.voltage, current: m.current, temperature: m.temperature, cell_min_mv: m.cell_min_mv, cell_max_mv: m.cell_max_mv, bms_fault: m.bms_fault ?? null }));
  await admin.from("station_latest").upsert({ station_id: station.id, ts, snapshot, modules: moduleRows });
  await admin.from("stations").update({ last_seen_at: ts }).eq("id", station.id);

  // ---------------------------------------------------------------- alert rules
  const { data: rules } = await admin.from("alert_rules").select("*");
  const candidates = evaluateRules((rules ?? []) as RuleLike[], { ...r, mode: r.mode }, modules.map((m) => ({ ...m, module_id: m.module_id })));
  const { data: open } = await admin.from("alerts").select("*").eq("station_id", station.id).neq("status", "resolved");
  const created: string[] = [];
  for (const c of candidates) {
    const existing = (open ?? []).find((a) => alertKey(a) === alertKey(c));
    if (existing) {
      if (existing.severity !== "critical" && c.severity === "critical") {
        await admin.from("alerts").update({ severity: "critical", params: c.params, status: "open", notified_at: null }).eq("id", existing.id);
        created.push(existing.id);
      }
      continue;
    }
    const { data: a } = await admin.from("alerts").insert({ station_id: station.id, module_id: c.module_id, code: c.code, severity: c.severity, params: c.params, created_at: ts }).select("id, severity").maybeSingle();
    if (a) {
      created.push(a.id);
      await admin.from("event_log").insert({ station_id: station.id, ts, source: c.code.startsWith("FIRE") ? "fire" : c.code.includes("PUMP") || c.code.includes("COOLANT") ? "cooling" : c.code === "INVERTER_ERROR" || c.code === "GRID_OUTAGE" ? "pcs" : "bms", code: c.code, message: JSON.stringify(c.params) });
    }
  }
  const active = new Set(candidates.map(alertKey));
  const toResolve = (open ?? []).filter((a) => EVALUATED.includes(a.code) && !active.has(alertKey(a)));
  if (toResolve.length) await admin.from("alerts").update({ status: "resolved", resolved_at: ts }).in("id", toResolve.map((a) => a.id));

  // ---------------------------------------------------------------- notifications for critical alerts
  const { data: critical } = await admin.from("alerts").select("id").in("id", created.length ? created : ["00000000-0000-0000-0000-000000000000"]).eq("severity", "critical").is("notified_at", null);
  for (const a of critical ?? []) await notifyAlert(admin, a.id);

  return { station_serial: r.station_serial, ok: true, alerts_created: created.length, alerts_resolved: toResolve.length };
}
