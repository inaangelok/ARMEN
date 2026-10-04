import { useState } from "react";
import { ArrowLeft, Ban, MapPin, Phone, Plus, Replace, Save, User } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/presentation/components/ui/card";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { NativeSelect } from "@/presentation/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/presentation/components/ui/tabs";
import { EmptyState, Skeleton } from "@/presentation/components/ui/misc";
import { Badge } from "@/presentation/components/ui/badge";
import { HealthBadge, StationStatusBadge, ToneBadge } from "@/presentation/components/StatusBadge";
import { SocGauge } from "@/presentation/components/SocGauge";
import { PowerFlow } from "@/presentation/components/PowerFlow";
import { PowerChart } from "@/presentation/components/charts/PowerChart";
import { SystemsPanel } from "@/presentation/components/SystemsPanel";
import { AlertItem } from "@/presentation/components/AlertItem";
import { Stat } from "@/presentation/components/ModuleDetailDialog";
import { BatteryHealthView } from "@/presentation/pages/owner/OwnerHealth";
import { DocumentsList, WarrantyCard } from "@/presentation/pages/owner/OwnerMaintenance";
import { ReplaceModuleDialog } from "@/presentation/components/ops/ReplaceModuleDialog";
import { CreateWorkOrderDialog } from "@/presentation/components/ops/CreateWorkOrderDialog";
import { WorkOrderDialog } from "@/presentation/components/ops/WorkOrderDialog";
import { useAlerts, useCustomers, useEvents, useFleet, useModuleReadings, useModules, usePowerSeries, useProfiles, useRawTelemetry, useStations, useWorkOrders } from "@/presentation/hooks/data";
import { useThresholds } from "@/presentation/hooks/useThresholds";
import { useServices } from "@/presentation/providers/services";
import { errorMessage } from "@/presentation/lib/errors";
import { useAuth } from "@/presentation/providers/auth";
import { amd, date, dateTime, kwh, num, pct, time } from "@/presentation/lib/format";
import { SIZE_SPECS } from "@/domain";
import { priorityTone, woStatusTone } from "@/presentation/lib/tone";
import { cn } from "@/presentation/lib/utils";
import type { Alert, Module, Station } from "@/domain/model";

function Overview({ station }: { station: Station }) {
  const { t } = useTranslation();
  const fleet = useFleet();
  const row = fleet.rows.find((r) => r.station.id === station.id);
  const power = usePowerSeries(station.id);
  const snap = row?.snapshot;
  if (!snap) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col items-center gap-2 pt-5">
            <SocGauge soc={snap.soc} size={220} />
            <ToneBadge tone={snap.mode === "backup" ? "warn" : snap.mode === "charging" ? "ok" : "info"}>{t(`mode.${snap.mode}`)}</ToneBadge>
            <div className="text-xs text-muted-foreground">
              {t("dashboard.updated")} {dateTime(snap.ts)}
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
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <Stat label="SOH" value={`${num(snap.soh, 1)}%`} />
        <Stat label={t("station.packVoltage")} value={`${num(snap.voltage, 0)} V`} />
        <Stat label={t("station.current")} value={`${num(snap.current, 1)} A`} />
        <Stat label={t("station.tempMax")} value={`${num(snap.temp_max, 1)} °C`} />
        <Stat label={t("station.spread")} value={`${snap.cell_spread_mv} mV`} />
        <Stat label={t("dashboard.energyStored")} value={kwh(snap.today.stored_kwh)} />
        <Stat label={t("dashboard.selfConsumption")} value={pct(snap.today.self_consumption_pct)} />
        <Stat label={t("dashboard.savings")} value={amd(snap.today.savings_amd)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.todayChart")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">{power.data ? <PowerChart data={power.data} /> : <Skeleton className="h-full" />}</div>
        </CardContent>
      </Card>
    </div>
  );
}

