import { useEffect, useState } from "react";
import { Loader2, Replace } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/presentation/components/ui/dialog";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { NativeSelect } from "@/presentation/components/ui/select";
import { useModules, useWorkOrders } from "@/presentation/hooks/data";
import { useServices } from "@/presentation/providers/services";
import { errorMessage } from "@/presentation/lib/errors";
import { num } from "@/presentation/lib/format";
import type { Module, ModuleGrade } from "@/domain/model";

/** Module replacement workflow: faulty module out, new serial + grade in, full traceability kept. */
export function ReplaceModuleDialog({ module, currentSoh, open, onOpenChange, workOrderId }: { module: Module | null; currentSoh?: number; open: boolean; onOpenChange: (o: boolean) => void; workOrderId?: string }) {
  const { t } = useTranslation();
  const modules = useModules();
  const modulesUc = useServices().commands.modules;
  const wos = useWorkOrders();
  const spares = (modules.data ?? []).filter((m) => m.status === "spare");
  const [spareId, setSpareId] = useState("");
  const [serial, setSerial] = useState("");
  const [grade, setGrade] = useState<ModuleGrade>("A");
  const [soh, setSoh] = useState(95);
  const [reason, setReason] = useState("");
  const [wo, setWo] = useState(workOrderId ?? "");
  const [busy, setBusy] = useState(false);
  const openWos = (wos.data ?? []).filter((w) => w.station_id === module?.station_id && w.status !== "done");

  useEffect(() => {
    if (!open) return;
    setReason(currentSoh !== undefined && currentSoh < 80 ? t("replace.reasonSoh", { soh: num(currentSoh, 1) }) : "");
    setWo(workOrderId ?? openWos.find((w) => w.type === "module_replacement")?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const s = spares.find((x) => x.id === spareId);
    if (s) {
      setSerial(s.serial);
      setGrade(s.grade);
      setSoh(s.initial_soh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spareId]);

  if (!module) return null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await modulesUc.replaceModule({ faulty: module, newSerial: serial, newGrade: grade, newInitialSoh: soh, reason, workOrderId: wo || null });
      toast.success(t("replace.done", { pos: `${module.row}-${module.slot}`, serial }));
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("common.close")}>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Replace className="h-5 w-5" aria-hidden /> {t("replace.title", { pos: `${module.row}-${module.slot}` })}
            </DialogTitle>
            <DialogDescription>
              {t("replace.removing")}: <span className="font-mono">{module.serial}</span> ({t("modules.grade")} {module.grade}
              {currentSoh !== undefined ? `, SOH ${num(currentSoh, 1)}%` : ""})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="spare">{t("replace.fromStock")}</Label>
            <NativeSelect id="spare" value={spareId} onChange={(e) => setSpareId(e.target.value)}>
              <option value="">{t("replace.manualEntry")}</option>
              {spares.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.serial} · {t("modules.grade")} {s.grade} · {num(s.initial_soh, 1)}%
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="serial">{t("replace.newSerial")}</Label>
              <Input id="serial" required value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="AM5-26A-01234" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grade">{t("modules.grade")}</Label>
              <NativeSelect id="grade" value={grade} onChange={(e) => setGrade(e.target.value as ModuleGrade)}>
                {(["A", "B", "C"] as const).map((g) => (
                  <option key={g} value={g}>
                    {g} — {t(`grade.${g}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="soh">{t("replace.sohAtInstall")}</Label>
              <Input id="soh" type="number" min={70} max={100} step={0.1} required value={soh} onChange={(e) => setSoh(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason">{t("replace.reason")}</Label>
            <Input id="reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wo">{t("replace.workOrder")}</Label>
            <NativeSelect id="wo" value={wo} onChange={(e) => setWo(e.target.value)}>
              <option value="">—</option>
              {openWos.map((w) => (
                <option key={w.id} value={w.id}>
                  WO-{w.number} · {w.title}
                </option>
              ))}
            </NativeSelect>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} {t("replace.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
