import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { NativeSelect } from "@/presentation/components/ui/select";
import { EmptyState, Skeleton } from "@/presentation/components/ui/misc";
import { PageHeader } from "@/presentation/components/PageHeader";
import { AlertItem } from "@/presentation/components/AlertItem";
import { CreateWorkOrderDialog } from "@/presentation/components/ops/CreateWorkOrderDialog";
import { useAlerts, useStations, useWorkOrders } from "@/presentation/hooks/data";
import { useServices } from "@/presentation/providers/services";
import type { Alert, Severity } from "@/domain/model";

export function OpsAlerts() {
  const { t } = useTranslation();
  const alertsUc = useServices().commands.alerts;
  const alerts = useAlerts();
  const stations = useStations();
  const wos = useWorkOrders();
  const [status, setStatus] = useState<"active" | "open" | "acknowledged" | "resolved" | "all">("active");
  const [sev, setSev] = useState<Severity | "">("");
  const [station, setStation] = useState("");
  const [woAlert, setWoAlert] = useState<Alert | null>(null);
  const list = (alerts.data ?? []).filter(
    (a) => (status === "all" || (status === "active" ? a.status !== "resolved" : a.status === status)) && (!sev || a.severity === sev) && (!station || a.station_id === station),
  );
  return (
    <div>
      <PageHeader title={t("alerts.fleetTitle")} subtitle={t("alerts.fleetSubtitle")} />
      <div className="mb-4 flex flex-wrap gap-2">
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-44" aria-label={t("fleet.status")}>
          <option value="active">{t("alerts.active")}</option>
          <option value="open">{t("alertStatus.open")}</option>
          <option value="acknowledged">{t("alertStatus.acknowledged")}</option>
          <option value="resolved">{t("alertStatus.resolved")}</option>
          <option value="all">{t("alerts.all")}</option>
        </NativeSelect>
        <NativeSelect value={sev} onChange={(e) => setSev(e.target.value as Severity | "")} className="w-40" aria-label={t("alerts.severity")}>
          <option value="">{t("alerts.allSeverities")}</option>
          {(["critical", "warning", "info"] as const).map((s) => (
            <option key={s} value={s}>
              {t(`severity.${s}`)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={station} onChange={(e) => setStation(e.target.value)} className="w-56" aria-label={t("fleet.station")}>
          <option value="">{t("alerts.allStations")}</option>
          {(stations.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      {alerts.isLoading ? (
        <Skeleton className="h-64" />
      ) : list.length === 0 ? (
        <EmptyState title={t("alerts.none")} />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {list.slice(0, 200).map((a) => (
            <AlertItem
              key={a.id}
              alert={a}
              stationName={stations.data?.find((s) => s.id === a.station_id)?.name}
              onAck={async () => {
                await alertsUc.acknowledgeAlert(a.id);
                toast.success(t("alerts.acknowledged"));
              }}
              onResolve={async () => {
                await alertsUc.resolveAlert(a.id);
                toast.success(t("alerts.resolved"));
              }}
              onCreateWO={(wos.data ?? []).some((w) => w.alert_id === a.id && w.status !== "done") ? undefined : () => setWoAlert(a)}
            />
          ))}
        </div>
      )}
      <CreateWorkOrderDialog open={!!woAlert} onOpenChange={(o) => !o && setWoAlert(null)} alert={woAlert} />
    </div>
  );
}
