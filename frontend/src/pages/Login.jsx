import { useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { supabase } from "../lib/supabase";

const socialProviders = [
  { label: "Google", provider: "google" },
  { label: "GitHub", provider: "github" },
];

function getReturnPath(location) {
  const from = location.state?.from;
  if (!from?.pathname) {
    return "/";
  }

  return `${from.pathname}${from.search || ""}${from.hash || ""}`;
}

function Login() {
  const { isAuthenticated, isConfigured, loading, refresh } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const returnPath = useMemo(() => getReturnPath(location), [location]);
  const [mode, setMode] = useState("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  async function handleSubmit(event) {
    event.preventDefault();

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
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}${returnPath}`,
            },
          })
        : supabase.auth.signInWithPassword({
            email,
            password,
          });

    const { data, error } = await authRequest;

    if (error) {
      setFormState({
        loading: false,
        error: error.message,
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
        redirectTo: `${window.location.origin}${returnPath}`,
      },
    });

    if (error) {
      setFormState({
        loading: false,
        error: error.message,
        message: "",
      });
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07110d] text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-24 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-[30rem] w-[30rem] rounded-full bg-cyan-500/8 blur-3xl" />
        <div className="pitch-grid absolute inset-0 opacity-30" />
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-300/30 bg-emerald-300/10 text-sm font-black text-emerald-300">
              SA
            </div>
            <div>
              <p className="font-bold tracking-tight text-white">ScoutAI</p>
              <p className="text-xs text-slate-400">Player similarity engine</p>
            </div>
          </div>
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/8 px-3 py-1 text-xs font-semibold text-emerald-200">
            Secure access
          </span>
        </header>

        <div className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1fr_0.8fr] lg:py-20">
          <div>
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.28em] text-emerald-300">
              ScoutAI workspace
            </p>
            <h1 className="max-w-3xl text-5xl font-black leading-[0.96] tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl">
              Sign in before opening the scouting room.
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Your reports and API requests now require a valid Supabase
              session.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-7">
            <div className="mb-6">
              <p className="text-sm font-semibold text-emerald-300">
                {mode === "signIn" ? "Welcome back" : "Create access"}
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">
                {mode === "signIn" ? "Sign in" : "Create account"}
              </h2>
            </div>

            <div className="mb-5 grid grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1">
              <button
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  mode === "signIn"
                    ? "bg-emerald-300 text-emerald-950"
                    : "text-slate-400 hover:text-emerald-200"
                }`}
                onClick={() => changeMode("signIn")}
                type="button"
              >
                Sign in
              </button>
              <button
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  mode === "signUp"
                    ? "bg-emerald-300 text-emerald-950"
                    : "text-slate-400 hover:text-emerald-200"
                }`}
                onClick={() => changeMode("signUp")}
                type="button"
              >
                Sign up
              </button>
            </div>

            {!isConfigured && (
              <p className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.08] px-4 py-3 text-sm text-amber-100">
                Supabase is not configured for this frontend.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {socialProviders.map(({ label, provider }) => (
                <button
                  className="min-h-12 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:border-emerald-300/40 hover:bg-emerald-300/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={formState.loading || !isConfigured}
                  key={provider}
                  onClick={() => signInWithProvider(provider)}
                  type="button"
                >
                  Continue with {label}
                </button>
              ))}
            </div>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                or
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={handleSubmit}>
              <label
                className="mb-2 block text-sm font-medium text-slate-300"
                htmlFor="email"
              >
                Email
              </label>
              <input
                autoComplete="email"
                autoFocus
                className="min-h-14 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-300/70 focus:ring-4 focus:ring-emerald-300/10"
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@club.com"
                required
                type="email"
                value={email}
              />

              <label
                className="mb-2 mt-4 block text-sm font-medium text-slate-300"
                htmlFor="password"
              >
                Password
              </label>
              <input
                autoComplete={
                  mode === "signIn" ? "current-password" : "new-password"
                }
                className="min-h-14 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-300/70 focus:ring-4 focus:ring-emerald-300/10"
                id="password"
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                required
                type="password"
                value={password}
              />

              {formState.error && (
                <p className="mt-3 text-sm text-rose-300" role="alert">
                  {formState.error}
                </p>
              )}

              {formState.message && (
                <p className="mt-3 text-sm text-emerald-200" role="status">
                  {formState.message}
                </p>
              )}

              <button
                className="mt-5 min-h-14 w-full rounded-xl bg-emerald-300 px-5 font-bold text-emerald-950 transition hover:bg-emerald-200 focus:outline-none focus:ring-4 focus:ring-emerald-300/25 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={formState.loading || !isConfigured}
                type="submit"
              >
                {formState.loading
                  ? "Working"
                  : mode === "signIn"
                    ? "Sign in"
                    : "Create account"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Login;
