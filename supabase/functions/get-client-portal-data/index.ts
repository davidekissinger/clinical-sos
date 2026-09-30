import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const CAPABILITIES = [
  "can_login", "can_view_engagement", "can_view_documents", "can_download_documents",
  "can_view_poc", "can_review_poc", "can_approve_poc", "can_view_tasks",
  "can_complete_tasks", "can_view_evidence", "can_submit_evidence",
  "can_view_audits", "can_complete_audits", "can_message_consultant",
] as const;

const RESOURCE_CAPABILITY: Record<string, string | null> = {
  engagements: "can_view_engagement",
  cases: "can_view_engagement",
  deficiencies: "can_view_engagement",
  pocs: "can_view_poc",
  work_products: "can_view_documents",
  documents: "can_view_documents",
  evidence: "can_view_evidence",
  tasks: "can_view_tasks",
  audits: "can_view_audits",
  readiness: "can_view_engagement",
  dashboard: null,
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DTO_FIELDS: Record<string, string[]> = {
  engagements: ["id","engagement_name","service_type","phase","status","start_date","estimated_end_date","deliverables","milestones"],
  cases: ["id","case_name","facility_name","engagement_id","engagement_name","survey_event_type","survey_date","cms_2567_date","state_agency","revisit_date","current_regulatory_status","case_status","ij_status","cmp_status","dpna_status","sff_status","total_deficiencies","high_priority_deficiencies"],
  deficiencies: ["id","regulatory_case_id","engagement_id","facility_name","f_tag","regulation_reference","deficiency_title","scope_severity","scope_severity_letter","harm_level","scope_level","immediate_jeopardy","survey_finding","deficiency_date","deficiency_status","revisit_readiness_status","revisit_readiness_score"],
  pocs: ["id","deficiency_id","engagement_id","facility_name","f_tag","version","element_1_specific_correction","element_2_others_potentially_affected","element_3_systemic_correction","element_4_monitoring","element_5_responsibility_qapi_completion","generated_narrative","status","client_review_status","client_reviewed_by","client_reviewed_date","client_review_comment"],
  work_products: ["id","document_type","document_status","facility_name","engagement_name","f_tag","version","generation_date"],
  evidence: ["id","deficiency_id","deficiency_name","facility_name","engagement_id","evidence_type","description","date","review_status","client_response_status","client_response_note","client_responded_by","client_response_date"],
  tasks: ["id","task","workstream","start_date","due_date","status","linked_engagement_id","client_completion_note","client_completed_by","client_completed_date"],
  audits: ["id","facility_name","engagement_id","f_tag","plain_language_regulatory_focus","audit_date","auditor","audit_result","what_was_corrected","review_date"],
  readiness: ["id","deficiency_id","facility_name","engagement_id","criterion_label","criterion_key","is_met","met_date","evidence_summary","blocks_readiness"],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getPublicKey() {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed?.default) return parsed.default;
  }
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (!legacy) throw new Error("Supabase publishable key is unavailable");
  return legacy;
}

function getSecretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed?.default) return parsed.default;
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!legacy) throw new Error("Supabase server key is unavailable");
  return legacy;
}

function pick(record: Record<string, unknown>, fields: string[]) {
  const dto: Record<string, unknown> = {};
  for (const field of fields) {
    if (record[field] !== undefined) dto[field] = record[field];
  }
  return dto;
}

function inScope(record: Record<string, unknown>, facilityIds: string[], engagementIds: string[]) {
  const engagementId = record.engagement_id;
  const linkedEngagementId = record.linked_engagement_id;
  if (typeof engagementId === "string" && engagementId) return engagementIds.includes(engagementId);
  if (typeof linkedEngagementId === "string" && linkedEngagementId) return engagementIds.includes(linkedEngagementId);
  const facilityId = record.facility_id;
  if (typeof facilityId === "string" && facilityId) return facilityIds.includes(facilityId);
  return false;
}

