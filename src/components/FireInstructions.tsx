import { DoorClosed, Phone, Siren } from "lucide-react";
import { useTranslation } from "react-i18next";

export const EMERGENCY = { rescue: "911", fire: "101", armenSupport: "+374 10 55 44 33" };

export function FireInstructions() {
  const { t } = useTranslation();
  const steps = ["s1", "s2", "s3", "s4", "s5"] as const;
  return (
    <section className="rounded-2xl border-2 border-crit/40 bg-crit-soft p-4 sm:p-5" aria-labelledby="fire-title">
      <h2 id="fire-title" className="flex items-center gap-2 text-lg font-bold text-crit-fg">
        <Siren className="h-6 w-6" aria-hidden /> {t("fire.title")}
      </h2>
      <ol className="mt-3 space-y-2">
        {steps.map((s, i) => (
          <li key={s} className="flex gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-crit text-xs font-bold text-white">{i + 1}</span>
            <span className="pt-0.5 font-medium text-foreground">{t(`fire.${s}`)}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <a href={`tel:${EMERGENCY.rescue}`} className="flex items-center justify-center gap-2 rounded-xl bg-crit px-4 py-3 font-bold text-white hover:bg-crit/90">
          <Phone className="h-5 w-5" aria-hidden /> {t("fire.callRescue")} {EMERGENCY.rescue}
        </a>
        <a href={`tel:${EMERGENCY.fire}`} className="flex items-center justify-center gap-2 rounded-xl border-2 border-crit bg-background px-4 py-3 font-bold text-crit-fg">
          <Phone className="h-5 w-5" aria-hidden /> {t("fire.callFire")} {EMERGENCY.fire}
        </a>
        <a href={`tel:${EMERGENCY.armenSupport.replace(/\s/g, "")}`} className="flex items-center justify-center gap-2 rounded-xl border bg-background px-4 py-3 font-semibold">
          <Phone className="h-5 w-5" aria-hidden /> {t("fire.callArmen")}
        </a>
      </div>
      <p className="mt-3 flex items-start gap-2 text-xs text-crit-fg">
        <DoorClosed className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {t("fire.howItWorks")}
      </p>
    </section>
  );
}
