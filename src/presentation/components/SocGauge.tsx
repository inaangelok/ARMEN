import { useTranslation } from "react-i18next";
import { num } from "@/presentation/lib/format";

/** Large semicircular state-of-charge gauge. */
export function SocGauge({ soc, size = 240 }: { soc: number; size?: number }) {
  const { t } = useTranslation();
  const r = 90;
  const c = Math.PI * r;
  const v = Math.max(0, Math.min(100, soc));
  const color = v < 15 ? "#C62828" : v < 30 ? "#C77700" : "#1F8A4C";
  return (
    <div className="relative mx-auto" style={{ width: size, height: size * 0.62 }} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={t("dashboard.soc")}>
      <svg viewBox="0 0 220 130" className="h-full w-full">
        <path d="M20 115 A90 90 0 0 1 200 115" fill="none" stroke="hsl(var(--muted))" strokeWidth="18" strokeLinecap="round" />
        <path
          d="M20 115 A90 90 0 0 1 200 115"
          fill="none"
          stroke={color}
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
          style={{ transition: "stroke-dasharray .8s ease, stroke .5s" }}
        />
        {[0, 25, 50, 75, 100].map((p) => {
          const a = Math.PI * (1 - p / 100);
          return <line key={p} x1={110 + 72 * Math.cos(a)} y1={115 - 72 * Math.sin(a)} x2={110 + 66 * Math.cos(a)} y2={115 - 66 * Math.sin(a)} stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" opacity=".5" />;
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="tabular text-5xl font-extrabold leading-none tracking-tight sm:text-6xl">
          {num(v, 0)}
          <span className="text-2xl font-bold text-muted-foreground">%</span>
        </span>
        <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("dashboard.soc")}</span>
      </div>
    </div>
  );
}
