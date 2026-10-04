import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/presentation/components/ui/card";
import { Skeleton } from "@/presentation/components/ui/misc";
import { PageHeader } from "@/presentation/components/PageHeader";
import { ModuleGrid } from "@/presentation/components/ModuleGrid";
import { ModuleDetailDialog } from "@/presentation/components/ModuleDetailDialog";
import { HistoryCharts, RangeTabs, useRange } from "@/presentation/components/charts/HistoryCharts";
import { RemainingLife } from "@/presentation/components/RemainingLife";
import { HealthBadge, ToneBadge } from "@/presentation/components/StatusBadge";
import { useAlerts, useModuleReadings, useModules, useSnapshots, useStationHistory } from "@/presentation/hooks/data";
import { useCurrentStation } from "@/presentation/hooks/useCurrentStation";
import { useThresholds } from "@/presentation/hooks/useThresholds";
import { SIZE_SPECS } from "@/domain";
import { healthLabel } from "@/domain";
import { num } from "@/presentation/lib/format";
import type { Module, Station } from "@/domain/model";

export function BatteryHealthView({ station, actions }: { station: Station; actions?: (m: Module) => React.ReactNode }) {
  const { t } = useTranslation();
  const modules = useModules();
  const readings = useModuleReadings(station.id);
  const snaps = useSnapshots();
  const alerts = useAlerts();
  const [range, setRange] = useRange("30d");
  const history = useStationHistory(station.id, range);
  const yearHistory = useStationHistory(station.id, "12m");
  const th = useThresholds();
  const [selected, setSelected] = useState<Module | null>(null);
  const stationModules = (modules.data ?? []).filter((m) => m.station_id === station.id);
  const rd = readings.data ?? [];
  const snap = snaps.data?.[station.id];
  const spec = SIZE_SPECS[station.size];
  const weakest = rd.length ? rd.reduce((a, b) => (a.soh < b.soh ? a : b)) : null;
  const hottest = rd.length ? rd.reduce((a, b) => (a.temperature > b.temperature ? a : b)) : null;
  const pos = (id?: string) => {
    const m = stationModules.find((x) => x.id === id);
    return m ? `${m.row}-${m.slot}` : "";
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase text-muted-foreground">{t("healthPage.packSoh")}</div>
          <div className="tabular mt-1 text-3xl font-extrabold">{num(snap?.soh, 1)}%</div>
          {snap && <HealthBadge health={healthLabel(snap, rd, alerts.data ?? [], station.id)} className="mt-1" />}
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase text-muted-foreground">{t("healthPage.weakest")}</div>
          <div className="tabular mt-1 text-3xl font-extrabold">{num(weakest?.soh, 1)}%</div>
          <div className="text-xs text-muted-foreground">
            {t("modules.module")} {pos(weakest?.module_id)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase text-muted-foreground">{t("healthPage.hottest")}</div>
          <div className="tabular mt-1 text-3xl font-extrabold">{num(hottest?.temperature, 1)} °C</div>
          <div className="text-xs text-muted-foreground">
            {t("modules.module")} {pos(hottest?.module_id)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase text-muted-foreground">{t("healthPage.spread")}</div>
          <div className="tabular mt-1 text-3xl font-extrabold">{num(snap?.cell_spread_mv, 0)} mV</div>
          <div className="text-xs text-muted-foreground">{t("healthPage.spreadHint", { limit: th.spreadWarn })}</div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {t("healthPage.modules")} · {spec.rows}×{spec.cols}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("healthPage.modulesHint")}</p>
        </CardHeader>
        <CardContent>
          {modules.isLoading || readings.isLoading ? (
            <Skeleton className="h-40" />
          ) : (
            <ModuleGrid size={station.size} modules={stationModules} readings={rd} onSelect={setSelected} selectedId={selected?.id} />
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4" aria-hidden />
            <ToneBadge tone="ok">{t("moduleStatus.ok")}</ToneBadge>
            <ToneBadge tone="warn">{t("moduleStatus.warn")}</ToneBadge>
            <ToneBadge tone="crit">{t("moduleStatus.crit")}</ToneBadge>
            <span>{t("healthPage.legend", { temp: th.tempWarn, soh: th.sohWarn })}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <h2 className="text-lg font-bold">{t("healthPage.trends")}</h2>
        <RangeTabs value={range} onChange={setRange} />
      </div>
      <HistoryCharts data={history.data} loading={history.isLoading} range={range} thresholds={{ tempWarn: th.tempWarn, spreadWarn: th.spreadWarn, sohWarn: th.sohWarn }} />
      <RemainingLife history={yearHistory.data} loading={yearHistory.isLoading} warrantyEnd={station.warranty_end} />

      <ModuleDetailDialog
        module={selected}
        reading={rd.find((r) => r.module_id === selected?.id)}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        actions={selected && actions ? actions(selected) : undefined}
      />
    </div>
  );
}

export function OwnerHealth() {
  const { t } = useTranslation();
  const { station } = useCurrentStation();
  if (!station) return <Skeleton className="h-96" />;
  return (
    <div>
      <PageHeader title={t("healthPage.title")} subtitle={t("healthPage.subtitle")} />
      <BatteryHealthView station={station} />
    </div>
  );
}
