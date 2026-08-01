import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { getCurrentUser } from "../services/api";
import { AuthContext } from "./useAuth";

const signedOutState = {
  claims: null,
  role: null,
  session: null,
  user: null,
  loading: false,
};

async function readAuthState() {
  if (!supabase) {
    return signedOutState;
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return signedOutState;
    }

    const userResult = await supabase.auth.getUser();

    if (userResult.error || !userResult.data?.user) {
      return signedOutState;
    }

    const claimsResult = await supabase.auth.getClaims().catch(() => null);
    const claims = claimsResult?.data?.claims || null;
    let role = claims?.user_role || null;

    if (!role) {
      const currentUser = await getCurrentUser().catch(() => null);
      role = currentUser?.role || "user";
    }

    return {
      claims,
      role,
      session,
      user: userResult.data.user,
      loading: false,
    };
  } catch {
    return signedOutState;
  }
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState({
    ...signedOutState,
    loading: isSupabaseConfigured,
  });

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    let isActive = true;

    readAuthState().then((nextState) => {
      if (isActive) {
        setAuthState(nextState);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      readAuthState().then((nextState) => {
        if (isActive) {
          setAuthState(nextState);
        }
      });
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    const nextState = await readAuthState();
    setAuthState(nextState);
    return nextState;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) {
      return { error: new Error("Supabase is not configured") };
    }

    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (!error) {
      setAuthState(signedOutState);
    }

    return { error };
  }, []);

  const value = useMemo(
    () => ({
      ...authState,
      isAdmin: authState.role === "admin",
      isAuthenticated: Boolean(authState.user?.id),
      isConfigured: isSupabaseConfigured,
      refresh,
      signOut,
    }),
    [authState, refresh, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
