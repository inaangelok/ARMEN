// React Query bindings for the application's queries, plus live-update wiring.
// Views read data only through these hooks; writes go through `useServices().commands`.
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import i18n from "@/presentation/i18n";
import { buildFleetRows, type ModuleReading, type RangeKey, type StationSnapshot } from "@/domain";
import { useAuth } from "@/presentation/providers/auth";
import { useServices } from "@/presentation/providers/services";

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
const useQ = () => useServices().queries;

export const useStations = () => {
  const q = useQ();
  return useQuery({ queryKey: [...k.stations, uid()], queryFn: q.listStations });
};
export const useCustomers = () => {
  const q = useQ();
  return useQuery({ queryKey: [...k.customers, uid()], queryFn: q.listCustomers });
};
export const useSnapshots = () => {
  const q = useQ();
  return useQuery({ queryKey: [...k.snapshots, uid()], queryFn: q.getSnapshots, refetchInterval: useServices().info.mode === "supabase" ? 60_000 : false });
};
export const useModuleReadings = (stationId?: string) => {
  const q = useQ();
  return useQuery({ queryKey: [...k.modulesLatest(stationId ?? ""), uid()], queryFn: () => q.getModuleReadings(stationId!), enabled: !!stationId });
};
export const useAlerts = () => {
  const q = useQ();
  return useQuery({ queryKey: [...k.alerts, uid()], queryFn: q.listAlerts });
};
export const useWorkOrders = () => {
  const q = useQ();
  return useQuery({ queryKey: [...k.workOrders, uid()], queryFn: q.listWorkOrders });
};
export const useChecklist = (woId?: string) => {
  const q = useQ();
  return useQuery({ queryKey: [...k.checklist(woId ?? ""), uid()], queryFn: () => q.listChecklist(woId!), enabled: !!woId });
};
export const useRules = () => {
  const q = useQ();
  return useQuery({ queryKey: [...k.rules, uid()], queryFn: q.listRules });
};
export const useModules = () => {
  const q = useQ();
  return useQuery({ queryKey: [...k.modules, uid()], queryFn: q.listModules });
};
export const useAssignments = () => {
  const q = useQ();
  return useQuery({ queryKey: [...k.assignments, uid()], queryFn: q.listAssignments });
};
export const useProfiles = () => {
  const q = useQ();
  return useQuery({ queryKey: [...k.profiles, uid()], queryFn: q.listProfiles });
};
export const useServiceHistory = () => {
  const q = useQ();
  return useQuery({ queryKey: [...k.history, uid()], queryFn: q.listServiceHistory });
};
export const useDocuments = () => {
  const q = useQ();
  return useQuery({ queryKey: [...k.documents, uid()], queryFn: q.listDocuments });
};
export const useEvents = (stationId?: string) => {
  const q = useQ();
  return useQuery({ queryKey: [...k.events(stationId ?? ""), uid()], queryFn: () => q.listEvents(stationId!), enabled: !!stationId });
};
export const useStationHistory = (stationId: string | undefined, range: RangeKey) => {
  const q = useQ();
  return useQuery({ queryKey: ["stationHistory", stationId, range, uid()], queryFn: () => q.getStationHistory(stationId!, range), enabled: !!stationId, staleTime: 5 * 60_000 });
};
export const useModuleHistory = (moduleId: string | undefined, range: RangeKey) => {
  const q = useQ();
  return useQuery({ queryKey: ["moduleHistory", moduleId, range, uid()], queryFn: () => q.getModuleHistory(moduleId!, range), enabled: !!moduleId, staleTime: 5 * 60_000 });
};
export const usePowerSeries = (stationId?: string) => {
  const q = useQ();
  return useQuery({ queryKey: ["power", stationId, uid()], queryFn: () => q.getPowerSeries(stationId!), enabled: !!stationId, refetchInterval: 60_000 });
};
export const useDaily = (stationId: string | undefined, from: string, to: string) => {
  const q = useQ();
  return useQuery({ queryKey: ["daily", stationId, from, to, uid()], queryFn: () => q.getDaily(stationId!, from, to), enabled: !!stationId, staleTime: 5 * 60_000 });
};
export const useRawTelemetry = (stationId?: string, limit = 200) => {
  const q = useQ();
  return useQuery({ queryKey: ["raw", stationId, limit, uid()], queryFn: () => q.getRawTelemetry(stationId!, limit), enabled: !!stationId });
};

// ---------------------------------------------------------------- simulation flag
export function useSimulating() {
  const { realtime, simulation } = useServices();
  return useSyncExternalStore(
    (cb) => realtime.onChange((t) => t === "simulation" && cb()),
    () => simulation.isSimulating(),
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
  const { realtime, queries } = useServices();
  useEffect(() => {
    if (!user) return;
    const offChange = realtime.onChange((topic) => {
      if (topic.startsWith("alert-new:")) {
        const id = topic.slice("alert-new:".length);
        qc.invalidateQueries({ queryKey: k.alerts });
        setTimeout(async () => {
          const alerts = await queries.listAlerts();
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
    const offLive = realtime.subscribeLive(({ snapshot, modules }) => {
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
  }, [qc, user, realtime, queries]);
}

// ---------------------------------------------------------------- fleet overview (derived)
export function useFleet() {
  const { clock } = useServices();
  const stations = useStations();
  const customers = useCustomers();
  const snapshots = useSnapshots();
  const alerts = useAlerts();
  const rows = useMemo(
    () => buildFleetRows(stations.data ?? [], customers.data ?? [], snapshots.data ?? {}, alerts.data ?? [], clock.now()),
    [stations.data, customers.data, snapshots.data, alerts.data, clock],
  );
  return { rows, isLoading: stations.isLoading || snapshots.isLoading || alerts.isLoading };
}
