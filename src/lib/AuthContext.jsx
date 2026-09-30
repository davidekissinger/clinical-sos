import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "@/api/supabaseClient";

const AuthContext = createContext(null);

function profileForUser(authUser, profile) {
  return {
    id: authUser.id,
    email: authUser.email || profile?.email || null,
    full_name:
      profile?.full_name ||
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      null,
    // Application authorization is deliberately read from the protected
    // profiles table. Never use editable user_metadata for roles.
    role: profile?.role || "pending",
  };
}

function safeRedirectTarget(value) {
  try {
    const url = new URL(value || "/", window.location.origin);
    if (url.origin !== window.location.origin) return "/";
    if (!url.pathname.startsWith("/") || url.pathname.startsWith("//")) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const requestId = useRef(0);

  const clearUser = useCallback(() => {
    setUser(null);
    setAuthError(null);
    setAuthChecked(true);
    setIsLoadingAuth(false);
  }, []);

  const loadProfile = useCallback(async (authUser) => {
    const currentRequest = ++requestId.current;
    setIsLoadingAuth(true);
    setAuthError(null);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", authUser.id)
      .maybeSingle();

    if (currentRequest !== requestId.current) return;

    if (profileError) {
      setUser(null);
      setAuthError({
        type: "profile_unavailable",
        message: "Your account profile could not be loaded.",
      });
    } else {
      // A missing profile fails closed as pending. The database trigger creates
      // profiles for all new users, while this fallback protects older users.
      setUser(profileForUser(authUser, profile));
    }

    setAuthChecked(true);
    setIsLoadingAuth(false);
  }, []);

  const checkUserAuth = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setIsLoadingAuth(true);
    setAuthError(null);

    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (currentRequest !== requestId.current) return;

    if (error || !authUser) {
      clearUser();
      return;
    }

    await loadProfile(authUser);
  }, [clearUser, loadProfile]);

  useEffect(() => {
    let active = true;

    void checkUserAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      if (!session?.user) {
        requestId.current += 1;
        clearUser();
        return;
      }

      // Supabase recommends keeping auth callbacks lightweight. Defer the
      // profile query until the callback has returned.
      window.setTimeout(() => {
        if (active) void loadProfile(session.user);
      }, 0);
    });

    return () => {
      active = false;
      requestId.current += 1;
      subscription.unsubscribe();
    };
  }, [checkUserAuth, clearUser, loadProfile]);

  const logout = useCallback(async (redirectUrl = "/") => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError({ type: "sign_out_failed", message: error.message });
      return;
    }

    clearUser();
    window.location.assign(safeRedirectTarget(redirectUrl));
  }, [clearUser]);

  const navigateToLogin = useCallback(() => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoadingAuth,
        // Kept as compatibility values while legacy consumers are removed.
        isLoadingPublicSettings: false,
        appPublicSettings: null,
        authError,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState: checkUserAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
