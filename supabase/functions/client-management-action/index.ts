import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CAPABILITY_KEYS = [
  "can_login","can_view_engagement","can_view_documents","can_download_documents",
  "can_view_poc","can_review_poc","can_approve_poc","can_view_tasks",
  "can_complete_tasks","can_view_evidence","can_submit_evidence",
  "can_view_audits","can_complete_audits","can_message_consultant",
] as const;

const ACCESS_STATUSES = ["Active","Grace Period","Restricted","Suspended","Terminated"];
const BILLING_STATUSES = ["Current","Invoice Due","Past Due","Payment Arrangement","Paid","Disputed","Unknown"];
const SUBSCRIPTION_STATUSES = ["Active","Trial","Grace Period","Past Due","Cancelled","Expired","Not Applicable"];
const OVERRIDE_TYPES = ["None","Suspend","Terminate","Reactivate","Extend Access","Maintain Access"];

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

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((x): x is string => typeof x === "string" && x.length > 0))];
}

function effectiveAccess(account: Record<string, unknown> | null) {
  if (!account) return { status: null, overrideActive: false, overrideExpired: false, reason: "Account not found" };
  const base = typeof account.access_status === "string" ? account.access_status : "Active";
  const override = typeof account.manual_access_override === "string" ? account.manual_access_override : "None";
  if (!override || override === "None") return { status: base, overrideActive: false, overrideExpired: false, reason: "Base access status" };
  const expiration = typeof account.manual_override_expiration === "string"
    ? new Date(account.manual_override_expiration)
    : null;
  if (expiration && expiration.getTime() < Date.now()) {
    return { status: base, overrideActive: false, overrideExpired: true, reason: `Manual override '${override}' expired` };
  }
  if (override === "Suspend") return { status: "Suspended", overrideActive: true, overrideExpired: false, reason: "Manual override 'Suspend' active" };
  if (override === "Terminate") return { status: "Terminated", overrideActive: true, overrideExpired: false, reason: "Manual override 'Terminate' active" };
  if (override === "Reactivate" || override === "Extend Access") return { status: "Active", overrideActive: true, overrideExpired: false, reason: `Manual override '${override}' active` };
  return { status: base, overrideActive: true, overrideExpired: false, reason: `Manual override '${override}' active` };
}

