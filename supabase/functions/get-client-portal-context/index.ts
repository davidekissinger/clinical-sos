import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const CAPABILITIES = [
  "can_login",
  "can_view_engagement",
  "can_view_documents",
  "can_download_documents",
  "can_view_poc",
  "can_review_poc",
  "can_approve_poc",
  "can_view_tasks",
  "can_complete_tasks",
  "can_view_evidence",
  "can_submit_evidence",
  "can_view_audits",
  "can_complete_audits",
  "can_message_consultant",
] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

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
  if (!legacy) throw new Error("Supabase publishable key is unavailable");
  return legacy;
}

function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed?.default) return parsed.default;
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!legacy) throw new Error("Supabase server key is unavailable");
  return legacy;
}

function portalMessage(status: string | null) {
  switch (status) {
    case "Active":
      return null;
    case "Grace Period":
      return "Your account is currently within a billing or subscription grace period. Portal access remains available.";
    case "Restricted":
      return "Your account is currently in restricted mode. You may view previously published documents, but new interactive actions are unavailable.";
    case "Suspended":
      return "Portal access is temporarily suspended. Please contact Clinical SOS regarding your account.";
    case "Terminated":
      return "Portal access is no longer available. Please contact Clinical SOS if you have questions.";
    default:
      return null;
  }
}

function effectiveAccess(account: {
  access_status?: string | null;
  manual_access_override?: string | null;
  manual_override_expiration?: string | null;
}) {
  const baseStatus = account.access_status || "Active";
  const override = account.manual_access_override || "None";
  if (override === "None") {
    return { status: baseStatus, expired: false };
  }

  const expiration = account.manual_override_expiration
    ? new Date(account.manual_override_expiration)
    : null;
  if (expiration && expiration.getTime() < Date.now()) {
    return { status: baseStatus, expired: true };
  }

  if (override === "Suspend") return { status: "Suspended", expired: false };
  if (override === "Terminate") return { status: "Terminated", expired: false };
  if (override === "Reactivate" || override === "Extend Access") {
    return { status: "Active", expired: false };
  }
  return { status: baseStatus, expired: false };
}

function capabilities(membership: Record<string, unknown>, accessStatus: string) {
  const result: Record<string, boolean> = {};
  for (const capability of CAPABILITIES) {
    result[capability] = membership[capability] === true;
  }

  if (accessStatus === "Restricted") {
    for (const capability of [
      "can_submit_evidence",
      "can_complete_audits",
      "can_approve_poc",
      "can_complete_tasks",
      "can_review_poc",
      "can_message_consultant",
    ]) {
      result[capability] = false;
    }
  }
  return result;
}

