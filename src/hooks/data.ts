import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import i18n from "@/i18n";
import type { Alert, ModuleReading, RangeKey, StationSnapshot } from "@/lib/types";
import { stationStatus, healthLabel, worstSeverity } from "@/lib/status";
import { useAuth } from "@/lib/auth";

const k = {
  stations: ["stations"],
  customers: ["customers"],
  snapshots: ["snapshots"],
  modulesLatest: (id: string) => ["modulesLatest", id],
  alerts: ["alerts"],
  workOrders: ["workorders"],
  checklist: (id: string) => ["checklist", id],
  rules: ["rules"],
  modules: ["modules"],
  assignments: ["assignments"],
  profiles: ["profiles"],
  history: ["history"],
  documents: ["documents"],
  events: (id: string) => ["events", id],
};

const uid = () => useAuth().user?.id ?? "anon";

export const useStations = () => useQuery({ queryKey: [...k.stations, uid()], queryFn: api.listStations });
export const useCustomers = () => useQuery({ queryKey: [...k.customers, uid()], queryFn: api.listCustomers });
export const useSnapshots = () => useQuery({ queryKey: [...k.snapshots, uid()], queryFn: api.getSnapshots, refetchInterval: api.mode === "supabase" ? 60_000 : false });
export const useModuleReadings = (stationId?: string) =>
  useQuery({ queryKey: [...k.modulesLatest(stationId ?? ""), uid()], queryFn: () => api.getModuleReadings(stationId!), enabled: !!stationId });
export const useAlerts = () => useQuery({ queryKey: [...k.alerts, uid()], queryFn: api.listAlerts });
export const useWorkOrders = () => useQuery({ queryKey: [...k.workOrders, uid()], queryFn: api.listWorkOrders });
export const useChecklist = (woId?: string) => useQuery({ queryKey: [...k.checklist(woId ?? ""), uid()], queryFn: () => api.listChecklist(woId!), enabled: !!woId });
export const useRules = () => useQuery({ queryKey: [...k.rules, uid()], queryFn: api.listRules });
export const useModules = () => useQuery({ queryKey: [...k.modules, uid()], queryFn: api.listModules });
export const useAssignments = () => useQuery({ queryKey: [...k.assignments, uid()], queryFn: api.listAssignments });
export const useProfiles = () => useQuery({ queryKey: [...k.profiles, uid()], queryFn: api.listProfiles });
export const useServiceHistory = () => useQuery({ queryKey: [...k.history, uid()], queryFn: api.listServiceHistory });
export const useDocuments = () => useQuery({ queryKey: [...k.documents, uid()], queryFn: api.listDocuments });
export const useEvents = (stationId?: string) => useQuery({ queryKey: [...k.events(stationId ?? ""), uid()], queryFn: () => api.listEvents(stationId!), enabled: !!stationId });
export const useStationHistory = (stationId: string | undefined, range: RangeKey) =>
  useQuery({ queryKey: ["stationHistory", stationId, range, uid()], queryFn: () => api.getStationHistory(stationId!, range), enabled: !!stationId, staleTime: 5 * 60_000 });
export const useModuleHistory = (moduleId: string | undefined, range: RangeKey) =>
  useQuery({ queryKey: ["moduleHistory", moduleId, range, uid()], queryFn: () => api.getModuleHistory(moduleId!, range), enabled: !!moduleId, staleTime: 5 * 60_000 });
export const usePowerSeries = (stationId?: string) =>
  useQuery({ queryKey: ["power", stationId, uid()], queryFn: () => api.getPowerSeries(stationId!), enabled: !!stationId, refetchInterval: 60_000 });
export const useDaily = (stationId: string | undefined, from: string, to: string) =>
  useQuery({ queryKey: ["daily", stationId, from, to, uid()], queryFn: () => api.getDaily(stationId!, from, to), enabled: !!stationId, staleTime: 5 * 60_000 });
export const useRawTelemetry = (stationId?: string, limit = 200) =>
  useQuery({ queryKey: ["raw", stationId, limit, uid()], queryFn: () => api.getRawTelemetry(stationId!, limit), enabled: !!stationId });

