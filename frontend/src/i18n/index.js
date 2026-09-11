import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { resources } from "./resources";

const INTERFACE_SETTINGS_STORAGE_KEY_V2 = "scoutai.interfaceSettings.v2";

function readInitialLanguage() {
  try {
    const v2 = window.localStorage.getItem(INTERFACE_SETTINGS_STORAGE_KEY_V2);
    if (v2) {
      const settings = JSON.parse(v2);
      return settings.language === "en" ? "en" : "th";
    }
    return "th";
  } catch {
    return "th";
  }
}

i18n.use(initReactI18next).init({
  fallbackLng: "th",
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
