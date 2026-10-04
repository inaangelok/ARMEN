import { Suspense, useState } from "react";
import { BarChart3, Bell, Boxes, LogOut, Map, Menu, Settings, SlidersHorizontal, SquareKanban, Users, X } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Wordmark } from "@/presentation/components/Logo";
import { LiveToggle } from "@/presentation/components/LiveToggle";
import { LanguageSwitcher } from "@/presentation/components/LanguageSwitcher";
import { useAlerts, useLiveSync, useWorkOrders } from "@/presentation/hooks/data";
import { useAuth } from "@/presentation/providers/auth";
import { cn } from "@/presentation/lib/utils";
import { DemoBanner } from "@/presentation/components/layout/DemoBanner";

export function OpsLayout() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const alerts = useAlerts();
  const wos = useWorkOrders();
  useLiveSync();
  const critical = (alerts.data ?? []).filter((a) => a.status === "open" && a.severity !== "info").length;
  const newWos = (wos.data ?? []).filter((w) => w.status === "new").length;
  const isAdmin = user?.role === "admin";
  const nav = [
    { to: "/ops", icon: Map, label: t("ops.fleet"), end: true },
    { to: "/ops/alerts", icon: Bell, label: t("nav.alerts"), badge: critical },
    { to: "/ops/work-orders", icon: SquareKanban, label: t("ops.workOrders"), badge: newWos },
    { to: "/ops/modules", icon: Boxes, label: t("ops.modules") },
    { to: "/ops/analytics", icon: BarChart3, label: t("ops.analytics") },
    { to: "/ops/rules", icon: SlidersHorizontal, label: t("ops.rules") },
    ...(isAdmin ? [{ to: "/ops/users", icon: Users, label: t("ops.users") }] : []),
    { to: "/ops/settings", icon: Settings, label: t("nav.settings") },
  ];
  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-3" aria-label={t("nav.main")}>
      <div className="mb-4 px-2 pt-1">
        <Wordmark />
      </div>
      {nav.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          onClick={() => setOpen(false)}
          className={({ isActive }) => cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white", isActive && "bg-white/15 text-white")}
        >
          <n.icon className="h-4 w-4" aria-hidden />
          <span className="flex-1">{n.label}</span>
          {!!n.badge && <span className="rounded-full bg-crit px-1.5 text-[10px] font-bold text-white">{n.badge}</span>}
        </NavLink>
      ))}
      <div className="mt-auto rounded-xl bg-white/10 p-3 text-white">
        <div className="truncate text-sm font-semibold">{user?.full_name}</div>
        <div className="text-xs text-white/70">
          {t(`roles.${user?.role ?? "technician"}`)}
          {user?.region ? ` · ${t(`region.${user.region}`)}` : ""}
        </div>
        <button
          className="mt-2 flex items-center gap-2 text-xs font-semibold text-white/80 hover:text-white"
          onClick={async () => {
            await signOut();
            navigate("/login");
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden /> {t("nav.signOut")}
        </button>
      </div>
    </nav>
  );
  return (
    <div className="min-h-screen bg-muted/40">
      <DemoBanner />
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 bg-brand-700 lg:block [&_.text-brand-700]:text-white [&_.text-muted-foreground]:text-white/60">{sidebar}</aside>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-64 bg-brand-700 [&_.text-brand-700]:text-white [&_.text-muted-foreground]:text-white/60">
              <button className="absolute right-2 top-2 p-2 text-white" onClick={() => setOpen(false)} aria-label={t("common.close")}>
                <X className="h-5 w-5" />
              </button>
              {sidebar}
            </aside>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 px-4 py-2.5 backdrop-blur">
            <button className="rounded-lg p-2 hover:bg-muted lg:hidden" onClick={() => setOpen(true)} aria-label={t("nav.menu")}>
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold text-muted-foreground">{t("ops.console")}</span>
            <div className="ml-auto flex items-center gap-2">
              <LanguageSwitcher />
              <LiveToggle compact />
            </div>
          </header>
          <main className="mx-auto max-w-[1400px] p-4 sm:p-6">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}
