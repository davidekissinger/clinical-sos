import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const CAPABILITIES = [
  "can_login","can_view_engagement","can_view_documents","can_download_documents",
  "can_view_poc","can_review_poc","can_approve_poc","can_view_tasks","can_complete_tasks",
  "can_view_evidence","can_submit_evidence","can_view_audits","can_complete_audits",
  "can_message_consultant",
] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function effectiveAccess(account: Record<string, unknown>) {
  const base = typeof account.access_status === "string" ? account.access_status : "Active";
  const override = typeof account.manual_access_override === "string" ? account.manual_access_override : "None";
  if (override === "None") return { status: base, expired: false };
  const expiration = typeof account.manual_override_expiration === "string"
    ? new Date(account.manual_override_expiration)
    : null;
  if (expiration && expiration.getTime() < Date.now()) return { status: base, expired: true };
  if (override === "Suspend") return { status: "Suspended", expired: false };
  if (override === "Terminate") return { status: "Terminated", expired: false };
  if (override === "Reactivate" || override === "Extend Access") return { status: "Active", expired: false };
  return { status: base, expired: false };
}

function capabilities(membership: Record<string, unknown>, status: string) {
  const result: Record<string, boolean> = {};
  for (const capability of CAPABILITIES) result[capability] = membership[capability] === true;
  if (status === "Restricted") {
    for (const capability of [
      "can_submit_evidence","can_complete_audits","can_approve_poc",
      "can_complete_tasks","can_review_poc","can_message_consultant",
    ]) result[capability] = false;
  }
  return result;
}

async function resolveClient(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: profile, error: profileError } = await admin
    .from("profiles").select("id,email,full_name,role").eq("id", userId).maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.role !== "client") {
    return { authorized: false, reason: "User does not have client role", status: null, caps: {}, engagementIds: [], profile };
  }

  const { data: memberships, error: membershipError } = await admin
    .from("client_memberships")
    .select("id,client_account_id,membership_status,can_login,can_view_engagement,can_view_documents,can_download_documents,can_view_poc,can_review_poc,can_approve_poc,can_view_tasks,can_complete_tasks,can_view_evidence,can_submit_evidence,can_view_audits,can_complete_audits,can_message_consultant,created_date")
    .eq("client_user_id", userId)
    .order("created_date", { ascending: true });
  if (membershipError) throw membershipError;

  const active = (memberships || []).filter((m) => m.membership_status === "Active");
  if (active.length !== 1) {
    return {
      authorized: false,
      reason: active.length > 1 ? "Multiple active client memberships detected. Administrative review required." : ((memberships?.length || 0) ? `Membership is ${memberships![0].membership_status}` : "No client membership found"),
      status: null,
      caps: {},
      engagementIds: [],
      profile,
    };
  }

  const membership = active[0] as Record<string, unknown>;
  if (membership.can_login === false) {
    return { authorized: false, reason: "Login capability not granted", status: null, caps: {}, engagementIds: [], profile };
  }

  const { data: account, error: accountError } = await admin
    .from("client_accounts")
    .select("id,access_status,manual_access_override,manual_override_expiration")
    .eq("id", membership.client_account_id)
    .maybeSingle();
  if (accountError) throw accountError;
  if (!account) {
    return { authorized: false, reason: "Client account not found", status: null, caps: {}, engagementIds: [], profile };
  }

  const effective = effectiveAccess(account);
  if (effective.expired) {
    await admin.from("client_accounts").update({
      manual_access_override: "None",
      manual_override_reason: null,
      manual_override_by: null,
      manual_override_by_id: null,
      manual_override_effective_date: null,
      manual_override_expiration: null,
      last_entitlement_check: new Date().toISOString(),
    }).eq("id", account.id);
  }

  if (effective.status === "Suspended" || effective.status === "Terminated") {
    return { authorized: false, reason: `Account is ${effective.status}`, status: effective.status, caps: {}, engagementIds: [], profile };
  }

  const caps = capabilities(membership, effective.status);
  const { data: engagementScope, error: engagementError } = await admin
    .from("client_membership_engagements")
    .select("engagement_id")
    .eq("membership_id", membership.id);
  if (engagementError) throw engagementError;

  await admin.from("client_accounts")
    .update({ last_entitlement_check: new Date().toISOString() })
    .eq("id", account.id);

  return {
    authorized: true,
    reason: "Authorized",
    status: effective.status,
    caps,
    engagementIds: (engagementScope || []).map((x) => x.engagement_id),
    profile,
  };
}

