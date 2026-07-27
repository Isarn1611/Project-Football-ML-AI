import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { resources } from "./resources";

const INTERFACE_SETTINGS_STORAGE_KEY = "scoutai.interfaceSettings";

function readInitialLanguage() {
  try {
    const settings = JSON.parse(
      window.localStorage.getItem(INTERFACE_SETTINGS_STORAGE_KEY) || "{}"
    );
    return settings.language === "th" ? "th" : "en";
  } catch {
    return "en";
  }
}

i18n.use(initReactI18next).init({
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
  lng: readInitialLanguage(),
  react: {
    useSuspense: false,
  },
  resources,
  supportedLngs: ["en", "th"],
});

export default i18n;
