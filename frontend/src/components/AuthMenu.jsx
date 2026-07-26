import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Button, Typography } from "antd";
import { LogoutOutlined, UserOutlined } from "@ant-design/icons";

import { useAuth } from "../auth/useAuth";

const PLAYER_DRAFT_STORAGE_KEY = "scoutai.playerSearchDraft";
const LAST_PLAYER_RESULT_STORAGE_KEY = "scoutai.lastPlayerResult";
const PLAYER_SESSION_CHANGE_EVENT = "scoutai-player-session-change";

function AuthMenu() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

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
