import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const RESERVED_NAMES = new Set(["administrator", "system", "clinical reviewer"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function publicKey() {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed?.default) return parsed.default;
  }
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (!legacy) throw new Error("Supabase publishable key unavailable");
  return legacy;
}

function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed?.default) return parsed.default;
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!legacy) throw new Error("Supabase server key unavailable");
  return legacy;
}

function validateDisplayName(raw: unknown) {
  if (!raw || typeof raw !== "string") return { valid: false, error: "Name is required." };
  const value = raw.trim();
  if (value.length < 2) return { valid: false, error: "Name must be at least 2 characters." };
  if (value.length > 100) return { valid: false, error: "Name must not exceed 100 characters." };
  if (/[\x00-\x1f\x7f<>{}\\]/.test(value)) return { valid: false, error: "Name contains invalid characters." };
  if (RESERVED_NAMES.has(value.toLowerCase())) {
    return { valid: false, error: `"${value}" is a reserved system label. An administrator must explicitly approve it.` };
  }
  return { valid: true, value };
}

function validateCredentials(raw: unknown) {
  if (!raw) return { valid: true, value: "" };
  if (typeof raw !== "string") return { valid: false, error: "Credentials must be text." };
  const value = raw.trim();
  if (value.length < 2) return { valid: false, error: "Credentials must be at least 2 characters." };
  if (value.length > 50) return { valid: false, error: "Credentials must not exceed 50 characters." };
  if (/[\x00-\x1f\x7f<>{}\\]/.test(value)) return { valid: false, error: "Credentials contain invalid characters." };
  return { valid: true, value };
}

function safeProfile(profile: Record<string, unknown> | null) {
  if (!profile) return null;
  return {
    id: profile.id,
    user_id: profile.user_id,
    verified_display_name: profile.verified_display_name,
    verified_credentials: profile.verified_credentials,
    identity_status: profile.identity_status,
    email_snapshot: profile.email_snapshot,
    provider_full_name_snapshot: profile.provider_full_name_snapshot,
  };
}

function safeRequest(request: Record<string, unknown>) {
  return {
    id: request.id,
    requested_display_name: request.requested_display_name,
    requested_credentials: request.requested_credentials,
    reason_for_request: request.reason_for_request,
    request_status: request.request_status,
    requested_at: request.requested_at,
    reviewed_at: request.reviewed_at,
    effective_at: request.effective_at,
  };
}

