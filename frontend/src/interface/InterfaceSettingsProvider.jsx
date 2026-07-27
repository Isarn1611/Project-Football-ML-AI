import { useEffect, useMemo, useState } from "react";

import i18n from "../i18n";
import { InterfaceSettingsContext } from "./useInterfaceSettings";

const INTERFACE_SETTINGS_STORAGE_KEY = "scoutai.interfaceSettings";

function readSettings() {
  try {
    const storedSettings = JSON.parse(
      window.localStorage.getItem(INTERFACE_SETTINGS_STORAGE_KEY) || "{}"
    );
    return {
      darkMode: storedSettings.darkMode === true,
      language: storedSettings.language === "th" ? "th" : "en",
    };
  } catch {
    return {
      darkMode: false,
      language: "en",
    };
  }
}

export function InterfaceSettingsProvider({ children }) {
  const [settings, setSettings] = useState(readSettings);
  const { darkMode, language } = settings;

  useEffect(() => {
    document.documentElement.dataset.colorMode = darkMode ? "dark" : "light";
    document.documentElement.lang = language;
    delete document.documentElement.dataset.density;
    delete document.documentElement.dataset.reduceMotion;
    void i18n.changeLanguage(language);

    try {
      window.localStorage.setItem(
        INTERFACE_SETTINGS_STORAGE_KEY,
        JSON.stringify({ darkMode, language })
      );
    } catch {
      // Dark mode still works for the current page.
    }
  }, [darkMode, language]);

  const value = useMemo(
    () => ({
      darkMode,
      language,
      setLanguage: (nextLanguage) =>
        setSettings((current) => ({
          ...current,
          language: nextLanguage === "th" ? "th" : "en",
        })),
      toggleDarkMode: () =>
        setSettings((current) => ({
          ...current,
          darkMode: !current.darkMode,
        })),
    }),
    [darkMode, language]
  );

  return (
    <InterfaceSettingsContext.Provider value={value}>
      {children}
    </InterfaceSettingsContext.Provider>
  );
}
