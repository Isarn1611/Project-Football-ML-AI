import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Avatar,
  Button,
  Popover,
  Segmented,
  Typography,
} from "antd";
import {
  DashboardOutlined,
  HistoryOutlined,
  LogoutOutlined,
  MoonOutlined,
  SettingOutlined,
  SunOutlined,
  TranslationOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";

import { useAuth } from "../auth/useAuth";
import { useInterfaceSettings } from "../interface/useInterfaceSettings";
import {
  clearActiveAuthProvider,
  getActiveAuthProvider,
  getUserAvatarUrl,
} from "../utils/userProfile";
import SearchHistoryOverlay from "./SearchHistoryOverlay";

const PLAYER_DRAFT_STORAGE_KEY = "scoutai.playerSearchDraft";
const LAST_PLAYER_RESULT_STORAGE_KEY = "scoutai.lastPlayerResult";
const PLAYER_SESSION_CHANGE_EVENT = "scoutai-player-session-change";
function AuthMenu() {
  const { t } = useTranslation("common");
  const { isAdmin, signOut, user } = useAuth();
  const { darkMode, language, setLanguage, toggleDarkMode } =
    useInterfaceSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const avatarUrl = getUserAvatarUrl(user, getActiveAuthProvider());
  const isAdminPage = location.pathname.startsWith("/admin");

  async function handleSignOut() {
    setIsSigningOut(true);
    const { error } = await signOut();
    setIsSigningOut(false);

    if (!error) {
      try {
        clearActiveAuthProvider();
        window.sessionStorage.removeItem(PLAYER_DRAFT_STORAGE_KEY);
        window.sessionStorage.removeItem(LAST_PLAYER_RESULT_STORAGE_KEY);
      } catch {
        // Sign out should not fail if session storage is unavailable.
      }
      window.dispatchEvent(new Event(PLAYER_SESSION_CHANGE_EVENT));
      navigate("/login", { replace: true });
    }
  }

  function openSearchHistory() {
    setSettingsOpen(false);
    setHistoryOpen(true);
  }

  const settingsContent = (
    <div className="interface-settings">
      <div className="interface-settings-heading">
        <span className="interface-settings-icon">
          <SettingOutlined />
        </span>
        <span>
          <strong>{t("settings.title")}</strong>
          <small>{t("settings.subtitle")}</small>
        </span>
      </div>

      <div className="language-setting">
        <span>
          <TranslationOutlined />
          {t("language.label")}
        </span>
        <Segmented
          aria-label={t("language.label")}
          block
          onChange={setLanguage}
          options={[
            { label: t("language.english"), value: "en" },
            { label: t("language.thai"), value: "th" },
          ]}
          value={language}
        />
      </div>

      <Button
        aria-pressed={darkMode}
        block
        className={`dark-mode-button${darkMode ? " is-active" : ""}`}
        icon={darkMode ? <SunOutlined /> : <MoonOutlined />}
        onClick={toggleDarkMode}
      >
        {darkMode ? t("settings.lightMode") : t("settings.darkMode")}
      </Button>

      <Button
        block
        className="settings-history-button"
        icon={<HistoryOutlined />}
        onClick={openSearchHistory}
      >
        {t("settings.searchHistory")}
      </Button>
    </div>
  );

  return (
    <>
      <div className="auth-menu">
        <div className="auth-identity">
          <Avatar
            className="auth-avatar"
            icon={<UserOutlined />}
            size={34}
            src={avatarUrl || undefined}
          />
          <span className="auth-user-copy">
            <Typography.Text className="auth-label">
              {t("shell.signedIn")}
            </Typography.Text>
            <Typography.Text className="auth-email" ellipsis>
              {user?.email}
            </Typography.Text>
          </span>
        </div>
        {isAdmin && (
          <Button
            className={`auth-admin-button${isAdminPage ? " is-search-link" : ""}`}
            icon={isAdminPage ? undefined : <DashboardOutlined />}
            onClick={() => navigate(isAdminPage ? "/app" : "/admin")}
            size="middle"
          >
            {isAdminPage ? t("shell.search") : t("shell.admin")}
          </Button>
        )}
        <Popover
          arrow={false}
          content={settingsContent}
          destroyOnHidden
          onOpenChange={setSettingsOpen}
          open={settingsOpen}
          placement="bottomRight"
          trigger="click"
        >
          <Button
            aria-label={t("settings.open")}
            className={`auth-settings-button ${settingsOpen ? "is-active" : ""}`}
            icon={<SettingOutlined />}
            shape="circle"
            title={t("settings.title")}
          />
        </Popover>
        <Button
          className="auth-signout-button"
          disabled={isSigningOut}
          icon={<LogoutOutlined />}
          loading={isSigningOut}
          onClick={handleSignOut}
          size="middle"
        >
          {t("shell.signOut")}
        </Button>
      </div>
      <SearchHistoryOverlay
        onClose={() => setHistoryOpen(false)}
        open={historyOpen}
      />
    </>
  );
}

export default AuthMenu;
