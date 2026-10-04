import { useState } from "react";
import { CalendarClock, Download, FileText, Plus, ShieldCheck, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Progress, Skeleton } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { ServiceRequestDialog } from "@/components/ServiceRequestDialog";
import { WoStepper } from "@/components/WoStepper";
import { ToneBadge } from "@/components/StatusBadge";
import { useCustomers, useDocuments, useServiceHistory, useWorkOrders } from "@/hooks/data";
import { useCurrentStation } from "@/hooks/useCurrentStation";
import { api } from "@/lib/api";
import { date } from "@/lib/format";
import { generateDocumentPdf } from "@/lib/pdf";
import type { DocumentRec, Station } from "@/lib/types";

function addMonths(iso: string, months: number) {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Next 6-monthly inspection and next annual coolant + fire-system check. */
export function serviceSchedule(station: Station) {
  const install = station.install_date;
  const now = Date.now();
  let k = 1;
  while (addMonths(install, 12 * k).getTime() < now - 86400000) k++;
  return {
    inspection: station.next_service_date,
    annual: addMonths(install, 12 * k).toISOString().slice(0, 10),
  };
}

export function WarrantyCard({ station }: { station: Station }) {
  const { t } = useTranslation();
  const start = Date.parse(station.install_date);
  const end = Date.parse(station.warranty_end);
  const used = ((Date.now() - start) / (end - start)) * 100;
  const yearsLeft = (end - Date.now()) / (365.25 * 86400000);
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <ShieldCheck className="h-5 w-5 text-ok" aria-hidden />
        <CardTitle>{t("maintenance.warranty")}</CardTitle>
        <ToneBadge tone={yearsLeft > 0 ? "ok" : "crit"} className="ml-auto">
          {yearsLeft > 0 ? t("maintenance.warrantyActive") : t("maintenance.warrantyExpired")}
        </ToneBadge>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="tabular text-2xl font-extrabold">{t("maintenance.yearsLeft", { years: Math.max(0, yearsLeft).toFixed(1) })}</div>
        <Progress value={used} label={t("maintenance.warranty")} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{date(station.install_date)}</span>
          <span>{date(station.warranty_end)}</span>
        </div>
        <p className="text-xs text-muted-foreground">{t("maintenance.warrantyTerms")}</p>
      </CardContent>
    </Card>
  );
}

export function DocumentsList({ station }: { station: Station }) {
  const { t } = useTranslation();
  const docs = useDocuments();
  const customers = useCustomers();
  const list = (docs.data ?? []).filter((d) => d.station_id === station.id);
  const open = async (d: DocumentRec) => {
    const url = d.storage_path ? await api.resolveFileUrl(d.storage_path) : null;
    if (url) window.open(url, "_blank", "noopener");
    else await generateDocumentPdf(d, station, customers.data?.find((c) => c.id === station.customer_id));
  };
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <FileText className="h-5 w-5 text-brand-500" aria-hidden />
        <CardTitle>{t("maintenance.documents")}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {docs.isLoading && <Skeleton className="h-24" />}
        {list.map((d) => (
          <div key={d.id} className="flex items-center gap-3 py-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-crit-soft text-[10px] font-bold text-crit-fg">PDF</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{d.title}</div>
              <div className="text-xs text-muted-foreground">
                {t(`docKind.${d.kind}`)} · {date(d.created_at)} · {d.size_kb} KB
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => open(d).catch(() => toast.error(t("common.error")))} aria-label={`${t("common.download")} ${d.title}`}>
              <Download />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function OwnerMaintenance() {
  const { t } = useTranslation();
  const { station } = useCurrentStation();
  const wos = useWorkOrders();
  const history = useServiceHistory();
  const [open, setOpen] = useState(false);
  if (!station) return <Skeleton className="h-96" />;
  const sched = serviceSchedule(station);
  const active = (wos.data ?? []).filter((w) => w.station_id === station.id && w.status !== "done");
  const hist = (history.data ?? []).filter((h) => h.station_id === station.id);
  return (
    <div className="space-y-4">
      <PageHeader
        title={t("maintenance.title")}
        subtitle={t("maintenance.subtitle")}
        actions={
          <Button onClick={() => setOpen(true)} size="lg">
            <Plus /> {t("maintenance.requestService")}
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <CalendarClock className="h-5 w-5 text-brand-500" aria-hidden />
            <CardTitle>{t("maintenance.upcoming")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border p-3">
                <div className="text-xs font-semibold uppercase text-muted-foreground">{t("serviceType.inspection_6m")}</div>
                <div className="mt-1 text-lg font-bold">{date(sched.inspection)}</div>
                <div className="text-xs text-muted-foreground">{t("maintenance.every6m")}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs font-semibold uppercase text-muted-foreground">{t("serviceType.annual_coolant_fire")}</div>
                <div className="mt-1 text-lg font-bold">{date(sched.annual)}</div>
                <div className="text-xs text-muted-foreground">{t("maintenance.everyYear")}</div>
              </div>
            </div>
            <h3 className="pt-2 text-sm font-semibold">{t("maintenance.openRequests")}</h3>
            {active.length === 0 && <p className="text-sm text-muted-foreground">{t("maintenance.noOpen")}</p>}
            {active.map((w) => (
              <div key={w.id} className="space-y-2 rounded-xl border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">WO-{w.number}</Badge>
                  <span className="font-semibold">{t(`serviceType.${w.type}`)}</span>
                  <span className="text-sm text-muted-foreground">· {w.title}</span>
                </div>
                <WoStepper status={w.status} />
                <div className="text-xs text-muted-foreground">
                  {w.scheduled_date ? `${t("wo.scheduledFor")} ${date(w.scheduled_date)}` : w.preferred_date ? `${t("wo.preferred")} ${date(w.preferred_date)}` : `${t("wo.created")} ${date(w.created_at)}`}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <WarrantyCard station={station} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Wrench className="h-5 w-5 text-brand-500" aria-hidden />
            <CardTitle>{t("maintenance.history")}</CardTitle>
          </CardHeader>
          <CardContent>
            {hist.length === 0 ? (
              <EmptyState title={t("maintenance.noHistory")} />
            ) : (
              <ol className="relative space-y-4 border-l-2 border-brand-100 pl-5">
                {hist.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-background bg-brand-500" aria-hidden />
                    <div className="text-xs text-muted-foreground">{date(h.date)}</div>
                    <div className="font-semibold">{t(`serviceType.${h.type}`)}</div>
                    <p className="text-sm text-muted-foreground">{h.summary}</p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
        <DocumentsList station={station} />
      </div>
      <ServiceRequestDialog station={station} open={open} onOpenChange={setOpen} />
    </div>
  );
}