async function audit(
  admin: ReturnType<typeof createClient>,
  values: Record<string, unknown>,
) {
  const now = new Date().toISOString();
  await admin.from("automation_logs").insert({
    automation: "Client Access Change",
    started: now,
    completed: now,
    status: "Success",
    manual_override: false,
    affected_record_ids: [],
    ...values,
  });
}

async function deny(
  admin: ReturnType<typeof createClient>,
  reason: string,
  recordId: string,
  userId: string,
  userName: string | null,
  source: string,
) {
  try {
    await audit(admin, {
      previous_access_state: "N/A",
      new_access_state: "Denied — Non-Disclosing",
      reason,
      triggering_source: source,
      acting_user_id: userId,
      acting_user_name: userName,
      affected_record_ids: recordId ? [recordId] : [],
    });
  } catch (error) {
    console.error("Non-blocking denial audit failure", error);
  }
  return json({ error: "Record not found or unavailable" }, 404);
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

    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : null;
    if (!["update_task","respond_evidence","review_poc"].includes(action || "")) {
      return json({ error: "Unknown action" }, 400);
    }

    const admin = createClient(url, secretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const entitlement = await resolveClient(admin, user.id);
    const userName = entitlement.profile?.full_name || entitlement.profile?.email || user.email || null;

    if (!entitlement.authorized) {
      const recordId = String(body.task_id || body.evidence_id || body.poc_id || "");
      return await deny(admin, entitlement.reason || "Access denied", recordId, user.id, userName, `client-portal-action:${action}:entitlement`);
    }

    if (action === "update_task") {
      const taskId = typeof body.task_id === "string" ? body.task_id : "";
      const status = typeof body.status === "string" ? body.status : "";
      const completionNote = typeof body.completion_note === "string" ? body.completion_note : null;
      if (!taskId) return json({ error: "task_id is required" }, 400);
      if (!["Not Started","In Progress","Complete"].includes(status)) {
        return json({ error: "status must be one of: Not Started, In Progress, Complete" }, 400);
      }

      const { data: task, error } = await admin.from("tasks").select("*").eq("id", taskId).maybeSingle();
      if (error) throw error;
      if (!task) return await deny(admin, "Task not found", taskId, user.id, userName, "client-portal-action:update_task:not_found");
      if (!task.linked_engagement_id) return await deny(admin, "Task missing engagement relationship", taskId, user.id, userName, "client-portal-action:update_task:no_engagement");
      if (task.client_visibility !== true) return await deny(admin, "Task is not client-visible", taskId, user.id, userName, "client-portal-action:update_task:not_visible");
      if (!entitlement.caps.can_complete_tasks) return await deny(admin, "Capability can_complete_tasks not granted", taskId, user.id, userName, "client-portal-action:update_task:capability");
      if (!entitlement.engagementIds.includes(task.linked_engagement_id)) return await deny(admin, "Task engagement not in authorized tenant scope", taskId, user.id, userName, "client-portal-action:update_task:scope");

      const completedAt = new Date().toISOString();
      const { error: updateError } = await admin.from("tasks").update({
        status,
        client_completion_note: completionNote || null,
        client_completed_by: userName,
        client_completed_date: completedAt,
      }).eq("id", taskId);
      if (updateError) throw updateError;

      await audit(admin, {
        previous_access_state: task.status,
        new_access_state: status,
        reason: `Client task update: ${taskId}`,
        triggering_source: "client-portal-action:update_task",
        acting_user_id: user.id,
        acting_user_name: userName,
        affected_record_ids: [taskId],
      });

      return json({ success: true, task_id: taskId, status, client_completed_by: userName, client_completed_date: completedAt });
    }

    if (action === "respond_evidence") {
      const evidenceId = typeof body.evidence_id === "string" ? body.evidence_id : "";
      const responseStatus = typeof body.response_status === "string" ? body.response_status : "";
      const note = typeof body.note === "string" ? body.note : null;
      const allowed = ["Prepared","Available","Clarification Requested","Noted"];
      if (!evidenceId) return json({ error: "evidence_id is required" }, 400);
      if (!allowed.includes(responseStatus)) return json({ error: "response_status must be one of: " + allowed.join(", ") }, 400);

      const { data: evidence, error } = await admin.from("evidence_items").select("*").eq("id", evidenceId).maybeSingle();
      if (error) throw error;
      if (!evidence) return await deny(admin, "Evidence item not found", evidenceId, user.id, userName, "client-portal-action:respond_evidence:not_found");
      if (!evidence.engagement_id) return await deny(admin, "Evidence item missing engagement relationship", evidenceId, user.id, userName, "client-portal-action:respond_evidence:no_engagement");
      if (evidence.client_visibility !== true) return await deny(admin, "Evidence item is not client-visible", evidenceId, user.id, userName, "client-portal-action:respond_evidence:not_visible");
      if (!entitlement.caps.can_submit_evidence) return await deny(admin, "Capability can_submit_evidence not granted", evidenceId, user.id, userName, "client-portal-action:respond_evidence:capability");
      if (!entitlement.engagementIds.includes(evidence.engagement_id)) return await deny(admin, "Evidence engagement not in authorized tenant scope", evidenceId, user.id, userName, "client-portal-action:respond_evidence:scope");

      const responseDate = new Date().toISOString();
      const { error: updateError } = await admin.from("evidence_items").update({
        client_response_status: responseStatus,
        client_response_note: note || null,
        client_responded_by: userName,
        client_responded_by_id: user.id,
        client_response_date: responseDate,
      }).eq("id", evidenceId);
      if (updateError) throw updateError;

      await audit(admin, {
        previous_access_state: evidence.client_response_status || "Pending",
        new_access_state: responseStatus,
        reason: `Client evidence response: ${evidenceId}`,
        triggering_source: "client-portal-action:respond_evidence",
        acting_user_id: user.id,
        acting_user_name: userName,
        affected_record_ids: [evidenceId],
      });

      return json({ success: true, evidence_id: evidenceId, client_response_status: responseStatus, client_responded_by: userName, client_response_date: responseDate });
    }

    const pocId = typeof body.poc_id === "string" ? body.poc_id : "";
    const reviewAction = typeof body.review_action === "string" ? body.review_action : "";
    const comment = typeof body.comment === "string" ? body.comment : null;
    const allowedActions = ["acknowledge","request_revision","client_approve"];
    if (!pocId) return json({ error: "poc_id is required" }, 400);
    if (!allowedActions.includes(reviewAction)) return json({ error: "review_action must be one of: " + allowedActions.join(", ") }, 400);

    const { data: poc, error } = await admin.from("pocs").select("*").eq("id", pocId).maybeSingle();
    if (error) throw error;
    if (!poc) return await deny(admin, "POC not found", pocId, user.id, userName, "client-portal-action:review_poc:not_found");
    if (!poc.engagement_id) return await deny(admin, "POC missing engagement relationship", pocId, user.id, userName, "client-portal-action:review_poc:no_engagement");
    if (poc.client_visibility !== true) return await deny(admin, "POC is not client-visible", pocId, user.id, userName, "client-portal-action:review_poc:not_visible");
    if (["AI Draft","Clinical Review"].includes(poc.status)) return await deny(admin, `POC status '${poc.status}' is not client-visible`, pocId, user.id, userName, "client-portal-action:review_poc:lifecycle");
    if (!entitlement.engagementIds.includes(poc.engagement_id)) return await deny(admin, "POC engagement not in authorized tenant scope", pocId, user.id, userName, "client-portal-action:review_poc:scope");

    const requiredCapability = reviewAction === "client_approve" ? "can_approve_poc" : "can_review_poc";
    if (!entitlement.caps[requiredCapability]) return await deny(admin, `Capability ${requiredCapability} not granted`, pocId, user.id, userName, "client-portal-action:review_poc:capability");
    if (!["Client Review","Revision Requested"].includes(poc.status)) {
      return json({ error: `POC status '${poc.status}' is not in client review state` }, 403);
    }

    const clientReviewStatus =
      reviewAction === "acknowledge" ? "Acknowledged" :
      reviewAction === "request_revision" ? "Revision Requested" :
      "Client Approved";
    const reviewedAt = new Date().toISOString();

    const { error: updateError } = await admin.from("pocs").update({
      client_review_status: clientReviewStatus,
      client_reviewed_by: userName,
      client_reviewed_by_id: user.id,
      client_reviewed_date: reviewedAt,
      client_review_comment: comment || null,
    }).eq("id", pocId);
    if (updateError) throw updateError;

    await audit(admin, {
      previous_access_state: poc.client_review_status || "Pending",
      new_access_state: clientReviewStatus,
      reason: `Client POC review (${reviewAction}): ${pocId}`,
      triggering_source: "client-portal-action:review_poc",
      acting_user_id: user.id,
      acting_user_name: userName,
      affected_record_ids: [pocId],
    });

    return json({
      success: true,
      poc_id: pocId,
      client_review_status: clientReviewStatus,
      client_reviewed_by: userName,
      client_reviewed_date: reviewedAt,
      regulatory_status_unchanged: poc.status,
    });
  } catch (error) {
    console.error("client-portal-action failed", error);
    return json({ error: "Unable to complete client portal action" }, 500);
  }
});
