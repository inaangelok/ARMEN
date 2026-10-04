import i18n from "@/presentation/i18n";
import { isDomainError } from "@/domain";

/** Human-readable, translated message for any error thrown by a use case or adapter. */
export function errorMessage(e: unknown): string {
  if (isDomainError(e)) return i18n.t(`errors.${e.code}`, { ...e.params });
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "serial_in_use") return i18n.t("errors.SERIAL_IN_USE");
  if (msg === "invalid_credentials") return i18n.t("login.error");
  return msg;
}
