import { createContext, useContext } from "react";

export const InterfaceSettingsContext = createContext(null);

export function useInterfaceSettings() {
  const context = useContext(InterfaceSettingsContext);

  if (!context) {
    throw new Error(
      "useInterfaceSettings must be used inside InterfaceSettingsProvider"
    );
  }

  return context;
}
