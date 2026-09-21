import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { KeyRound, Loader2, Lock, Mail, UserPlus } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeReturnTo } from "@/lib/authReturnTo";

const VALID_MODES = new Set(["login", "register", "forgot", "reset", "confirmed"]);

export default function SupabaseSignIn() {
  const [searchParams] = useSearchParams();
  const requestedMode = searchParams.get("mode") || "login";
  const initialMode = VALID_MODES.has(requestedMode) ? requestedMode : "login";
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(mode !== "reset");
  const returnTo = safeReturnTo();

  useEffect(() => {
    let active = true;

    const resolveSession = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;

      if (sessionError) {
        setError(sessionError.message);
        setRecoveryReady(true);
        return;
      }

      if (mode === "reset") {
        setRecoveryReady(Boolean(data.session));
        if (!data.session) {
          setError("This password reset link is invalid or has expired.");
        }
        return;
      }

      if (data.session && mode !== "forgot") {
        window.location.replace(returnTo);
      } else if (mode === "confirmed") {
        setMode("login");
        setError("This confirmation link is invalid or has expired.");
      }
    };

    resolveSession();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (mode === "reset" && (event === "PASSWORD_RECOVERY" || session)) {
        setError("");
        setRecoveryReady(true);
      } else if (session && mode !== "forgot") {
        window.location.replace(returnTo);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [mode, returnTo]);

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if ((mode === "register" || mode === "reset") && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "register") {
        const emailRedirectTo = new URL("/auth/supabase", window.location.origin);
        emailRedirectTo.searchParams.set("mode", "confirmed");
        emailRedirectTo.searchParams.set("returnTo", returnTo);

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: emailRedirectTo.toString() },
        });
        if (signUpError) throw signUpError;

        if (data.session) {
          window.location.replace(returnTo);
          return;
        }
        setMessage("Check your email to confirm your account, then continue signing in.");
      } else if (mode === "forgot") {
        const resetRedirectTo = new URL("/auth/supabase", window.location.origin);
        resetRedirectTo.searchParams.set("mode", "reset");
        resetRedirectTo.searchParams.set("returnTo", returnTo);

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: resetRedirectTo.toString(),
        });
        if (resetError) throw resetError;
        setMessage("If an account exists for that email, a reset link is on its way.");
      } else if (mode === "reset") {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        window.location.replace(returnTo);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        window.location.replace(returnTo);
      }
    } catch (submitError) {
      setError(submitError.message || "Authentication could not be completed.");
    } finally {
      setLoading(false);
    }
  };

  const title = {
    confirmed: "Email confirmed",
    forgot: "Reset password",
    login: "Secure sign in",
    register: "Create your account",
    reset: "Choose a new password",
  }[mode];
  const subtitle = {
    confirmed: "Your account is ready. Returning to authorization…",
    forgot: "We will email you a secure reset link",
    login: "Use your Clinical SOS identity",
    register: "Account access remains subject to Clinical SOS approval",
    reset: "Enter a strong password for your account",
  }[mode];
  const Icon = mode === "register" ? UserPlus : mode === "reset" ? KeyRound : Lock;

  if (mode === "confirmed") {
    return (
      <AuthLayout icon={Mail} title={title} subtitle={subtitle}>
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
          Finishing sign in…
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={Icon}
      title={title}
      subtitle={subtitle}
      footer={
        <Link to="/contact" className="text-primary font-medium hover:underline">
          Need access? Contact Clinical SOS.
        </Link>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 text-emerald-800 text-sm" role="status">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode !== "reset" && (
          <div className="space-y-2">
            <Label htmlFor="supabase-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="supabase-email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>
        )}

        {mode !== "forgot" && (
          <div className="space-y-2">
            <Label htmlFor="supabase-password">
              {mode === "reset" ? "New password" : "Password"}
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="supabase-password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                autoFocus={mode === "reset"}
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>
        )}

        {(mode === "register" || mode === "reset") && (
          <div className="space-y-2">
            <Label htmlFor="supabase-confirm-password">Confirm password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="supabase-confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-12 font-medium"
          disabled={loading || (mode === "reset" && !recoveryReady)}
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
          {mode === "register"
            ? "Create account"
            : mode === "forgot"
              ? "Send reset link"
              : mode === "reset"
                ? "Update password"
                : "Sign in"}
        </Button>
      </form>

      <div className="mt-5 text-center text-sm text-muted-foreground space-y-2">
        {mode === "login" && (
          <>
            <button type="button" onClick={() => changeMode("forgot")} className="block w-full text-primary hover:underline">
              Forgot password?
            </button>
            <button type="button" onClick={() => changeMode("register")} className="block w-full text-primary hover:underline">
              Create an account
            </button>
          </>
        )}
        {(mode === "register" || mode === "forgot") && (
          <button type="button" onClick={() => changeMode("login")} className="text-primary hover:underline">
            Back to sign in
          </button>
        )}
      </div>
    </AuthLayout>
  );
}
