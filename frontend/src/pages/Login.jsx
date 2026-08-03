import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Alert, Button, Divider, Form, Input } from "antd";
import { useTranslation } from "react-i18next";
import {
  ArrowRightOutlined,
  DiscordOutlined,
  GithubOutlined,
  GoogleOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";

import { useAuth } from "../auth/useAuth";
import authHero from "../assets/scoutai-auth-hero.png";
import authHeroAnalysis from "../assets/scoutai-auth-hero-analysis.png";
import authHeroPath from "../assets/scoutai-auth-hero-path.png";
import scoutAiWordmark from "../assets/scoutai-wordmark.png";
import { getEnabledOAuthProviders, supabase } from "../lib/supabase";
import {
  activateAuthProvider,
  clearPendingAuthProvider,
  setPendingAuthProvider,
} from "../utils/userProfile";

const socialProviders = [
  { icon: <GoogleOutlined />, label: "Google", provider: "google" },
  { icon: <GithubOutlined />, label: "GitHub", provider: "github" },
  { icon: <DiscordOutlined />, label: "Discord", provider: "discord" },
];

const POST_LOGIN_PATH = "/app";
const AUTO_SLIDE_DELAY = 6500;

const heroImages = [authHero, authHeroAnalysis, authHeroPath];

function readErrorMessage(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    const message = value.trim();
    if (!message || message === "{}" || message === "[object Object]") {
      return "";
    }

    if (message.startsWith("{")) {
      try {
        return readErrorMessage(JSON.parse(message));
      } catch {
        // Keep a non-JSON server message as-is.
      }
    }

    return message;
  }

  if (typeof value === "object") {
    const fields = [
      value.message,
      value.msg,
      value.error_description,
      value.error,
      value.details,
    ];

    for (const field of fields) {
      const message = readErrorMessage(field);
      if (message) {
        return message;
      }
    }
  }

  return "";
}

function readAuthError(error, t, operation = "auth") {
  const message = readErrorMessage(error);
  const code = error?.code;

  if (
    code === "email_address_invalid" ||
    /email address.+is invalid/i.test(message)
  ) {
    return t("errors.invalidEmailAddress");
  }

  if (code === "email_address_not_authorized") {
    return t("errors.emailNotAuthorized");
  }

  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    /rate limit|too many requests/i.test(message)
  ) {
    return t("errors.rateLimit");
  }

  if (/invalid login credentials/i.test(message)) {
    return t("errors.invalidCredentials");
  }

  if (/email not confirmed/i.test(message)) {
    return t("errors.emailUnconfirmed");
  }

  if (/provider is not enabled/i.test(message)) {
    return t("errors.providerDisabled");
  }

  if (
    operation === "email" &&
    (!message || code === "unexpected_failure" || error?.status >= 500)
  ) {
    return t("errors.emailDeliveryFailed");
  }

  return message || t("errors.generic");
}

function getAuthCallbackUrl(returnPath) {
  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("next", returnPath);
  return url.toString();
}

function getPasswordResetUrl() {
  return getAuthCallbackUrl("/reset-password");
}

