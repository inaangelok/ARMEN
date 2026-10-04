import { useState } from "react";
import { BellRing, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/presentation/components/ui/tabs";
import { EmptyState, Skeleton } from "@/presentation/components/ui/misc";
import { PageHeader } from "@/presentation/components/PageHeader";
import { AlertItem } from "@/presentation/components/AlertItem";
import { useAlerts } from "@/presentation/hooks/data";
import { useCurrentStation } from "@/presentation/hooks/useCurrentStation";
import { api } from "@/composition-root";

export function OwnerAlerts() {
  const { t } = useTranslation();
  const { station } = useCurrentStation();
  const alerts = useAlerts();
  const [tab, setTab] = useState<"active" | "all">("active");
  const list = (alerts.data ?? []).filter((a) => a.station_id === station?.id && (tab === "all" || a.status !== "resolved"));
  return (
    <div>
      <PageHeader title={t("alerts.title")} subtitle={t("alerts.subtitle")} actions={
        <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "all")}>
          <TabsList>
            <TabsTrigger value="active">{t("alerts.active")}</TabsTrigger>
            <TabsTrigger value="all">{t("alerts.history")}</TabsTrigger>
          </TabsList>
        </Tabs>
      } />
      <div className="mb-4 flex items-start gap-3 rounded-2xl border bg-card p-3 text-sm text-muted-foreground">
        <div className="flex gap-1 pt-0.5 text-brand-500">
          <Mail className="h-4 w-4" aria-hidden />
          <BellRing className="h-4 w-4" aria-hidden />
        </div>
        {t("alerts.channels")}
      </div>
      {alerts.isLoading ? (
        <Skeleton className="h-40" />
      ) : list.length === 0 ? (
        <EmptyState title={t("alerts.none")}>{t("alerts.noneHint")}</EmptyState>
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <AlertItem
              key={a.id}
              alert={a}
              onAck={async () => {
                await api.setAlertStatus(a.id, "acknowledged");
                toast.success(t("alerts.acknowledged"));
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
