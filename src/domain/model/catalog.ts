import type { SizeSpec, StationSize } from "./station";

/** ARMEN cabinet catalogue: 5 kWh second-life LFP modules arranged in rows. */
export const MODULE_KWH = 5;

export const SIZE_SPECS: Record<StationSize, SizeSpec> = {
  S30: { size: "S30", capacityKwh: 30, modules: 6, rows: 1, cols: 6, massKg: 330, inverterKw: 10, model: "ARMEN Home 30" },
  M60: { size: "M60", capacityKwh: 60, modules: 12, rows: 2, cols: 6, massKg: 610, inverterKw: 20, model: "ARMEN Pro 60" },
  L100: { size: "L100", capacityKwh: 100, modules: 20, rows: 2, cols: 10, massKg: 1000, inverterKw: 30, model: "ARMEN Industrial 100" },
};

/** End-of-life threshold for a second-life module: below this SOH it is replaced. */
export const SOH_END_OF_LIFE = 80;
/** Below this SOH a module or station needs attention. */
export const SOH_ATTENTION = 85;
