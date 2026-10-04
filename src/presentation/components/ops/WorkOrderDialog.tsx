import { useEffect, useState } from "react";
import { Camera, CheckCircle2, ExternalLink, Loader2, Plus, Replace, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/presentation/components/ui/dialog";
import { Button } from "@/presentation/components/ui/button";
import { Input, Textarea } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { NativeSelect } from "@/presentation/components/ui/select";
import { Badge } from "@/presentation/components/ui/badge";
import { Progress } from "@/presentation/components/ui/misc";
import { ToneBadge } from "@/presentation/components/StatusBadge";
import { SignaturePad } from "@/presentation/components/ops/SignaturePad";
import { useChecklist, useCustomers, useProfiles, useStations } from "@/presentation/hooks/data";
import { api } from "@/composition-root";
import { useAuth } from "@/presentation/providers/auth";
import { date, dateTime } from "@/presentation/lib/format";
import { priorityTone, woStatusTone } from "@/presentation/lib/tone";
import { cn } from "@/presentation/lib/utils";
import type { PartUsed, Priority, WorkOrder, WorkOrderStatus } from "@/domain/model";

function Img({ refStr }: { refStr: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    api.resolveFileUrl(refStr).then(setUrl);
  }, [refStr]);
  if (!url) return <div className="h-20 w-20 animate-pulse rounded-lg bg-muted" />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="" className="h-20 w-20 rounded-lg border object-cover" />
    </a>
  );
}

