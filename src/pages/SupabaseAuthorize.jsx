import React, { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";

const SCOPE_LABELS = {
  email: "View your email address",
  openid: "Verify your identity",
  phone: "View your phone number",
  profile: "View your basic profile",
};

export default function SupabaseAuthorize() {
  const [searchParams] = useSearchParams();
  const authorizationId = searchParams.get("authorization_id");
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadAuthorization = async () => {
      if (!authorizationId) {
        setError("This authorization link is missing required information.");
        setLoading(false);
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      if (userError || !userData.user) {
        const returnTo = window.location.pathname + window.location.search;
        window.location.replace(`/auth/supabase?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }

      const { data, error: detailsError } =
        await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (detailsError || !data) {
        setError(detailsError?.message || "This authorization request is invalid or has expired.");
        setLoading(false);
        return;
      }

      if (!("authorization_id" in data)) {
        window.location.replace(data.redirect_url);
        return;
      }

      setDetails(data);
      setLoading(false);
    };

    loadAuthorization();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  const respond = async (decision) => {
    if (!authorizationId) return;
    setSubmitting(true);
    setError("");

    try {
      const response =
        decision === "approve"
          ? await supabase.auth.oauth.approveAuthorization(authorizationId)
          : await supabase.auth.oauth.denyAuthorization(authorizationId);

      if (response.error) throw response.error;
      window.location.replace(response.data.redirect_url);
    } catch (responseError) {
      setError(responseError.message || "The authorization decision could not be completed.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AuthLayout icon={ShieldCheck} title="Authorize Clinical SOS">
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
          Loading authorization request…
        </div>
      </AuthLayout>
    );
  }

  if (!details) {
    return (
      <AuthLayout icon={ShieldCheck} title="Authorization unavailable">
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm" role="alert">
          {error}
        </div>
      </AuthLayout>
    );
  }

  const scopes = (details.scope || "")
    .split(" ")
    .map((scope) => scope.trim())
    .filter(Boolean);
  const clientName = details.client?.name || "Clinical SOS";

  return (
    <AuthLayout
      icon={ShieldCheck}
      title="Authorize access"
      subtitle={`${clientName} wants to use your Supabase identity`}
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm" role="alert">
          {error}
        </div>
      )}

      <p className="text-sm font-medium text-foreground mb-3">This will allow it to:</p>
      <ul className="space-y-2 mb-6 text-sm text-muted-foreground">
        {scopes.map((scope) => (
          <li key={scope} className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
            {SCOPE_LABELS[scope] || scope}
          </li>
        ))}
      </ul>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1 h-12 font-medium"
          disabled={submitting}
          onClick={() => respond("deny")}
        >
          Deny
        </Button>
        <Button
          className="flex-1 h-12 font-medium"
          disabled={submitting}
          onClick={() => respond("approve")}
        >
          {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
          Allow
        </Button>
      </div>
    </AuthLayout>
  );
}
