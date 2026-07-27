import { useMemo } from "react";
import { BrowserRouter } from "react-router-dom";
import { App as AntApp, ConfigProvider, theme as antdTheme } from "antd";
import enUS from "antd/locale/en_US";
import thTH from "antd/locale/th_TH";

import { AuthProvider } from "./auth/AuthProvider";
import { InterfaceSettingsProvider } from "./interface/InterfaceSettingsProvider";
import { useInterfaceSettings } from "./interface/useInterfaceSettings";
import AppRoutes from "./routes/AppRoutes";

const lightTheme = {
  token: {
    borderRadius: 8,
    colorBgLayout: "#f4f7fb",
    colorInfo: "#246c4f",
    colorPrimary: "#246c4f",
    colorSuccess: "#16a34a",
    colorText: "#172033",
    colorTextSecondary: "#627089",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  components: {
    Button: {
      borderRadius: 6,
      controlHeight: 38,
      fontWeight: 600,
    },
    Card: {
      borderRadiusLG: 8,
      headerBg: "#ffffff",
    },
    Input: {
      borderRadius: 6,
      controlHeightLG: 46,
    },
    Layout: {
      bodyBg: "#f4f7fb",
      headerBg: "#ffffff",
    },
    Select: {
      borderRadius: 6,
      controlHeightLG: 46,
    },
    Table: {
      headerBg: "#eef3f8",
      rowHoverBg: "#f8fbff",
    },
  },
};

function ThemedApp() {
  const { darkMode, language } = useInterfaceSettings();
  const scoutTheme = useMemo(
    () => ({
      ...lightTheme,
      algorithm: darkMode
        ? antdTheme.darkAlgorithm
        : antdTheme.defaultAlgorithm,
      token: {
        ...lightTheme.token,
        ...(darkMode
          ? {
              colorBgContainer: "#151d19",
              colorBgElevated: "#1b2520",
              colorBgLayout: "#0d1310",
              colorBorder: "#314039",
              colorInfo: "#75c7a0",
              colorPrimary: "#75c7a0",
              colorSuccess: "#65c58f",
              colorText: "#e8f1ec",
              colorTextSecondary: "#9daea5",
            }
          : {}),
      },
      components: {
        ...lightTheme.components,
        Card: {
          ...lightTheme.components.Card,
          headerBg: darkMode ? "#151d19" : "#ffffff",
        },
        Layout: {
          ...lightTheme.components.Layout,
          bodyBg: darkMode ? "#0d1310" : "#f4f7fb",
          headerBg: darkMode ? "#111915" : "#ffffff",
        },
        Table: {
          ...lightTheme.components.Table,
          headerBg: darkMode ? "#1b2520" : "#eef3f8",
          rowHoverBg: darkMode ? "#202d27" : "#f8fbff",
        },
      },
    }),
    [darkMode]
  );

  return (
    <ConfigProvider locale={language === "th" ? thTH : enUS} theme={scoutTheme}>
      <AntApp>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}

function App() {
  return (
    <InterfaceSettingsProvider>
      <ThemedApp />
    </InterfaceSettingsProvider>
  );
}

export default App;
