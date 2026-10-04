import { useEffect, useState } from "react";
import { BellRing, Headphones, Mail, Phone, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/presentation/components/ui/card";
import { Label } from "@/presentation/components/ui/label";
import { Switch } from "@/presentation/components/ui/switch";
import { Skeleton } from "@/presentation/components/ui/misc";
import { PageHeader } from "@/presentation/components/PageHeader";
import { LANGS } from "@/presentation/components/LanguageSwitcher";
import { EMERGENCY } from "@/presentation/components/FireInstructions";
import { useCurrentStation } from "@/presentation/hooks/useCurrentStation";
import { api } from "@/composition-root";
import { useAuth } from "@/presentation/providers/auth";
import { enablePush } from "@/infrastructure/browser/web-push";
import { cn } from "@/presentation/lib/utils";
import type { Lang, OperatingMode, Profile } from "@/domain/model";

export function LanguageCard() {
  const { t, i18n } = useTranslation();
  const { setUser } = useAuth();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.language")}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-2">
        {LANGS.map((l) => (
          <button
            key={l.code}
            onClick={async () => {
              await i18n.changeLanguage(l.code);
              setUser(await api.updateMyProfile({ language: l.code as Lang }));
            }}
            className={cn("rounded-xl border-2 px-3 py-3 text-sm font-semibold", i18n.language === l.code ? "border-brand-700 bg-secondary" : "hover:bg-muted")}
            aria-pressed={i18n.language === l.code}
          >
            {l.label}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

export function NotificationsCard() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const [perm, setPerm] = useState<string>(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  if (!user) return null;
  const toggle = async (k: keyof Profile, v: boolean) => setUser(await api.updateMyProfile({ [k]: v } as Partial<Profile>));
  const rows: { k: keyof Profile; label: string; hint: string }[] = [
    { k: "notify_email", label: t("settings.email"), hint: t("settings.emailHint", { email: user.email }) },
    { k: "notify_push", label: t("settings.push"), hint: t("settings.pushHint") },
    { k: "notify_warning", label: t("settings.warnings"), hint: t("settings.warningsHint") },
    { k: "notify_info", label: t("settings.info"), hint: t("settings.infoHint") },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.notifications")}</CardTitle>
        <CardDescription>{t("settings.criticalAlways")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {rows.map((r) => (
          <div key={r.k} className="flex items-center justify-between gap-4 rounded-xl px-1 py-2">
            <Label htmlFor={r.k} className="cursor-pointer">
              <div>{r.label}</div>
              <div className="mt-0.5 text-xs font-normal text-muted-foreground">{r.hint}</div>
            </Label>
            <Switch id={r.k} checked={!!user[r.k]} onCheckedChange={(v) => toggle(r.k, v)} />
          </div>
        ))}
        {perm !== "granted" && perm !== "unsupported" && (
          <Button
            variant="outline"
            className="mt-2 w-full"
            onClick={async () => {
              const p = await enablePush(api.savePushSubscription);
              setPerm(p);
              if (p === "granted") toast.success(t("settings.pushEnabled"));
            }}
          >
            <BellRing /> {t("settings.enablePush")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function OperatingModeCard() {
  const { t } = useTranslation();
  const { station } = useCurrentStation();
  const [mode, setMode] = useState<OperatingMode>("self_consumption");
  const [reserve, setReserve] = useState(20);
  useEffect(() => {
    if (station) {
      setMode(station.operating_mode);
      setReserve(station.backup_reserve_pct);
    }
  }, [station]);
  if (!station) return <Skeleton className="h-48" />;
  const save = async () => {
    await api.updateStation(station.id, { operating_mode: mode, backup_reserve_pct: reserve });
    toast.success(t("settings.saved"));
  };
  const opt = (m: OperatingMode) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      aria-pressed={mode === m}
      className={cn("rounded-xl border-2 p-3 text-left", mode === m ? "border-brand-700 bg-secondary" : "hover:bg-muted")}
    >
      <div className="font-semibold">{t(`operatingMode.${m}`)}</div>
      <div className="text-xs text-muted-foreground">{t(`operatingMode.${m}Desc`)}</div>
    </button>
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.operatingMode")}</CardTitle>
        <CardDescription>{station.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {opt("self_consumption")}
          {opt("backup_reserve")}
        </div>
        {mode === "backup_reserve" && (
          <div className="space-y-2">
            <Label htmlFor="reserve" className="flex justify-between">
              <span>{t("settings.reserve")}</span>
              <span className="tabular font-bold">{reserve}%</span>
            </Label>
            <input id="reserve" type="range" min={10} max={80} step={5} value={reserve} onChange={(e) => setReserve(Number(e.target.value))} className="w-full accent-[#22382F]" />
            <p className="text-xs text-muted-foreground">{t("settings.reserveHint", { kwh: Math.round((reserve / 100) * (station.size === "S30" ? 30 : station.size === "M60" ? 60 : 100)) })}</p>
          </div>
        )}
        <Button onClick={save}>
          <Save /> {t("common.save")}
        </Button>
      </CardContent>
    </Card>
  );
}

export function SupportCard() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.support")}</CardTitle>
        <CardDescription>{t("settings.supportHours")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-3">
        <a href={`tel:${EMERGENCY.armenSupport.replace(/\s/g, "")}`} className="flex items-center gap-2 rounded-xl border p-3 font-semibold hover:bg-muted">
          <Phone className="h-5 w-5 text-brand-500" aria-hidden /> {EMERGENCY.armenSupport}
        </a>
        <a href="mailto:support@armen.am" className="flex items-center gap-2 rounded-xl border p-3 font-semibold hover:bg-muted">
          <Mail className="h-5 w-5 text-brand-500" aria-hidden /> support@armen.am
        </a>
        <a href="https://wa.me/37410554433" target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border p-3 font-semibold hover:bg-muted">
          <Headphones className="h-5 w-5 text-brand-500" aria-hidden /> WhatsApp / Viber
        </a>
      </CardContent>
    </Card>
  );
}

export function OwnerSettings() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <PageHeader title={t("settings.title")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <OperatingModeCard />
        <div className="space-y-4">
          <LanguageCard />
          <NotificationsCard />
        </div>
      </div>
      <SupportCard />
    </div>
  );
}
