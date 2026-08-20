import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Resolve the authoritative display name for a user.
 * Priority: verified_display_name (if Verified) > provider name > email.
 * @returns {{ name: string, verified: boolean, credentials: string }}
 */
export function resolveDisplayName(profile, providerName, email) {
  if (profile && profile.identity_status === "Verified" && profile.verified_display_name) {
    return { name: profile.verified_display_name, verified: true, credentials: profile.verified_credentials || "" };
  }
  if (providerName) {
    return { name: providerName, verified: false, credentials: "" };
  }
  return { name: email || "Unknown", verified: false, credentials: "" };
}

/**
 * Format a display name with an "Unverified" indicator for internal displays.
 */
export function formatDisplayName(profile, providerName, email) {
  const { name, verified } = resolveDisplayName(profile, providerName, email);
  return verified ? name : `${name} (Unverified)`;
}

/**
 * React hook that fetches the current user's identity profile.
 * @returns {{ profile: object|null, loading: boolean, error: object|null, reload: function }}
 */
export function useMyIdentity() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("getMyIdentityProfile", {});
      setProfile(res.data);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return { profile, loading, error, reload: load };
}