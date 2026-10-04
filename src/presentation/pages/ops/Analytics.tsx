import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/presentation/components/ui/card";
import { PageHeader } from "@/presentation/components/PageHeader";
import { ChartCard, AXIS, GRID, TOOLTIP_STYLE } from "@/presentation/components/charts/ChartCard";
import { useAlerts, useStations, useWorkOrders } from "@/presentation/hooks/data";
import { useServices } from "@/presentation/providers/services";
import { estimateYearsTo80 } from "@/domain";
import { num } from "@/presentation/lib/format";
import { format } from "date-fns";

export function Analytics() {
  const { t } = useTranslation();
  const { queries } = useServices();
  const stations = useStations();
  const alerts = useAlerts();
  const wos = useWorkOrders();
  const histories = useQueries({ queries: (stations.data ?? []).map((s) => ({ queryKey: ["stationHistory", s.id, "12m", "analytics"], queryFn: () => queries.getStationHistory(s.id, "12m"), staleTime: 10 * 60_000 })) });
  const loading = histories.some((h) => h.isLoading) || stations.isLoading;

  const { trend, degradation, perStation, avgNow } = useMemo(() => {
    const byMonth = new Map<string, number[]>();
    const perStation: { name: string; soh: number; rate: number; years: number | null }[] = [];
    histories.forEach((h, i) => {
      const st = stations.data?.[i];
      if (!h.data?.length || !st) return;
      for (const p of h.data) {
        const m = p.ts.slice(0, 7);
        (byMonth.get(m) ?? byMonth.set(m, []).get(m)!).push(p.soh);
      }
      const est = estimateYearsTo80(h.data.map((p) => ({ t: Date.parse(p.ts), soh: p.soh })));
      perStation.push({ name: st.name, soh: h.data[h.data.length - 1].soh, rate: est.ratePerYear, years: est.years });
    });
    const months = [...byMonth.keys()].sort();
    const trend = months.map((m) => ({ month: m, soh: byMonth.get(m)!.reduce((a, b) => a + b, 0) / byMonth.get(m)!.length }));
    // per-month degradation: average drop within each station-month
    const degr = new Map<string, number[]>();
    histories.forEach((h) => {
      const perM = new Map<string, { first: number; last: number }>();
      for (const p of h.data ?? []) {
        const m = p.ts.slice(0, 7);
        const e = perM.get(m);
        if (!e) perM.set(m, { first: p.soh, last: p.soh });
        else e.last = p.soh;
      }
      perM.forEach((v, m) => (degr.get(m) ?? degr.set(m, []).get(m)!).push(v.first - v.last));
    });
    const degradation = [...degr.keys()].sort().slice(-12).map((m) => ({ month: m, drop: degr.get(m)!.reduce((a, b) => a + b, 0) / degr.get(m)!.length }));
    const avgNow = perStation.length ? perStation.reduce((a, s) => a + s.soh, 0) / perStation.length : 0;
    return { trend, degradation, perStation: perStation.sort((a, b) => a.soh - b.soh), avgNow };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histories.map((h) => h.dataUpdatedAt).join(), stations.data]);

  const yearAgo = Date.now() - 365 * 86400000;
  const faults = useMemo(() => {
    const c = new Map<string, number>();
    for (const a of alerts.data ?? []) if (a.severity !== "info" && Date.parse(a.created_at) > yearAgo) c.set(a.code, (c.get(a.code) ?? 0) + 1);
    return [...c.entries()].map(([code, count]) => ({ code, label: t(`alertCode.${code}.title` as "alertCode.SOH_LOW.title"), count })).sort((a, b) => b.count - a.count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts.data, t]);

  const repairs = (wos.data ?? []).filter((w) => w.status === "done" && w.completed_at && (w.type === "repair" || w.type === "module_replacement"));
  const mttrH = repairs.length ? repairs.reduce((a, w) => a + (Date.parse(w.completed_at!) - Date.parse(w.created_at)), 0) / repairs.length / 3600000 : 0;
  const acked = (alerts.data ?? []).filter((a) => a.acknowledged_at && a.severity !== "info");
  const mttaMin = acked.length ? acked.reduce((a, x) => a + (Date.parse(x.acknowledged_at!) - Date.parse(x.created_at)), 0) / acked.length / 60000 : 0;
  const avgRate = perStation.length ? perStation.reduce((a, s) => a + s.rate, 0) / perStation.length : 0;
  const monthFmt = (m: string) => format(new Date(m + "-01"), "MMM yy");

  const kpis = [
    { label: t("analytics.avgSoh"), value: `${num(avgNow, 1)}%`, hint: t("analytics.stationsCount", { count: perStation.length }) },
    { label: t("analytics.degradation"), value: `${num(avgRate / 12, 2)}%`, hint: t("analytics.perMonth") },
    { label: t("analytics.mttr"), value: `${num(mttrH, 1)} ${t("units.h")}`, hint: t("analytics.mttrHint", { count: repairs.length }) },
    { label: t("analytics.mtta"), value: `${num(mttaMin, 0)} ${t("units.min")}`, hint: t("analytics.mttaHint") },
  ];
  return (
    <div className="space-y-4">
      <PageHeader title={t("analytics.title")} subtitle={t("analytics.subtitle")} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k.label}</div>
            <div className="tabular mt-1 text-3xl font-extrabold">{k.value}</div>
            <div className="text-xs text-muted-foreground">{k.hint}</div>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={t("analytics.sohTrend")} subtitle="%" loading={loading} height={240}>
          <ResponsiveContainer>
            <LineChart data={trend} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="month" tickFormatter={monthFmt} tick={AXIS} />
              <YAxis tick={AXIS} domain={["dataMin - 0.5", "dataMax + 0.5"]} tickFormatter={(v) => num(v, 1)} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => monthFmt(String(v))} formatter={(v: number) => [`${num(v, 2)}%`, "SOH"]} />
              <Line dataKey="soh" stroke="#22382F" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={t("analytics.degradationPerMonth")} subtitle={t("analytics.degradationSub")} loading={loading} height={240}>
          <ResponsiveContainer>
            <BarChart data={degradation} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="month" tickFormatter={monthFmt} tick={AXIS} />
              <YAxis tick={AXIS} tickFormatter={(v) => num(v, 2)} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => monthFmt(String(v))} formatter={(v: number) => [`${num(v, 3)} %-pt`, t("analytics.degradation")]} />
              <Bar dataKey="drop" fill="#36604F" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={t("analytics.topFaults")} subtitle={t("analytics.last12m")} loading={alerts.isLoading} height={260}>
          <ResponsiveContainer>
            <BarChart data={faults} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={AXIS} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ ...AXIS, fontSize: 10 }} width={150} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v, t("analytics.occurrences")]} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {faults.map((f, i) => (
                  <Cell key={f.code} fill={i === 0 ? "#C62828" : i < 3 ? "#C77700" : "#7FA894"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={t("analytics.stationSoh")} subtitle={t("analytics.stationSohSub")} loading={loading} height={Math.max(260, perStation.length * 26)}>
          <ResponsiveContainer>
            <BarChart data={perStation} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" domain={[80, 100]} tick={AXIS} />
              <YAxis type="category" dataKey="name" tick={{ ...AXIS, fontSize: 10 }} width={150} interval={0} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, _n, p) => [`${num(v, 1)}% · ${num(p.payload.rate, 2)}%/${t("units.year")} · ${p.payload.years ? num(p.payload.years, 1) + " " + t("units.years") : "15+"} → 80%`, "SOH"]} />
              <Bar dataKey="soh" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {perStation.map((s) => (
                  <Cell key={s.name} fill={s.soh < 85 ? "#C77700" : "#1F8A4C"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