function RawTelemetry({ station }: { station: Station }) {
  const { t } = useTranslation();
  const raw = useRawTelemetry(station.id, 240);
  const modules = useModules();
  const fleet = useFleet();
  const snap = fleet.rows.find((r) => r.station.id === station.id)?.snapshot;
  const pos = (id: string) => {
    const m = modules.data?.find((x) => x.id === id);
    return m?.row ? `${m.row}-${m.slot}` : "?";
  };
  const th = useThresholds();
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{t("station.rawModules")}</CardTitle>
          <Button size="sm" variant="outline" onClick={() => raw.refetch()}>
            {t("common.refresh")}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted text-left uppercase tracking-wide text-muted-foreground">
                <tr>
                  {[t("station.time"), t("modules.position"), "SOC %", "SOH %", "V", "A", "°C", t("modules.cellMin"), t("modules.cellMax"), "Δ mV", "BMS"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular divide-y font-mono">
                {(raw.data ?? []).map((r, i) => {
                  const spread = r.cell_max_mv - r.cell_min_mv;
                  return (
                    <tr key={i} className="hover:bg-muted/50">
                      <td className="whitespace-nowrap px-3 py-1.5">{time(r.ts)}</td>
                      <td className="px-3 py-1.5">{pos(r.module_id)}</td>
                      <td className="px-3 py-1.5">{num(r.soc, 1)}</td>
                      <td className={cn("px-3 py-1.5", r.soh < th.sohWarn && "font-bold text-warn-fg")}>{num(r.soh, 1)}</td>
                      <td className="px-3 py-1.5">{num(r.voltage, 2)}</td>
                      <td className="px-3 py-1.5">{num(r.current, 1)}</td>
                      <td className={cn("px-3 py-1.5", r.temperature > th.tempWarn && "font-bold text-crit-fg")}>{num(r.temperature, 1)}</td>
                      <td className="px-3 py-1.5">{r.cell_min_mv}</td>
                      <td className="px-3 py-1.5">{r.cell_max_mv}</td>
                      <td className={cn("px-3 py-1.5", spread > th.spreadWarn && "font-bold text-warn-fg")}>{spread}</td>
                      <td className="px-3 py-1.5">{r.bms_fault ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {snap && (
        <Card>
          <CardHeader>
            <CardTitle>{t("station.rawSnapshot")}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto rounded-xl bg-brand-900 p-3 text-[11px] leading-relaxed text-brand-100">{JSON.stringify({ ...snap, today: undefined }, null, 2)}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EventLog({ station }: { station: Station }) {
  const { t } = useTranslation();
  const events = useEvents(station.id);
  const SRC: Record<string, string> = { bms: "bg-info-soft text-info-fg", pcs: "bg-grid/10 text-grid", fire: "bg-crit-soft text-crit-fg", cooling: "bg-info-soft text-info-fg", system: "bg-muted text-muted-foreground", user: "bg-ok-soft text-ok-fg" };
  return (
    <Card>
      <CardContent className="divide-y pt-4">
        {events.isLoading && <Skeleton className="h-40" />}
        {(events.data ?? []).map((e) => (
          <div key={e.id} className="flex flex-wrap items-start gap-3 py-2 text-sm">
            <span className="tabular w-36 shrink-0 text-xs text-muted-foreground">{dateTime(e.ts)}</span>
            <span className={cn("rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase", SRC[e.source])}>{e.source}</span>
            <span className="font-mono text-xs font-semibold">{e.code}</span>
            <span className="min-w-0 flex-1 break-words text-xs text-muted-foreground">{e.code === "ALERT_CLEARED" ? t(`alertCode.${e.message}.title` as "alertCode.SOH_LOW.title") : e.message}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function StationSettings({ station }: { station: Station }) {
  const { t } = useTranslation();
  const stationsUc = useServices().commands.stations;
  const { user } = useAuth();
  const profiles = useProfiles();
  const [form, setForm] = useState({ technician_id: station.technician_id ?? "", tariff_amd: station.tariff_amd, export_tariff_amd: station.export_tariff_amd, next_service_date: station.next_service_date ?? "", operating_mode: station.operating_mode, backup_reserve_pct: station.backup_reserve_pct });
  const isAdmin = user?.role === "admin";
  const save = async () => {
    try {
      await stationsUc.updateDetails(station.id, { ...form, technician_id: form.technician_id || null, next_service_date: form.next_service_date || null });
      toast.success(t("settings.saved"));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <Card className="max-w-2xl">
      <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tech">{t("station.technician")}</Label>
          <NativeSelect id="tech" disabled={!isAdmin} value={form.technician_id} onChange={(e) => setForm({ ...form, technician_id: e.target.value })}>
            <option value="">—</option>
            {(profiles.data ?? []).filter((p) => p.role === "technician").map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="next">{t("station.nextService")}</Label>
          <Input id="next" type="date" value={form.next_service_date} onChange={(e) => setForm({ ...form, next_service_date: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tariff">{t("station.tariff")}</Label>
          <Input id="tariff" type="number" value={form.tariff_amd} onChange={(e) => setForm({ ...form, tariff_amd: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exp">{t("station.exportTariff")}</Label>
          <Input id="exp" type="number" value={form.export_tariff_amd} onChange={(e) => setForm({ ...form, export_tariff_amd: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mode">{t("settings.operatingMode")}</Label>
          <NativeSelect id="mode" value={form.operating_mode} onChange={(e) => setForm({ ...form, operating_mode: e.target.value as Station["operating_mode"] })}>
            <option value="self_consumption">{t("operatingMode.self_consumption")}</option>
            <option value="backup_reserve">{t("operatingMode.backup_reserve")}</option>
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="res">{t("settings.reserve")} (%)</Label>
          <Input id="res" type="number" min={0} max={90} value={form.backup_reserve_pct} onChange={(e) => setForm({ ...form, backup_reserve_pct: Number(e.target.value) })} />
        </div>
        <div className="sm:col-span-2">
          <Button onClick={save}>
            <Save /> {t("common.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function StationDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { commands } = useServices();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "overview";
  const stations = useStations();
  const customers = useCustomers();
  const profiles = useProfiles();
  const alerts = useAlerts();
  const wos = useWorkOrders();
  const fleet = useFleet();
  const readings = useModuleReadings(id);
  const [replacing, setReplacing] = useState<Module | null>(null);
  const [woFromAlert, setWoFromAlert] = useState<Alert | null | undefined>(undefined);
  const [openWo, setOpenWo] = useState<string | null>(null);
  const station = stations.data?.find((s) => s.id === id);
  if (stations.isLoading) return <Skeleton className="h-96" />;
  if (!station) return <EmptyState title={t("station.notFound")} />;
  const customer = customers.data?.find((c) => c.id === station.customer_id);
  const tech = profiles.data?.find((p) => p.id === station.technician_id);
  const row = fleet.rows.find((r) => r.station.id === station.id);
  const spec = SIZE_SPECS[station.size];
  const stAlerts = (alerts.data ?? []).filter((a) => a.station_id === station.id);
  const stWos = (wos.data ?? []).filter((w) => w.station_id === station.id);
  const openAlerts = stAlerts.filter((a) => a.status !== "resolved");
  const moduleActions = (m: Module) => (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={m.status === "faulty"}
        onClick={async () => {
          await commands.modules.markModuleFaulty(m.id, t("replace.markedFromApp"));
          toast.success(t("replace.markedFaulty", { pos: `${m.row}-${m.slot}` }));
        }}
      >
        <Ban /> {t("replace.markFaulty")}
      </Button>
      <Button size="sm" onClick={() => setReplacing(m)}>
        <Replace /> {t("replace.replace")}
      </Button>
    </div>
  );
  const currentWo = stWos.find((w) => w.id === openWo) ?? null;

  return (
    <div>
      <Link to="/ops" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("ops.fleet")}
      </Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{station.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="font-mono">{station.serial}</span>
            <span>
              {spec.model} · {spec.capacityKwh} {t("units.kwh")} · {spec.rows}×{spec.cols} · {spec.inverterKw} {t("units.kw")} · {station.pv_kwp} kWp PV
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
              {station.address}
            </span>
            <span className="flex items-center gap-1">
              <User className="h-4 w-4 text-muted-foreground" aria-hidden />
              {customer?.name}
            </span>
            {customer?.phone && (
              <a href={`tel:${customer.phone}`} className="flex items-center gap-1 text-brand-600 hover:underline">
                <Phone className="h-4 w-4" aria-hidden />
                {customer.phone}
              </a>
            )}
            <span className="text-muted-foreground">
              {t("station.technician")}: {tech?.full_name ?? "—"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {row && <StationStatusBadge status={row.status} />}
          {row && <HealthBadge health={row.health} />}
          <Button onClick={() => setWoFromAlert(null)}>
            <Plus /> {t("wo.new")}
          </Button>
        </div>
      </div>
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">{t("station.tabs.overview")}</TabsTrigger>
          <TabsTrigger value="health">{t("station.tabs.health")}</TabsTrigger>
          <TabsTrigger value="systems">{t("station.tabs.systems")}</TabsTrigger>
          <TabsTrigger value="alerts">
            {t("station.tabs.alerts")} {openAlerts.length > 0 && <Badge variant="crit" className="px-1.5 py-0">{openAlerts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="workorders">{t("station.tabs.workorders")}</TabsTrigger>
          <TabsTrigger value="telemetry">{t("station.tabs.telemetry")}</TabsTrigger>
          <TabsTrigger value="events">{t("station.tabs.events")}</TabsTrigger>
          <TabsTrigger value="documents">{t("station.tabs.documents")}</TabsTrigger>
          <TabsTrigger value="settings">{t("station.tabs.settings")}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Overview station={station} />
        </TabsContent>
        <TabsContent value="health">
          <BatteryHealthView station={station} actions={moduleActions} />
        </TabsContent>
        <TabsContent value="systems">{row?.snapshot ? <SystemsPanel snap={row.snapshot} /> : <Skeleton className="h-64" />}</TabsContent>
        <TabsContent value="alerts" className="space-y-3">
          {stAlerts.length === 0 && <EmptyState title={t("alerts.none")} />}
          {stAlerts.map((a) => (
            <AlertItem
              key={a.id}
              alert={a}
              onAck={() => commands.alerts.acknowledgeAlert(a.id)}
              onResolve={() => commands.alerts.resolveAlert(a.id)}
              onCreateWO={stWos.some((w) => w.alert_id === a.id && w.status !== "done") ? undefined : () => setWoFromAlert(a)}
            />
          ))}
        </TabsContent>
        <TabsContent value="workorders">
          <Card>
            <CardContent className="divide-y pt-3">
              {stWos.length === 0 && <EmptyState title={t("wo.none")} />}
              {stWos.map((w) => (
                <button key={w.id} onClick={() => setOpenWo(w.id)} className="flex w-full flex-wrap items-center gap-2 py-2.5 text-left hover:bg-muted/50">
                  <Badge variant="outline">WO-{w.number}</Badge>
                  <ToneBadge tone={woStatusTone[w.status]}>{t(`woStatus.${w.status}`)}</ToneBadge>
                  <ToneBadge tone={priorityTone[w.priority]}>{t(`priority.${w.priority}`)}</ToneBadge>
                  <span className="font-medium">{t(`serviceType.${w.type}`)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{w.title}</span>
                  <span className="text-xs text-muted-foreground">{date(w.completed_at ?? w.scheduled_date ?? w.created_at)}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="telemetry">
          <RawTelemetry station={station} />
        </TabsContent>
        <TabsContent value="events">
          <EventLog station={station} />
        </TabsContent>
        <TabsContent value="documents" className="grid gap-4 lg:grid-cols-2">
          <DocumentsList station={station} />
          <WarrantyCard station={station} />
        </TabsContent>
        <TabsContent value="settings">
          <StationSettings key={station.id + station.technician_id} station={station} />
        </TabsContent>
      </Tabs>
      <ReplaceModuleDialog module={replacing} currentSoh={readings.data?.find((r) => r.module_id === replacing?.id)?.soh} open={!!replacing} onOpenChange={(o) => !o && setReplacing(null)} />
      <CreateWorkOrderDialog open={woFromAlert !== undefined} onOpenChange={(o) => !o && setWoFromAlert(undefined)} stationId={station.id} alert={woFromAlert} />
      <WorkOrderDialog wo={currentWo} open={!!currentWo} onOpenChange={(o) => !o && setOpenWo(null)} />
    </div>
  );
}
