import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "@/composition-root";
import { useAuth } from "@/presentation/providers/auth";
import type { Lang } from "@/domain/model";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "hy", label: "Հայերեն" },
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
];

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const { user, setUser } = useAuth();
  const change = async (code: Lang) => {
    await i18n.changeLanguage(code);
    if (user) setUser(await api.updateMyProfile({ language: code }));
  };
  return (
    <label className="relative flex items-center gap-1 rounded-full border bg-background px-2.5 py-1.5 text-xs font-semibold">
      <Globe className="h-4 w-4 text-muted-foreground" aria-hidden />
      <span className="sr-only">{t("settings.language")}</span>
      <select value={i18n.language} onChange={(e) => change(e.target.value as Lang)} className="cursor-pointer appearance-none bg-transparent pr-1 focus:outline-none">
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.code.toUpperCase()} · {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
