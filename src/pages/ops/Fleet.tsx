import { useMemo, useState } from "react";
import { Activity, AlertTriangle, BatteryFull, Search, Server } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/PageHeader";
import { FleetMap } from "@/components/FleetMap";
import { StationStatusBadge } from "@/components/StatusBadge";
import { useFleet } from "@/hooks/data";
import { date, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SIZE_SPECS } from "@/lib/sim/model";
import type { Region, StationSize, StationStatus } from "@/lib/types";

export function Fleet() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { rows, isLoading } = useFleet();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<Region | "">("");
  const [size, setSize] = useState<StationSize | "">("");
  const [status, setStatus] = useState<StationStatus | "">("");
  const filtered = useMemo(
    () =>
      rows
        .filter((r) => (!region || r.station.region === region) && (!size || r.station.size === size) && (!status || r.status === status))
        .filter((r) => !q || `${r.station.name} ${r.station.community} ${r.station.serial} ${r.customer?.name ?? ""}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => ["critical", "warning", "offline", "ok"].indexOf(a.status) - ["critical", "warning", "offline", "ok"].indexOf(b.status) || a.station.name.localeCompare(b.station.name)),
    [rows, q, region, size, status],
  );
  const avgSoh = rows.length ? rows.reduce((a, r) => a + (r.snapshot?.soh ?? 0), 0) / rows.length : 0;
  const capacity = rows.reduce((a, r) => a + (r.station.size === "S30" ? 30 : r.station.size === "M60" ? 60 : 100), 0);
  const kpis = [
    { icon: Server, label: t("fleet.stations"), value: `${rows.length}`, hint: `${num(capacity, 0)} ${t("units.kwh")}` },
    { icon: Activity, label: t("fleet.online"), value: `${rows.filter((r) => r.status !== "offline").length}/${rows.length}`, hint: t("fleet.reporting") },
    { icon: AlertTriangle, label: t("fleet.needAttention"), value: `${rows.filter((r) => r.status === "critical" || r.status === "warning").length}`, hint: `${rows.filter((r) => r.status === "critical").length} ${t("fleet.critical")}` },
    { icon: BatteryFull, label: t("fleet.avgSoh"), value: `${num(avgSoh, 1)}%`, hint: t("fleet.acrossFleet") },
  ];
  return (
    <div>
      <PageHeader title={t("fleet.title")} subtitle={t("fleet.subtitle")} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <k.icon className="h-4 w-4" aria-hidden /> {k.label}
            </div>
            <div className="tabular mt-1 text-3xl font-extrabold">{k.value}</div>
            <div className="text-xs text-muted-foreground">{k.hint}</div>
          </Card>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("fleet.search")} className="pl-9" aria-label={t("fleet.search")} />
        </div>
        <NativeSelect value={region} onChange={(e) => setRegion(e.target.value as Region | "")} aria-label={t("fleet.region")} className="w-40">
          <option value="">{t("fleet.allRegions")}</option>
          <option value="Aragatsotn">{t("region.Aragatsotn")}</option>
          <option value="Yerevan">{t("region.Yerevan")}</option>
        </NativeSelect>
        <NativeSelect value={size} onChange={(e) => setSize(e.target.value as StationSize | "")} aria-label={t("fleet.size")} className="w-44">
          <option value="">{t("fleet.allSizes")}</option>
          {(["S30", "M60", "L100"] as const).map((s) => (
            <option key={s} value={s}>
              {t(`size.${s}`)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as StationStatus | "")} aria-label={t("fleet.status")} className="w-40">
          <option value="">{t("fleet.allStatuses")}</option>
          {(["ok", "warning", "critical", "offline"] as const).map((s) => (
            <option key={s} value={s}>
              {t(`stationStatus.${s}`)}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <FleetMap rows={filtered} />
        <Card className="overflow-hidden">
          {isLoading ? (
            <Skeleton className="h-96" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">{t("fleet.station")}</th>
                    <th className="px-3 py-2.5 font-semibold">{t("fleet.size")}</th>
                    <th className="px-3 py-2.5 text-right font-semibold">SOH</th>
                    <th className="px-3 py-2.5 text-right font-semibold">SOC</th>
                    <th className="px-3 py-2.5 font-semibold">{t("fleet.status")}</th>
                    <th className="px-3 py-2.5 text-right font-semibold">{t("fleet.alerts")}</th>
                    <th className="px-3 py-2.5 font-semibold">{t("fleet.lastService")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((r) => (
                    <tr key={r.station.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/ops/stations/${r.station.id}`)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate(`/ops/stations/${r.station.id}`)}>
                      <td className="px-3 py-2.5">
                        <div className="whitespace-nowrap font-semibold">{r.station.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.station.community}, {t(`region.${r.station.region}`)}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{SIZE_SPECS[r.station.size].capacityKwh} {t("units.kwh")}</td>
                      <td className={cn("tabular px-3 py-2.5 text-right font-semibold", (r.snapshot?.soh ?? 100) < 85 && "text-warn-fg")}>{num(r.snapshot?.soh, 1)}%</td>
                      <td className="tabular px-3 py-2.5 text-right">{num(r.snapshot?.soc, 0)}%</td>
                      <td className="px-3 py-2.5">
                        <StationStatusBadge status={r.status} />
                      </td>
                      <td className="tabular px-3 py-2.5 text-right">{r.openAlerts || "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{date(r.station.last_service_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">{t("fleet.noMatch")}</p>}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
