import { Check, CheckCheck, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SeverityBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ago, dateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Alert } from "@/lib/types";

const BAR = { critical: "bg-crit", warning: "bg-warn", info: "bg-info" };

export function AlertItem({ alert, stationName, onAck, onResolve, onCreateWO, compact }: { alert: Alert; stationName?: string; onAck?: () => void; onResolve?: () => void; onCreateWO?: () => void; compact?: boolean }) {
  const { t } = useTranslation();
  const p = alert.params as Record<string, string | number>;
  return (
    <article className={cn("relative overflow-hidden rounded-2xl border bg-card p-4 pl-5", alert.status === "resolved" && "opacity-75")}>
      <span className={cn("absolute inset-y-0 left-0 w-1.5", BAR[alert.severity])} aria-hidden />
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={alert.severity} />
        <span className="text-xs text-muted-foreground" title={dateTime(alert.created_at)}>
          {dateTime(alert.created_at)} · {ago(alert.created_at)}
        </span>
        {alert.status !== "open" && <span className="text-xs font-semibold text-muted-foreground">· {t(`alertStatus.${alert.status}`)}</span>}
      </div>
      <h3 className="mt-2 font-semibold leading-snug">
        {t(`alertCode.${alert.code}.title`)}
        {stationName && <span className="font-normal text-muted-foreground"> — {stationName}</span>}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{t(`alertCode.${alert.code}.desc`, { ...p })}</p>
      {!compact && alert.status !== "resolved" && (
        <div className="mt-3 rounded-xl bg-muted p-3 text-sm">
          <span className="font-semibold">{t("alerts.recommended")}: </span>
          {t(`alertCode.${alert.code}.action`)}
        </div>
      )}
      {(onAck || onResolve || onCreateWO) && alert.status !== "resolved" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {onAck && alert.status === "open" && (
            <Button size="sm" variant="outline" onClick={onAck}>
              <Check /> {t("alerts.acknowledge")}
            </Button>
          )}
          {onResolve && (
            <Button size="sm" variant="outline" onClick={onResolve}>
              <CheckCheck /> {t("alerts.resolve")}
            </Button>
          )}
          {onCreateWO && (
            <Button size="sm" onClick={onCreateWO}>
              <Wrench /> {t("alerts.createWO")}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
