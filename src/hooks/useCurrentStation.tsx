import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useStations } from "./data";
import type { Station } from "@/lib/types";

const KEY = "armen-care-station";
const Ctx = createContext<{ station: Station | undefined; stations: Station[]; setStationId: (id: string) => void; loading: boolean } | null>(null);

const read = () => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export function CurrentStationProvider({ children }: { children: ReactNode }) {
  const q = useStations();
  const [id, setId] = useState<string | null>(read);
  const stations = q.data ?? [];
  const station = stations.find((s) => s.id === id) ?? stations[0];
  useEffect(() => {
    if (station && station.id !== id) setId(station.id);
  }, [station, id]);
  const setStationId = (v: string) => {
    setId(v);
    try {
      window.localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
  };
  return <Ctx.Provider value={{ station, stations, setStationId, loading: q.isLoading }}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCurrentStation() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCurrentStation outside provider");
  return v;
}
