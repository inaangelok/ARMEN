import type { ServiceType, Station } from "../model";
import { addMonths, DAY_MS } from "./time";

/** Digital checklist templates per service type. Labels are i18n keys under `checklist.*`. */
export const CHECKLIST_TEMPLATES: Record<ServiceType, string[]> = {
  inspection_6m: [
    "visual_inspection",
    "enclosure_seals",
    "coolant_level",
    "pump_operation",
    "dc_torque",
    "contactors_fuses",
    "bms_logs",
    "cell_balance",
    "fire_detection_test",
    "fire_pressure",
    "hmi_comm",
    "clean_filters",
    "firmware",
    "customer_briefing",
  ],
  annual_coolant_fire: [
    "replace_coolant",
    "cooling_pressure_test",
    "inspect_cooling_plates",
    "fire_valves_test",
    "compartment_flood_test",
    "fire_water_filter",
    "insulation_test",
    "transformer_inspection",
    "thermal_imaging",
    "capacity_test",
  ],
  repair: ["diagnose_fault", "isolate_dc", "replace_component", "verify_operation", "clear_fault_codes", "customer_briefing"],
  module_replacement: [
    "isolate_dc",
    "verify_zero_voltage",
    "remove_faulty_module",
    "install_replacement",
    "record_serials",
    "dc_torque",
    "reconnect_cooling",
    "bms_addressing",
    "cell_balance",
    "verify_operation",
  ],
  commissioning: ["site_survey", "mounting", "dc_torque", "reconnect_cooling", "fire_detection_test", "hmi_comm", "capacity_test", "customer_briefing"],
};

/** Recommended service interval in months per scheduled service type. */
export const SERVICE_INTERVAL_MONTHS: Partial<Record<ServiceType, number>> = {
  inspection_6m: 6,
  annual_coolant_fire: 12,
};

/** Next due date after a completed scheduled service (6-monthly inspection or annual coolant/fire check). */
export function nextServiceDate(type: ServiceType, completedDay: string): string | null {
  const months = SERVICE_INTERVAL_MONTHS[type];
  return months ? addMonths(completedDay, months) : null;
}

/**
 * Upcoming maintenance for a station: the next 6-monthly inspection (planned by staff) and the next
 * annual coolant + fire-system check (every 12 months from installation).
 */
export function serviceSchedule(station: Pick<Station, "install_date" | "next_service_date">, now: number): { inspection: string | null; annual: string } {
  const install = station.install_date.slice(0, 10);
  let k = 1;
  while (Date.parse(addMonths(install, 12 * k)) < now - DAY_MS) k++;
  return { inspection: station.next_service_date, annual: addMonths(install, 12 * k) };
}
