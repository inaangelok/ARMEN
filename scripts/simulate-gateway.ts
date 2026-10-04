/**
 * Pretends to be a station's MQTT/Modbus gateway and POSTs readings to the ingest endpoint.
 * This is exactly what real hardware will do, so it doubles as an integration test.
 *
 *   INGEST_URL=https://<project>.supabase.co/functions/v1/ingest \
 *   DEVICE_KEY=armen-gw-... STATION_SERIAL=ARM-S30-2025-0101 npm run simulate
 */
import { buildDataset } from "../src/lib/sim/dataset";
import { buildGatewayPayload } from "../src/lib/sim/payload";

const ingestUrl = process.env.INGEST_URL;
const deviceKey = process.env.DEVICE_KEY;
const serial = process.env.STATION_SERIAL;
const intervalMs = Number(process.env.INTERVAL_MS ?? 5000);
if (!ingestUrl || !deviceKey || !serial) {
  console.error("Set INGEST_URL, DEVICE_KEY and STATION_SERIAL");
  process.exit(1);
}

const ds = buildDataset();
const station = ds.stations.find((s) => s.serial === serial);
if (!station) {
  console.error(`Unknown serial ${serial}. Known: ${ds.stations.map((s) => s.serial).join(", ")}`);
  process.exit(1);
}
const sim = ds.sims[station.id];

async function send() {
  const body = buildGatewayPayload(sim);
  const r = await fetch(ingestUrl!, { method: "POST", headers: { "Content-Type": "application/json", "x-device-key": deviceKey! }, body: JSON.stringify(body) });
  console.log(new Date().toLocaleTimeString(), r.status, JSON.stringify(await r.json()));
}

console.log(`Streaming ${station.name} (${serial}) every ${intervalMs / 1000}s → ${ingestUrl}`);
send();
setInterval(send, intervalMs);
