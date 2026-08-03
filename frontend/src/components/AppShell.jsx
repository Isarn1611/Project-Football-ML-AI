import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Layout } from "antd";
import { useTranslation } from "react-i18next";

import scoutAiWordmark from "../assets/scoutai-wordmark.png";
import AuthMenu from "./AuthMenu";

const LAST_PLAYER_RESULT_STORAGE_KEY = "scoutai.lastPlayerResult";

function writeLastPlayerResult(playerName) {
  const cleanedName = String(playerName || "").trim();

  try {
    if (cleanedName) {
      window.sessionStorage.setItem(LAST_PLAYER_RESULT_STORAGE_KEY, cleanedName);
    }
  } catch {
    // Navigation still works without session storage.
  }

  return cleanedName;
}

function AppShell({ children, extra }) {
  const { t } = useTranslation("common");
  const location = useLocation();
  const currentReportPlayer = location.pathname.startsWith("/result")
    ? new URLSearchParams(location.search).get("player")?.trim() || ""
    : "";

  useEffect(() => {
    if (!currentReportPlayer) return;

    writeLastPlayerResult(currentReportPlayer);
  }, [currentReportPlayer]);

  useEffect(() => {
    if (!location.hash) return;

    window.requestAnimationFrame(() => {
      document
        .getElementById(location.hash.replace("#", ""))
        ?.scrollIntoView({ block: "start" });
    });
  }, [location.hash, location.pathname]);

  return (
    <Layout className="app-shell">
      <Layout.Header className="app-header">
        <div className="app-header-inner">
          <div className="app-header-left">
            <Link className="brand-link" to="/app">
              <img className="brand-logo" src={scoutAiWordmark} alt="ScoutAI" />
              <span className="brand-product">
                {t("shell.product")}
                <small>{t("shell.productSuffix")}</small>
              </span>
            </Link>
          </div>

          <div className="app-header-actions">
            {extra && <div className="app-header-extra">{extra}</div>}
            <AuthMenu />
          </div>
        </div>
      </Layout.Header>

      <Layout.Content className="app-content">
        <div className="app-container">{children}</div>
      </Layout.Content>
    </Layout>
  );
}

export default AppShell;
