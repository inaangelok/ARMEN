import { useRules } from "./data";
import { useAuth } from "@/lib/auth";
import { DEFAULT_RULES } from "@/lib/sim/dataset";

/** Effective warning thresholds (live rules for staff; defaults for owners, who cannot read rules). */
export function useThresholds() {
  const { user } = useAuth();
  const staff = user?.role !== "owner";
  const rules = useRules();
  const src = staff && rules.data ? rules.data : DEFAULT_RULES;
  const get = (code: string) => src.find((r) => r.code === code);
  return {
    tempWarn: get("MODULE_OVER_TEMP")?.warning_threshold ?? 45,
    tempCrit: get("MODULE_OVER_TEMP")?.critical_threshold ?? 55,
    spreadWarn: get("CELL_IMBALANCE")?.warning_threshold ?? 50,
    sohWarn: get("SOH_LOW")?.warning_threshold ?? 85,
    coolantWarn: get("COOLANT_HIGH")?.warning_threshold ?? 35,
  };
}
