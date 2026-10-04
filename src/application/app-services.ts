import type { Backend, BackendInfo, Clock, PushRegistrar, RealtimePort, SimulationPort } from "./ports";
import { makeAuthUseCases } from "./use-cases/auth";
import { makeAlertUseCases } from "./use-cases/alerts";
import { makeWorkOrderUseCases } from "./use-cases/work-orders";
import { makeModuleUseCases } from "./use-cases/modules";
import { makeStationUseCases } from "./use-cases/stations";
import { makeUserUseCases } from "./use-cases/users";

/** Read side: plain queries straight from the read ports (no business rules involved). */
function makeQueries(b: Backend) {
  return {
    listStations: () => b.listStations(),
    listCustomers: () => b.listCustomers(),
    getSnapshots: () => b.getSnapshots(),
    getModuleReadings: (stationId: string) => b.getModuleReadings(stationId),
    getStationHistory: (...a: Parameters<Backend["getStationHistory"]>) => b.getStationHistory(...a),
    getModuleHistory: (...a: Parameters<Backend["getModuleHistory"]>) => b.getModuleHistory(...a),
    getPowerSeries: (stationId: string) => b.getPowerSeries(stationId),
    getDaily: (...a: Parameters<Backend["getDaily"]>) => b.getDaily(...a),
    getRawTelemetry: (stationId: string, limit: number) => b.getRawTelemetry(stationId, limit),
    listModules: () => b.listModules(),
    listAssignments: () => b.listAssignments(),
    listAlerts: () => b.listAlerts(),
    listRules: () => b.listRules(),
    listWorkOrders: () => b.listWorkOrders(),
    listChecklist: (workOrderId: string) => b.listChecklist(workOrderId),
    listProfiles: () => b.listProfiles(),
    listServiceHistory: () => b.listServiceHistory(),
    listDocuments: () => b.listDocuments(),
    listEvents: (stationId: string) => b.listEvents(stationId),
  };
}

function makeCommands(b: Backend, clock: Clock, push: PushRegistrar) {
  return {
    auth: makeAuthUseCases(b, push, b),
    alerts: makeAlertUseCases(b),
    workOrders: makeWorkOrderUseCases(b, b, clock),
    modules: makeModuleUseCases(b),
    stations: makeStationUseCases(b, b, clock),
    users: makeUserUseCases(b),
  };
}

export interface AppServices {
  info: BackendInfo;
  clock: Clock;
  queries: ReturnType<typeof makeQueries>;
  commands: ReturnType<typeof makeCommands>;
  realtime: RealtimePort;
  simulation: Pick<SimulationPort, "isSimulating">;
}

/** Builds the application from one backend adapter plus platform services. */
export function createAppServices(deps: { backend: Backend; clock: Clock; push: PushRegistrar }): AppServices {
  const { backend, clock, push } = deps;
  return {
    info: { mode: backend.mode, demoAccounts: backend.demoAccounts },
    clock,
    queries: makeQueries(backend),
    commands: makeCommands(backend, clock, push),
    realtime: { subscribeLive: (cb) => backend.subscribeLive(cb), onChange: (cb) => backend.onChange(cb) },
    simulation: { isSimulating: () => backend.isSimulating() },
  };
}
