import { format, formatDistanceToNow } from "date-fns";
import { enGB, hy, ru } from "date-fns/locale";
import i18n from "@/presentation/i18n";
import type { Lang } from "@/domain/model";

const LOCALES: Record<Lang, string> = { hy: "hy-AM", en: "en-GB", ru: "ru-RU" };
const DF = { hy, en: enGB, ru };

const lang = (): Lang => ((i18n.language as Lang) in LOCALES ? (i18n.language as Lang) : "hy");
const nf = (min: number, max: number) => new Intl.NumberFormat(LOCALES[lang()], { minimumFractionDigits: min, maximumFractionDigits: max });

/** Normalises "-0" and formats with the active locale. */
export function num(v: number | null | undefined, digits = 1, minDigits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const r = Math.abs(v) < 0.5 * 10 ** -digits ? 0 : v;
  return nf(minDigits, digits).format(r);
}
export const amd = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${num(Math.round(v), 0)} ֏`);
export const pct = (v: number | null | undefined, d = 0) => `${num(v, d)}%`;
export const kw = (v: number | null | undefined) => `${num(v, 1, 1)} ${i18n.t("units.kw")}`;
export const kwh = (v: number | null | undefined, d = 1) => `${num(v, d)} ${i18n.t("units.kwh")}`;
export const temp = (v: number | null | undefined) => `${num(v, 1)} °C`;

export const date = (iso: string | null | undefined, pattern = "d MMM yyyy") => (iso ? format(new Date(iso), pattern, { locale: DF[lang()] }) : "—");
export const dateTime = (iso: string | null | undefined) => date(iso, "d MMM yyyy, HH:mm");
export const time = (iso: string | null | undefined) => date(iso, "HH:mm");
export const ago = (iso: string | null | undefined) => (iso ? formatDistanceToNow(new Date(iso), { addSuffix: true, locale: DF[lang()] }) : "—");
export const monthLabel = (d: Date) => format(d, "LLLL yyyy", { locale: DF[lang()] });
export const shortDay = (iso: string) => format(new Date(iso), "d MMM", { locale: DF[lang()] });
