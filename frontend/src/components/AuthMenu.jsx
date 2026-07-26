import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/useAuth";

function AuthMenu() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    const { error } = await signOut();
    setIsSigningOut(false);

    if (!error) {
      navigate("/login", { replace: true });
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="hidden max-w-48 truncate text-xs text-slate-400 sm:block">
        {user?.email}
      </span>
      <button
        className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-emerald-300/40 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSigningOut}
        onClick={handleSignOut}
        type="button"
      >
        {isSigningOut ? "Signing out" : "Sign out"}
      </button>
    </div>
  );
}

export default AuthMenu;
