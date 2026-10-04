import { AlertTriangle, CheckCircle2, Info, WifiOff, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { HealthLabel, Severity, StationStatus } from "@/lib/types";
import type { Tone } from "@/lib/status";

const ICON: Record<Tone, typeof CheckCircle2> = { ok: CheckCircle2, warn: AlertTriangle, crit: XCircle, info: Info, muted: WifiOff };
const VARIANT: Record<Tone, "ok" | "warn" | "crit" | "info" | "muted"> = { ok: "ok", warn: "warn", crit: "crit", info: "info", muted: "muted" };

/** Colour + icon + text, so status never depends on colour alone. */
export function ToneBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  const Icon = ICON[tone];
  return (
    <Badge variant={VARIANT[tone]} className={className}>
      <Icon aria-hidden />
      {children}
    </Badge>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const { t } = useTranslation();
  const tone: Tone = severity === "critical" ? "crit" : severity === "warning" ? "warn" : "info";
  return <ToneBadge tone={tone}>{t(`severity.${severity}`)}</ToneBadge>;
}

export function HealthBadge({ health, className }: { health: HealthLabel; className?: string }) {
  const { t } = useTranslation();
  const tone: Tone = health === "good" ? "ok" : health === "attention" ? "warn" : "crit";
  return (
    <ToneBadge tone={tone} className={className}>
      {t(`health.${health}`)}
    </ToneBadge>
  );
}

export function StationStatusBadge({ status }: { status: StationStatus }) {
  const { t } = useTranslation();
  const tone: Tone = status === "ok" ? "ok" : status === "warning" ? "warn" : status === "critical" ? "crit" : "muted";
  return <ToneBadge tone={tone}>{t(`stationStatus.${status}`)}</ToneBadge>;
}
