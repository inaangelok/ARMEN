import { useTranslation } from "react-i18next";
import { useServices } from "@/presentation/providers/services";

export function DemoBanner() {
  const { t } = useTranslation();
  const { info } = useServices();
  if (info.mode !== "demo") return null;
  return <div className="no-print bg-brand-700 px-4 py-1 text-center text-[11px] font-medium text-white/90">{t("demo.banner")}</div>;
}
