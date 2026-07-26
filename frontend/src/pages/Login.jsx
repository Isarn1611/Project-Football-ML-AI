import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Alert, Button, Divider, Form, Input } from "antd";
import {
  ArrowRightOutlined,
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
import { supabase } from "../lib/supabase";

const socialProviders = [
  { icon: <GoogleOutlined />, label: "Google", provider: "google" },
  { icon: <GithubOutlined />, label: "GitHub", provider: "github" },
];

const POST_LOGIN_PATH = "/";
const AUTO_SLIDE_DELAY = 6500;

const heroSlides = [
  {
    image: authHero,
    kicker: "Built for better decisions",
    title: ["See the player.", "Know the fit."],
    description:
      "One clear workspace for player discovery, model-backed insight, and every report your recruitment team trusts.",
    proof: [
      ["8,452", "players"],
      ["89", "attributes"],
      ["5", "models"],
    ],
  },
  {
    image: authHeroAnalysis,
    kicker: "Evidence before instinct",
    title: ["Turn data into", "a clearer decision."],
    description:
      "Compare the attributes that matter, surface hidden strengths, and give every recommendation useful context.",
    proof: [
      ["89", "attributes"],
      ["1", "clear view"],
      ["24/7", "access"],
    ],
  },
  {
    image: authHeroPath,
    kicker: "From shortlist to signing",
    title: ["Build the case.", "Back the player."],
    description:
      "Keep saved players, search history, and scouting reports together from the first look to the final call.",
    proof: [
      ["1", "workspace"],
      ["0", "lost reports"],
      ["100%", "private"],
    ],
  },
];

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
  const [activeSlide, setActiveSlide] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const pointerStartX = useRef(null);
  const currentSlide = heroSlides[activeSlide];

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
  }, [carouselPaused]);

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
      <section className="login-container" aria-label="ScoutAI authentication">
        <aside
          aria-label={`ScoutAI highlights, slide ${activeSlide + 1} of ${heroSlides.length}`}
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
            <span>Player intelligence</span>
          </div>

          <div className="login-visual-copy" key={activeSlide}>
            <span className="login-visual-kicker">{currentSlide.kicker}</span>
            <h1>
              {currentSlide.title[0]}
              <br />
              {currentSlide.title[1]}
            </h1>
            <p>{currentSlide.description}</p>
            <div className="login-proof" aria-label="Platform coverage">
              {currentSlide.proof.map(([value, label]) => (
                <span key={label}>
                  <strong>{value}</strong> {label}
                </span>
              ))}
            </div>
          </div>

          <div className="login-visual-dots" aria-label="Choose a highlight">
            {heroSlides.map((slide, index) => (
              <button
                aria-label={`Show slide ${index + 1}: ${slide.title.join(" ")}`}
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
            <span>Player intelligence</span>
          </div>

          <div className="auth-heading">
            <span className="auth-eyebrow">
              <SafetyCertificateOutlined />
              Secure scouting workspace
            </span>
            <h2>{mode === "signIn" ? "Welcome back" : "Create your account"}</h2>
            <p>
              {mode === "signIn"
                ? "New to ScoutAI?"
                : "Already have a ScoutAI account?"}{" "}
              <button
                className="auth-mode-link"
                onClick={() =>
                  changeMode(mode === "signIn" ? "signUp" : "signIn")
                }
                type="button"
              >
                {mode === "signIn" ? "Create an account" : "Sign in"}
              </button>
            </p>
          </div>

          {!isConfigured && (
            <Alert
              message="Supabase is not configured for this frontend."
              showIcon
              type="warning"
            />
          )}

          <div className="auth-social-grid">
            {socialProviders.map(({ icon, label, provider }) => (
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

          <Divider plain>or continue with email</Divider>

          <Form
            className="auth-form"
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
                prefix={<MailOutlined aria-hidden="true" />}
                size="large"
                placeholder="name@club.com"
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
                autoComplete={
                  mode === "signIn" ? "current-password" : "new-password"
                }
                className="auth-input"
                prefix={<LockOutlined aria-hidden="true" />}
                size="large"
                placeholder={
                  mode === "signIn"
                    ? "Enter your password"
                    : "At least 6 characters"
                }
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
              className="auth-submit-button"
              htmlType="submit"
              loading={formState.loading}
              size="large"
              type="primary"
            >
              {mode === "signIn" ? "Sign in" : "Create account"}
              <ArrowRightOutlined />
            </Button>
          </Form>

          <p className="auth-privacy-note">
            <LockOutlined aria-hidden="true" />
            Your reports, saved players, and search history stay private.
          </p>
        </section>
      </section>
    </main>
  );
}

export default Login;
