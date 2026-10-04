import { createContext, useContext, type ReactNode } from "react";
import type { AppServices } from "@/application/app-services";

// The UI receives the application through context, so components never construct adapters themselves
// and tests can render them with fake services.
const Ctx = createContext<AppServices | null>(null);

export function ServicesProvider({ services, children }: { services: AppServices; children: ReactNode }) {
  return <Ctx.Provider value={services}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useServices(): AppServices {
  const s = useContext(Ctx);
  if (!s) throw new Error("useServices outside ServicesProvider");
  return s;
}
