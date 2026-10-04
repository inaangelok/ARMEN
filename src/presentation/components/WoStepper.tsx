import { useTranslation } from "react-i18next";
import { cn } from "@/presentation/lib/utils";
import type { WorkOrderStatus } from "@/domain/model";

const STEPS: WorkOrderStatus[] = ["new", "scheduled", "in_progress", "done"];

export function WoStepper({ status }: { status: WorkOrderStatus }) {
  const { t } = useTranslation();
  const idx = STEPS.indexOf(status);
  return (
    <ol className="flex items-center gap-1" aria-label={t("wo.progress")}>
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-1 flex-col gap-1">
          <span className={cn("h-1.5 rounded-full", i <= idx ? "bg-brand-500" : "bg-muted")} />
          <span className={cn("text-[10px] font-semibold", i === idx ? "text-foreground" : "text-muted-foreground")} aria-current={i === idx ? "step" : undefined}>
            {t(`woStatus.${s}`)}
          </span>
        </li>
      ))}
    </ol>
  );
}
