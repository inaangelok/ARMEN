import { useTranslation } from "react-i18next";
import { SIZE_SPECS } from "@/lib/sim/model";
import { moduleTone, toneBg, toneBorder, toneText, type Tone } from "@/lib/status";
import { num } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Module, ModuleReading, StationSize } from "@/lib/types";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

const TONE_ICON: Record<Tone, typeof CheckCircle2> = { ok: CheckCircle2, warn: AlertTriangle, crit: XCircle, info: CheckCircle2, muted: CheckCircle2 };

/** Module cards laid out exactly like the physical cabinet (1×6, 2×6 or 2×10). */
export function ModuleGrid({ size, modules, readings, onSelect, selectedId }: { size: StationSize; modules: Module[]; readings: ModuleReading[]; onSelect?: (m: Module) => void; selectedId?: string }) {
  const { t } = useTranslation();
  const spec = SIZE_SPECS[size];
  const byPos = new Map(modules.filter((m) => m.station_id).map((m) => [`${m.row}-${m.slot}`, m]));
  const toneLabel: Record<Tone, string> = { ok: t("moduleStatus.ok"), warn: t("moduleStatus.warn"), crit: t("moduleStatus.crit"), info: "", muted: "" };
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="flex min-w-max flex-col gap-2 rounded-2xl border-2 border-brand-200 bg-brand-50/60 p-2 sm:min-w-0">
        {Array.from({ length: spec.rows }, (_, r) => (
          <div key={r} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${spec.cols}, minmax(${spec.cols > 6 ? 88 : 96}px, 1fr))` }}>
            {Array.from({ length: spec.cols }, (_, c) => {
              const m = byPos.get(`${r + 1}-${c + 1}`);
              const rd = m ? readings.find((x) => x.module_id === m.id) : undefined;
              if (!m || !rd)
                return (
                  <div key={c} className="flex h-[118px] items-center justify-center rounded-xl border border-dashed bg-background text-xs text-muted-foreground">
                    {r + 1}-{c + 1}
                  </div>
                );
              const tone = moduleTone(rd, m.status === "faulty");
              const Icon = TONE_ICON[tone];
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onSelect?.(m)}
                  className={cn(
                    "group flex h-[118px] flex-col rounded-xl border-2 bg-background p-2 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    toneBorder[tone],
                    selectedId === m.id && "ring-2 ring-brand-700",
                  )}
                  aria-label={`${t("modules.module")} ${r + 1}-${c + 1}: SOH ${num(rd.soh, 1)}%, ${num(rd.temperature, 1)} °C, ${toneLabel[tone]}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground">{r + 1}-{c + 1}</span>
                    <span className={cn("flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold", toneBg[tone], toneText[tone])}>
                      <Icon className="h-3 w-3" aria-hidden />
                      {toneLabel[tone]}
                    </span>
                  </div>
                  <div className="tabular mt-1 text-xl font-extrabold leading-none">
                    {num(rd.soh, 1)}
                    <span className="text-xs font-semibold text-muted-foreground">%</span>
                  </div>
                  <div className="text-[10px] font-medium uppercase text-muted-foreground">SOH</div>
                  <div className="tabular mt-auto flex justify-between text-[11px] font-semibold">
                    <span className={cn(rd.temperature > 45 && toneText[rd.temperature > 55 ? "crit" : "warn"])}>{num(rd.temperature, 1)}°C</span>
                    <span className="text-muted-foreground">{num(rd.voltage, 1)}V</span>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
