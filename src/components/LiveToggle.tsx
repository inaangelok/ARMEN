import { Radio } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useSimulating, useStations } from "@/hooks/data";
import { cn } from "@/lib/utils";

/** "Simulate live data" — streams new telemetry every few seconds for demos. */
export function LiveToggle({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const on = useSimulating();
  const stations = useStations();
  return (
    <label className={cn("flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold", on ? "border-ok/40 bg-ok-soft text-ok-fg" : "bg-background text-muted-foreground")}>
      <Radio className={cn("h-4 w-4", on && "animate-pulse")} aria-hidden />
      <span className={cn(compact && "hidden sm:inline")}>{on ? t("live.on") : t("live.simulate")}</span>
      <Switch checked={on} onCheckedChange={(v) => api.setSimulation(v, (stations.data ?? []).map((s) => s.id))} aria-label={t("live.simulate")} className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span[data-state=checked]]:translate-x-4" />
    </label>
  );
}
