import { Battery, Home, Sun, UtilityPole } from "lucide-react";
import { useTranslation } from "react-i18next";
import { kw } from "@/lib/format";
import type { StationSnapshot } from "@/lib/types";

const TH = 0.05;

function Flow({ d, active, reverse, color }: { d: string; active: boolean; reverse?: boolean; color: string }) {
  return (
    <>
      <path d={d} fill="none" stroke="hsl(var(--border))" strokeWidth="4" strokeLinecap="round" />
      {active && (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="6 6"
          className="animate-flow-dash motion-reduce:animate-none"
          style={{ animationDirection: reverse ? "reverse" : "normal" }}
        />
      )}
    </>
  );
}

function Node({ x, y, icon, label, value, sub, color }: { x: number; y: number; icon: React.ReactNode; label: string; value: string; sub?: string; color: string }) {
  return (
    <foreignObject x={x - 62} y={y - 46} width="124" height="104">
      <div className="flex h-full flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 bg-background shadow-sm" style={{ borderColor: color, color }}>
          {icon}
        </div>
        <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="tabular text-sm font-bold leading-tight">{value}</div>
        {sub && <div className="text-[11px] leading-tight text-muted-foreground">{sub}</div>}
      </div>
    </foreignObject>
  );
}

/** Solar → Battery → Home ↔ Grid with live kW values and animated flow direction. */
export function PowerFlow({ snap }: { snap: StationSnapshot }) {
  const { t } = useTranslation();
  const pv = snap.pv_kw;
  const bat = snap.battery_kw;
  const grid = snap.grid_kw;
  const pvToHome = pv > TH;
  const batteryCharging = bat > TH;
  const batteryDischarging = bat < -TH;
  const importing = grid > TH;
  const exporting = grid < -TH;
  // layout: Solar top, Battery left, Home centre-right, Grid right
  return (
    <svg viewBox="0 0 360 292" className="h-auto w-full max-w-md" role="img" aria-label={t("dashboard.powerFlow")}>
      <Flow d="M180 96 L180 162" active={pvToHome} color="#E3A008" />
      <Flow d="M180 170 L95 170" active={batteryCharging || batteryDischarging} reverse={batteryDischarging} color="#1F8A4C" />
      <Flow d="M180 170 L265 170" active={importing || exporting} reverse={importing} color="#6366F1" />
      <Flow d="M180 170 L180 196" active={snap.load_kw > TH} color="#22382F" />
      <circle cx="180" cy="170" r="7" fill="#22382F" />
      <Node x={180} y={48} color="#E3A008" icon={<Sun className="h-6 w-6" />} label={t("dashboard.solar")} value={kw(pv)} />
      <Node
        x={60}
        y={166}
        color="#1F8A4C"
        icon={<Battery className="h-6 w-6" />}
        label={t("dashboard.battery")}
        value={kw(Math.abs(bat))}
        sub={batteryCharging ? t("flow.charging") : batteryDischarging ? t("flow.discharging") : t("flow.idle")}
      />
      <Node
        x={300}
        y={166}
        color="#6366F1"
        icon={<UtilityPole className="h-6 w-6" />}
        label={t("dashboard.grid")}
        value={kw(Math.abs(grid))}
        sub={snap.mode === "backup" ? t("flow.outage") : importing ? t("flow.import") : exporting ? t("flow.export") : t("flow.idle")}
      />
      <Node x={180} y={244} color="#22382F" icon={<Home className="h-6 w-6" />} label={t("dashboard.home")} value={kw(snap.load_kw)} />
    </svg>
  );
}
