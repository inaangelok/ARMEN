import { useMemo, useRef, useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/PageHeader";
import { ChartCard, AXIS, GRID, TOOLTIP_STYLE } from "@/components/charts/ChartCard";
import { Wordmark } from "@/components/Logo";
import { useCustomers, useDaily } from "@/hooks/data";
import { useCurrentStation } from "@/hooks/useCurrentStation";
import { amd, kwh, monthLabel, num, pct, shortDay } from "@/lib/format";
import { exportNodeToPdf } from "@/lib/pdf";
import { SIZE_SPECS } from "@/lib/sim/model";
import type { Station } from "@/lib/types";

function months(station: Station) {
  const out: { key: string; from: string; to: string; date: Date }[] = [];
  const now = new Date();
  const install = new Date(station.install_date);
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    if (end < install) break;
    out.push({ key: d.toISOString().slice(0, 7), from: d.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), date: d });
  }
  return out;
}

export function EnergyReport({ station }: { station: Station }) {
  const { t, i18n } = useTranslation();
  const opts = useMemo(() => months(station), [station]);
  const [key, setKey] = useState(opts[1]?.key ?? opts[0]?.key);
  const m = opts.find((o) => o.key === key) ?? opts[0];
  const daily = useDaily(station.id, m.from, m.to);
  const customers = useCustomers();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const d = daily.data ?? [];
  let cum = 0;
  const data = d.map((x) => ({ ...x, export_neg: -x.grid_export_kwh, cum: (cum += x.savings_amd) }));
  const sum = (k: keyof (typeof d)[number]) => d.reduce((a, x) => a + Number(x[k]), 0);
  const solar = sum("solar_kwh"), exp = sum("grid_export_kwh");
  const totals = {
    solar, stored: sum("charged_kwh"), used: sum("discharged_kwh"), imp: sum("grid_import_kwh"), exp, load: sum("load_kwh"),
    self: solar > 0 ? ((solar - exp) / solar) * 100 : 0, savings: sum("savings_amd"),
  };
  const autarky = totals.load > 0 ? ((totals.load - totals.imp) / totals.load) * 100 : 0;
  const download = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      await exportNodeToPdf(ref.current, `ARMEN-report-${station.serial}-${m.key}.pdf`);
    } catch {
      toast.error(t("reports.pdfFailed"));
    } finally {
      setBusy(false);
    }
  };
  const customer = customers.data?.find((c) => c.id === station.customer_id);
  const kwhFmt = (v: number) => [`${num(v, 1)} ${t("units.kwh")}`];
  return (
    <div>
      <PageHeader
        title={t("reports.title")}
        subtitle={t("reports.subtitle")}
        actions={
          <>
            <NativeSelect value={key} onChange={(e) => setKey(e.target.value)} aria-label={t("reports.month")} className="w-48">
              {opts.map((o) => (
                <option key={o.key} value={o.key}>
                  {monthLabel(o.date)}
                </option>
              ))}
            </NativeSelect>
            {import.meta.env.MODE !== "singlefile" && (
              <Button variant="outline" onClick={() => window.print()} className="no-print">
                <Printer /> {t("reports.print")}
              </Button>
            )}
            <Button onClick={download} disabled={busy || daily.isLoading} className="no-print">
              {busy ? <Loader2 className="animate-spin" /> : <Download />} {t("reports.downloadPdf")}
            </Button>
          </>
        }
      />
      <div ref={ref} className="space-y-4 bg-background p-1" lang={i18n.language}>
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <Wordmark />
          <div className="text-right text-sm">
            <div className="font-bold">
              {t("reports.monthlyReport")} — {monthLabel(m.date)}
            </div>
            <div className="text-muted-foreground">
              {station.name} · {customer?.name} · {SIZE_SPECS[station.size].model} · {station.serial}
            </div>
          </div>
        </Card>
        {daily.isLoading ? (
          <Skeleton className="h-96" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                [t("reports.solar"), kwh(totals.solar, 0)],
                [t("reports.stored"), kwh(totals.stored, 0)],
                [t("reports.selfConsumption"), pct(totals.self)],
                [t("reports.savings"), amd(totals.savings)],
                [t("reports.used"), kwh(totals.used, 0)],
                [t("reports.gridImport"), kwh(totals.imp, 0)],
                [t("reports.gridExport"), kwh(totals.exp, 0)],
                [t("reports.autarky"), pct(autarky)],
              ].map(([label, value]) => (
                <Card key={label} className="p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
                  <div className="tabular mt-1 text-xl font-extrabold">{value}</div>
                </Card>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ChartCard title={t("reports.storedVsUsed")} subtitle={t("units.kwh")}>
                <ResponsiveContainer>
                  <BarChart data={data} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="day" tickFormatter={shortDay} tick={AXIS} minTickGap={16} />
                    <YAxis tick={AXIS} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => shortDay(String(v))} formatter={(v: number) => kwhFmt(v)} />
                    <Legend iconSize={10} formatter={(v) => <span className="text-xs text-foreground">{v === "charged_kwh" ? t("reports.stored") : t("reports.used")}</span>} />
                    <Bar dataKey="charged_kwh" fill="#1F8A4C" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="discharged_kwh" fill="#7FA894" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title={t("reports.solarSelf")} subtitle={`${t("units.kwh")} · %`}>
                <ResponsiveContainer>
                  <ComposedChart data={data} margin={{ top: 6, right: 0, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="day" tickFormatter={shortDay} tick={AXIS} minTickGap={16} />
                    <YAxis yAxisId="k" tick={AXIS} />
                    <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tick={AXIS} width={34} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => shortDay(String(v))} formatter={(v: number, n) => (n === "self_consumption_pct" ? [`${num(v, 0)}%`, t("reports.selfConsumption")] : [`${num(v, 1)} ${t("units.kwh")}`, t("reports.solar")])} />
                    <Bar yAxisId="k" dataKey="solar_kwh" fill="#F5D46B" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Line yAxisId="p" dataKey="self_consumption_pct" stroke="#C77700" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title={t("reports.gridFlows")} subtitle={t("reports.gridFlowsSub")}>
                <ResponsiveContainer>
                  <BarChart data={data} stackOffset="sign" margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="day" tickFormatter={shortDay} tick={AXIS} minTickGap={16} />
                    <YAxis tick={AXIS} />
                    <ReferenceLine y={0} stroke="#94A3B8" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => shortDay(String(v))} formatter={(v: number, n) => [`${num(Math.abs(v), 1)} ${t("units.kwh")}`, n === "grid_import_kwh" ? t("reports.gridImport") : t("reports.gridExport")]} />
                    <Legend iconSize={10} formatter={(v) => <span className="text-xs text-foreground">{v === "grid_import_kwh" ? t("reports.gridImport") : t("reports.gridExport")}</span>} />
                    <Bar dataKey="grid_import_kwh" stackId="g" fill="#6366F1" isAnimationActive={false} />
                    <Bar dataKey="export_neg" stackId="g" fill="#A5B4FC" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title={t("reports.cumSavings")} subtitle="֏">
                <ResponsiveContainer>
                  <AreaChart data={data} margin={{ top: 6, right: 6, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="day" tickFormatter={shortDay} tick={AXIS} minTickGap={16} />
                    <YAxis tick={AXIS} tickFormatter={(v) => num(v / 1000, 0) + "k"} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => shortDay(String(v))} formatter={(v: number) => [amd(v), t("reports.savings")]} />
                    <Area dataKey="cum" stroke="#22382F" fill="#D6E4DD" strokeWidth={2} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
            <p className="text-xs text-muted-foreground">{t("reports.method", { tariff: station.tariff_amd, export: station.export_tariff_amd })}</p>
          </>
        )}
      </div>
    </div>
  );
}

export function OwnerReports() {
  const { station } = useCurrentStation();
  if (!station) return <Skeleton className="h-96" />;
  return <EnergyReport key={station.id} station={station} />;
}
