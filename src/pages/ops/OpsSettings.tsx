import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { LanguageCard, NotificationsCard } from "@/pages/owner/OwnerSettings";
import { api } from "@/lib/api";

export function OpsSettings() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <PageHeader title={t("settings.title")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <LanguageCard />
        <NotificationsCard />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.integration")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            {t("settings.backend")}: <b>{api.mode === "demo" ? t("settings.backendDemo") : "Supabase"}</b>
          </p>
          <p className="text-muted-foreground">{t("settings.ingestInfo")}</p>
          <pre className="overflow-x-auto rounded-xl bg-brand-900 p-3 text-[11px] text-brand-100">{`POST /functions/v1/ingest
x-device-key: <station gateway key>
{ "station_serial": "ARM-S30-2025-0101", "ts": "…", "soc": 64.2,
  "mode": "charging", "pv_kw": 6.1, "load_kw": 1.4, "grid_kw": 0, "battery_kw": 4.7,
  "coolant_in_temp": 22.1, "coolant_out_temp": 25.3,
  "systems": { "pump": {…}, "fire": {…}, "inverter": {…}, … },
  "modules": [ { "row": 1, "slot": 1, "soh": 94.2, "temperature": 27.4, … } ] }`}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
