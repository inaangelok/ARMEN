import { assertNotPast, validateOperatingMode, type OperatingMode, type Station } from "@/domain";
import type { Clock, SimulationPort, StationRepository } from "../ports";

export type StationDetailsPatch = Partial<Pick<Station, "name" | "address" | "technician_id" | "next_service_date" | "tariff_amd" | "export_tariff_amd" | "pv_kwp" | "operating_mode" | "backup_reserve_pct">>;

export const makeStationUseCases = (stations: StationRepository, simulation: SimulationPort, clock: Clock) => ({
  /** Owner picks self-consumption or backup-reserve mode (and how much to keep for outages). */
  async setOperatingMode(stationId: string, mode: OperatingMode, reservePct: number): Promise<Station> {
    validateOperatingMode(mode, reservePct);
    return stations.updateStation(stationId, { operating_mode: mode, backup_reserve_pct: reservePct });
  },
  /** Admin edits station master data. */
  async updateDetails(stationId: string, patch: StationDetailsPatch): Promise<Station> {
    assertNotPast(patch.next_service_date, clock.now());
    if (patch.operating_mode) validateOperatingMode(patch.operating_mode, patch.backup_reserve_pct ?? 0);
    return stations.updateStation(stationId, patch);
  },
  toggleSimulation: (on: boolean, stationIds: string[]) => simulation.setSimulation(on, stationIds),
});