async function audit(
  admin: ReturnType<typeof createClient>,
  event: Record<string, unknown>,
) {
  try {
    const now = new Date().toISOString();
    await admin.from("automation_logs").insert({
      automation: "Client Access Change",
      started: now,
      completed: now,
      status: "Success",
      manual_override: false,
      affected_record_ids: [],
      ...event,
    });
  } catch (error) {
    console.error("Non-blocking entitlement audit failure", error);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL");
    if (!url) throw new Error("SUPABASE_URL is unavailable");

    const userClient = createClient(url, publicKey(), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(url, secretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id,email,full_name,role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile || profile.role !== "client") {
      return json({
        authorized: false,
        access_status: null,
        account_name: null,
        membership_status: null,
        effective_capabilities: {},
        authorized_engagements: [],
        authorized_facilities: [],
        portal_message:
          "No active client membership found. Please contact Clinical SOS if you believe this is an error.",
        reason: "User does not have client role",
      });
    }

    const { data: memberships, error: membershipError } = await admin
      .from("client_memberships")
      .select(
        "id,client_account_id,membership_status,can_login,can_view_engagement,can_view_documents,can_download_documents,can_view_poc,can_review_poc,can_approve_poc,can_view_tasks,can_complete_tasks,can_view_evidence,can_submit_evidence,can_view_audits,can_complete_audits,can_message_consultant,created_date",
      )
      .eq("client_user_id", user.id)
      .order("created_date", { ascending: true });

    if (membershipError) throw membershipError;

    if (!memberships?.length) {
      return json({
        authorized: false,
        access_status: null,
        account_name: null,
        membership_status: null,
        effective_capabilities: {},
        authorized_engagements: [],
        authorized_facilities: [],
        portal_message:
          "No active client membership found. Please contact Clinical SOS if you believe this is an error.",
        reason: "No client membership found",
      });
    }

    const activeMemberships = memberships.filter(
      (membership) => membership.membership_status === "Active",
    );

    if (activeMemberships.length > 1) {
      await audit(admin, {
        previous_access_state: "Active",
        new_access_state: "Conflict",
        reason: `Multiple active client memberships detected for user ${user.id}. Membership IDs: ${activeMemberships.map((m) => m.id).join(", ")}. Administrative review required.`,
        triggering_source: "get-client-portal-context:multiple_active_conflict",
        acting_user_id: "system",
        acting_user_name: "System — Membership Conflict Detector",
      });

      return json({
        authorized: false,
        access_status: null,
        account_name: null,
        membership_status: "Conflict",
        effective_capabilities: {},
        authorized_engagements: [],
        authorized_facilities: [],
        portal_message:
          "No active client membership found. Please contact Clinical SOS if you believe this is an error.",
        reason:
          "Multiple active client memberships detected. Administrative review required.",
      });
    }

    if (activeMemberships.length === 0) {
      return json({
        authorized: false,
        access_status: null,
        account_name: null,
        membership_status: memberships[0].membership_status,
        effective_capabilities: {},
        authorized_engagements: [],
        authorized_facilities: [],
        portal_message:
          "No active client membership found. Please contact Clinical SOS if you believe this is an error.",
        reason: `Membership is ${memberships[0].membership_status}`,
      });
    }

    const membership = activeMemberships[0];

    if (membership.can_login === false) {
      return json({
        authorized: false,
        access_status: null,
        account_name: null,
        membership_status: membership.membership_status,
        effective_capabilities: {},
        authorized_engagements: [],
        authorized_facilities: [],
        portal_message:
          "No active client membership found. Please contact Clinical SOS if you believe this is an error.",
        reason: "Login capability not granted",
      });
    }

    const { data: account, error: accountError } = await admin
      .from("client_accounts")
      .select(
        "id,account_name,access_status,manual_access_override,manual_override_expiration",
      )
      .eq("id", membership.client_account_id)
      .maybeSingle();

    if (accountError) throw accountError;

    if (!account) {
      return json({
        authorized: false,
        access_status: null,
        account_name: null,
        membership_status: membership.membership_status,
        effective_capabilities: {},
        authorized_engagements: [],
        authorized_facilities: [],
        portal_message:
          "No active client membership found. Please contact Clinical SOS if you believe this is an error.",
        reason: "Client account not found",
      });
    }

    const effective = effectiveAccess(account);

    if (effective.expired) {
      const now = new Date().toISOString();
      await admin
        .from("client_accounts")
        .update({
          manual_access_override: "None",
          manual_override_reason: null,
          manual_override_by: null,
          manual_override_by_id: null,
          manual_override_effective_date: null,
          manual_override_expiration: null,
          last_entitlement_check: now,
        })
        .eq("id", account.id);

      await audit(admin, {
        client_account_id: account.id,
        previous_access_state: account.manual_access_override,
        new_access_state: effective.status,
        reason: "Manual override expired — automatic recalculation",
        triggering_source: "get-client-portal-context:override_expired",
        acting_user_id: "system",
        acting_user_name: "System — Override Expiration",
        manual_override: true,
        manual_override_details: "Override expired and was automatically cleared",
        affected_record_ids: [account.id],
      });
    }

    if (effective.status === "Suspended" || effective.status === "Terminated") {
      return json({
        authorized: false,
        access_status: effective.status,
        account_name: account.account_name,
        membership_status: membership.membership_status,
        effective_capabilities: {},
        authorized_engagements: [],
        authorized_facilities: [],
        portal_message: portalMessage(effective.status),
        reason: `Account is ${effective.status}`,
      });
    }

    const effectiveCapabilities = capabilities(membership, effective.status);

    const [{ data: facilityScope, error: facilityScopeError }, {
      data: engagementScope,
      error: engagementScopeError,
    }] = await Promise.all([
      admin
        .from("client_membership_facilities")
        .select("facility_id")
        .eq("membership_id", membership.id),
      admin
        .from("client_membership_engagements")
        .select("engagement_id")
        .eq("membership_id", membership.id),
    ]);

    if (facilityScopeError) throw facilityScopeError;
    if (engagementScopeError) throw engagementScopeError;

    const facilityIds = (facilityScope || []).map((row) => row.facility_id);
    const engagementIds = (engagementScope || []).map((row) => row.engagement_id);

    let authorizedFacilities: unknown[] = [];
    let authorizedEngagements: unknown[] = [];

    if (facilityIds.length) {
      const { data, error } = await admin
        .from("facilities")
        .select("id,facility_name,city,state")
        .in("id", facilityIds)
        .order("facility_name", { ascending: true });
      if (error) throw error;
      authorizedFacilities = data || [];
    }

    if (engagementIds.length) {
      const { data, error } = await admin
        .from("engagements")
        .select(
          "id,engagement_name,service_type,phase,status,start_date,estimated_end_date,deliverables,milestones",
        )
        .in("id", engagementIds)
        .eq("client_visibility", true)
        .order("created_date", { ascending: false });
      if (error) throw error;
      authorizedEngagements = data || [];
    }

    await admin
      .from("client_accounts")
      .update({ last_entitlement_check: new Date().toISOString() })
      .eq("id", account.id);

    return json({
      authorized: true,
      access_status: effective.status,
      account_name: account.account_name,
      membership_status: membership.membership_status,
      effective_capabilities: effectiveCapabilities,
      authorized_facilities: authorizedFacilities,
      authorized_engagements: authorizedEngagements,
      portal_message: portalMessage(effective.status),
      reason: null,
    });
  } catch (error) {
    console.error("get-client-portal-context failed", error);
    return json({ error: "Unable to resolve client portal access" }, 500);
  }
});
