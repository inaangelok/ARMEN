// In-memory fakes for the application ports. Use cases are tested against these, with no browser or database.
import type { AlertRule, ChecklistItem, Module, Profile, Station, WorkOrder } from "@/domain";
import type { AlertRepository, AuthPort, Clock, FileStorage, ModuleRepository, ReplaceModuleInput, SimulationPort, StationRepository, UserRepository, WorkOrderRepository } from "@/application/ports";
import { NOW, profile, station, workOrder } from "../fixtures";

export const fixedClock = (now = NOW): Clock => ({ now: () => now });

export function fakeWorkOrders(initial: WorkOrder[] = []) {
  const items = new Map(initial.map((w) => [w.id, { ...w }]));
  const created: Parameters<WorkOrderRepository["createWorkOrder"]>[0][] = [];
  const repo: WorkOrderRepository = {
    listWorkOrders: async () => [...items.values()],
    listChecklist: async () => [] as ChecklistItem[],
    createWorkOrder: async (input) => {
      created.push(input);
      const wo = workOrder({ id: `wo${items.size + 1}`, station_id: input.station_id, title: input.title, type: input.type, priority: input.priority ?? "normal" });
      items.set(wo.id, wo);
      return wo;
    },
    updateWorkOrder: async (id, patch) => {
      const next = { ...items.get(id)!, ...patch };
      items.set(id, next);
      return next;
    },
    updateChecklistItem: async () => {},
  };
  return { repo, items, created };
}

export function fakeFiles() {
  const uploads: string[] = [];
  const files: FileStorage = {
    uploadFile: async (bucket, path) => {
      uploads.push(`${bucket}/${path}`);
      return `${bucket}/${path}`;
    },
    resolveFileUrl: async (ref) => `https://files/${ref}`,
  };
  return { files, uploads };
}

export function fakeModules(registry: Module[]) {
  const replaced: ReplaceModuleInput[] = [];
  const repo: ModuleRepository = {
    listModules: async () => registry,
    listAssignments: async () => [],
    markModuleFaulty: async () => {},
    replaceModule: async (input) => {
      replaced.push(input);
    },
  };
  return { repo, replaced };
}

export function fakeAlerts() {
  const ruleUpdates: [string, Partial<AlertRule>][] = [];
  const statuses: [string, string][] = [];
  const repo: AlertRepository = {
    listAlerts: async () => [],
    setAlertStatus: async (id, s) => {
      statuses.push([id, s]);
    },
    listRules: async () => [],
    updateRule: async (id, patch) => {
      ruleUpdates.push([id, patch]);
    },
  };
  return { repo, ruleUpdates, statuses };
}

export function fakeStations(initial: Station[] = [station()]) {
  const items = new Map(initial.map((s) => [s.id, s]));
  const repo: StationRepository & SimulationPort = {
    listStations: async () => [...items.values()],
    listCustomers: async () => [],
    updateStation: async (id, patch) => {
      const next = { ...items.get(id)!, ...patch };
      items.set(id, next);
      return next;
    },
    setSimulation: () => {},
    isSimulating: () => false,
  };
  return { repo, items };
}

export function fakeAuth(me: Profile = profile()) {
  let current = { ...me };
  const auth: AuthPort = {
    getSession: async () => current,
    signIn: async () => current,
    signOut: async () => {},
    updateMyProfile: async (patch) => (current = { ...current, ...patch }),
  };
  return { auth, current: () => current };
}

export function fakeUsers() {
  const invites: Parameters<UserRepository["inviteUser"]>[0][] = [];
  const repo: UserRepository = {
    listProfiles: async () => [],
    updateProfile: async () => {},
    inviteUser: async (i) => {
      invites.push(i);
    },
  };
  return { repo, invites };
}
