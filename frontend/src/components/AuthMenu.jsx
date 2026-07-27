import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Button, Popover, Typography } from "antd";
import {
  LogoutOutlined,
  MoonOutlined,
  SettingOutlined,
  SunOutlined,
  UserOutlined,
} from "@ant-design/icons";

import { useAuth } from "../auth/useAuth";
import { useInterfaceSettings } from "../interface/useInterfaceSettings";

const PLAYER_DRAFT_STORAGE_KEY = "scoutai.playerSearchDraft";
const LAST_PLAYER_RESULT_STORAGE_KEY = "scoutai.lastPlayerResult";
const PLAYER_SESSION_CHANGE_EVENT = "scoutai-player-session-change";
function AuthMenu() {
  const { signOut, user } = useAuth();
  const { darkMode, toggleDarkMode } = useInterfaceSettings();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    const { error } = await signOut();
    setIsSigningOut(false);

    if (!error) {
      try {
        window.sessionStorage.removeItem(PLAYER_DRAFT_STORAGE_KEY);
        window.sessionStorage.removeItem(LAST_PLAYER_RESULT_STORAGE_KEY);
      } catch {
        // Sign out should not fail if session storage is unavailable.
      }
      window.dispatchEvent(new Event(PLAYER_SESSION_CHANGE_EVENT));
      navigate("/login", { replace: true });
    }
  }

  const settingsContent = (
    <div className="interface-settings">
      <div className="interface-settings-heading">
        <span className="interface-settings-icon">
          <SettingOutlined />
        </span>
        <span>
          <strong>Interface settings</strong>
          <small>Personalize your workspace</small>
        </span>
      </div>

      <Button
        aria-pressed={darkMode}
        block
        className={`dark-mode-button${darkMode ? " is-active" : ""}`}
        icon={darkMode ? <SunOutlined /> : <MoonOutlined />}
        onClick={toggleDarkMode}
      >
        {darkMode ? "Use light mode" : "Use dark mode"}
      </Button>
    </div>
  );

  return (
    <div className="auth-menu">
      <div className="auth-identity">
        <Avatar className="auth-avatar" icon={<UserOutlined />} size={34} />
        <span className="auth-user-copy">
          <Typography.Text className="auth-label">Signed in</Typography.Text>
          <Typography.Text className="auth-email" ellipsis>
            {user?.email}
          </Typography.Text>
        </span>
      </div>
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
          aria-label="Open interface settings"
          className={`auth-settings-button ${settingsOpen ? "is-active" : ""}`}
          icon={<SettingOutlined />}
          shape="circle"
          title="Interface settings"
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
        Sign out
      </Button>
    </div>
  );
}

export default AuthMenu;