async function getIdentityProfile(admin: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await admin
    .from("user_identity_profiles")
    .select("*")
    .or(`user_profile_id.eq.${userId},user_id.eq.${userId}`)
    .order("created_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function auditIdentity(
  admin: ReturnType<typeof createClient>,
  values: Record<string, unknown>,
) {
  await admin.from("user_identity_audit_events").insert({
    event_timestamp: new Date().toISOString(),
    ...values,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    if (!url) throw new Error("SUPABASE_URL unavailable");

    const userClient = createClient(url, publicKey(), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(url, secretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: appProfile, error: appProfileError } = await admin
      .from("profiles")
      .select("id,email,full_name,role")
      .eq("id", user.id)
      .maybeSingle();
    if (appProfileError) throw appProfileError;

    const action = req.method === "GET"
      ? "get_profile"
      : String((await req.json().catch(() => ({}))).action || "");

    if (action === "get_profile") {
      const profile = await getIdentityProfile(admin, user.id);

      let requests: Record<string, unknown>[] = [];
      if (profile) {
        const { data, error } = await admin
          .from("user_name_change_requests")
          .select("*")
          .or(`requesting_profile_id.eq.${user.id},requesting_user_id.eq.${user.id}`)
          .order("requested_at", { ascending: false });
        if (error) throw error;
        requests = data || [];
      }

      return json({
        profile: safeProfile(profile),
        requests: requests.map(safeRequest),
        provider_full_name: appProfile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || null,
        email: appProfile?.email || user.email || null,
        role: appProfile?.role || "pending",
      });
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const body = await req.clone().json().catch(() => ({}));

    if (action === "submit_change") {
      const reason = typeof body.reason_for_request === "string" ? body.reason_for_request.trim() : "";
      if (!reason) return json({ error: "A reason for the request is required." }, 400);

      const nameResult = validateDisplayName(body.requested_display_name);
      if (!nameResult.valid) return json({ error: nameResult.error }, 400);

      const credResult = validateCredentials(body.requested_credentials);
      if (!credResult.valid) return json({ error: credResult.error }, 400);

      const profile = await getIdentityProfile(admin, user.id);
      if (!profile) {
        return json({ error: "No identity profile found. An administrator must initialize your identity first." }, 404);
      }

      const { data: pending, error: pendingError } = await admin
        .from("user_name_change_requests")
        .select("id")
        .or(`requesting_profile_id.eq.${user.id},requesting_user_id.eq.${user.id}`)
        .eq("request_status", "Pending")
        .limit(1);
      if (pendingError) throw pendingError;
      if (pending?.length) {
        return json({ error: "You already have a pending name-change request. Withdraw it before submitting a new one." }, 409);
      }

      const now = new Date().toISOString();
      const { data: newRequest, error: requestError } = await admin
        .from("user_name_change_requests")
        .insert({
          requesting_user_id: user.id,
          requesting_profile_id: user.id,
          identity_profile_id: profile.id,
          current_verified_display_name_snapshot: profile.verified_display_name || null,
          requested_display_name: nameResult.value,
          current_credentials_snapshot: profile.verified_credentials || null,
          requested_credentials: credResult.value || null,
          reason_for_request: reason,
          supporting_information: typeof body.supporting_information === "string" && body.supporting_information.trim()
            ? body.supporting_information.trim()
            : null,
          request_status: "Pending",
          requested_at: now,
        })
        .select("id")
        .single();
      if (requestError) throw requestError;

      const profileUpdate: Record<string, unknown> = { last_change_request_id: newRequest.id };
      if (profile.identity_status === "Verified") profileUpdate.identity_status = "Correction Requested";
      const { error: profileUpdateError } = await admin
        .from("user_identity_profiles")
        .update(profileUpdate)
        .eq("id", profile.id);
      if (profileUpdateError) throw profileUpdateError;

      await auditIdentity(admin, {
        subject_user_id: user.id,
        subject_profile_id: user.id,
        identity_profile_id: profile.id,
        event_type: "Name Change Requested",
        old_display_name: profile.verified_display_name || null,
        new_display_name: nameResult.value,
        old_credentials: profile.verified_credentials || null,
        new_credentials: credResult.value || null,
        request_id: newRequest.id,
        reason,
        performed_by_user_id: user.id,
        performed_by_profile_id: user.id,
        performed_by_name_snapshot: appProfile?.full_name || appProfile?.email || user.email || null,
        source: "identity-self-service:submit_change",
      });

      return json({ success: true, request_id: newRequest.id });
    }

    if (action === "withdraw_change") {
      const requestId = typeof body.request_id === "string" ? body.request_id : "";
      if (!requestId) return json({ error: "Request ID is required." }, 400);

      const { data: request, error: requestError } = await admin
        .from("user_name_change_requests")
        .select("*")
        .eq("id", requestId)
        .maybeSingle();
      if (requestError) throw requestError;
      if (!request) return json({ error: "Request not found." }, 404);

      const ownsRequest =
        request.requesting_profile_id === user.id ||
        request.requesting_user_id === user.id;
      if (!ownsRequest) return json({ error: "You can only withdraw your own requests." }, 403);
      if (request.request_status !== "Pending") {
        return json({ error: `Cannot withdraw a request with status '${request.request_status}'.` }, 400);
      }

      const now = new Date().toISOString();
      const { error: updateRequestError } = await admin
        .from("user_name_change_requests")
        .update({ request_status: "Withdrawn", reviewed_at: now })
        .eq("id", request.id);
      if (updateRequestError) throw updateRequestError;

      if (request.identity_profile_id) {
        const { data: identityProfile, error: identityError } = await admin
          .from("user_identity_profiles")
          .select("id,identity_status")
          .eq("id", request.identity_profile_id)
          .maybeSingle();
        if (identityError) throw identityError;
        if (identityProfile?.identity_status === "Correction Requested") {
          const { error: revertError } = await admin
            .from("user_identity_profiles")
            .update({ identity_status: "Verified" })
            .eq("id", identityProfile.id);
          if (revertError) throw revertError;
        }
      }

      await auditIdentity(admin, {
        subject_user_id: user.id,
        subject_profile_id: user.id,
        identity_profile_id: request.identity_profile_id || null,
        event_type: "Name Change Denied",
        old_display_name: request.current_verified_display_name_snapshot || null,
        new_display_name: null,
        request_id: request.id,
        reason: "Withdrawn by requesting user",
        performed_by_user_id: user.id,
        performed_by_profile_id: user.id,
        performed_by_name_snapshot: appProfile?.full_name || appProfile?.email || user.email || null,
        source: "identity-self-service:withdraw_change",
        notes: "User withdrew their own pending request",
      });

      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("identity-self-service failed", error);
    return json({ error: "Unable to complete identity request" }, 500);
  }
});
