import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Card, Result, Spin, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

import { useAuth } from "../auth/useAuth";
import { supabase } from "../lib/supabase";

const { Paragraph, Text } = Typography;

function getSafeNext(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

function getHashError() {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  return hashParams.get("error_description") || hashParams.get("error");
}

function decodeCallbackError(value) {
  if (!value) {
    return "";
  }

  let message = value;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const decoded = decodeURIComponent(message.replace(/\+/g, " "));
      if (decoded === message) {
        break;
      }
      message = decoded;
    } catch {
      break;
    }
  }

  return message;
}

function getCallbackError(searchParams) {
  const queryError =
    searchParams.get("error_description") || searchParams.get("error");

  return decodeCallbackError(queryError || getHashError());
}

function readCallbackError(message, t) {
  if (!message) {
    return "";
  }

  if (/unable to exchange external code/i.test(message)) {
    return t("callback.errors.exchange");
  }

  if (/rate limit/i.test(message)) {
    return t("callback.errors.rateLimit");
  }

  if (/access_denied/i.test(message)) {
    return t("callback.errors.cancelled");
  }

  return message;
}

function AuthCallback() {
  const { t } = useTranslation("auth");
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function finishSignIn() {
      if (!supabase) {
        setError(t("callback.errors.notConfigured"));
        return;
      }

      const callbackError = getCallbackError(searchParams);
      if (callbackError) {
        setError(readCallbackError(callbackError, t));
        return;
      }

      const code = searchParams.get("code");
      const next = getSafeNext(searchParams.get("next"));

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          setError(readCallbackError(exchangeError.message, t));
          return;
        }
      }

      const nextState = await refresh();
      if (!isActive) return;

      if (nextState.user) {
        navigate(next, { replace: true });
      } else {
        setError(t("callback.errors.noSession"));
      }
    }

    finishSignIn();

    return () => {
      isActive = false;
    };
  }, [navigate, refresh, searchParams, t]);

  return (
    <main className="login-shell">
      <section className="state-center">
        <Card style={{ maxWidth: 460, width: "min(100% - 32px, 460px)" }}>
          {error ? (
            <Result
              extra={
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate("/login", { replace: true })}
                  type="primary"
                >
                  {t("callback.back")}
                </Button>
              }
              status="error"
              subTitle={error}
              title={t("callback.title")}
            />
          ) : (
            <div style={{ padding: 28, textAlign: "center" }}>
              <Spin size="large" />
              <Paragraph style={{ margin: "18px 0 4px" }}>
                <Text strong>{t("callback.finishing")}</Text>
              </Paragraph>
              <Text type="secondary">{t("callback.redirecting")}</Text>
            </div>
          )}
        </Card>
      </section>
    </main>
  );
}

export default AuthCallback;
