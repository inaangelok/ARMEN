import { DoorClosed, Droplets, Fan, Flame, Plug, Thermometer, Waves, Wifi, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/presentation/components/ui/card";
import { ToneBadge } from "@/presentation/components/StatusBadge";
import { num } from "@/presentation/lib/format";
import type { Tone } from "@/presentation/lib/tone";
import type { StationSnapshot } from "@/domain/model";

function Row({ icon, label, value, tone, status }: { icon: React.ReactNode; label: string; value?: React.ReactNode; tone: Tone; status: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-brand-600">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        {value && <div className="tabular text-xs text-muted-foreground">{value}</div>}
      </div>
      <ToneBadge tone={tone}>{status}</ToneBadge>
    </div>
  );
}

/** Cooling, fire suppression, DC isolator, inverter (PCS), transformer, communication. */
export function SystemsPanel({ snap, coolantWarn = 35 }: { snap: StationSnapshot; coolantWarn?: number }) {
  const { t } = useTranslation();
  const s = snap.systems;
  const pumpTone: Tone = s.pump.status === "ok" ? "ok" : s.pump.status === "off" ? "warn" : "crit";
  const coolTone: Tone = snap.coolant_out_temp > coolantWarn + 7 ? "crit" : snap.coolant_out_temp > coolantWarn ? "warn" : "ok";
  const fireTone: Tone = s.fire.state === "armed" && s.fire.pressure_bar >= 2 ? "ok" : "crit";
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Waves className="h-5 w-5 text-info" aria-hidden /> {t("systems.cooling")}
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <Row icon={<Fan className="h-5 w-5" />} label={t("systems.pump")} value={`${t("systems.flow")}: ${num(s.pump.flow_lpm, 1)} L/min`} tone={pumpTone} status={t(`systems.pumpState.${s.pump.status}`)} />
          <Row icon={<Thermometer className="h-5 w-5" />} label={t("systems.coolantIn")} value={`${num(snap.coolant_in_temp, 1)} °C`} tone={snap.coolant_in_temp > 30 ? "warn" : "ok"} status={snap.coolant_in_temp > 30 ? t("systems.high") : t("systems.normal")} />
          <Row icon={<Thermometer className="h-5 w-5" />} label={t("systems.coolantOut")} value={`${num(snap.coolant_out_temp, 1)} °C · Δ ${num(snap.coolant_out_temp - snap.coolant_in_temp, 1)} °C`} tone={coolTone} status={coolTone === "ok" ? t("systems.normal") : t("systems.high")} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-crit" aria-hidden /> {t("systems.fire")}
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <Row icon={<Flame className="h-5 w-5" />} label={t("systems.fireState")} value={t("systems.fireDesc")} tone={s.fire.state === "armed" ? "ok" : "crit"} status={t(`systems.fireStates.${s.fire.state}`)} />
          <Row icon={<Droplets className="h-5 w-5" />} label={t("systems.waterPressure")} value={`${num(s.fire.pressure_bar, 2)} bar (${t("systems.min")} 2.0)`} tone={fireTone} status={s.fire.pressure_bar >= 2 ? t("systems.normal") : t("systems.low")} />
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-solar" aria-hidden /> {t("systems.power")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-8 divide-y md:grid-cols-2 md:divide-y-0">
          <Row icon={<DoorClosed className="h-5 w-5" />} label={t("systems.dcIsolator")} value={t("systems.dcIsolatorDesc")} tone={s.dc_isolator === "closed" ? "ok" : "warn"} status={t(`systems.isolator.${s.dc_isolator}`)} />
          <Row icon={<Zap className="h-5 w-5" />} label={t("systems.inverter")} value={`${num(s.inverter.temp_c, 1)} °C${s.inverter.code ? ` · ${s.inverter.code}` : ""}`} tone={s.inverter.state === "ok" ? "ok" : s.inverter.state === "standby" ? "warn" : "crit"} status={t(`systems.inverterState.${s.inverter.state}`)} />
          <Row icon={<Plug className="h-5 w-5" />} label={t("systems.transformer")} value={`${num(s.transformer.temp_c, 1)} °C`} tone={s.transformer.state === "ok" ? "ok" : "warn"} status={s.transformer.state === "ok" ? t("systems.normal") : t("systems.high")} />
          <Row icon={<Wifi className="h-5 w-5" />} label={t("systems.comm")} value="CAN · Modbus TCP" tone={s.comm === "online" ? "ok" : "crit"} status={t(`systems.commState.${s.comm}`)} />
        </CardContent>
      </Card>
    </div>
  );
}
