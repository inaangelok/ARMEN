import { useTranslation } from "react-i18next";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, GRID, TOOLTIP_STYLE } from "@/presentation/components/charts/ChartCard";
import { num, time } from "@/presentation/lib/format";
import type { PowerPoint } from "@/application/ports/backend";

/** Today's power flows (kW) with battery SOC (%) on the right axis. */
export function PowerChart({ data }: { data: PowerPoint[] }) {
  const { t } = useTranslation();
  const names: Record<string, string> = { pv: t("dashboard.solar"), load: t("dashboard.home"), grid: t("dashboard.grid"), battery: t("dashboard.battery"), soc: "SOC" };
  return (
    <ResponsiveContainer>
      <ComposedChart data={data} margin={{ top: 6, right: 0, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="ts" tickFormatter={(v) => time(v)} tick={AXIS} minTickGap={40} />
        <YAxis yAxisId="kw" tick={AXIS} tickFormatter={(v) => num(v, 1)} />
        <YAxis yAxisId="soc" orientation="right" domain={[0, 100]} tick={AXIS} width={34} tickFormatter={(v) => `${v}%`} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => time(String(v))} formatter={(v: number, n: string) => [n === "soc" ? `${num(v, 0)}%` : `${num(v, 2)} ${t("units.kw")}`, names[n] ?? n]} />
        <Legend formatter={(v: string) => <span className="text-xs text-foreground">{names[v] ?? v}</span>} iconSize={10} />
        <Area yAxisId="kw" type="monotone" dataKey="pv" stroke="#E3A008" fill="#FDF3D0" strokeWidth={2} isAnimationActive={false} />
        <Line yAxisId="kw" type="monotone" dataKey="load" stroke="#22382F" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line yAxisId="kw" type="monotone" dataKey="battery" stroke="#1F8A4C" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <Line yAxisId="kw" type="monotone" dataKey="grid" stroke="#6366F1" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <Line yAxisId="soc" type="monotone" dataKey="soc" stroke="#94A3B8" strokeDasharray="4 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
