import { cyclesAt, modulesAt, snapshotAt, type SimStation } from "@/infrastructure/simulation/model";

/** JSON payload a station controller (MQTT/Modbus gateway) sends to the ingest endpoint. */
export function buildGatewayPayload(sim: SimStation, now = Date.now(), simulated = false) {
  const s = snapshotAt(sim, now, 1);
  const mods = modulesAt(sim, now, 1);
  return {
    station_serial: sim.serial,
    ts: new Date(now).toISOString(),
    ...(simulated ? { simulated: true } : {}),
    soc: s.soc,
    mode: s.mode,
    pv_kw: s.pv_kw,
    load_kw: s.load_kw,
    grid_kw: s.grid_kw,
    battery_kw: s.battery_kw,
    voltage: s.voltage,
    current: s.current,
    coolant_in_temp: s.coolant_in_temp,
    coolant_out_temp: s.coolant_out_temp,
    cycles: Math.round(cyclesAt(sim, now) * 10) / 10,
    systems: { pump: s.systems.pump, fire: s.systems.fire, dc_isolator: s.systems.dc_isolator, inverter: s.systems.inverter, transformer: s.systems.transformer },
    modules: mods.map((m) => ({
      row: m.row,
      slot: m.slot,
      serial: sim.modules.find((x) => x.id === m.module_id)?.serial,
      soc: m.soc,
      soh: m.soh,
      voltage: m.voltage,
      current: m.current,
      temperature: m.temperature,
      cell_min_mv: m.cell_min_mv,
      cell_max_mv: m.cell_max_mv,
      bms_fault: m.bms_fault,
    })),
  };
}
