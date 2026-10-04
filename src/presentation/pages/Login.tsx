import { useState } from "react";
import { HardHat, Home, Loader2, ShieldCheck } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { Logo } from "@/presentation/components/Logo";
import { LanguageSwitcher } from "@/presentation/components/LanguageSwitcher";
import { useServices } from "@/presentation/providers/services";
import { useAuth } from "@/presentation/providers/auth";
import type { Role } from "@/domain/model";

export const homeFor = (role: Role) => (role === "owner" ? "/app" : "/ops");
const ICON: Record<Role, typeof Home> = { owner: Home, technician: HardHat, admin: ShieldCheck };

export function Login() {
  const { t } = useTranslation();
  const { user, signIn } = useAuth();
  const { info } = useServices();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const go = async (e: string, p: string, key: string) => {
    setBusy(key);
    setError("");
    try {
      const prof = await signIn(e, p);
      navigate(homeFor(prof.role), { replace: true });
    } catch {
      setError(t("login.error"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-brand-700 via-brand-700 to-brand-800 lg:flex-row">
      <div className="flex flex-1 flex-col justify-between p-6 text-white lg:p-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="h-10 w-10 [&>rect:first-child]:fill-white/10" />
            <span className="text-xl font-extrabold">ARMEN Care</span>
          </div>
          <div className="text-foreground lg:hidden">
            <LanguageSwitcher />
          </div>
        </div>
        <div className="my-8 max-w-lg lg:my-0">
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{t("login.headline")}</h1>
          <p className="mt-3 text-white/80">{t("login.tagline")}</p>
          <ul className="mt-6 hidden space-y-2 text-sm text-white/80 sm:block">
            {(["f1", "f2", "f3"] as const).map((k) => (
              <li key={k} className="flex gap-2">
                <span className="text-[#7EE0A6]">●</span>
                {t(`login.${k}`)}
              </li>
            ))}
          </ul>
        </div>
        <p className="hidden text-xs text-white/50 lg:block">© ARMEN · {t("login.footer")}</p>
      </div>
      <div className="flex flex-1 items-start justify-center rounded-t-3xl bg-background p-4 sm:p-8 lg:items-center lg:rounded-none">
        <div className="w-full max-w-md space-y-5">
          <div className="hidden justify-end lg:flex">
            <LanguageSwitcher />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold">{t("login.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("login.subtitle")}</p>
          </div>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              go(email, password, "form");
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("login.email")}</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("login.password")}</Label>
              <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && (
              <p className="rounded-lg bg-crit-soft p-2 text-sm text-crit-fg" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={!!busy}>
              {busy === "form" && <Loader2 className="animate-spin" />} {t("login.signIn")}
            </Button>
          </form>
          <div className="relative py-1 text-center text-xs text-muted-foreground">
            <span className="relative z-10 bg-background px-2">{info.mode === "demo" ? t("login.demoAccounts") : t("login.seededAccounts")}</span>
            <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
          </div>
          <div className="grid gap-2">
            {info.demoAccounts.map((a) => {
              const Icon = ICON[a.role];
              return (
                <Card key={a.role} className="transition hover:shadow-md">
                  <CardContent className="p-0">
                    <button className="flex w-full items-center gap-3 p-3 text-left" onClick={() => go(a.email, a.password, a.role)} disabled={!!busy}>
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-brand-700">{busy === a.role ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{t(`roles.${a.role}`)}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {a.name} · {t(`login.roleDesc.${a.role}`)}
                        </span>
                      </span>
                    </button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
