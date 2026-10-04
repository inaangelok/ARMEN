import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartCard, AXIS, GRID, TOOLTIP_STYLE } from "./ChartCard";
import { date, num } from "@/lib/format";
import type { HistoryPoint, RangeKey } from "@/lib/types";

export function RangeTabs({ value, onChange }: { value: RangeKey; onChange: (r: RangeKey) => void }) {
  const { t } = useTranslation();
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as RangeKey)}>
      <TabsList>
        <TabsTrigger value="7d">{t("range.7d")}</TabsTrigger>
        <TabsTrigger value="30d">{t("range.30d")}</TabsTrigger>
        <TabsTrigger value="12m">{t("range.12m")}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export function useRange(initial: RangeKey = "30d") {
  return useState<RangeKey>(initial);
}

const tickFmt = (range: RangeKey) => (v: string) => date(v, range === "7d" ? "EEE" : range === "30d" ? "d MMM" : "MMM");

interface Props {
  data: HistoryPoint[] | undefined;
  loading: boolean;
  range: RangeKey;
  thresholds?: { tempWarn?: number; spreadWarn?: number; sohWarn?: number };
  showCycles?: boolean;
}

/** SOH trend, cycle count, temperature and cell-voltage spread for a station or a module. */
export function HistoryCharts({ data, loading, range, thresholds = {}, showCycles = true }: Props) {
  const { t } = useTranslation();
  const d = data ?? [];
  const tf = tickFmt(range);
  const label = (v: string) => date(v, range === "12m" ? "d MMM yyyy" : "d MMM, HH:mm");
  const sohMin = d.length ? Math.floor(Math.min(...d.map((p) => p.soh)) - 1) : 70;
  const sohMax = d.length ? Math.ceil(Math.max(...d.map((p) => p.soh)) + 0.5) : 100;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ChartCard title={t("charts.sohTrend")} subtitle="%" loading={loading}>
        <ResponsiveContainer>
          <LineChart data={d} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="ts" tickFormatter={tf} tick={AXIS} minTickGap={28} />
            <YAxis domain={[sohMin, sohMax]} tick={AXIS} allowDecimals tickFormatter={(v) => num(v, sohMax - sohMin <= 4 ? 1 : 0)} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={label} formatter={(v: number) => [`${num(v, 2)}%`, "SOH"]} />
            {thresholds.sohWarn && thresholds.sohWarn > sohMin && <ReferenceLine y={thresholds.sohWarn} stroke="#C77700" strokeDasharray="4 4" />}
            <Line type="monotone" dataKey="soh" stroke="#22382F" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      {showCycles && (
        <ChartCard title={t("charts.cycles")} subtitle={t("charts.cyclesSub")} loading={loading}>
          <ResponsiveContainer>
            <AreaChart data={d} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="ts" tickFormatter={tf} tick={AXIS} minTickGap={28} />
              <YAxis tick={AXIS} domain={["dataMin - 2", "dataMax + 2"]} tickFormatter={(v) => num(v, 0)} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={label} formatter={(v: number) => [num(v, 1), t("charts.cycles")]} />
              <Area type="monotone" dataKey="cycles" stroke="#36604F" fill="#D6E4DD" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
      <ChartCard title={t("charts.temperature")} subtitle="°C" loading={loading}>
        <ResponsiveContainer>
          <LineChart data={d} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="ts" tickFormatter={tf} tick={AXIS} minTickGap={28} />
            <YAxis tick={AXIS} domain={[10, (max: number) => Math.max(50, Math.ceil(max + 2))]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={label} formatter={(v: number, n) => [`${num(v, 1)} °C`, n === "temp_max" ? t("charts.max") : t("charts.avg")]} />
            {thresholds.tempWarn && <ReferenceLine y={thresholds.tempWarn} stroke="#C77700" strokeDasharray="4 4" label={{ value: `${thresholds.tempWarn} °C`, fontSize: 10, fill: "#8A5300", position: "insideTopRight" }} />}
            <Line type="monotone" dataKey="temp_max" stroke="#C62828" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="temp_avg" stroke="#36604F" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title={t("charts.spread")} subtitle={t("charts.spreadSub")} loading={loading}>
        <ResponsiveContainer>
          <LineChart data={d} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="ts" tickFormatter={tf} tick={AXIS} minTickGap={28} />
            <YAxis tick={AXIS} domain={[0, (max: number) => Math.max(60, Math.ceil(max + 5))]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={label} formatter={(v: number) => [`${num(v, 0)} mV`, t("charts.spread")]} />
            {thresholds.spreadWarn && <ReferenceLine y={thresholds.spreadWarn} stroke="#C77700" strokeDasharray="4 4" label={{ value: `${thresholds.spreadWarn} mV`, fontSize: 10, fill: "#8A5300", position: "insideTopRight" }} />}
            <Line type="monotone" dataKey="spread_mv" stroke="#6366F1" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
