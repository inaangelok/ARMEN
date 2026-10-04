import { useMemo, useState } from "react";
import { ArrowRight, Ban, Replace, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card } from "@/presentation/components/ui/card";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { NativeSelect } from "@/presentation/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/presentation/components/ui/dialog";
import { Skeleton } from "@/presentation/components/ui/misc";
import { PageHeader } from "@/presentation/components/PageHeader";
import { ToneBadge } from "@/presentation/components/StatusBadge";
import { HistoryCharts } from "@/presentation/components/charts/HistoryCharts";
import { ReplaceModuleDialog } from "@/presentation/components/ops/ReplaceModuleDialog";
import { useAssignments, useModuleHistory, useModules, useSnapshots, useStations } from "@/presentation/hooks/data";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/composition-root";
import { date, num } from "@/presentation/lib/format";
import type { Tone } from "@/presentation/lib/tone";
import type { Module, ModuleStatus } from "@/domain/model";

const STATUS_TONE: Record<ModuleStatus, Tone> = { active: "ok", faulty: "crit", replaced: "muted", spare: "info" };

function Traceability({ module, open, onOpenChange, onReplace }: { module: Module | null; open: boolean; onOpenChange: (o: boolean) => void; onReplace: (m: Module) => void }) {
  const { t } = useTranslation();
  const assignments = useAssignments();
  const stations = useStations();
  const history = useModuleHistory(open && module?.station_id ? module.id : undefined, "12m");
  if (!module) return null;
  const rows = (assignments.data ?? []).filter((a) => a.module_id === module.id).sort((a, b) => a.installed_at.localeCompare(b.installed_at));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right" closeLabel={t("common.close")}>
        <DialogHeader>
          <DialogTitle className="font-mono">{module.serial}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <ToneBadge tone={STATUS_TONE[module.status]}>{t(`moduleState.${module.status}`)}</ToneBadge>
            {t("modules.grade")} {module.grade} · {module.origin} · {t("modules.manufactured")} {date(module.manufacture_date)}
          </DialogDescription>
        </DialogHeader>
        {module.station_id && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={module.status === "faulty"}
              onClick={async () => {
                await api.markModuleFaulty(module.id, t("replace.markedFromApp"));
                toast.success(t("replace.markedFaulty", { pos: `${module.row}-${module.slot}` }));
              }}
            >
              <Ban /> {t("replace.markFaulty")}
            </Button>
            <Button size="sm" onClick={() => onReplace(module)}>
              <Replace /> {t("replace.replace")}
            </Button>
          </div>
        )}
        <section>
          <h4 className="mb-2 font-semibold">{t("modules.lifecycle")}</h4>
          <ol className="relative space-y-4 border-l-2 border-brand-100 pl-5">
            <li className="relative">
              <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-brand-300" />
              <div className="text-xs text-muted-foreground">{date(module.manufacture_date)}</div>
              <div className="text-sm font-semibold">{t("modules.graded", { grade: module.grade, soh: num(rows[0]?.soh_at_install ?? module.initial_soh, 1) })}</div>
            </li>
            {rows.map((a) => {
              const st = stations.data?.find((s) => s.id === a.station_id);
              return (
                <li key={a.id} className="relative">
                  <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ${a.removed_at ? "bg-muted-foreground" : "bg-ok"}`} />
                  <div className="text-xs text-muted-foreground">
                    {date(a.installed_at)} → {a.removed_at ? date(a.removed_at) : t("modules.present")}
                  </div>
                  <div className="text-sm font-semibold">
                    {st ? (
                      <Link to={`/ops/stations/${st.id}?tab=health`} className="hover:underline" onClick={() => onOpenChange(false)}>
                        {st.name}
                      </Link>
                    ) : (
                      "—"
                    )}{" "}
                    · {t("modules.position")} {a.row}-{a.slot}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("modules.atInstall")}: {t("modules.grade")} {a.grade_at_install}, SOH {num(a.soh_at_install, 1)}%
                    {a.removed_at && (
                      <>
                        {" "}
                        · {t("modules.atRemoval")}: SOH {num(a.soh_at_removal, 1)}% — {a.removal_reason}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
        {module.station_id && (
          <section>
            <h4 className="mb-2 font-semibold">{t("modules.sohOverTime")}</h4>
            <HistoryCharts data={history.data} loading={history.isLoading} range="12m" showCycles={false} />
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function Modules() {
  const { t } = useTranslation();
  const modules = useModules();
  const stations = useStations();
  useSnapshots();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ModuleStatus | "">("");
  const [grade, setGrade] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<Module | null>(null);
  const stationIds = [...new Set((modules.data ?? []).map((m) => m.station_id).filter(Boolean))] as string[];
  const readings = useQueries({ queries: stationIds.map((id) => ({ queryKey: ["modulesLatest", id, "registry"], queryFn: () => api.getModuleReadings(id) })) });
  const sohById = new Map(readings.flatMap((r) => r.data ?? []).map((r) => [r.module_id, r.soh]));
  const list = useMemo(
    () =>
      (modules.data ?? [])
        .filter((m) => (!status || m.status === status) && (!grade || m.grade === grade))
        .filter((m) => {
          const st = stations.data?.find((s) => s.id === m.station_id);
          return !q || `${m.serial} ${m.origin} ${st?.name ?? ""}`.toLowerCase().includes(q.toLowerCase());
        })
        .sort((a, b) => ["faulty", "active", "spare", "replaced"].indexOf(a.status) - ["faulty", "active", "spare", "replaced"].indexOf(b.status) || (sohById.get(a.id) ?? 100) - (sohById.get(b.id) ?? 100)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modules.data, stations.data, q, status, grade, readings.map((r) => r.dataUpdatedAt).join()],
  );
  const counts = (s: ModuleStatus) => (modules.data ?? []).filter((m) => m.status === s).length;
  const selected = (modules.data ?? []).find((m) => m.id === sel) ?? null;
  return (
    <div>
      <PageHeader title={t("modules.title")} subtitle={t("modules.subtitle")} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(["active", "faulty", "spare", "replaced"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(status === s ? "" : s)} className="text-left">
            <Card className={`p-4 transition hover:shadow-md ${status === s ? "ring-2 ring-brand-500" : ""}`}>
              <ToneBadge tone={STATUS_TONE[s]}>{t(`moduleState.${s}`)}</ToneBadge>
              <div className="tabular mt-2 text-3xl font-extrabold">{counts(s)}</div>
            </Card>
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("modules.search")} className="pl-9" aria-label={t("modules.search")} />
        </div>
        <NativeSelect value={grade} onChange={(e) => setGrade(e.target.value)} className="w-36" aria-label={t("modules.grade")}>
          <option value="">{t("modules.allGrades")}</option>
          {["A", "B", "C"].map((g) => (
            <option key={g} value={g}>
              {t("modules.grade")} {g}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Card className="overflow-hidden">
        {modules.isLoading ? (
          <Skeleton className="h-96" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">{t("modules.serial")}</th>
                  <th className="px-3 py-2.5">{t("modules.grade")}</th>
                  <th className="px-3 py-2.5">{t("fleet.status")}</th>
                  <th className="px-3 py-2.5">{t("fleet.station")}</th>
                  <th className="px-3 py-2.5">{t("modules.position")}</th>
                  <th className="px-3 py-2.5 text-right">SOH</th>
                  <th className="px-3 py-2.5">{t("modules.installed")}</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.slice(0, 300).map((m) => {
                  const st = stations.data?.find((s) => s.id === m.station_id);
                  const soh = sohById.get(m.id);
                  return (
                    <tr key={m.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSel(m.id)}>
                      <td className="px-3 py-2 font-mono text-xs">{m.serial}</td>
                      <td className="px-3 py-2">{m.grade}</td>
                      <td className="px-3 py-2">
                        <ToneBadge tone={STATUS_TONE[m.status]}>{t(`moduleState.${m.status}`)}</ToneBadge>
                      </td>
                      <td className="px-3 py-2">{st?.name ?? <span className="text-muted-foreground">{m.status === "spare" ? t("modules.warehouse") : "—"}</span>}</td>
                      <td className="px-3 py-2">{m.row ? `${m.row}-${m.slot}` : "—"}</td>
                      <td className={`tabular px-3 py-2 text-right font-semibold ${soh !== undefined && soh < 85 ? (soh < 80 ? "text-crit-fg" : "text-warn-fg") : ""}`}>{soh !== undefined ? `${num(soh, 1)}%` : m.status === "spare" ? `${num(m.initial_soh, 1)}%` : "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{date(m.install_date)}</td>
                      <td className="px-3 py-2 text-right">
                        <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Traceability module={selected} open={!!selected} onOpenChange={(o) => !o && setSel(null)} onReplace={(m) => setReplacing(m)} />
      <ReplaceModuleDialog module={replacing} currentSoh={replacing ? sohById.get(replacing.id) : undefined} open={!!replacing} onOpenChange={(o) => !o && setReplacing(null)} />
    </div>
  );
}
