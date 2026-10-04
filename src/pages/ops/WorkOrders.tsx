import { useMemo, useState } from "react";
import { DndContext, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CalendarDays, GripVertical, Plus, Search, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/PageHeader";
import { ToneBadge } from "@/components/StatusBadge";
import { CreateWorkOrderDialog } from "@/components/ops/CreateWorkOrderDialog";
import { WorkOrderDialog } from "@/components/ops/WorkOrderDialog";
import { useProfiles, useStations, useWorkOrders } from "@/hooks/data";
import { api } from "@/lib/api";
import { date } from "@/lib/format";
import { priorityTone } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { Profile, Station, WorkOrder, WorkOrderStatus } from "@/lib/types";

const COLS: WorkOrderStatus[] = ["new", "scheduled", "in_progress", "done"];
const COL_STYLE: Record<WorkOrderStatus, string> = { new: "border-t-info", scheduled: "border-t-warn", in_progress: "border-t-solar", done: "border-t-ok" };

function WoCard({ wo, station, tech, onOpen }: { wo: WorkOrder; station?: Station; tech?: Profile; onOpen: () => void }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: wo.id, data: { status: wo.status } });
  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cn("rounded-xl border bg-card p-3 shadow-sm", isDragging && "z-50 opacity-80 shadow-lg")}
    >
      <div className="flex items-start gap-1">
        <button className="-ml-1 mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted" {...listeners} {...attributes} aria-label={t("wo.drag")}>
          <GripVertical className="h-4 w-4" />
        </button>
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-muted-foreground">WO-{wo.number}</span>
            <ToneBadge tone={priorityTone[wo.priority]}>{t(`priority.${wo.priority}`)}</ToneBadge>
          </div>
          <div className="mt-1 text-sm font-semibold leading-snug">{wo.title}</div>
          {wo.title.toLowerCase() !== t(`serviceType.${wo.type}`).toLowerCase() && <div className="text-xs text-muted-foreground">{t(`serviceType.${wo.type}`)}</div>}
          <div className="mt-2 truncate text-xs font-medium">{station?.name}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" aria-hidden />
              {tech?.full_name ?? t("wo.unassigned")}
            </span>
            {(wo.scheduled_date || wo.preferred_date || wo.completed_at) && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" aria-hidden />
                {date(wo.completed_at ?? wo.scheduled_date ?? wo.preferred_date, "d MMM")}
              </span>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}

function Column({ status, children, count }: { status: WorkOrderStatus; children: React.ReactNode; count: number }) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section ref={setNodeRef} className={cn("flex min-h-[300px] w-[280px] shrink-0 flex-col rounded-2xl border border-t-4 bg-muted/60 p-2 lg:w-auto", COL_STYLE[status], isOver && "ring-2 ring-brand-400")} aria-label={t(`woStatus.${status}`)}>
      <h2 className="flex items-center justify-between px-1.5 py-1 text-sm font-bold">
        {t(`woStatus.${status}`)}
        <span className="rounded-full bg-background px-2 text-xs">{count}</span>
      </h2>
      <div className="mt-1 flex flex-1 flex-col gap-2">{children}</div>
    </section>
  );
}

export function WorkOrders() {
  const { t } = useTranslation();
  const wos = useWorkOrders();
  const stations = useStations();
  const profiles = useProfiles();
  const [q, setQ] = useState("");
  const [tech, setTech] = useState("");
  const [showAllDone, setShowAllDone] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));
  const techs = (profiles.data ?? []).filter((p) => p.role === "technician");
  const list = useMemo(
    () =>
      (wos.data ?? []).filter((w) => {
        const st = stations.data?.find((s) => s.id === w.station_id);
        return (!tech || (tech === "none" ? !w.assigned_to : w.assigned_to === tech)) && (!q || `WO-${w.number} ${w.title} ${st?.name}`.toLowerCase().includes(q.toLowerCase()));
      }),
    [wos.data, stations.data, q, tech],
  );
  const onDragEnd = async (e: DragEndEvent) => {
    const to = e.over?.id as WorkOrderStatus | undefined;
    const wo = list.find((w) => w.id === e.active.id);
    if (!to || !wo || wo.status === to) return;
    if (to === "done") {
      setOpenId(wo.id);
      toast.info(t("wo.completeInDialog"));
      return;
    }
    if (wo.status === "done") return;
    await api.updateWorkOrder(wo.id, { status: to });
    toast.success(t("wo.moved", { number: wo.number, status: t(`woStatus.${to}`) }));
  };
  const current = (wos.data ?? []).find((w) => w.id === openId) ?? null;
  const cutoff = Date.now() - 30 * 86400000;
  return (
    <div>
      <PageHeader
        title={t("wo.boardTitle")}
        subtitle={t("wo.boardSubtitle")}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> {t("wo.new")}
          </Button>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("wo.search")} className="pl-9" aria-label={t("wo.search")} />
        </div>
        <NativeSelect value={tech} onChange={(e) => setTech(e.target.value)} className="w-52" aria-label={t("wo.assignee")}>
          <option value="">{t("wo.allTechnicians")}</option>
          <option value="none">{t("wo.unassigned")}</option>
          {techs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </NativeSelect>
      </div>
      {wos.isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 lg:mx-0 lg:grid lg:grid-cols-4 lg:px-0">
            {COLS.map((c) => {
              let items = list.filter((w) => w.status === c);
              const total = items.length;
              if (c === "done" && !showAllDone) items = items.filter((w) => Date.parse(w.completed_at ?? w.created_at) > cutoff);
              return (
                <Column key={c} status={c} count={total}>
                  {items.map((w) => (
                    <WoCard key={w.id} wo={w} station={stations.data?.find((s) => s.id === w.station_id)} tech={profiles.data?.find((p) => p.id === w.assigned_to)} onOpen={() => setOpenId(w.id)} />
                  ))}
                  {c === "done" && total > items.length && (
                    <Button variant="ghost" size="sm" onClick={() => setShowAllDone(true)}>
                      {t("wo.showOlder", { count: total - items.length })}
                    </Button>
                  )}
                </Column>
              );
            })}
          </div>
        </DndContext>
      )}
      <WorkOrderDialog wo={current} open={!!current} onOpenChange={(o) => !o && setOpenId(null)} />
      <CreateWorkOrderDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
