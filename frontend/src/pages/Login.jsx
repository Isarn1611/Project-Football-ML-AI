import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Divider,
  Form,
  Input,
  Segmented,
  Space,
  Statistic,
  Typography,
} from "antd";
import {
  GithubOutlined,
  GoogleOutlined,
  LoginOutlined,
  LockOutlined,
  MailOutlined,
} from "@ant-design/icons";

import { useAuth } from "../auth/useAuth";
import scoutAiWordmark from "../assets/scoutai-wordmark.png";
import { supabase } from "../lib/supabase";

const { Text } = Typography;

const socialProviders = [
  { icon: <GoogleOutlined />, label: "Google", provider: "google" },
  { icon: <GithubOutlined />, label: "GitHub", provider: "github" },
];

const POST_LOGIN_PATH = "/";

function readAuthError(error) {
  const message = error?.message || "Could not complete sign in.";

  if (/rate limit/i.test(message)) {
    return "Too many requests. Wait a few minutes, then try again.";
  }

  if (/invalid login credentials/i.test(message)) {
    return "Email or password is incorrect.";
  }

  if (/email not confirmed/i.test(message)) {
    return "Confirm your email before signing in.";
  }

  if (/provider is not enabled/i.test(message)) {
    return "This sign-in method is not enabled yet.";
  }

  return message;
}

function getAuthCallbackUrl(returnPath) {
  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("next", returnPath);
  return url.toString();
}

function Login() {
  const { isAuthenticated, isConfigured, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const returnPath = POST_LOGIN_PATH;
  const [mode, setMode] = useState("signIn");
  const [formState, setFormState] = useState({
    loading: false,
    error: "",
    message: "",
  });

  function changeMode(nextMode) {
    setMode(nextMode);
    setFormState({ loading: false, error: "", message: "" });
  }

  if (!loading && isAuthenticated) {
    return <Navigate to={returnPath} replace />;
  }

  async function handleSubmit(values) {
    if (!supabase) {
      setFormState({
        loading: false,
        error: "Supabase is not configured for this frontend.",
        message: "",
      });
      return;
    }

    setFormState({ loading: true, error: "", message: "" });

    const authRequest =
      mode === "signUp"
        ? supabase.auth.signUp({
            email: values.email,
            password: values.password,
            options: {
              emailRedirectTo: getAuthCallbackUrl(returnPath),
            },
          })
        : supabase.auth.signInWithPassword({
            email: values.email,
            password: values.password,
          });

    const { data, error } = await authRequest;

    if (error) {
      setFormState({
        loading: false,
        error: readAuthError(error),
        message: "",
      });
      return;
    }

    if (mode === "signUp" && !data.session) {
      setFormState({
        loading: false,
        error: "",
        message: "Account created. Check your email to confirm it.",
      });
      return;
    }

    await refresh();
    navigate(returnPath, { replace: true });
  }

  async function signInWithProvider(provider) {
    if (!supabase) {
      setFormState({
        loading: false,
        error: "Supabase is not configured for this frontend.",
        message: "",
      });
      return;
    }

    setFormState({ loading: true, error: "", message: "" });

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getAuthCallbackUrl(returnPath),
      },
    });

    if (error) {
      setFormState({
        loading: false,
        error: readAuthError(error),
        message: "",
      });
    }
  }

  return (
    <main className="login-shell">
      <section className="login-container">
        <div className="login-copy">
          <div className="login-brand">
            <img
              className="login-brand-logo"
              src={scoutAiWordmark}
              alt="ScoutAI"
            />
            <Text type="secondary">Football Manager player intelligence</Text>
          </div>

          <div>
            <span className="section-kicker">Secure scouting workspace</span>
            <h1 className="page-title">Sign in to open the player database.</h1>
            <p className="page-subtitle">
              Reports, saved players, and search history are tied to your
              account.
            </p>
          </div>

          <div className="metric-grid">
            <Card size="small">
              <Statistic title="Players" value={8452} />
            </Card>
            <Card size="small">
              <Statistic title="Attributes" value={89} />
            </Card>
            <Card size="small">
              <Statistic title="Models" value={5} />
            </Card>
          </div>
        </div>

        <Card
          bordered
          className="auth-card"
          title={mode === "signIn" ? "Sign in" : "Create account"}
        >
          <Segmented
            block
            onChange={changeMode}
            options={[
              { label: "Sign in", value: "signIn" },
              { label: "Sign up", value: "signUp" },
            ]}
            value={mode}
          />

          {!isConfigured && (
            <Alert
              message="Supabase is not configured for this frontend."
              showIcon
              style={{ marginTop: 16 }}
              type="warning"
            />
          )}

          <Space direction="vertical" size={10} style={{ marginTop: 20, width: "100%" }}>
            {socialProviders.map(({ icon, label, provider }) => (
              <Button
                block
                className="auth-centered-button"
                disabled={formState.loading || !isConfigured}
                icon={icon}
                key={provider}
                onClick={() => signInWithProvider(provider)}
                size="large"
              >
                Continue with {label}
              </Button>
            ))}
          </Space>

          <Divider plain>or</Divider>

          <Form
            disabled={formState.loading || !isConfigured}
            layout="vertical"
            onFinish={handleSubmit}
            requiredMark={false}
          >
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: "Enter your email." },
                { type: "email", message: "Enter a valid email." },
              ]}
            >
              <Input
                autoComplete="email"
                autoFocus
                className="auth-input"
                prefix={<MailOutlined />}
                size="large"
                placeholder="you@club.com"
              />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[
                { required: true, message: "Enter your password." },
                { min: 6, message: "Use at least 6 characters." },
              ]}
            >
              <Input.Password
                autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                className="auth-input"
                prefix={<LockOutlined />}
                size="large"
                placeholder="At least 6 characters"
              />
            </Form.Item>

            {formState.error && (
              <Alert
                message={formState.error}
                showIcon
                style={{ marginBottom: 16 }}
                type="error"
              />
            )}

            {formState.message && (
              <Alert
                message={formState.message}
                showIcon
                style={{ marginBottom: 16 }}
                type="success"
              />
            )}

            <Button
              block
              className="auth-centered-button"
              htmlType="submit"
              icon={<LoginOutlined />}
              loading={formState.loading}
              size="large"
              type="primary"
            >
              {mode === "signIn" ? "Sign in" : "Create account"}
            </Button>
          </Form>
        </Card>
      </section>
    </main>
  );
}

export default Login;
