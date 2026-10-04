import type { Module, ModuleGrade } from "../model";
import { SOH_END_OF_LIFE } from "../model/catalog";
import { DomainError } from "../errors/domain-error";

export interface ReplacementRequest {
  faulty: Module;
  newSerial: string;
  newGrade: ModuleGrade;
  newInitialSoh: number;
  reason: string;
}

/**
 * Rules for swapping a module in a cabinet:
 * the old module must be installed, the replacement needs a fresh serial that is not already
 * in another station, a documented reason, and a usable second-life SOH (80–100 %).
 */
export function validateReplacement(req: ReplacementRequest, registry: Module[]): void {
  if (!req.faulty.station_id) throw new DomainError("MODULE_NOT_INSTALLED");
  const serial = req.newSerial.trim();
  if (!serial) throw new DomainError("SERIAL_REQUIRED");
  if (serial === req.faulty.serial) throw new DomainError("SERIAL_SAME_AS_REMOVED");
  const existing = registry.find((m) => m.serial === serial);
  if (existing && existing.station_id) throw new DomainError("SERIAL_IN_USE", { serial });
  if (!(req.newInitialSoh >= SOH_END_OF_LIFE && req.newInitialSoh <= 100)) throw new DomainError("SOH_OUT_OF_RANGE", { min: SOH_END_OF_LIFE, max: 100 });
  if (!req.reason.trim()) throw new DomainError("REASON_REQUIRED");
}
