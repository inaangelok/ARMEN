import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/presentation/components/ui/dialog";
import { HistoryCharts, RangeTabs, useRange } from "@/presentation/components/charts/HistoryCharts";
import { ToneBadge } from "@/presentation/components/StatusBadge";
import { useModuleHistory } from "@/presentation/hooks/data";
import { useThresholds } from "@/presentation/hooks/useThresholds";
import { date, num } from "@/presentation/lib/format";
import { moduleTone } from "@/presentation/lib/tone";
import type { Module, ModuleReading } from "@/domain/model";

export function Stat({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border bg-background p-3 ${className ?? ""}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="tabular mt-0.5 text-lg font-bold leading-tight">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function ModuleDetailDialog({ module, reading, open, onOpenChange, actions }: { module: Module | null; reading?: ModuleReading; open: boolean; onOpenChange: (o: boolean) => void; actions?: ReactNode }) {
  const { t } = useTranslation();
  const [range, setRange] = useRange("30d");
  const history = useModuleHistory(open ? module?.id : undefined, range);
  const th = useThresholds();
  if (!module) return null;
  const tone = reading ? moduleTone(reading, module.status === "faulty") : "muted";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right" closeLabel={t("common.close")}>
        <DialogHeader>
          <DialogTitle>
            {t("modules.module")} {module.row}-{module.slot}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{module.serial}</span>
            <span>·</span>
            <span>
              {t("modules.grade")} {module.grade}
            </span>
            <span>·</span>
            <span>
              {t("modules.installed")} {date(module.install_date)}
            </span>
            <ToneBadge tone={tone}>{module.status === "faulty" ? t("moduleState.faulty") : t(`moduleStatus.${tone === "crit" ? "crit" : tone === "warn" ? "warn" : "ok"}`)}</ToneBadge>
          </DialogDescription>
        </DialogHeader>
        {reading && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="SOH" value={`${num(reading.soh, 1)}%`} />
            <Stat label={t("modules.temperature")} value={`${num(reading.temperature, 1)} °C`} />
            <Stat label={t("modules.voltage")} value={`${num(reading.voltage, 2)} V`} />
            <Stat label={t("modules.current")} value={`${num(reading.current, 1)} A`} />
            <Stat label="SOC" value={`${num(reading.soc, 0)}%`} />
            <Stat label={t("modules.cellMin")} value={`${num(reading.cell_min_mv / 1000, 3)} V`} />
            <Stat label={t("modules.cellMax")} value={`${num(reading.cell_max_mv / 1000, 3)} V`} />
            <Stat label={t("modules.spread")} value={`${reading.cell_max_mv - reading.cell_min_mv} mV`} />
          </div>
        )}
        {reading?.bms_fault && (
          <div className="rounded-xl border border-warn/40 bg-warn-soft p-3 text-sm text-warn-fg">
            <b>{t("modules.bmsFault")}:</b> <span className="font-mono">{reading.bms_fault}</span> — {t(`bmsFault.${reading.bms_fault}` as "bmsFault.BMS_OT_W")}
          </div>
        )}
        {actions}
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-semibold">{t("modules.history")}</h4>
          <RangeTabs value={range} onChange={setRange} />
        </div>
        <HistoryCharts data={history.data} loading={history.isLoading} range={range} showCycles={false} thresholds={{ tempWarn: th.tempWarn, spreadWarn: th.spreadWarn, sohWarn: th.sohWarn }} />
        <p className="text-xs text-muted-foreground">
          {t("modules.origin")}: {module.origin} · {t("modules.initialSoh")}: {num(module.initial_soh, 1)}% · {t("modules.manufactured")}: {date(module.manufacture_date)}
        </p>
      </DialogContent>
    </Dialog>
  );
}