function Login() {
  const { t } = useTranslation("auth");
  const { isAuthenticated, isConfigured, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const returnPath = POST_LOGIN_PATH;
  const [mode, setMode] = useState("signIn");
  const [enabledOAuthProviders, setEnabledOAuthProviders] = useState([
    "google",
  ]);
  const [formState, setFormState] = useState({
    loading: false,
    error: "",
    message: "",
  });
  const [activeSlide, setActiveSlide] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const pointerStartX = useRef(null);
  const heroSlides = useMemo(
    () =>
      t("hero.slides", { returnObjects: true }).map((slide, index) => ({
        ...slide,
        image: heroImages[index],
      })),
    [t]
  );
  const currentSlide = heroSlides[activeSlide];

  useEffect(() => {
    let isActive = true;

    getEnabledOAuthProviders()
      .then((providers) => {
        if (isActive) {
          setEnabledOAuthProviders(providers);
        }
      })
      .catch(() => {
        // Keep the known-safe Google fallback if provider discovery is offline.
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (
      carouselPaused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, AUTO_SLIDE_DELAY);

    return () => window.clearInterval(intervalId);
  }, [carouselPaused, heroSlides.length]);

  function changeMode(nextMode) {
    setMode(nextMode);
    setFormState({ loading: false, error: "", message: "" });
  }

  function moveSlide(direction) {
    setActiveSlide(
      (current) =>
        (current + direction + heroSlides.length) % heroSlides.length,
    );
  }

  function handleCarouselKeyDown(event) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveSlide(-1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveSlide(1);
    }
  }

  function handlePointerDown(event) {
    pointerStartX.current = event.clientX;
  }

  function handlePointerUp(event) {
    if (pointerStartX.current === null) {
      return;
    }

    const distance = event.clientX - pointerStartX.current;
    pointerStartX.current = null;

    if (Math.abs(distance) > 45) {
      moveSlide(distance > 0 ? -1 : 1);
    }
  }

  if (!loading && isAuthenticated) {
    return <Navigate to={returnPath} replace />;
  }

  async function handleSubmit(values) {
    if (!supabase) {
      setFormState({
        loading: false,
        error: t("errors.supabase"),
        message: "",
      });
      return;
    }

    setFormState({ loading: true, error: "", message: "" });

    if (mode === "forgotPassword") {
      const { error } = await supabase.auth.resetPasswordForEmail(
        values.email.trim(),
        { redirectTo: getPasswordResetUrl() },
      );

      setFormState({
        loading: false,
        error: error ? readAuthError(error, t, "email") : "",
        message: error ? "" : t("passwordResetSent"),
      });
      return;
    }

    const authRequest =
      mode === "signUp"
        ? supabase.auth.signUp({
            email: values.email.trim(),
            password: values.password,
            options: {
              emailRedirectTo: getAuthCallbackUrl(returnPath),
            },
          })
        : supabase.auth.signInWithPassword({
            email: values.email.trim(),
            password: values.password,
          });

    const { data, error } = await authRequest;

    if (error) {
      setFormState({
        loading: false,
        error: readAuthError(error, t, "email"),
        message: "",
      });
      return;
    }

    if (mode === "signUp" && !data.session) {
      setFormState({
        loading: false,
        error: "",
        message: t("accountCreated"),
      });
      return;
    }

    activateAuthProvider("email");
    await supabase.auth.updateUser({
      data: { last_sign_in_provider: "email" },
    });
    await refresh();
    navigate(returnPath, { replace: true });
  }

  async function signInWithProvider(provider) {
    if (!supabase) {
      setFormState({
        loading: false,
        error: t("errors.supabase"),
        message: "",
      });
      return;
    }

    setFormState({ loading: true, error: "", message: "" });
    setPendingAuthProvider(provider);

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getAuthCallbackUrl(returnPath),
      },
    });

    if (error) {
      clearPendingAuthProvider();
      setFormState({
        loading: false,
        error: readAuthError(error, t),
        message: "",
      });
    }
  }

  return (
    <main className="login-shell">
      <section className="login-container" aria-label={t("authenticationLabel")}>
        <aside
          aria-label={t("carousel.label", {
            current: activeSlide + 1,
            total: heroSlides.length,
          })}
          aria-roledescription="carousel"
          className="login-visual"
          onBlur={() => setCarouselPaused(false)}
          onFocus={() => setCarouselPaused(true)}
          onKeyDown={handleCarouselKeyDown}
          onPointerDown={handlePointerDown}
          onPointerEnter={() => setCarouselPaused(true)}
          onPointerLeave={() => {
            pointerStartX.current = null;
            setCarouselPaused(false);
          }}
          onPointerUp={handlePointerUp}
          tabIndex={0}
        >
          <div
            className="login-visual-track"
            style={{ transform: `translate3d(-${activeSlide * 100}%, 0, 0)` }}
          >
            {heroSlides.map((slide, index) => (
              <img
                alt=""
                aria-hidden={index !== activeSlide}
                className="login-visual-image"
                decoding="async"
                draggable="false"
                fetchPriority={index === 0 ? "high" : "auto"}
                key={slide.image}
                loading={index === 0 ? "eager" : "lazy"}
                src={slide.image}
              />
            ))}
          </div>
          <div className="login-visual-overlay" aria-hidden="true" />

          <div className="login-brand">
            <img
              className="login-brand-logo"
              src={scoutAiWordmark}
              alt="ScoutAI"
            />
            <span>{t("hero.brand")}</span>
          </div>

          <div className="login-visual-copy" key={activeSlide}>
            <span className="login-visual-kicker">{currentSlide.kicker}</span>
            <h1>
              {currentSlide.title[0]}
              <br />
              {currentSlide.title[1]}
            </h1>
            <p>{currentSlide.description}</p>
            <div
              className="login-proof"
              aria-label={t("carousel.platformCoverage")}
            >
              {currentSlide.proof.map(([value, label]) => (
                <span key={label}>
                  <strong>{value}</strong> {label}
                </span>
              ))}
            </div>
          </div>

          <div
            className="login-visual-dots"
            aria-label={t("carousel.choose")}
          >
            {heroSlides.map((slide, index) => (
              <button
                aria-label={t("carousel.showSlide", {
                  number: index + 1,
                  title: slide.title.join(" "),
                })}
                aria-pressed={activeSlide === index}
                className={activeSlide === index ? "is-active" : ""}
                key={slide.image}
                onClick={() => setActiveSlide(index)}
                type="button"
              />
            ))}
          </div>
        </aside>

        <section className="auth-panel">
          <div className="login-mobile-brand">
            <img src={scoutAiWordmark} alt="ScoutAI" />
            <span>{t("hero.brand")}</span>
          </div>

          <div className="auth-heading">
            <span className="auth-eyebrow">
              <SafetyCertificateOutlined />
              {t("secureWorkspace")}
            </span>
            <h2>
              {mode === "signIn"
                ? t("welcomeBack")
                : mode === "signUp"
                  ? t("createYourAccount")
                  : t("resetYourPassword")}
            </h2>
            <p>
              {mode === "signIn" ? t("newMember") : t("alreadyMember")}{" "}
              <button
                className="auth-mode-link"
                onClick={() =>
                  changeMode(mode === "signIn" ? "signUp" : "signIn")
                }
                type="button"
              >
                {mode === "signIn" ? t("createAccount") : t("signIn")}
              </button>
            </p>
          </div>

          {!isConfigured && (
            <Alert
              message={t("errors.supabase")}
              showIcon
              type="warning"
            />
          )}

          {mode !== "forgotPassword" && enabledOAuthProviders.length > 0 && (
            <>
              <div className="auth-social-grid">
                {socialProviders
                  .filter(({ provider }) =>
                    enabledOAuthProviders.includes(provider),
                  )
                  .map(({ icon, label, provider }) => (
                    <Button
                      block
                      className="auth-social-button"
                      disabled={formState.loading || !isConfigured}
                      icon={icon}
                      key={provider}
                      onClick={() => signInWithProvider(provider)}
                      size="large"
                    >
                      {label}
                    </Button>
                  ))}
              </div>
              <Divider plain>{t("continueEmail")}</Divider>
            </>
          )}

          <Form
            className="auth-form"
            disabled={formState.loading || !isConfigured}
            layout="vertical"
            onFinish={handleSubmit}
            onValuesChange={() => {
              if (formState.error) {
                setFormState((current) => ({ ...current, error: "" }));
              }
            }}
            requiredMark={false}
          >
            <Form.Item
              extra={mode === "signUp" ? t("emailSignupHint") : null}
              label={t("email")}
              name="email"
              rules={[
                { required: true, message: t("emailRequired") },
                { type: "email", message: t("emailInvalid") },
              ]}
            >
              <Input
                autoComplete="email"
                autoFocus
                className="auth-input"
                prefix={<MailOutlined aria-hidden="true" />}
                size="large"
                placeholder="name@club.com"
              />
            </Form.Item>

            {mode !== "forgotPassword" && (
              <Form.Item
                label={t("password")}
                name="password"
                rules={[
                  { required: true, message: t("passwordRequired") },
                  { min: 6, message: t("passwordMin") },
                ]}
              >
                <Input.Password
                  autoComplete={
                    mode === "signIn" ? "current-password" : "new-password"
                  }
                  className="auth-input"
                  prefix={<LockOutlined aria-hidden="true" />}
                  size="large"
                  placeholder={
                    mode === "signIn"
                      ? t("passwordPlaceholder")
                      : t("passwordCreatePlaceholder")
                  }
                />
              </Form.Item>
            )}

            {mode === "signIn" && (
              <button
                className="auth-forgot-link"
                onClick={() => changeMode("forgotPassword")}
                type="button"
              >
                {t("forgotPassword")}
              </button>
            )}

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
              className="auth-submit-button"
              htmlType="submit"
              loading={formState.loading}
              size="large"
              type="primary"
            >
              {mode === "signIn"
                ? t("signIn")
                : mode === "signUp"
                  ? t("createAccount")
                  : t("sendResetLink")}
              <ArrowRightOutlined />
            </Button>
          </Form>

          <p className="auth-privacy-note">
            <LockOutlined aria-hidden="true" />
            {t("privacy")}
          </p>
        </section>
      </section>
    </main>
  );
}

export default Login;