async function actorProfile(admin: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await admin.from("profiles")
    .select("id,email,full_name,role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function resolveProfile(admin: ReturnType<typeof createClient>, suppliedId: string) {
  if (isUuid(suppliedId)) {
    const { data, error } = await admin.from("profiles")
      .select("id,email,full_name,role")
      .eq("id", suppliedId)
      .maybeSingle();
    if (error) throw error;
    if (data) return { profile: data, legacyUserId: null };
  }

  const { data: link, error: linkError } = await admin.from("legacy_user_profile_links")
    .select("legacy_user_id,profile_id")
    .eq("legacy_user_id", suppliedId)
    .maybeSingle();
  if (linkError) throw linkError;
  if (!link?.profile_id) return { profile: null, legacyUserId: suppliedId };

  const { data: profile, error } = await admin.from("profiles")
    .select("id,email,full_name,role")
    .eq("id", link.profile_id)
    .maybeSingle();
  if (error) throw error;
  return { profile, legacyUserId: suppliedId };
}

async function membershipProfileId(admin: ReturnType<typeof createClient>, membership: Record<string, unknown>) {
  if (typeof membership.client_user_id === "string" && membership.client_user_id) {
    return membership.client_user_id;
  }
  if (typeof membership.legacy_client_user_id !== "string" || !membership.legacy_client_user_id) return null;
  const { data, error } = await admin.from("legacy_user_profile_links")
    .select("profile_id")
    .eq("legacy_user_id", membership.legacy_client_user_id)
    .maybeSingle();
  if (error) throw error;
  return data?.profile_id || null;
}

async function getScope(admin: ReturnType<typeof createClient>, membershipId: string) {
  const [{ data: f, error: fe }, { data: e, error: ee }] = await Promise.all([
    admin.from("client_membership_facilities").select("facility_id").eq("membership_id", membershipId),
    admin.from("client_membership_engagements").select("engagement_id").eq("membership_id", membershipId),
  ]);
  if (fe) throw fe;
  if (ee) throw ee;
  return {
    facilityIds: (f || []).map((x) => x.facility_id),
    engagementIds: (e || []).map((x) => x.engagement_id),
  };
}

async function validateFacilityScope(
  admin: ReturnType<typeof createClient>,
  ids: string[],
  account: Record<string, unknown>,
) {
  if (!ids.length) return [];
  if (!account.organization_id) throw new Error("Client Account must be linked to an Organization before tenant resources can be assigned.");

  const { data, error } = await admin.from("facilities")
    .select("id,operator_id")
    .in("id", ids);
  if (error) throw error;

  const matches = new Map((data || []).map((x) => [x.id, x]));
  const invalid = ids.filter((id) => !matches.has(id) || matches.get(id)?.operator_id !== account.organization_id);
  if (invalid.length) {
    throw new Error(`Tenant validation failed: ${invalid.length} facility ID(s) do not belong to this client account's organization`);
  }
  return ids;
}

async function validateEngagementScope(
  admin: ReturnType<typeof createClient>,
  ids: string[],
  account: Record<string, unknown>,
) {
  if (!ids.length) return [];
  if (!account.organization_id) throw new Error("Client Account must be linked to an Organization before tenant resources can be assigned.");

  const { data, error } = await admin.from("engagements")
    .select("id,client_account_id,organization_id")
    .in("id", ids);
  if (error) throw error;

  const matches = new Map((data || []).map((x) => [x.id, x]));
  const invalid = ids.filter((id) => {
    const engagement = matches.get(id);
    if (!engagement) return true;
    if (engagement.client_account_id && engagement.client_account_id === account.id) return false;
    return engagement.organization_id !== account.organization_id;
  });
  if (invalid.length) {
    throw new Error(`Tenant validation failed: ${invalid.length} engagement ID(s) do not belong to this client account`);
  }
  return ids;
}

async function replaceScope(
  admin: ReturnType<typeof createClient>,
  membershipId: string,
  facilityIds: string[] | null,
  engagementIds: string[] | null,
) {
  if (facilityIds !== null) {
    const { error: deleteError } = await admin.from("client_membership_facilities")
      .delete().eq("membership_id", membershipId);
    if (deleteError) throw deleteError;
    if (facilityIds.length) {
      const { error } = await admin.from("client_membership_facilities")
        .insert(facilityIds.map((facility_id) => ({ membership_id: membershipId, facility_id })));
      if (error) throw error;
    }
  }

  if (engagementIds !== null) {
    const { error: deleteError } = await admin.from("client_membership_engagements")
      .delete().eq("membership_id", membershipId);
    if (deleteError) throw deleteError;
    if (engagementIds.length) {
      const { error } = await admin.from("client_membership_engagements")
        .insert(engagementIds.map((engagement_id) => ({ membership_id: membershipId, engagement_id })));
      if (error) throw error;
    }
  }
}

async function audit(
  admin: ReturnType<typeof createClient>,
  actor: Record<string, unknown>,
  values: Record<string, unknown>,
) {
  const now = new Date().toISOString();
  const name = actor.full_name || actor.email || "Unknown";
  const { error } = await admin.from("automation_logs").insert({
    automation: "Client Access Change",
    started: now,
    completed: now,
    status: "Success",
    affected_record_ids: [],
    acting_user_id: actor.id,
    acting_profile_id: actor.id,
    acting_user_name: name,
    manual_override: false,
    ...values,
  });
  if (error) throw error;
}

async function syncProfileRole(
  admin: ReturnType<typeof createClient>,
  membership: Record<string, unknown>,
  effectiveStatus: string | null,
) {
  const profileId = await membershipProfileId(admin, membership);
  const scope = await getScope(admin, String(membership.id));
  if (!profileId) {
    return { role: null, facilityIds: [], engagementIds: [], profileId: null };
  }

  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id,role")
    .eq("id", profileId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return { role: null, facilityIds: [], engagementIds: [], profileId };

  let role = profile.role;
  if (membership.membership_status === "Active") {
    role = "client";
  } else if (profile.role === "client") {
    const { count, error } = await admin.from("client_memberships")
      .select("id", { count: "exact", head: true })
      .eq("client_user_id", profileId)
      .eq("membership_status", "Active");
    if (error) throw error;
    if (!count) role = "pending";
  }

  if (role !== profile.role) {
    const { error } = await admin.from("profiles").update({ role }).eq("id", profileId);
    if (error) throw error;
  }

  const noData = effectiveStatus === "Suspended" || effectiveStatus === "Terminated";
  const active = membership.membership_status === "Active" && !noData;
  return {
    role,
    profileId,
    facilityIds: active ? scope.facilityIds : [],
    engagementIds: active ? scope.engagementIds : [],
  };
}

function capabilityPayload(input: unknown, defaults = false) {
  const source = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const payload: Record<string, boolean> = {};
  const defaultValues: Record<string, boolean> = {
    can_login: true,
    can_view_engagement: true,
    can_view_documents: true,
    can_download_documents: true,
    can_view_poc: true,
    can_review_poc: true,
    can_approve_poc: false,
    can_view_tasks: true,
    can_complete_tasks: false,
    can_view_evidence: true,
    can_submit_evidence: false,
    can_view_audits: true,
    can_complete_audits: false,
    can_message_consultant: true,
  };
  for (const key of CAPABILITY_KEYS) {
    if (key in source) payload[key] = source[key] === true;
    else if (defaults) payload[key] = defaultValues[key];
  }
  return payload;
}

async function fetchAccount(admin: ReturnType<typeof createClient>, accountId: string) {
  const { data, error } = await admin.from("client_accounts")
    .select("*")
    .eq("id", accountId)
    .maybeSingle();
  if (error) throw error;
  return data;
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

    const actor = await actorProfile(admin, user.id);
    if (!actor) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "manage_membership") {
      if (actor.role !== "admin") return json({ error: "Forbidden — admin only" }, 403);
      const membershipAction = typeof body.membership_action === "string" ? body.membership_action : "";
      const reason = typeof body.reason === "string" ? body.reason : null;

      if (membershipAction === "create") {
        const suppliedUserId = typeof body.client_user_id === "string" ? body.client_user_id : "";
        const accountId = typeof body.client_account_id === "string" ? body.client_account_id : "";
        if (!suppliedUserId || !accountId) return json({ error: "client_user_id and client_account_id required" }, 400);

        const account = await fetchAccount(admin, accountId);
        if (!account) return json({ error: "Client account not found" }, 404);
        if (!account.organization_id) return json({ error: "Client Account must be linked to an Organization before tenant resources can be assigned." }, 400);

        const resolved = await resolveProfile(admin, suppliedUserId);
        if (!resolved.profile) return json({ error: "Client user not found or not yet linked to a Supabase profile" }, 404);
        const profileId = resolved.profile.id;

        const facilityIds = await validateFacilityScope(admin, uniqueStrings(body.authorized_facility_ids), account);
        const engagementIds = await validateEngagementScope(admin, uniqueStrings(body.authorized_engagement_ids), account);

        const { data: userMemberships, error: membershipError } = await admin.from("client_memberships")
          .select("*")
          .eq("client_user_id", profileId);
        if (membershipError) throw membershipError;

        const otherActive = (userMemberships || []).filter((m) =>
          m.membership_status === "Active" && m.client_account_id !== accountId
        );
        if (otherActive.length) {
          return json({ error: "V1 Client Portal supports one active Client Membership per user. Suspend, revoke, or expire the existing membership before activating another." }, 409);
        }

        const existing = (userMemberships || []).find((m) =>
          m.client_account_id === accountId &&
          !["Revoked","Expired"].includes(m.membership_status)
        );

        const caps = capabilityPayload(body.capabilities, true);
        const now = new Date().toISOString();
        const basePayload = {
          client_user_id: profileId,
          legacy_client_user_id: resolved.legacyUserId,
          client_user_name: resolved.profile.full_name || resolved.profile.email,
          client_user_email: resolved.profile.email,
          client_account_id: accountId,
          organization_id: account.organization_id,
          organization_name: account.organization_name,
          ...caps,
          membership_status: "Active",
        };

        let membership: Record<string, unknown>;
        let reconciled = false;

        if (existing) {
          const { data, error } = await admin.from("client_memberships")
            .update({
              ...basePayload,
              activated_date: existing.membership_status === "Active"
                ? (existing.activated_date || now)
                : now,
            })
            .eq("id", existing.id)
            .select("*")
            .single();
          if (error) {
            if (error.code === "23505") return json({ error: "V1 Client Portal supports one active Client Membership per user." }, 409);
            throw error;
          }
          membership = data;
          reconciled = true;
        } else {
          const { data, error } = await admin.from("client_memberships")
            .insert({
              ...basePayload,
              invited_date: now,
              activated_date: now,
            })
            .select("*")
            .single();
          if (error) {
            if (error.code === "23505") return json({ error: "V1 Client Portal supports one active Client Membership per user or one open membership per account." }, 409);
            throw error;
          }
          membership = data;
        }

        await replaceScope(admin, String(membership.id), facilityIds, engagementIds);
        const effective = effectiveAccess(account);
        const sync = await syncProfileRole(admin, membership, effective.status);

        await audit(admin, actor, {
          client_account_id: accountId,
          previous_access_state: existing?.membership_status || "None",
          new_access_state: "Active",
          reason: reason || (reconciled ? "Membership reconciled and activated via create" : "Membership created and activated"),
          triggering_source: "client-management-action:manage_membership:create",
          affected_record_ids: [String(membership.id)],
        });

        return json({
          success: true,
          membership_id: membership.id,
          action: "create",
          reconciled,
          assigned_role: sync.role,
        });
      }

      const membershipId = typeof body.membership_id === "string" ? body.membership_id : "";
      if (!membershipId) return json({ error: "membership_id is required" }, 400);

      const { data: membership, error: membershipError } = await admin.from("client_memberships")
        .select("*").eq("id", membershipId).maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) return json({ error: "Membership not found" }, 404);

      const previousState = membership.membership_status;
      const account = await fetchAccount(admin, membership.client_account_id);
      if (!account) return json({ error: "Client account not found" }, 404);

      if (membershipAction === "activate") {
        const profileId = await membershipProfileId(admin, membership);
        if (!profileId) return json({ error: "Membership user is not linked to a Supabase profile" }, 409);
        const { count, error } = await admin.from("client_memberships")
          .select("id", { count: "exact", head: true })
          .eq("client_user_id", profileId)
          .eq("membership_status", "Active")
          .neq("id", membershipId);
        if (error) throw error;
        if (count) return json({ error: "V1 Client Portal supports one active Client Membership per user. Suspend, revoke, or expire the existing membership before activating another." }, 409);

        const { data, error: updateError } = await admin.from("client_memberships")
          .update({ membership_status: "Active", activated_date: new Date().toISOString() })
          .eq("id", membershipId).select("*").single();
        if (updateError) {
          if (updateError.code === "23505") return json({ error: "V1 Client Portal supports one active Client Membership per user." }, 409);
          throw updateError;
        }
        Object.assign(membership, data);
      } else if (membershipAction === "suspend") {
        const { data, error } = await admin.from("client_memberships")
          .update({
            membership_status: "Suspended",
            suspended_date: new Date().toISOString(),
            suspension_reason: reason,
          })
          .eq("id", membershipId).select("*").single();
        if (error) throw error;
        Object.assign(membership, data);
      } else if (membershipAction === "revoke") {
        const { data, error } = await admin.from("client_memberships")
          .update({
            membership_status: "Revoked",
            revoked_date: new Date().toISOString(),
            revocation_reason: reason,
          })
          .eq("id", membershipId).select("*").single();
        if (error) throw error;
        Object.assign(membership, data);
      } else if (membershipAction === "update_capabilities") {
        if (!account.organization_id) return json({ error: "Client Account must be linked to an Organization before tenant resources can be assigned." }, 400);

        const update = capabilityPayload(body.capabilities, false);
        let facilities: string[] | null = null;
        let engagements: string[] | null = null;
        if ("authorized_facility_ids" in body) {
          facilities = await validateFacilityScope(admin, uniqueStrings(body.authorized_facility_ids), account);
        }
        if ("authorized_engagement_ids" in body) {
          engagements = await validateEngagementScope(admin, uniqueStrings(body.authorized_engagement_ids), account);
        }

        if (Object.keys(update).length) {
          const { data, error } = await admin.from("client_memberships")
            .update(update).eq("id", membershipId).select("*").single();
          if (error) throw error;
          Object.assign(membership, data);
        }
        await replaceScope(admin, membershipId, facilities, engagements);
      } else {
        return json({ error: `Unknown membership action: ${membershipAction}` }, 400);
      }

      const effective = effectiveAccess(account);
      const sync = await syncProfileRole(admin, membership, effective.status);
      await audit(admin, actor, {
        client_account_id: membership.client_account_id,
        previous_access_state: previousState,
        new_access_state:
          membershipAction === "activate" ? "Active" :
          membershipAction === "suspend" ? "Suspended" :
          membershipAction === "revoke" ? "Revoked" : previousState,
        reason: reason || `Membership ${membershipAction}`,
        triggering_source: `client-management-action:manage_membership:${membershipAction}`,
        affected_record_ids: [membershipId],
      });

      return json({
        success: true,
        membership_id: membershipId,
        action: membershipAction,
        previous_state: previousState,
        assigned_role: sync.role,
        authorized_facility_ids: sync.facilityIds,
        authorized_engagement_ids: sync.engagementIds,
      });
    }

    if (action === "transition_access") {
      if (actor.role !== "admin") return json({ error: "Forbidden — admin only" }, 403);

      const accountId = typeof body.client_account_id === "string" ? body.client_account_id : "";
      const newStatus = typeof body.new_access_status === "string" ? body.new_access_status : "";
      const reason = typeof body.reason === "string" ? body.reason : null;
      if (!accountId) return json({ error: "client_account_id is required" }, 400);
      if (!ACCESS_STATUSES.includes(newStatus)) return json({ error: "Valid new_access_status is required" }, 400);

      const account = await fetchAccount(admin, accountId);
      if (!account) return json({ error: "Client account not found" }, 404);
      const previous = account.access_status;

      const update: Record<string, unknown> = {
        access_status: newStatus,
        access_restriction_reason: reason,
        access_restriction_effective_date: newStatus !== "Active" ? new Date().toISOString() : null,
      };

      if (body.manual_override === true) {
        const overrideType = typeof body.manual_override_type === "string" ? body.manual_override_type : "";
        if (!OVERRIDE_TYPES.includes(overrideType)) return json({ error: "Invalid manual_override_type" }, 400);
        update.manual_access_override = overrideType;
        update.manual_override_reason = reason;
        update.manual_override_by = actor.full_name || actor.email;
        update.manual_override_by_id = actor.id;
        update.manual_override_effective_date = new Date().toISOString();
        update.manual_override_expiration = typeof body.override_expiration === "string" ? body.override_expiration : null;
      }

      const { data: updated, error } = await admin.from("client_accounts")
        .update(update).eq("id", accountId).select("*").single();
      if (error) throw error;
      const effective = effectiveAccess(updated);

      const { data: memberships, error: membershipsError } = await admin.from("client_memberships")
        .select("*").eq("client_account_id", accountId);
      if (membershipsError) throw membershipsError;

      for (const membership of memberships || []) {
        await syncProfileRole(admin, membership, effective.status);
      }

      await audit(admin, actor, {
        client_account_id: accountId,
        previous_access_state: previous,
        new_access_state: newStatus,
        reason: reason || "No reason provided",
        triggering_source: body.manual_override === true
          ? "client-management-action:admin_manual_override"
          : "client-management-action:admin_transition",
        manual_override: body.manual_override === true,
        manual_override_details: body.manual_override === true
          ? `${String(body.manual_override_type)}${body.override_expiration ? " (expires " + body.override_expiration + ")" : ""}`
          : null,
        affected_record_ids: [accountId],
      });

      return json({
        success: true,
        client_account_id: accountId,
        previous_access_state: previous,
        new_access_state: newStatus,
        effective_access_status: effective.status,
        memberships_synced: memberships?.length || 0,
      });
    }

    if (action === "sync_membership") {
      if (actor.role !== "admin") return json({ error: "Forbidden — admin only" }, 403);
      const membershipId = typeof body.membership_id === "string" ? body.membership_id : "";
      if (!membershipId) return json({ error: "membership_id is required" }, 400);

      const { data: membership, error } = await admin.from("client_memberships")
        .select("*").eq("id", membershipId).maybeSingle();
      if (error) throw error;
      if (!membership) return json({ error: "Membership not found" }, 404);

      let account = membership.client_account_id
        ? await fetchAccount(admin, membership.client_account_id)
        : null;
      const effective = effectiveAccess(account);

      if (effective.overrideExpired && account) {
        const { data: cleared, error: clearError } = await admin.from("client_accounts")
          .update({
            manual_access_override: "None",
            manual_override_reason: null,
            manual_override_by: null,
            manual_override_by_id: null,
            manual_override_effective_date: null,
            manual_override_expiration: null,
            last_entitlement_check: new Date().toISOString(),
          })
          .eq("id", account.id)
          .select("*")
          .single();
        if (clearError) throw clearError;
        account = cleared;
      }

      const finalEffective = effectiveAccess(account);
      const sync = await syncProfileRole(admin, membership, finalEffective.status);

      await audit(admin, actor, {
        client_account_id: membership.client_account_id,
        previous_access_state: account?.access_status || "Unknown",
        new_access_state: finalEffective.status,
        reason: `Membership sync: ${membership.membership_status} (effective: ${finalEffective.status})`,
        triggering_source: "client-management-action:sync_membership",
        manual_override: effective.overrideActive || effective.overrideExpired,
        manual_override_details: effective.reason,
        affected_record_ids: [membershipId],
      });

      return json({
        synced: true,
        client_user_id: sync.profileId,
        assigned_role: sync.role,
        authorized_facility_ids: sync.facilityIds,
        authorized_engagement_ids: sync.engagementIds,
        membership_status: membership.membership_status,
        effective_access_status: finalEffective.status,
      });
    }

    if (action === "update_billing") {
      if (!["admin","finance"].includes(String(actor.role))) {
        return json({ error: "Forbidden — admin or finance only" }, 403);
      }

      const accountId = typeof body.client_account_id === "string" ? body.client_account_id : "";
      if (!accountId) return json({ error: "client_account_id is required" }, 400);

      const account = await fetchAccount(admin, accountId);
      if (!account) return json({ error: "Client account not found" }, 404);

      const update: Record<string, unknown> = {};
      if ("billing_status" in body) {
        if (!BILLING_STATUSES.includes(String(body.billing_status))) return json({ error: "Invalid billing_status" }, 400);
        update.billing_status = body.billing_status;
      }
      if ("subscription_status" in body) {
        if (!SUBSCRIPTION_STATUSES.includes(String(body.subscription_status))) return json({ error: "Invalid subscription_status" }, 400);
        update.subscription_status = body.subscription_status;
      }

      for (const field of [
        "subscription_plan","subscription_start_date","subscription_renewal_date",
        "subscription_end_date","past_due_since","grace_period_end",
      ]) {
        if (field in body) update[field] = body[field] ?? null;
      }

      const { error } = await admin.from("client_accounts").update(update).eq("id", accountId);
      if (error) throw error;

      await audit(admin, actor, {
        client_account_id: accountId,
        previous_access_state: `billing:${account.billing_status}, subscription:${account.subscription_status}`,
        new_access_state: `billing:${body.billing_status || account.billing_status}, subscription:${body.subscription_status || account.subscription_status}`,
        reason: typeof body.reason === "string" ? body.reason : "Billing/subscription update",
        triggering_source: "client-management-action:finance_billing_update",
        affected_record_ids: [accountId],
      });

      let proposed: string | null = null;
      if (body.billing_status === "Past Due" && body.grace_period_end) {
        const graceEnd = new Date(String(body.grace_period_end));
        if (Number.isFinite(graceEnd.getTime()) && graceEnd.getTime() < Date.now()) proposed = "Restricted";
      }
      if (body.subscription_status === "Expired") proposed ||= "Restricted";
      if (body.subscription_status === "Cancelled") proposed = "Suspended";

      return json({
        success: true,
        client_account_id: accountId,
        updated_fields: Object.keys(update),
        proposed_access_change: proposed ? {
          recommended_status: proposed,
          note: "Admin must finalize access_status change via transition_access",
        } : null,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("client-management-action failed", error);
    const message = error instanceof Error ? error.message : "Unable to complete client management action";
    if (/Tenant validation failed|Client Account must be linked/.test(message)) return json({ error: message }, 400);
    return json({ error: "Unable to complete client management action" }, 500);
  }
});