function effectiveAccess(account: Record<string, unknown>) {
  const baseStatus = typeof account.access_status === "string" ? account.access_status : "Active";
  const override = typeof account.manual_access_override === "string" ? account.manual_access_override : "None";
  if (override === "None") return { status: baseStatus, expired: false };
  const expiration = typeof account.manual_override_expiration === "string"
    ? new Date(account.manual_override_expiration)
    : null;
  if (expiration && expiration.getTime() < Date.now()) return { status: baseStatus, expired: true };
  if (override === "Suspend") return { status: "Suspended", expired: false };
  if (override === "Terminate") return { status: "Terminated", expired: false };
  if (override === "Reactivate" || override === "Extend Access") return { status: "Active", expired: false };
  return { status: baseStatus, expired: false };
}

function effectiveCapabilities(membership: Record<string, unknown>, status: string) {
  const caps: Record<string, boolean> = {};
  for (const cap of CAPABILITIES) caps[cap] = membership[cap] === true;
  if (status === "Restricted") {
    for (const cap of ["can_submit_evidence","can_complete_audits","can_approve_poc","can_complete_tasks","can_review_poc","can_message_consultant"]) {
      caps[cap] = false;
    }
  }
  return caps;
}

async function resolveEntitlement(
  admin: ReturnType<typeof createClient>,
  userId: string,
  requiredCapability: string | null,
) {
  const { data: profile, error: profileError } = await admin
    .from("profiles").select("id,role").eq("id", userId).maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.role !== "client") {
    return { authorized: false, status: null, reason: "User does not have client role", caps: {}, facilityIds: [], engagementIds: [], membershipStatus: null };
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
      status: null,
      reason: active.length > 1 ? "Multiple active client memberships detected. Administrative review required." : ((memberships?.length || 0) ? `Membership is ${memberships![0].membership_status}` : "No client membership found"),
      caps: {},
      facilityIds: [],
      engagementIds: [],
      membershipStatus: active.length > 1 ? "Conflict" : (memberships?.[0]?.membership_status || null),
    };
  }

  const membership = active[0] as Record<string, unknown>;
  if (membership.can_login === false) {
    return { authorized: false, status: null, reason: "Login capability not granted", caps: {}, facilityIds: [], engagementIds: [], membershipStatus: "Active" };
  }

  const { data: account, error: accountError } = await admin
    .from("client_accounts")
    .select("id,access_status,manual_access_override,manual_override_expiration")
    .eq("id", membership.client_account_id)
    .maybeSingle();
  if (accountError) throw accountError;
  if (!account) {
    return { authorized: false, status: null, reason: "Client account not found", caps: {}, facilityIds: [], engagementIds: [], membershipStatus: "Active" };
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
    return { authorized: false, status: effective.status, reason: `Account is ${effective.status}`, caps: {}, facilityIds: [], engagementIds: [], membershipStatus: "Active" };
  }

  const caps = effectiveCapabilities(membership, effective.status);
  if (requiredCapability && !caps[requiredCapability]) {
    return { authorized: false, status: effective.status, reason: `Capability '${requiredCapability}' not granted`, caps, facilityIds: [], engagementIds: [], membershipStatus: "Active" };
  }

  const [{ data: facilities, error: facilitiesError }, { data: engagements, error: engagementsError }] = await Promise.all([
    admin.from("client_membership_facilities").select("facility_id").eq("membership_id", membership.id),
    admin.from("client_membership_engagements").select("engagement_id").eq("membership_id", membership.id),
  ]);
  if (facilitiesError) throw facilitiesError;
  if (engagementsError) throw engagementsError;

  await admin.from("client_accounts").update({ last_entitlement_check: new Date().toISOString() }).eq("id", account.id);

  return {
    authorized: true,
    status: effective.status,
    reason: "Authorized",
    caps,
    facilityIds: (facilities || []).map((x) => x.facility_id),
    engagementIds: (engagements || []).map((x) => x.engagement_id),
    membershipStatus: "Active",
  };
}

