import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Button,
  Form,
  Input,
  Modal,
  Popover,
  Segmented,
  Typography,
} from "antd";
import {
  DashboardOutlined,
  KeyOutlined,
  LockOutlined,
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
import { supabase } from "../lib/supabase";

const PLAYER_DRAFT_STORAGE_KEY = "scoutai.playerSearchDraft";
const LAST_PLAYER_RESULT_STORAGE_KEY = "scoutai.lastPlayerResult";
const PLAYER_SESSION_CHANGE_EVENT = "scoutai-player-session-change";
function AuthMenu() {
  const { t } = useTranslation("common");
  const { isAdmin, signOut, user } = useAuth();
  const { darkMode, language, setLanguage, toggleDarkMode } =
    useInterfaceSettings();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordState, setPasswordState] = useState({
    loading: false,
    error: "",
    success: false,
  });
  const [passwordForm] = Form.useForm();
  const hasPassword = user?.app_metadata?.providers?.includes("email");

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

  async function handlePasswordSubmit(values) {
    setPasswordState({ loading: true, error: "", success: false });
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });

    setPasswordState({
      loading: false,
      error: error?.message || "",
      success: !error,
    });
    if (!error) {
      passwordForm.resetFields();
    }
  }

  function openPasswordSettings() {
    setSettingsOpen(false);
    setPasswordState({ loading: false, error: "", success: false });
    setPasswordOpen(true);
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
        className="account-password-button"
        icon={<KeyOutlined />}
        onClick={openPasswordSettings}
      >
        {hasPassword
          ? t("settings.changePassword")
          : t("settings.setPassword")}
      </Button>
    </div>
  );

  return (
    <>
      <div className="auth-menu">
        <div className="auth-identity">
          <Avatar className="auth-avatar" icon={<UserOutlined />} size={34} />
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
            className="auth-admin-button"
            icon={<DashboardOutlined />}
            onClick={() => navigate("/admin")}
            size="middle"
          >
            {t("shell.admin")}
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

      <Modal
        destroyOnHidden
        footer={null}
        onCancel={() => setPasswordOpen(false)}
        open={passwordOpen}
        title={
          hasPassword
            ? t("settings.changePassword")
            : t("settings.setPassword")
        }
      >
        <Typography.Paragraph type="secondary">
          {t("settings.passwordDescription")}
        </Typography.Paragraph>

        {passwordState.error && (
          <Alert
            message={passwordState.error}
            showIcon
            style={{ marginBottom: 16 }}
            type="error"
          />
        )}
        {passwordState.success && (
          <Alert
            message={t("settings.passwordSaved")}
            showIcon
            style={{ marginBottom: 16 }}
            type="success"
          />
        )}

        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordSubmit}
          requiredMark={false}
        >
          <Form.Item
            label={t("settings.newPassword")}
            name="password"
            rules={[
              { required: true, message: t("settings.passwordRequired") },
              { min: 6, message: t("settings.passwordMin") },
            ]}
          >
            <Input.Password
              autoComplete="new-password"
              prefix={<LockOutlined />}
              size="large"
            />
          </Form.Item>
          <Form.Item
            dependencies={["password"]}
            label={t("settings.confirmPassword")}
            name="confirmPassword"
            rules={[
              {
                required: true,
                message: t("settings.confirmPasswordRequired"),
              },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || getFieldValue("password") === value
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error(t("settings.passwordsDoNotMatch")),
                      );
                },
              }),
            ]}
          >
            <Input.Password
              autoComplete="new-password"
              prefix={<LockOutlined />}
              size="large"
            />
          </Form.Item>
          <Button
            block
            htmlType="submit"
            loading={passwordState.loading}
            size="large"
            type="primary"
          >
            {t("settings.savePassword")}
          </Button>
        </Form>
      </Modal>
    </>
  );
}

export default AuthMenu;
