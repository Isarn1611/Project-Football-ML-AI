import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { supabase } from "../lib/supabase";

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

function AuthCallback() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function finishSignIn() {
      if (!supabase) {
        setError("Supabase is not configured for this frontend.");
        return;
      }

      const callbackError = getCallbackError(searchParams);
      if (callbackError) {
        setError(callbackError);
        return;
      }

      const code = searchParams.get("code");
      const next = getSafeNext(searchParams.get("next"));

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
      }

      const nextState = await refresh();
      if (!isActive) return;

      if (nextState.user) {
        navigate(next, { replace: true });
      } else {
        setError("Sign in completed, but no Supabase session was found.");
      }
    }

    finishSignIn();

    return () => {
      isActive = false;
    };
  }, [navigate, refresh, searchParams]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#07110d] px-5 text-center text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.055] p-6 shadow-2xl shadow-black/30">
        {error ? (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-rose-300">
              Sign in failed
            </p>
            <h1 className="mt-3 text-2xl font-bold text-white">
              Could not finish sign in
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">{error}</p>
            <Link
              className="mt-6 inline-flex rounded-xl bg-emerald-300 px-5 py-3 font-bold text-emerald-950 transition hover:bg-emerald-200"
              to="/login"
            >
              Back to login
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-emerald-300" />
            <p className="text-sm font-semibold text-slate-300">
              Finishing sign in
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default AuthCallback;
