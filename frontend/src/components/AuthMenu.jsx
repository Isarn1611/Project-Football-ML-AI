import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Button, Popover, Switch, Typography } from "antd";
import {
  ColumnHeightOutlined,
  LogoutOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from "@ant-design/icons";

import { useAuth } from "../auth/useAuth";

const PLAYER_DRAFT_STORAGE_KEY = "scoutai.playerSearchDraft";
const LAST_PLAYER_RESULT_STORAGE_KEY = "scoutai.lastPlayerResult";
const PLAYER_SESSION_CHANGE_EVENT = "scoutai-player-session-change";
const INTERFACE_SETTINGS_STORAGE_KEY = "scoutai.interfaceSettings";

const DEFAULT_INTERFACE_SETTINGS = {
  compact: false,
  reduceMotion: false,
};

function readInterfaceSettings() {
  try {
    return {
      ...DEFAULT_INTERFACE_SETTINGS,
      ...JSON.parse(
        window.localStorage.getItem(INTERFACE_SETTINGS_STORAGE_KEY) || "{}",
      ),
    };
  } catch {
    return DEFAULT_INTERFACE_SETTINGS;
  }
}

function AuthMenu() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [interfaceSettings, setInterfaceSettings] = useState(
    readInterfaceSettings,
  );

  useEffect(() => {
    document.documentElement.dataset.density = interfaceSettings.compact
      ? "compact"
      : "comfortable";
    document.documentElement.dataset.reduceMotion = interfaceSettings.reduceMotion
      ? "true"
      : "false";

    try {
      window.localStorage.setItem(
        INTERFACE_SETTINGS_STORAGE_KEY,
        JSON.stringify(interfaceSettings),
      );
    } catch {
      // Interface preferences still work for the current page.
    }
  }, [interfaceSettings]);

  function updateInterfaceSetting(name, value) {
    setInterfaceSettings((current) => ({ ...current, [name]: value }));
  }

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

      <label className="interface-setting-row">
        <span className="interface-setting-copy">
          <ColumnHeightOutlined />
          <span>
            <strong>Compact workspace</strong>
            <small>Show more scouting data at once</small>
          </span>
        </span>
        <Switch
          checked={interfaceSettings.compact}
          onChange={(checked) => updateInterfaceSetting("compact", checked)}
          size="small"
        />
      </label>

      <label className="interface-setting-row">
        <span className="interface-setting-copy">
          <ThunderboltOutlined />
          <span>
            <strong>Reduce motion</strong>
            <small>Minimize interface animations</small>
          </span>
        </span>
        <Switch
          checked={interfaceSettings.reduceMotion}
          onChange={(checked) => updateInterfaceSetting("reduceMotion", checked)}
          size="small"
        />
      </label>
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
