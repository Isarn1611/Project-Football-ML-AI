import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Card, Result, Spin, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";

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

function readCallbackError(message) {
  if (!message) {
    return "";
  }

  if (/unable to exchange external code/i.test(message)) {
    return "Google sign in could not be completed. Check the OAuth redirect settings, then try again.";
  }

  if (/rate limit/i.test(message)) {
    return "Too many sign-in attempts. Wait a few minutes, then try again.";
  }

  if (/access_denied/i.test(message)) {
    return "Sign in was cancelled before access was granted.";
  }

  return message;
}

function AuthCallback() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function finishSignIn() {
      if (!supabase) {
        setError("Sign in is not configured for this app.");
        return;
      }

      const callbackError = getCallbackError(searchParams);
      if (callbackError) {
        setError(readCallbackError(callbackError));
        return;
      }

      const code = searchParams.get("code");
      const next = getSafeNext(searchParams.get("next"));

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          setError(readCallbackError(exchangeError.message));
          return;
        }
      }

      const nextState = await refresh();
      if (!isActive) return;

      if (nextState.user) {
        navigate(next, { replace: true });
      } else {
        setError("Sign in finished, but no session was found. Try signing in again.");
      }
    }

    finishSignIn();

    return () => {
      isActive = false;
    };
  }, [navigate, refresh, searchParams]);

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
                  Back to login
                </Button>
              }
              status="error"
              subTitle={error}
              title="Could not finish sign in"
            />
          ) : (
            <div style={{ padding: 28, textAlign: "center" }}>
              <Spin size="large" />
              <Paragraph style={{ margin: "18px 0 4px" }}>
                <Text strong>Finishing sign in</Text>
              </Paragraph>
              <Text type="secondary">You will be redirected automatically.</Text>
            </div>
          )}
        </Card>
      </section>
    </main>
  );
}

export default AuthCallback;
