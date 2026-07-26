import { BrowserRouter } from "react-router-dom";
import { App as AntApp, ConfigProvider } from "antd";

import { AuthProvider } from "./auth/AuthProvider";
import AppRoutes from "./routes/AppRoutes";

const scoutTheme = {
  token: {
    borderRadius: 8,
    colorBgLayout: "#f4f7fb",
    colorInfo: "#0ea5e9",
    colorPrimary: "#1677ff",
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

function App() {
  return (
    <ConfigProvider theme={scoutTheme}>
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

export default App;
