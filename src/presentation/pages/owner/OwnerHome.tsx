import { AlertTriangle, ArrowRight, BatteryCharging, BatteryFull, BatteryMedium, CalendarClock, CircleDollarSign, Leaf, PlugZap, ShieldCheck, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/presentation/components/ui/card";
import { Skeleton } from "@/presentation/components/ui/misc";
import { HealthBadge, ToneBadge } from "@/presentation/components/StatusBadge";
import { SocGauge } from "@/presentation/components/SocGauge";
import { PowerFlow } from "@/presentation/components/PowerFlow";
import { PowerChart } from "@/presentation/components/charts/PowerChart";
import { useAlerts, useModuleReadings, usePowerSeries, useSimulating, useSnapshots } from "@/presentation/hooks/data";
import { useCurrentStation } from "@/presentation/hooks/useCurrentStation";
import { SIZE_SPECS } from "@/domain";
import { healthLabel } from "@/domain";
import type { Tone } from "@/presentation/lib/tone";
import { amd, date, kwh, num, pct, time } from "@/presentation/lib/format";
import { cn } from "@/presentation/lib/utils";
import type { BatteryMode, StationSnapshot } from "@/domain/model";

const MODE_TONE: Record<BatteryMode, Tone> = { charging: "ok", discharging: "info", idle: "muted", backup: "warn" };
const MODE_ICON: Record<BatteryMode, typeof BatteryCharging> = { charging: BatteryCharging, discharging: BatteryMedium, idle: BatteryFull, backup: PlugZap };

export function AlertsBanner({ stationId }: { stationId: string }) {
  const { t } = useTranslation();
  const alerts = useAlerts();
  const open = (alerts.data ?? []).filter((a) => a.station_id === stationId && a.status !== "resolved" && a.severity !== "info");
  if (!open.length) return null;
  const critical = open.some((a) => a.severity === "critical");
  const top = open.find((a) => a.severity === "critical") ?? open[0];
  return (
    <Link
      to="/app/alerts"
      className={cn("mb-4 flex items-center gap-3 rounded-2xl border-2 p-3 sm:p-4", critical ? "border-crit/40 bg-crit-soft text-crit-fg" : "border-warn/40 bg-warn-soft text-warn-fg")}
      role="alert"
    >
      <AlertTriangle className="h-6 w-6 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-bold">{t("dashboard.alertsBanner", { count: open.length })}</div>
        <div className="truncate text-sm">
          {t(`severity.${top.severity}`)}: {t(`alertCode.${top.code}.title`)}
        </div>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
    </Link>
  );
}

function Tile({ icon, label, value, hint, color }: { icon: React.ReactNode; label: string; value: string; hint?: string; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${color}1A`, color }}>
          {icon}
        </span>
        {label}
      </div>
      <div className="tabular mt-2 text-2xl font-extrabold leading-none sm:text-3xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function backupHours(snap: StationSnapshot, capacity: number) {
  const energy = (snap.soc / 100) * capacity * (snap.soh / 100);
  return energy / Math.max(0.3, snap.load_kw);
}

export function OwnerHome() {
  const { t } = useTranslation();
  const { station, loading } = useCurrentStation();
  const snaps = useSnapshots();
  const modules = useModuleReadings(station?.id);
  const alerts = useAlerts();
  const power = usePowerSeries(station?.id);
  const live = useSimulating();
  if (loading || !station) return <Skeleton className="h-96" />;
  const snap = snaps.data?.[station.id];
  if (!snap) return <Skeleton className="h-96" />;
  const spec = SIZE_SPECS[station.size];
  const health = healthLabel(snap, modules.data, alerts.data ?? [], station.id);
  const ModeIcon = MODE_ICON[snap.mode];
  const systemsOk = snap.systems.pump.status === "ok" && snap.systems.fire.state === "armed" && snap.systems.inverter.state === "ok";

  return (
    <div>
      <AlertsBanner stationId={station.id} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {spec.model} · {spec.capacityKwh} {t("units.kwh")} · {t("dashboard.updated")} {time(snap.ts)}
            {live && <span className="ml-1 font-semibold text-ok-fg">● {t("live.live")}</span>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 [&>*]:min-w-0">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col items-center gap-3 pt-5">
            <SocGauge soc={snap.soc} />
            <ToneBadge tone={MODE_TONE[snap.mode]} className="px-3 py-1 text-sm">
              <ModeIcon aria-hidden /> {t(`mode.${snap.mode}`)}
            </ToneBadge>
            <div className="grid w-full grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-muted p-2.5">
                <div className="tabular text-lg font-bold">{kwh((snap.soc / 100) * spec.capacityKwh * (snap.soh / 100))}</div>
                <div className="text-xs text-muted-foreground">{t("dashboard.storedNow")}</div>
              </div>
              <div className="rounded-xl bg-muted p-2.5">
                <div className="tabular text-lg font-bold">≈ {num(Math.min(99, backupHours(snap, spec.capacityKwh)), 0)} {t("units.h")}</div>
                <div className="text-xs text-muted-foreground">{t("dashboard.backupTime")}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{t("dashboard.powerFlow")}</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <PowerFlow snap={snap} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3 [&>*]:min-w-0">
        <Link to="/app/health" className="block md:col-span-1">
          <Card className="h-full p-4 transition hover:shadow-md">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("dashboard.healthScore")}</div>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
              <div className="tabular text-5xl font-extrabold leading-none">
                {num(snap.soh, 1)}
                <span className="text-xl text-muted-foreground">%</span>
              </div>
              <HealthBadge health={health} className="px-3 py-1 text-sm" />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t(`health.${health}Desc`)}</p>
            <div className="mt-2 flex items-center gap-1 text-sm font-semibold text-brand-600">
              {t("dashboard.seeModules")} <ArrowRight className="h-4 w-4" />
            </div>
          </Card>
        </Link>
        <Link to="/app/safety" className="block">
          <Card className="h-full p-4 transition hover:shadow-md">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("nav.safety")}</div>
            <div className="mt-3 flex items-center gap-3">
              <ShieldCheck className={cn("h-10 w-10", systemsOk ? "text-ok" : "text-crit")} aria-hidden />
              <div>
                <ToneBadge tone={systemsOk ? "ok" : "crit"}>{systemsOk ? t("dashboard.systemsOk") : t("dashboard.systemsIssue")}</ToneBadge>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("systems.fire")}: {t(`systems.fireStates.${snap.systems.fire.state}`)} · {t("systems.pump")}: {t(`systems.pumpState.${snap.systems.pump.status}`)}
                </p>
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/app/maintenance" className="block">
          <Card className="h-full p-4 transition hover:shadow-md">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("dashboard.nextService")}</div>
            <div className="mt-3 flex items-center gap-3">
              <CalendarClock className="h-10 w-10 text-brand-500" aria-hidden />
              <div>
                <div className="text-lg font-bold">{date(station.next_service_date)}</div>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.lastService")}: {date(station.last_service_date)}
                </p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      <h2 className="mb-2 mt-6 text-lg font-bold">{t("dashboard.today")}</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={<BatteryCharging className="h-4 w-4" />} color="#1F8A4C" label={t("dashboard.energyStored")} value={kwh(snap.today.stored_kwh)} hint={t("dashboard.energyStoredHint")} />
        <Tile icon={<BatteryMedium className="h-4 w-4" />} color="#2563EB" label={t("dashboard.energyUsed")} value={kwh(snap.today.used_kwh)} hint={t("dashboard.energyUsedHint")} />
        <Tile icon={<Leaf className="h-4 w-4" />} color="#C77700" label={t("dashboard.selfConsumption")} value={pct(snap.today.self_consumption_pct)} hint={`${t("dashboard.solar")}: ${kwh(snap.today.solar_kwh)}`} />
        <Tile icon={<CircleDollarSign className="h-4 w-4" />} color="#22382F" label={t("dashboard.savings")} value={amd(snap.today.savings_amd)} hint={t("dashboard.savingsHint")} />
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Sun className="h-5 w-5 text-solar" aria-hidden />
          <CardTitle>{t("dashboard.todayChart")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">{power.data ? <PowerChart data={power.data} /> : <Skeleton className="h-full" />}</div>
        </CardContent>
      </Card>
    </div>
  );
}
