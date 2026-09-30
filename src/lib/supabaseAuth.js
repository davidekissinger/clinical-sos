import { supabase } from "@/api/supabaseClient";

function sameOriginUrl(path = "/") {
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin) {
    return new URL("/", window.location.origin).toString();
  }
  return url.toString();
}

export async function getCurrentApplicationUser() {
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,email,full_name,role")
    .eq("id", authUser.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  return {
    id: authUser.id,
    email: profile?.email || authUser.email || null,
    full_name:
      profile?.full_name ||
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      null,
    // Authorization always comes from server-managed application data.
    // Never use user_metadata for role/permission decisions.
    role: profile?.role || "pending",
  };
}

export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle(returnTo = "/") {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: sameOriginUrl(returnTo),
    },
  });
  if (error) throw error;
  return data;
}

export async function signUpWithPassword(email, password, returnTo = "/") {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: sameOriginUrl(returnTo),
    },
  });
  if (error) throw error;
  return data;
}

export async function requestPasswordReset(email, returnTo = "/") {
  const resetUrl = new URL("/reset-password", window.location.origin);
  resetUrl.searchParams.set("returnTo", returnTo);

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: resetUrl.toString(),
  });
  if (error) throw error;
  return data;
}

export async function updatePassword(password) {
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  return data;
}

export async function signOutLocal() {
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
}

export function onSupabaseAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}
