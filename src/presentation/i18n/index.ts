import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/presentation/i18n/en";
import hy from "@/presentation/i18n/hy";
import ru from "@/presentation/i18n/ru";

const KEY = "armen-care-lang";
let initial = "hy"; // Armenian is the default language
try {
  initial = window.localStorage.getItem(KEY) ?? "hy";
} catch {
  /* storage unavailable */
}

i18n.use(initReactI18next).init({
  resources: { hy: { translation: hy }, en: { translation: en }, ru: { translation: ru } },
  lng: initial,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

const applyLang = (lng: string) => {
  document.documentElement.lang = lng;
  try {
    window.localStorage.setItem(KEY, lng);
  } catch {
    /* ignore */
  }
};
applyLang(initial);
i18n.on("languageChanged", applyLang);

export default i18n;
