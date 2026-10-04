import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/presentation/components/ui/dialog";
import { Button } from "@/presentation/components/ui/button";
import { Input, Textarea } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { NativeSelect } from "@/presentation/components/ui/select";
import { useProfiles, useStations } from "@/presentation/hooks/data";
import { api } from "@/composition-root";
import type { Alert, Priority, ServiceType } from "@/domain/model";

const TYPES: ServiceType[] = ["inspection_6m", "annual_coolant_fire", "repair", "module_replacement", "commissioning"];
const PRIOS: Priority[] = ["low", "normal", "high", "urgent"];

export function CreateWorkOrderDialog({ open, onOpenChange, stationId, alert }: { open: boolean; onOpenChange: (o: boolean) => void; stationId?: string; alert?: Alert | null }) {
  const { t } = useTranslation();
  const stations = useStations();
  const profiles = useProfiles();
  const techs = (profiles.data ?? []).filter((p) => p.role === "technician");
  const [form, setForm] = useState({ station_id: "", type: "repair" as ServiceType, title: "", description: "", priority: "normal" as Priority, assigned_to: "", scheduled_date: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const sid = alert?.station_id ?? stationId ?? stations.data?.[0]?.id ?? "";
    const st = stations.data?.find((s) => s.id === sid);
    setForm({
      station_id: sid,
      type: alert?.code === "SOH_LOW" ? "module_replacement" : "repair",
      title: alert ? t(`alertCode.${alert.code}.title`) + (alert.params.module ? ` (${t("modules.module")} ${alert.params.module})` : "") : "",
      description: alert ? t(`alertCode.${alert.code}.desc`, { ...alert.params }) : "",
      priority: alert?.severity === "critical" ? "urgent" : alert?.severity === "warning" ? "high" : "normal",
      assigned_to: st?.technician_id ?? "",
      scheduled_date: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const wo = await api.createWorkOrder({ ...form, issue_type: alert ? "alert" : null, assigned_to: form.assigned_to || null, scheduled_date: form.scheduled_date || null, alert_id: alert?.id ?? null });
      toast.success(t("wo.createdToast", { number: wo.number }));
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("common.close")}>
        <form onSubmit={submit} className="space-y-3">
          <DialogHeader>
            <DialogTitle>{t("wo.new")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="wo-station">{t("fleet.station")}</Label>
            <NativeSelect id="wo-station" value={form.station_id} onChange={(e) => set("station_id", e.target.value)} disabled={!!stationId || !!alert}>
              {(stations.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wo-type">{t("wo.type")}</Label>
              <NativeSelect id="wo-type" value={form.type} onChange={(e) => set("type", e.target.value as ServiceType)}>
                {TYPES.map((x) => (
                  <option key={x} value={x}>
                    {t(`serviceType.${x}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-prio">{t("wo.priority")}</Label>
              <NativeSelect id="wo-prio" value={form.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
                {PRIOS.map((x) => (
                  <option key={x} value={x}>
                    {t(`priority.${x}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wo-title">{t("wo.title")}</Label>
            <Input id="wo-title" required value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wo-desc">{t("wo.description")}</Label>
            <Textarea id="wo-desc" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wo-tech">{t("wo.assignee")}</Label>
              <NativeSelect id="wo-tech" value={form.assigned_to} onChange={(e) => set("assigned_to", e.target.value)}>
                <option value="">{t("wo.unassigned")}</option>
                {techs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-date">{t("wo.scheduledDate")}</Label>
              <Input id="wo-date" type="date" value={form.scheduled_date} onChange={(e) => set("scheduled_date", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy || !form.station_id}>
              {busy && <Loader2 className="animate-spin" />} {t("wo.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
