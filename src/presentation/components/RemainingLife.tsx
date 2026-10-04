import { Hourglass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/presentation/components/ui/card";
import { Skeleton } from "@/presentation/components/ui/misc";
import { estimateYearsTo80 } from "@/infrastructure/simulation/model";
import { num } from "@/presentation/lib/format";
import type { HistoryPoint } from "@/domain/model";

export function RemainingLife({ history, loading, warrantyEnd }: { history: HistoryPoint[] | undefined; loading: boolean; warrantyEnd?: string }) {
  const { t } = useTranslation();
  const pts = (history ?? []).map((p) => ({ t: Date.parse(p.ts), soh: p.soh }));
  const est = estimateYearsTo80(pts);
  const current = pts.at(-1)?.soh;
  const warrantyYears = warrantyEnd ? (Date.parse(warrantyEnd) - Date.now()) / (365.25 * 86400000) : null;
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Hourglass className="h-5 w-5 text-brand-500" aria-hidden />
        <CardTitle>{t("life.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Skeleton className="h-20" />
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <div className="tabular text-4xl font-extrabold leading-none">{est.years === null ? "15+" : num(Math.min(est.years, 25), 1)}</div>
                <div className="text-sm text-muted-foreground">{t("life.yearsTo80")}</div>
              </div>
              <div className="text-sm">
                <div>
                  <span className="text-muted-foreground">{t("life.currentSoh")}: </span>
                  <b className="tabular">{num(current, 1)}%</b>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("life.rate")}: </span>
                  <b className="tabular">{num(est.ratePerYear, 2)}% / {t("units.year")}</b>
                </div>
                {warrantyYears !== null && (
                  <div>
                    <span className="text-muted-foreground">{t("life.warrantyLeft")}: </span>
                    <b className="tabular">{num(warrantyYears, 1)} {t("units.years")}</b>
                  </div>
                )}
              </div>
            </div>
            <p className="rounded-xl bg-muted p-3 text-xs leading-relaxed text-muted-foreground">{t("life.explanation", { days: pts.length })}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
