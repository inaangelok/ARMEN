import type { OperatingMode } from "../model";
import { DomainError } from "../errors/domain-error";

/** Share of the battery kept for outages in backup-reserve mode. */
export const RESERVE_MIN_PCT = 10;
export const RESERVE_MAX_PCT = 80;

export function validateOperatingMode(mode: OperatingMode, reservePct: number): void {
  if (mode === "backup_reserve" && !(reservePct >= RESERVE_MIN_PCT && reservePct <= RESERVE_MAX_PCT))
    throw new DomainError("RESERVE_OUT_OF_RANGE", { min: RESERVE_MIN_PCT, max: RESERVE_MAX_PCT });
}
