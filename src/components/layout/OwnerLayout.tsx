import { Bell, FileBarChart, HeartPulse, House, LogOut, Menu, Settings, ShieldCheck, Wrench } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Wordmark } from "@/components/Logo";
import { LiveToggle } from "@/components/LiveToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/select";
import { useAlerts, useLiveSync } from "@/hooks/data";
import { CurrentStationProvider, useCurrentStation } from "@/hooks/useCurrentStation";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { DemoBanner } from "./DemoBanner";

function StationSwitcher() {
  const { t } = useTranslation();
  const { station, stations, setStationId } = useCurrentStation();
  if (stations.length < 2) return station ? <div className="truncate text-sm font-semibold">{station.name}</div> : null;
  return (
    <NativeSelect aria-label={t("owner.selectStation")} value={station?.id} onChange={(e) => setStationId(e.target.value)} className="w-full max-w-[220px]">
      {stations.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </NativeSelect>
  );
}

function Shell() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const alerts = useAlerts();
  const { station } = useCurrentStation();
  const [more, setMore] = useState(false);
  useLiveSync();
  const openCount = (alerts.data ?? []).filter((a) => a.station_id === station?.id && a.status !== "resolved" && a.severity !== "info").length;

  type NavItem = { to: string; icon: typeof House; label: string; end?: boolean; badge?: number };
  const nav: NavItem[] = [
    { to: "/app", icon: House, label: t("nav.home"), end: true },
    { to: "/app/health", icon: HeartPulse, label: t("nav.health") },
    { to: "/app/alerts", icon: Bell, label: t("nav.alerts"), badge: openCount },
    { to: "/app/maintenance", icon: Wrench, label: t("nav.service") },
  ];
  const extra: NavItem[] = [
    { to: "/app/safety", icon: ShieldCheck, label: t("nav.safety") },
    { to: "/app/reports", icon: FileBarChart, label: t("nav.reports") },
    { to: "/app/settings", icon: Settings, label: t("nav.settings") },
  ];

  return (
    <div className="min-h-screen bg-muted/40 pb-24 md:pb-8">
      <DemoBanner />
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <div className="shrink-0">
            <Wordmark />
          </div>
          <div className="ml-4 hidden min-w-0 items-center gap-2 lg:flex">
            <span className="whitespace-nowrap text-xs text-muted-foreground">{t("owner.hello", { name: user?.full_name.split(" ")[0] })}</span>
            <StationSwitcher />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>
            <LiveToggle compact />
            <button
              className="hidden rounded-lg p-2 text-muted-foreground hover:bg-muted md:block"
              onClick={async () => {
                await signOut();
                navigate("/login");
              }}
              aria-label={t("nav.signOut")}
              title={t("nav.signOut")}
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 pb-2.5 lg:hidden">
          <span className="text-xs text-muted-foreground">{t("owner.hello", { name: user?.full_name.split(" ")[0] })}</span>
          <span className="text-muted-foreground">·</span>
          <StationSwitcher />
        </div>
          <nav className="mx-auto hidden max-w-6xl items-center gap-1 overflow-x-auto px-3 pb-2 lg:flex" aria-label={t("nav.main")}>
          {[...nav, ...extra].map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn("relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted", isActive && "bg-secondary text-foreground")}>
                <n.icon className="h-4 w-4" aria-hidden />
                {n.label}
                {!!n.badge && <span className="ml-0.5 rounded-full bg-crit px-1.5 text-[10px] font-bold text-white">{n.badge}</span>}
              </NavLink>
            ))}
          </nav>

      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 sm:py-6">
        <Outlet />
      </main>

      {/* mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label={t("nav.main")}>
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn("relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground", isActive && "text-brand-700")}>
              {({ isActive }) => (
                <>
                  <span className={cn("flex h-8 w-12 items-center justify-center rounded-full", isActive && "bg-secondary")}>
                    <n.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="max-w-full truncate px-1">{n.label}</span>
                  {!!n.badge && <span className="absolute right-[22%] top-1 rounded-full bg-crit px-1.5 text-[10px] font-bold text-white">{n.badge}</span>}
                </>
              )}
            </NavLink>
          ))}
          <button onClick={() => setMore(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground">
            <span className="flex h-8 w-12 items-center justify-center rounded-full">
              <Menu className="h-5 w-5" aria-hidden />
            </span>
            {t("nav.more")}
          </button>
        </div>
      </nav>
      <Dialog open={more} onOpenChange={setMore}>
        <DialogContent closeLabel={t("common.close")} className="top-auto bottom-3 translate-y-0">
          <DialogTitle>{t("nav.more")}</DialogTitle>
          <div className="grid gap-1">
            {extra.map((n) => (
              <NavLink key={n.to} to={n.to} onClick={() => setMore(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 font-medium hover:bg-muted">
                <n.icon className="h-5 w-5 text-brand-500" aria-hidden /> {n.label}
              </NavLink>
            ))}
            <div className="flex items-center justify-between rounded-xl px-3 py-2">
              <span className="font-medium">{t("settings.language")}</span>
              <LanguageSwitcher />
            </div>
            <button
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-left font-medium text-crit-fg hover:bg-muted"
              onClick={async () => {
                await signOut();
                navigate("/login");
              }}
            >
              <LogOut className="h-5 w-5" aria-hidden /> {t("nav.signOut")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function OwnerLayout() {
  return (
    <CurrentStationProvider>
      <Shell />
    </CurrentStationProvider>
  );
}
