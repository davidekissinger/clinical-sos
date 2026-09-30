import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validateDisplayName(raw: unknown, allowReserved = false) {
  if (!raw || typeof raw !== "string") return { valid: false, error: "Name is required." };
  const value = raw.trim();
  if (value.length < 2) return { valid: false, error: "Name must be at least 2 characters." };
  if (value.length > 100) return { valid: false, error: "Name must not exceed 100 characters." };
  if (/[\x00-\x1f\x7f<>{}\\]/.test(value)) return { valid: false, error: "Name contains invalid characters." };
  if (!allowReserved && RESERVED_NAMES.has(value.toLowerCase())) {
    return { valid: false, error: `"${value}" is a reserved system label.` };
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

async function resolveAppProfile(admin: ReturnType<typeof createClient>, suppliedId: string) {
  if (isUuid(suppliedId)) {
    const { data, error } = await admin.from("profiles")
      .select("id,email,full_name,role").eq("id", suppliedId).maybeSingle();
    if (error) throw error;
    if (data) return { profile: data, legacyId: null };
  }

  const { data: link, error: linkError } = await admin.from("legacy_user_profile_links")
    .select("legacy_user_id,profile_id,legacy_email")
    .eq("legacy_user_id", suppliedId)
    .maybeSingle();
  if (linkError) throw linkError;
  if (!link?.profile_id) return { profile: null, legacyId: suppliedId };

  const { data: profile, error } = await admin.from("profiles")
    .select("id,email,full_name,role").eq("id", link.profile_id).maybeSingle();
  if (error) throw error;
  return { profile, legacyId: suppliedId };
}

async function findIdentityProfile(
  admin: ReturnType<typeof createClient>,
  targetProfileId: string | null,
  legacyId: string | null,
) {
  let query = admin.from("user_identity_profiles").select("*");
  if (targetProfileId && legacyId) {
    query = query.or(`user_profile_id.eq.${targetProfileId},user_id.eq.${legacyId}`);
  } else if (targetProfileId) {
    query = query.or(`user_profile_id.eq.${targetProfileId},user_id.eq.${targetProfileId}`);
  } else if (legacyId) {
    query = query.eq("user_id", legacyId);
  } else {
    return null;
  }
  const { data, error } = await query.order("created_date", { ascending: true }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

async function duplicateCount(admin: ReturnType<typeof createClient>, name: string, excludeId: string) {
  const { data, error } = await admin.from("user_identity_profiles")
    .select("id,verified_display_name,identity_status")
    .eq("identity_status", "Verified");
  if (error) throw error;
  const target = name.trim().toLowerCase();
  return (data || []).filter((x) =>
    x.id !== excludeId &&
    typeof x.verified_display_name === "string" &&
    x.verified_display_name.trim().toLowerCase() === target
  ).length;
}

async function audit(
  admin: ReturnType<typeof createClient>,
  actor: Record<string, unknown>,
  values: Record<string, unknown>,
) {
  const { error } = await admin.from("user_identity_audit_events").insert({
    event_timestamp: new Date().toISOString(),
    performed_by_user_id: actor.id,
    performed_by_profile_id: actor.id,
    performed_by_name_snapshot: actor.full_name || actor.email || "Unknown",
    ...values,
  });
  if (error) throw error;
}

function selfTarget(actorId: string, resolvedProfileId: string | null, suppliedId: string) {
  return resolvedProfileId === actorId || suppliedId === actorId;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

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

    const { data: actor, error: actorError } = await admin.from("profiles")
      .select("id,email,full_name,role").eq("id", user.id).maybeSingle();
    if (actorError) throw actorError;
    if (!actor || actor.role !== "admin") {
      return json({ error: "Forbidden: administrator role required." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";
    if (!action) return json({ error: "Action is required." }, 400);

    if (action === "approve_request" || action === "deny_request") {
      const requestId = typeof body.request_id === "string" ? body.request_id : "";
      const notes = typeof body.decision_notes === "string" ? body.decision_notes.trim() : "";
      if (!requestId) return json({ error: "Request ID is required." }, 400);
      if (!notes) {
        return json({
          error: action === "approve_request"
            ? "A documented reason for the approved name change is required."
            : "A documented reason for denying the request is required.",
        }, 400);
      }

      const { data: request, error: requestError } = await admin.from("user_name_change_requests")
        .select("*").eq("id", requestId).maybeSingle();
      if (requestError) throw requestError;
      if (!request) return json({ error: "Request not found." }, 404);
      if (request.request_status !== "Pending") {
        return json({ error: `Request is not pending (status: ${request.request_status}).` }, 400);
      }
      if (request.requesting_profile_id === actor.id || request.requesting_user_id === actor.id) {
        return json({ error: action === "approve_request" ? "Self-approval is not permitted." : "Self-denial is not permitted." }, 403);
      }

      const now = new Date().toISOString();
      const { data: identity, error: identityError } = await admin.from("user_identity_profiles")
        .select("*").eq("id", request.identity_profile_id).maybeSingle();
      if (identityError) throw identityError;

      if (action === "approve_request") {
        if (!identity) return json({ error: "Identity profile not found." }, 404);

        const oldName = identity.verified_display_name || null;
        const oldCreds = identity.verified_credentials || null;
        const { error: updateIdentityError } = await admin.from("user_identity_profiles")
          .update({
            verified_display_name: request.requested_display_name,
            verified_credentials: request.requested_credentials || identity.verified_credentials,
            identity_status: "Verified",
            last_changed_at: now,
            last_change_request_id: request.id,
          }).eq("id", identity.id);
        if (updateIdentityError) throw updateIdentityError;

        const { error: updateRequestError } = await admin.from("user_name_change_requests")
          .update({
            request_status: "Approved",
            reviewed_by_user_id: actor.id,
            reviewed_by_profile_id: actor.id,
            reviewed_by_name_snapshot: actor.full_name || actor.email,
            reviewed_at: now,
            decision_notes: notes,
            effective_at: now,
          }).eq("id", request.id);
        if (updateRequestError) throw updateRequestError;

        const duplicates = await duplicateCount(admin, request.requested_display_name, identity.id);
        await audit(admin, actor, {
          subject_user_id: identity.user_id || request.requesting_user_id,
          subject_profile_id: identity.user_profile_id || request.requesting_profile_id,
          identity_profile_id: identity.id,
          event_type: "Name Change Approved",
          old_display_name: oldName,
          new_display_name: request.requested_display_name,
          old_credentials: oldCreds,
          new_credentials: request.requested_credentials || oldCreds,
          request_id: request.id,
          reason: notes,
          source: "identity-admin-action:approve_request",
          notes: duplicates ? `Duplicate name detected: ${duplicates} other verified profile(s) share this name.` : null,
        });

        return json({
          success: true,
          duplicate_warning: duplicates ? `${duplicates} other verified profile(s) share this name.` : null,
        });
      }

      const { error: updateRequestError } = await admin.from("user_name_change_requests")
        .update({
          request_status: "Denied",
          reviewed_by_user_id: actor.id,
          reviewed_by_profile_id: actor.id,
          reviewed_by_name_snapshot: actor.full_name || actor.email,
          reviewed_at: now,
          decision_notes: notes,
        }).eq("id", request.id);
      if (updateRequestError) throw updateRequestError;

      if (identity?.identity_status === "Correction Requested") {
        const { error } = await admin.from("user_identity_profiles")
          .update({ identity_status: "Verified" }).eq("id", identity.id);
        if (error) throw error;
      }

      await audit(admin, actor, {
        subject_user_id: request.requesting_user_id,
        subject_profile_id: request.requesting_profile_id,
        identity_profile_id: request.identity_profile_id || null,
        event_type: "Name Change Denied",
        old_display_name: request.current_verified_display_name_snapshot || null,
        new_display_name: null,
        request_id: request.id,
        reason: notes,
        source: "identity-admin-action:deny_request",
      });
      return json({ success: true });
    }

    const suppliedId = typeof body.target_user_id === "string" ? body.target_user_id : "";
    if (!suppliedId) return json({ error: "Target user ID is required." }, 400);

    const resolved = await resolveAppProfile(admin, suppliedId);
    if (!resolved.profile) return json({ error: "Target user not found." }, 404);
    if (selfTarget(actor.id, resolved.profile.id, suppliedId)) {
      const labels: Record<string,string> = {
        init: "Self-initialization is not permitted. Another administrator must initialize your identity.",
        verify: "Self-verification is not permitted. Another administrator must verify your identity.",
        change_credentials: "Self-credential-change is not permitted.",
        suspend: "Self-suspension is not permitted.",
        retire: "Self-retirement is not permitted.",
        reactivate: "Self-reactivation is not permitted.",
      };
      return json({ error: labels[action] || "Self-action is not permitted." }, 403);
    }

    let identity = await findIdentityProfile(admin, resolved.profile.id, resolved.legacyId);
    const subjectUserId = resolved.legacyId || resolved.profile.id;
    const now = new Date().toISOString();

    if (action === "init") {
      if (identity) return json({ error: "An identity profile already exists for this user." }, 409);

      const { data: created, error } = await admin.from("user_identity_profiles")
        .insert({
          user_id: subjectUserId,
          user_profile_id: resolved.profile.id,
          email_snapshot: resolved.profile.email || null,
          provider_full_name_snapshot: resolved.profile.full_name || null,
          verified_display_name: null,
          verified_credentials: null,
          identity_status: "Pending Verification",
          active: true,
          internal_notes: typeof body.internal_notes === "string" ? body.internal_notes : null,
        })
        .select("*").single();
      if (error) throw error;
      identity = created;

      await audit(admin, actor, {
        subject_user_id: subjectUserId,
        subject_profile_id: resolved.profile.id,
        identity_profile_id: identity.id,
        event_type: "Profile Created",
        source: "identity-admin-action:init",
        notes: typeof body.internal_notes === "string" ? body.internal_notes : null,
      });
      return json({ success: true, profile_id: identity.id });
    }

    if (!identity) return json({ error: "Identity profile not found. Initialize it first." }, 404);

    if (action === "verify") {
      const name = validateDisplayName(body.verified_display_name, true);
      if (!name.valid) return json({ error: name.error }, 400);
      const creds = validateCredentials(body.verified_credentials);
      if (!creds.valid) return json({ error: creds.error }, 400);

      const oldName = identity.verified_display_name || null;
      const oldCreds = identity.verified_credentials || null;
      const { error } = await admin.from("user_identity_profiles")
        .update({
          verified_display_name: name.value,
          verified_credentials: creds.value || null,
          identity_status: "Verified",
          verified_by_user_id: actor.id,
          verified_by_profile_id: actor.id,
          verified_by_name_snapshot: actor.full_name || actor.email,
          verified_at: now,
          last_changed_at: now,
          internal_notes: typeof body.internal_notes === "string" && body.internal_notes
            ? body.internal_notes
            : identity.internal_notes,
        }).eq("id", identity.id);
      if (error) throw error;

      const duplicates = await duplicateCount(admin, name.value, identity.id);
      await audit(admin, actor, {
        subject_user_id: subjectUserId,
        subject_profile_id: resolved.profile.id,
        identity_profile_id: identity.id,
        event_type: "Initial Verification",
        old_display_name: oldName,
        new_display_name: name.value,
        old_credentials: oldCreds,
        new_credentials: creds.value || null,
        source: "identity-admin-action:verify",
        notes: duplicates ? `Duplicate name detected: ${duplicates} other verified profile(s) share this name.` : null,
      });
      return json({
        success: true,
        duplicate_warning: duplicates ? `${duplicates} other verified profile(s) share this name.` : null,
      });
    }

    if (action === "change_credentials") {
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (!reason) return json({ error: "A reason for the credential change is required." }, 400);
      const creds = validateCredentials(body.verified_credentials);
      if (!creds.valid) return json({ error: creds.error }, 400);
      const oldCreds = identity.verified_credentials || null;
      const { error } = await admin.from("user_identity_profiles")
        .update({ verified_credentials: creds.value || null, last_changed_at: now })
        .eq("id", identity.id);
      if (error) throw error;
      await audit(admin, actor, {
        subject_user_id: subjectUserId,
        subject_profile_id: resolved.profile.id,
        identity_profile_id: identity.id,
        event_type: "Credentials Changed",
        old_credentials: oldCreds,
        new_credentials: creds.value || null,
        reason,
        source: "identity-admin-action:change_credentials",
      });
      return json({ success: true });
    }

    if (["suspend","retire","reactivate"].includes(action)) {
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (!reason) return json({ error: `A reason for ${action === "suspend" ? "suspension" : action === "retire" ? "retirement" : "reactivation"} is required.` }, 400);

      const newStatus =
        action === "suspend" ? "Suspended" :
        action === "retire" ? "Retired" :
        identity.verified_display_name ? "Verified" : "Pending Verification";
      const active = action === "reactivate";

      const { error } = await admin.from("user_identity_profiles")
        .update({ identity_status: newStatus, active, last_changed_at: now })
        .eq("id", identity.id);
      if (error) throw error;

      const eventType =
        action === "suspend" ? "Identity Suspended" :
        action === "retire" ? "Identity Retired" :
        "Identity Reactivated";
      await audit(admin, actor, {
        subject_user_id: subjectUserId,
        subject_profile_id: resolved.profile.id,
        identity_profile_id: identity.id,
        event_type: eventType,
        old_display_name: identity.verified_display_name || null,
        new_display_name: identity.verified_display_name || null,
        reason,
        source: `identity-admin-action:${action}`,
      });
      return json({ success: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error("identity-admin-action failed", error);
    return json({ error: "Unable to complete identity administration action" }, 500);
  }
});