export function WorkOrderDialog({ wo, open, onOpenChange }: { wo: WorkOrder | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const stations = useStations();
  const customers = useCustomers();
  const profiles = useProfiles();
  const checklist = useChecklist(open ? wo?.id : undefined);
  const [parts, setParts] = useState<PartUsed[]>([]);
  const [notes, setNotes] = useState("");
  const [signer, setSigner] = useState("");
  const [sig, setSig] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [localChecks, setLocalChecks] = useState<Record<string, boolean>>({});
  const [warnIncomplete, setWarnIncomplete] = useState(false);

  useEffect(() => {
    if (wo && open) {
      setParts(wo.parts_used);
      setNotes(wo.resolution_notes ?? "");
      setSigner(wo.signed_by ?? "");
      setSig(null);
      setLocalChecks({});
      setWarnIncomplete(false);
    }
  }, [wo, open]);

  if (!wo) return null;
  const station = stations.data?.find((s) => s.id === wo.station_id);
  const customer = customers.data?.find((c) => c.id === station?.customer_id);
  const techs = (profiles.data ?? []).filter((p) => p.role === "technician");
  const items = (checklist.data ?? []).map((c) => ({ ...c, done: localChecks[c.id] ?? c.done }));
  const done = items.filter((c) => c.done).length;
  const readOnly = wo.status === "done";

  const patch = async (p: Partial<WorkOrder>, msg?: string) => {
    try {
      await api.updateWorkOrder(wo.id, p);
      Object.assign(wo, p);
      if (msg) toast.success(msg);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const toggle = async (id: string, v: boolean) => {
    setLocalChecks((s) => ({ ...s, [id]: v }));
    await api.updateChecklistItem(id, { done: v });
  };
  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const refs = await Promise.all(Array.from(files).map((f, i) => api.uploadFile("photos", `${wo.station_id}/${wo.id}/${Date.now()}-${i}.${f.name.split(".").pop()}`, f)));
    await patch({ photos: [...wo.photos, ...refs] }, t("wo.photosAdded"));
  };
  const complete = async () => {
    if (done < items.length && !warnIncomplete) {
      setWarnIncomplete(true);
      toast.warning(t("wo.incompleteConfirm"));
      return;
    }
    if (!sig && !wo.signature_url) {
      toast.error(t("wo.signatureRequired"));
      return;
    }
    setBusy(true);
    try {
      const signature_url = sig ? await api.uploadFile("signatures", `${wo.station_id}/${wo.id}.png`, sig) : wo.signature_url;
      await patch({ status: "done", parts_used: parts, resolution_notes: notes, signed_by: signer || customer?.name || null, signature_url }, t("wo.completed", { number: wo.number }));
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right" closeLabel={t("common.close")}>
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">WO-{wo.number}</Badge>
            <ToneBadge tone={woStatusTone[wo.status]}>{t(`woStatus.${wo.status}`)}</ToneBadge>
            <ToneBadge tone={priorityTone[wo.priority]}>{t(`priority.${wo.priority}`)}</ToneBadge>
          </div>
          <DialogTitle>
            {t(`serviceType.${wo.type}`)} — {wo.title}
          </DialogTitle>
          <DialogDescription>
            {station && (
              <Link to={`/ops/stations/${station.id}`} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline" onClick={() => onOpenChange(false)}>
                {station.name} <ExternalLink className="h-3 w-3" />
              </Link>
            )}{" "}
            · {station?.address} · {customer?.name} {customer?.phone && <a href={`tel:${customer.phone}`} className="underline">{customer.phone}</a>}
          </DialogDescription>
        </DialogHeader>
        {wo.description && <p className="whitespace-pre-line rounded-xl bg-muted p-3 text-sm">{wo.description}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="st">{t("wo.status")}</Label>
            <NativeSelect id="st" value={wo.status} disabled={readOnly} onChange={(e) => (e.target.value === "done" ? complete() : patch({ status: e.target.value as WorkOrderStatus }, t("wo.updated")))}>
              {(["new", "scheduled", "in_progress", "done"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`woStatus.${s}`)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="as">{t("wo.assignee")}</Label>
            <NativeSelect id="as" value={wo.assigned_to ?? ""} disabled={readOnly} onChange={(e) => patch({ assigned_to: e.target.value || null }, t("wo.updated"))}>
              <option value="">{t("wo.unassigned")}</option>
              {techs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sd">{t("wo.scheduledDate")}</Label>
            <Input id="sd" type="date" disabled={readOnly} value={wo.scheduled_date ?? ""} onChange={(e) => patch({ scheduled_date: e.target.value || null, status: wo.status === "new" && e.target.value ? "scheduled" : wo.status }, t("wo.updated"))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pr">{t("wo.priority")}</Label>
            <NativeSelect id="pr" value={wo.priority} disabled={readOnly} onChange={(e) => patch({ priority: e.target.value as Priority }, t("wo.updated"))}>
              {(["low", "normal", "high", "urgent"] as const).map((p) => (
                <option key={p} value={p}>
                  {t(`priority.${p}`)}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {t("wo.created")} {dateTime(wo.created_at)}
          {wo.preferred_date && ` · ${t("wo.preferred")} ${date(wo.preferred_date)}`}
          {wo.completed_at && ` · ${t("woStatus.done")} ${dateTime(wo.completed_at)}`}
        </div>

        {wo.type === "module_replacement" && !readOnly && (
          <Button asChild variant="outline">
            <Link to={`/ops/stations/${wo.station_id}?tab=health`} onClick={() => onOpenChange(false)}>
              <Replace /> {t("wo.openReplacement")}
            </Link>
          </Button>
        )}

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">{t("wo.checklist")}</h4>
            <span className="tabular text-sm text-muted-foreground">
              {done}/{items.length}
            </span>
          </div>
          <Progress value={items.length ? (done / items.length) * 100 : 0} label={t("wo.checklist")} />
          <ul className="divide-y rounded-xl border">
            {items.map((c) => (
              <li key={c.id}>
                <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm", c.done && "text-muted-foreground")}>
                  <input type="checkbox" className="h-5 w-5 accent-[#22382F]" checked={c.done} disabled={readOnly || user?.role === "owner"} onChange={(e) => toggle(c.id, e.target.checked)} />
                  <span className={cn(c.done && "line-through")}>{t(`checklist.${c.label_key}` as "checklist.visual_inspection")}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h4 className="font-semibold">{t("wo.parts")}</h4>
          {parts.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_1fr_auto] gap-2">
              <Input aria-label={t("wo.part")} value={p.part} disabled={readOnly} onChange={(e) => setParts((x) => x.map((y, j) => (j === i ? { ...y, part: e.target.value } : y)))} />
              <Input aria-label={t("wo.qty")} type="number" min={0} step={0.1} value={p.qty} disabled={readOnly} onChange={(e) => setParts((x) => x.map((y, j) => (j === i ? { ...y, qty: Number(e.target.value) } : y)))} />
              <Input aria-label={t("wo.serial")} placeholder={t("wo.serial")} value={p.serial ?? ""} disabled={readOnly} onChange={(e) => setParts((x) => x.map((y, j) => (j === i ? { ...y, serial: e.target.value } : y)))} />
              {!readOnly && (
                <Button type="button" size="icon" variant="ghost" onClick={() => setParts((x) => x.filter((_, j) => j !== i))} aria-label={t("common.remove")}>
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
          {!readOnly && (
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setParts((x) => [...x, { part: "", qty: 1 }])}>
                <Plus /> {t("wo.addPart")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => patch({ parts_used: parts }, t("wo.updated"))}>
                {t("common.save")}
              </Button>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h4 className="font-semibold">{t("wo.photos")}</h4>
          <div className="flex flex-wrap gap-2">
            {wo.photos.map((p) => (
              <Img key={p} refStr={p} />
            ))}
            {!readOnly && (
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs text-muted-foreground hover:bg-muted">
                <Camera className="h-5 w-5" aria-hidden />
                {t("wo.addPhoto")}
                <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
              </label>
            )}
            {readOnly && wo.photos.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
          </div>
        </section>

        <section className="space-y-2">
          <Label htmlFor="notes" className="font-semibold">
            {t("wo.notes")}
          </Label>
          <Textarea id="notes" value={notes} disabled={readOnly} onChange={(e) => setNotes(e.target.value)} placeholder={t("wo.notesPlaceholder")} />
        </section>

        <section className="space-y-2">
          <h4 className="font-semibold">{t("wo.signature")}</h4>
          {wo.signature_url ? (
            <div className="flex items-center gap-2 rounded-xl border bg-ok-soft p-3 text-sm text-ok-fg">
              <CheckCircle2 className="h-5 w-5" aria-hidden /> {t("wo.signedBy", { name: wo.signed_by ?? "—" })}
            </div>
          ) : (
            !readOnly && (
              <>
                <Input aria-label={t("wo.signerName")} placeholder={t("wo.signerName")} value={signer} onChange={(e) => setSigner(e.target.value)} />
                <SignaturePad onChange={setSig} />
              </>
            )
          )}
        </section>

        {warnIncomplete && <p className="rounded-xl border border-warn/40 bg-warn-soft p-3 text-sm text-warn-fg">{t("wo.incompleteConfirm")}</p>}
        {!readOnly && (
          <Button size="lg" onClick={complete} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} {t("wo.complete")}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