async function scopedRecords(
  admin: ReturnType<typeof createClient>,
  table: string,
  facilityIds: string[],
  engagementIds: string[],
  orderColumn = "created_date",
  limit = 200,
) {
  const { data, error } = await admin.from(table).select("*").eq("client_visibility", true).order(orderColumn, { ascending: false }).limit(limit);
  if (error) throw error;
  return (data || []).filter((record) => inScope(record, facilityIds, engagementIds));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    if (!url) throw new Error("SUPABASE_URL is unavailable");

    const userClient = createClient(url, getPublicKey(), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    let resource = "dashboard";
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (typeof body.resource === "string" && body.resource) resource = body.resource;
    } else {
      resource = new URL(req.url).searchParams.get("resource") || "dashboard";
    }

    if (!(resource in RESOURCE_CAPABILITY)) return json({ error: `Unknown resource: ${resource}` }, 400);

    const admin = createClient(url, getSecretKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const entitlement = await resolveEntitlement(admin, user.id, RESOURCE_CAPABILITY[resource]);

    if (!entitlement.authorized) {
      return json({ error: "Access denied", reason: entitlement.reason, access_status: entitlement.status }, 403);
    }

    const { facilityIds, engagementIds, caps } = entitlement;

    if (resource === "dashboard") {
      const summary: Record<string, number> = {};
      let engagements: Record<string, unknown>[] = [];

      if (caps.can_view_engagement) {
        const { data, error } = await admin.from("engagements").select("*").eq("client_visibility", true).in("id", engagementIds).order("created_date", { ascending: false }).limit(200);
        if (error) throw error;
        engagements = data || [];
        summary.active_engagements = engagements.filter((e) => e.status === "Active").length;

        const cases = await scopedRecords(admin, "regulatory_cases", facilityIds, engagementIds);
        summary.open_cases = cases.filter((c) => c.case_status !== "Closed").length;
      }

      if (caps.can_view_tasks) {
        const tasks = await scopedRecords(admin, "tasks", facilityIds, engagementIds, "due_date", 100);
        summary.open_tasks = tasks.filter((t) => t.status !== "Complete").length;
      }

      if (caps.can_view_poc) {
        const pocs = await scopedRecords(admin, "pocs", facilityIds, engagementIds);
        summary.pocs_in_review = pocs
          .filter((p) => !["AI Draft","Clinical Review"].includes(String(p.status)))
          .filter((p) => p.status === "Client Review").length;
      }

      if (caps.can_view_evidence) {
        const evidence = await scopedRecords(admin, "evidence_items", facilityIds, engagementIds);
        summary.pending_evidence = evidence.filter((e) => e.review_status === "Required" || e.review_status === "Requested").length;
      }

      return json({
        summary,
        engagements: caps.can_view_engagement ? engagements.map((e) => pick(e, DTO_FIELDS.engagements)) : [],
        capabilities: caps,
      });
    }

    if (resource === "engagements") {
      const { data, error } = await admin.from("engagements").select("*").eq("client_visibility", true).in("id", engagementIds).order("created_date", { ascending: false }).limit(200);
      if (error) throw error;
      return json((data || []).map((x) => pick(x, DTO_FIELDS.engagements)));
    }

    const tableMap: Record<string, string> = {
      cases: "regulatory_cases",
      deficiencies: "deficiencies",
      pocs: "pocs",
      work_products: "work_products",
      documents: "work_products",
      evidence: "evidence_items",
      tasks: "tasks",
      audits: "audit_tools",
      readiness: "revisit_readiness_criteria",
    };
    const dtoKey = resource === "documents" ? "work_products" : resource;
    const orderColumn = resource === "tasks" ? "due_date" : "created_date";
    const limit = resource === "tasks" ? 100 : 200;

    let records = await scopedRecords(admin, tableMap[resource], facilityIds, engagementIds, orderColumn, limit);

    if (resource === "pocs") records = records.filter((x) => !["AI Draft","Clinical Review"].includes(String(x.status)));
    if (resource === "work_products" || resource === "documents") {
      records = records.filter((x) => !["DRAFT","CLINICAL REVIEW"].includes(String(x.document_status)));
    }

    return json(records.map((x) => pick(x, DTO_FIELDS[dtoKey])));
  } catch (error) {
    console.error("get-client-portal-data failed", error);
    return json({ error: "Unable to load client portal data" }, 500);
  }
});
