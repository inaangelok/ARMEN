import { Droplets, Timer, Waves } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/PageHeader";
import { SystemsPanel } from "@/components/SystemsPanel";
import { FireInstructions } from "@/components/FireInstructions";
import { useSnapshots } from "@/hooks/data";
import { useCurrentStation } from "@/hooks/useCurrentStation";
import { useThresholds } from "@/hooks/useThresholds";

export function SuppressionInfo() {
  const { t } = useTranslation();
  const items = [
    { icon: Droplets, value: "50–55 L", label: t("safety.waterVolume") },
    { icon: Timer, value: "≈ 50 s", label: t("safety.floodTime") },
    { icon: Waves, value: "60 L/min", label: t("safety.flowRate") },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("safety.suppressionTitle")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("safety.suppressionDesc")}</p>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-2">
        {items.map((i) => (
          <div key={i.label} className="rounded-xl bg-muted p-3 text-center">
            <i.icon className="mx-auto h-5 w-5 text-info" aria-hidden />
            <div className="tabular mt-1 font-bold">{i.value}</div>
            <div className="text-xs text-muted-foreground">{i.label}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function OwnerSafety() {
  const { t } = useTranslation();
  const { station } = useCurrentStation();
  const snaps = useSnapshots();
  const th = useThresholds();
  const snap = station ? snaps.data?.[station.id] : undefined;
  return (
    <div className="space-y-4">
      <PageHeader title={t("safety.title")} subtitle={t("safety.subtitle")} />
      {snap ? <SystemsPanel snap={snap} coolantWarn={th.coolantWarn} /> : <Skeleton className="h-64" />}
      <FireInstructions />
      <SuppressionInfo />
      <Card>
        <CardHeader>
          <CardTitle>{t("safety.tipsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            {(["t1", "t2", "t3", "t4"] as const).map((k) => (
              <li key={k}>{t(`safety.${k}`)}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
