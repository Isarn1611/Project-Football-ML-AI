import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { AuthContext } from "./useAuth";

const signedOutState = {
  claims: null,
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

    const [claimsResult, userResult] = await Promise.all([
      supabase.auth.getClaims(),
      supabase.auth.getUser(),
    ]);

    if (
      claimsResult.error ||
      userResult.error ||
      !claimsResult.data?.claims ||
      !userResult.data?.user
    ) {
      return signedOutState;
    }

    return {
      claims: claimsResult.data.claims,
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
      isAuthenticated: Boolean(authState.claims?.sub),
      isConfigured: isSupabaseConfigured,
      refresh,
      signOut,
    }),
    [authState, refresh, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
