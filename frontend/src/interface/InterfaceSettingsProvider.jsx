import { useEffect, useMemo, useState } from "react";

import { InterfaceSettingsContext } from "./useInterfaceSettings";

const INTERFACE_SETTINGS_STORAGE_KEY = "scoutai.interfaceSettings";

function readDarkMode() {
  try {
    const storedSettings = JSON.parse(
      window.localStorage.getItem(INTERFACE_SETTINGS_STORAGE_KEY) || "{}"
    );
    return storedSettings.darkMode === true;
  } catch {
    return false;
  }
}

export function InterfaceSettingsProvider({ children }) {
  const [darkMode, setDarkMode] = useState(readDarkMode);

  useEffect(() => {
    document.documentElement.dataset.colorMode = darkMode ? "dark" : "light";
    delete document.documentElement.dataset.density;
    delete document.documentElement.dataset.reduceMotion;

    try {
      window.localStorage.setItem(
        INTERFACE_SETTINGS_STORAGE_KEY,
        JSON.stringify({ darkMode })
      );
    } catch {
      // Dark mode still works for the current page.
    }
  }, [darkMode]);

  const value = useMemo(
    () => ({
      darkMode,
      toggleDarkMode: () => setDarkMode((current) => !current),
    }),
    [darkMode]
  );

  return (
    <InterfaceSettingsContext.Provider value={value}>
      {children}
    </InterfaceSettingsContext.Provider>
  );
}
