import { useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { IssueType, Station } from "@/lib/types";

const ISSUES: IssueType[] = ["alert", "performance", "noise", "physical_damage", "app_data", "other"];

export function ServiceRequestDialog({ station, open, onOpenChange }: { station: Station; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const [issue, setIssue] = useState<IssueType>("performance");
  const [desc, setDesc] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const minDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const wo = await api.createWorkOrder({
        station_id: station.id,
        type: "repair",
        issue_type: issue,
        title: t(`issueType.${issue}`),
        description: desc,
        preferred_date: dateStr || null,
        priority: issue === "physical_damage" ? "high" : "normal",
        photos: files,
      });
      toast.success(t("request.created", { number: wo.number }));
      onOpenChange(false);
      setDesc("");
      setFiles([]);
      setDateStr("");
    } catch (err) {
      toast.error(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("common.close")}>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("request.title")}</DialogTitle>
            <DialogDescription>{t("request.subtitle", { station: station.name })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="issue">{t("request.issueType")}</Label>
            <NativeSelect id="issue" value={issue} onChange={(e) => setIssue(e.target.value as IssueType)}>
              {ISSUES.map((i) => (
                <option key={i} value={i}>
                  {t(`issueType.${i}`)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">{t("request.description")}</Label>
            <Textarea id="desc" required minLength={5} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("request.descriptionPlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">{t("request.preferredDate")}</Label>
            <Input id="date" type="date" min={minDate} value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("request.photos")}</Label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-sm text-muted-foreground hover:bg-muted">
              <Camera className="h-5 w-5" aria-hidden /> {t("request.addPhotos")}
              <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])].slice(0, 6))} />
            </label>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <div key={i} className="relative">
                    <img src={URL.createObjectURL(f)} alt={f.name} className="h-16 w-16 rounded-lg object-cover" />
                    <button type="button" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-0.5 text-background" aria-label={t("common.remove")}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} {t("request.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
