/**
 * Seeds a Supabase project with the ARMEN Care demo dataset.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed            (90 days of telemetry)
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed -- --days 30 --reset
 *
 * Creates demo users (password: ArmenCare2026!), 12 stations, modules, 90 days of
 * 15-minute telemetry (module rows: 15-min for the last 7 days, hourly before that),
 * 12 months of daily roll-ups, alerts, work orders, service history and documents.
 * Prints one gateway API key per station for testing the ingest endpoint.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { buildDataset, DEMO_PASSWORD } from "../src/lib/sim/dataset";
import { DAY_MS, HOUR_MS, STEP_MS, cyclesAt, dailyAgg, dayStartMs, localDayIndex, modulesAt, snapshotAt } from "../src/lib/sim/model";

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const args = process.argv.slice(2);
const DAYS = Number(args[args.indexOf("--days") + 1]) || 90;
const RESET = args.includes("--reset");
const db = createClient(url, key, { auth: { persistSession: false } });

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}
async function insertBatches(table: string, rows: object[], size = 2000) {
  for (let i = 0; i < rows.length; i += size) {
    await must(db.from(table).insert(rows.slice(i, i + size)), `insert ${table}`);
    process.stdout.write(`\r  ${table}: ${Math.min(i + size, rows.length)}/${rows.length}`);
  }
  if (rows.length) process.stdout.write("\n");
}
const NIL = "00000000-0000-0000-0000-000000000000";

async function main() {
  const now = Math.floor(Date.now() / STEP_MS) * STEP_MS;

  // ------------------------------------------------------------ users
  console.log("Creating users…");
  const base = buildDataset(now);
  const existing = new Map<string, string>();
  for (let page = 1; page < 20; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    data.users.forEach((u) => u.email && existing.set(u.email.toLowerCase(), u.id));
    if (data.users.length < 200) break;
  }
  const userIds: Record<string, string> = {};
  for (const [k, email] of Object.entries(base.userEmails)) {
    const profile = base.profiles.find((p) => p.email === email)!;
    let id = existing.get(email.toLowerCase());
    if (!id) {
      const { data, error } = await db.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true, app_metadata: { role: profile.role }, user_metadata: { full_name: profile.full_name } });
      if (error) throw error;
      id = data.user.id;
    }
    userIds[k] = id;
  }
  const ds = buildDataset(now, userIds);

  if (RESET) {
    console.log("Removing previous demo data…");
    for (const t of ["event_log", "documents", "service_history", "checklist_items", "work_orders", "alerts", "module_daily", "station_daily", "station_latest", "telemetry", "module_assignments", "modules", "stations", "customers"])
      await must(db.from(t).delete().neq(t === "telemetry" ? "station_id" : t === "station_latest" || t === "station_daily" ? "station_id" : t === "module_daily" ? "module_id" : "id", NIL), `clear ${t}`);
  }

  console.log("Profiles, customers, stations, modules…");
  for (const p of ds.profiles) await must(db.from("profiles").upsert(p), "profiles");
  await must(db.from("customers").upsert(ds.customers), "customers");
  const deviceKeys: Record<string, string> = {};
  await must(
    db.from("stations").upsert(
      ds.stations.map((s) => {
        const k = `armen-gw-${s.serial.toLowerCase()}-${createHash("sha1").update(s.id).digest("hex").slice(0, 10)}`;
        deviceKeys[s.serial] = k;
        return { ...s, device_key_hash: createHash("sha256").update(k).digest("hex") };
      }),
    ),
    "stations",
  );
  await must(db.from("modules").upsert(ds.modules), "modules");
  await must(db.from("module_assignments").upsert(ds.assignments), "assignments");

  // ------------------------------------------------------------ telemetry
  console.log(`Telemetry (${DAYS} days)…`);
  const from = now - DAYS * DAY_MS;
  for (const s of ds.stations) {
    const sim = ds.sims[s.id];
    const stationRows: object[] = [];
    const moduleRows: object[] = [];
    for (let t = Math.max(from, sim.installMs); t <= now; t += STEP_MS) {
      const snap = snapshotAt(sim, t);
      stationRows.push({ station_id: s.id, module_id: null, ts: snap.ts, soc: snap.soc, soh: snap.soh, voltage: snap.voltage, current: snap.current, temperature: snap.temp_max, coolant_in_temp: snap.coolant_in_temp, coolant_out_temp: snap.coolant_out_temp, pv_kw: snap.pv_kw, load_kw: snap.load_kw, grid_kw: snap.grid_kw, battery_kw: snap.battery_kw, mode: snap.mode, temp_avg: snap.temp_avg, cell_spread_mv: snap.cell_spread_mv, cycles: Math.round(cyclesAt(sim, t) * 10) / 10, systems: snap.systems });
      const recent = t > now - 7 * DAY_MS;
      if (recent || t % HOUR_MS === 0)
        for (const m of modulesAt(sim, t)) {
          if (t < (sim.modules.find((x) => x.id === m.module_id)?.installMs ?? 0)) continue;
          moduleRows.push({ station_id: s.id, module_id: m.module_id, ts: m.ts, soc: m.soc, soh: m.soh, voltage: m.voltage, current: m.current, temperature: m.temperature, cell_min_mv: m.cell_min_mv, cell_max_mv: m.cell_max_mv, bms_fault: m.bms_fault });
        }
    }
    console.log(`  ${s.name}`);
    await insertBatches("telemetry", stationRows);
    await insertBatches("telemetry", moduleRows, 3000);

    // daily roll-ups (up to 12 months)
    const today = localDayIndex(now);
    const daily: object[] = [];
    const mdaily: object[] = [];
    for (let d = Math.max(today - 365, localDayIndex(sim.installMs) + 1); d <= today; d++) {
      const a = dailyAgg(sim, d);
      const e = a.energy;
      daily.push({ station_id: s.id, day: a.day, charged_kwh: e.stored_kwh, discharged_kwh: e.used_kwh, solar_kwh: e.solar_kwh, load_kwh: e.load_kwh, grid_import_kwh: e.grid_import_kwh, grid_export_kwh: e.grid_export_kwh, self_consumption_pct: e.self_consumption_pct, savings_amd: e.savings_amd, soh: a.soh, cycles: a.cycles, temp_max: a.temp_max, temp_avg: a.temp_avg, spread_mv: a.spread_mv });
      for (const mid of Object.keys(a.moduleSoh)) {
        const sm = sim.modules.find((x) => x.id === mid)!;
        if (dayStartMs(d) < sm.installMs) continue;
        mdaily.push({ module_id: mid, station_id: s.id, day: a.day, soh: a.moduleSoh[mid], temp_max: a.moduleTempMax[mid], spread_mv: a.moduleSpread[mid] });
      }
    }
    // today's row is partial: recompute from steps up to now
    const snapNow = snapshotAt(sim, now);
    const last = daily[daily.length - 1] as Record<string, unknown>;
    Object.assign(last, { charged_kwh: snapNow.today.stored_kwh, discharged_kwh: snapNow.today.used_kwh, solar_kwh: snapNow.today.solar_kwh, load_kwh: snapNow.today.load_kwh, grid_import_kwh: snapNow.today.grid_import_kwh, grid_export_kwh: snapNow.today.grid_export_kwh, self_consumption_pct: snapNow.today.self_consumption_pct, savings_amd: snapNow.today.savings_amd });
    await must(db.from("station_daily").upsert(daily), "station_daily");
    await insertBatches("module_daily", mdaily, 3000);
    await must(db.from("station_latest").upsert({ station_id: s.id, ts: snapNow.ts, snapshot: snapNow, modules: modulesAt(sim, now).map(({ row: _r, slot: _s, ...m }) => m) }), "station_latest");
  }

  // ------------------------------------------------------------ alerts, maintenance, documents
  console.log("Alerts, work orders, history, documents…");
  await must(db.from("alerts").upsert(ds.alerts.map((a) => ({ ...a, notified_at: a.severity === "critical" ? a.created_at : null }))), "alerts");
  await must(db.from("work_orders").upsert(ds.workOrders), "work_orders");
  const woIds = ds.workOrders.map((w) => w.id);
  for (let i = 0; i < woIds.length; i += 100) await must(db.from("checklist_items").delete().in("work_order_id", woIds.slice(i, i + 100)), "clear checklist");
  await insertBatches("checklist_items", ds.checklist);
  await must(db.from("service_history").upsert(ds.serviceHistory), "service_history");
  await must(db.from("documents").upsert(ds.documents), "documents");
  await must(db.from("event_log").upsert(ds.events), "event_log");

  console.log("\nDone. Demo logins (password %s):", DEMO_PASSWORD);
  console.log("  owner@demo.armencare.am · tech@demo.armencare.am · tech2@demo.armencare.am · admin@demo.armencare.am");
  console.log("\nGateway API keys (x-device-key) for scripts/simulate-gateway.ts:");
  for (const [serial, k] of Object.entries(deviceKeys)) console.log(`  ${serial}  ${k}`);
}

main().catch((e) => {
  console.error("\nSeed failed:", e.message ?? e);
  process.exit(1);
});