// ---------------------------------------------------------------- simulation flag
const simListeners = new Set<() => void>();
api.onChange((t) => t === "simulation" && simListeners.forEach((l) => l()));
export function useSimulating() {
  return useSyncExternalStore(
    (cb) => {
      simListeners.add(cb);
      return () => simListeners.delete(cb);
    },
    () => api.isSimulating(),
  );
}

// ---------------------------------------------------------------- live sync (mounted once in the app shell)
function invalidateFor(qc: QueryClient, topic: string) {
  const map: Record<string, string[][]> = {
    alerts: [k.alerts, k.events("").slice(0, 1)],
    workorders: [k.workOrders, k.history, ["checklist"], k.documents],
    stations: [k.stations, k.snapshots, ["power"], ["daily"], ["modulesLatest"]],
    modules: [k.modules, k.assignments, ["modulesLatest"], k.snapshots, ["stationHistory"], ["moduleHistory"], ["events"]],
    rules: [k.rules, k.alerts],
    profiles: [k.profiles],
    checklist: [["checklist"]],
  };
  for (const key of map[topic] ?? []) qc.invalidateQueries({ queryKey: key });
}

export function useLiveSync() {
  const qc = useQueryClient();
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const offChange = api.onChange((topic) => {
      if (topic.startsWith("alert-new:")) {
        const id = topic.slice("alert-new:".length);
        qc.invalidateQueries({ queryKey: k.alerts });
        setTimeout(async () => {
          const alerts = await api.listAlerts();
          const a = alerts.find((x) => x.id === id);
          if (!a || a.severity !== "critical") return;
          const title = `${i18n.t("severity.critical")}: ${i18n.t(`alertCode.${a.code}.title`)}`;
          toast.error(title, { description: i18n.t("notifications.sentEmailPush"), duration: 8000 });
          if (user.notify_push && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(title, { body: i18n.t(`alertCode.${a.code}.action`), tag: a.id });
            } catch {
              /* some browsers only allow notifications from a service worker */
            }
          }
        }, 50);
        return;
      }
      invalidateFor(qc, topic);
    });
    const offLive = api.subscribeLive(({ snapshot, modules }) => {
      qc.setQueriesData<Record<string, StationSnapshot>>({ queryKey: k.snapshots }, (old) => (old ? { ...old, [snapshot.station_id]: snapshot } : old));
      if (modules) qc.setQueriesData<ModuleReading[]>({ queryKey: k.modulesLatest(snapshot.station_id) }, () => modules);
      qc.setQueriesData<{ ts: string; pv: number; load: number; grid: number; battery: number; soc: number }[]>({ queryKey: ["power", snapshot.station_id] }, (old) =>
        old ? [...old, { ts: snapshot.ts, pv: snapshot.pv_kw, load: snapshot.load_kw, grid: snapshot.grid_kw, battery: snapshot.battery_kw, soc: snapshot.soc }] : old,
      );
    });
    return () => {
      offChange();
      offLive();
    };
  }, [qc, user]);
}

// ---------------------------------------------------------------- fleet overview (derived)
export function useFleet() {
  const stations = useStations();
  const customers = useCustomers();
  const snapshots = useSnapshots();
  const alerts = useAlerts();
  const rows = useMemo(() => {
    const al = alerts.data ?? [];
    return (stations.data ?? []).map((s) => {
      const snap = snapshots.data?.[s.id];
      const open = al.filter((a: Alert) => a.station_id === s.id && a.status !== "resolved" && a.severity !== "info");
      return {
        station: s,
        customer: customers.data?.find((c) => c.id === s.customer_id),
        snapshot: snap,
        openAlerts: open.length,
        worstSeverity: worstSeverity(open),
        status: stationStatus(snap, al, s.id, s.last_seen_at),
        health: healthLabel(snap, undefined, al, s.id),
      };
    });
  }, [stations.data, customers.data, snapshots.data, alerts.data]);
  return { rows, isLoading: stations.isLoading || snapshots.isLoading || alerts.isLoading };
}
