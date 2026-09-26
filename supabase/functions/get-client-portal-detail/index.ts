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
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DTO_FIELDS: Record<string, string[]> = {
  engagement: ["id","engagement_name","service_type","phase","status","start_date","estimated_end_date","deliverables","milestones"],
  case: ["id","case_name","facility_name","engagement_id","engagement_name","survey_event_type","survey_date","cms_2567_date","state_agency","revisit_date","current_regulatory_status","case_status","ij_status","cmp_status","dpna_status","sff_status","total_deficiencies","high_priority_deficiencies"],
  deficiency: ["id","regulatory_case_id","engagement_id","facility_name","f_tag","regulation_reference","deficiency_title","scope_severity","scope_severity_letter","harm_level","scope_level","immediate_jeopardy","survey_finding","deficiency_date","deficiency_status","revisit_readiness_status","revisit_readiness_score"],
  poc: ["id","deficiency_id","engagement_id","facility_name","f_tag","version","element_1_specific_correction","element_2_others_potentially_affected","element_3_systemic_correction","element_4_monitoring","element_5_responsibility_qapi_completion","generated_narrative","status","client_review_status","client_reviewed_by","client_reviewed_date","client_review_comment"],
  work_product: ["id","document_type","document_status","facility_name","engagement_name","f_tag","version","generation_date"],
  evidence: ["id","deficiency_id","deficiency_name","facility_name","engagement_id","evidence_type","description","date","review_status","client_response_status","client_response_note","client_responded_by","client_response_date"],
  task: ["id","task","workstream","start_date","due_date","status","linked_engagement_id","client_completion_note","client_completed_by","client_completed_date"],
  audit: ["id","facility_name","engagement_id","f_tag","plain_language_regulatory_focus","audit_date","auditor","audit_result","what_was_corrected","review_date"],
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
  for (const field of fields) if (record[field] !== undefined) dto[field] = record[field];
  return dto;
}

function recordInScope(record: Record<string, unknown>, facilityIds: string[], engagementIds: string[]) {
  if (typeof record.engagement_id === "string" && record.engagement_id) {
    return engagementIds.includes(record.engagement_id);
  }
  if (typeof record.linked_engagement_id === "string" && record.linked_engagement_id) {
    return engagementIds.includes(record.linked_engagement_id);
  }
  if (typeof record.facility_id === "string" && record.facility_id) {
    return facilityIds.includes(record.facility_id);
  }
  return false;
}

function effectiveAccess(account: Record<string, unknown>) {
  const base = typeof account.access_status === "string" ? account.access_status : "Active";
  const override = typeof account.manual_access_override === "string" ? account.manual_access_override : "None";
  if (override === "None") return { status: base, expired: false };
  const expiration = typeof account.manual_override_expiration === "string" ? new Date(account.manual_override_expiration) : null;
  if (expiration && expiration.getTime() < Date.now()) return { status: base, expired: true };
  if (override === "Suspend") return { status: "Suspended", expired: false };
  if (override === "Terminate") return { status: "Terminated", expired: false };
  if (override === "Reactivate" || override === "Extend Access") return { status: "Active", expired: false };
  return { status: base, expired: false };
}

function effectiveCapabilities(membership: Record<string, unknown>, status: string) {
  const caps: Record<string, boolean> = {};
  for (const cap of CAPABILITIES) caps[cap] = membership[cap] === true;
  if (status === "Restricted") {
    for (const cap of ["can_submit_evidence","can_complete_audits","can_approve_poc","can_complete_tasks","can_review_poc","can_message_consultant"]) caps[cap] = false;
  }
  return caps;
}

async function resolveEntitlement(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: profile, error: profileError } = await admin.from("profiles").select("id,email,full_name,role").eq("id", userId).maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.role !== "client") {
    return { authorized: false, reason: "User does not have client role", status: null, caps: {}, facilityIds: [], engagementIds: [], profile };
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
      facilityIds: [],
      engagementIds: [],
      profile,
    };
  }

  const membership = active[0] as Record<string, unknown>;
  if (membership.can_login === false) {
    return { authorized: false, reason: "Login capability not granted", status: null, caps: {}, facilityIds: [], engagementIds: [], profile };
  }

  const { data: account, error: accountError } = await admin
    .from("client_accounts")
    .select("id,access_status,manual_access_override,manual_override_expiration")
    .eq("id", membership.client_account_id)
    .maybeSingle();
  if (accountError) throw accountError;
  if (!account) {
    return { authorized: false, reason: "Client account not found", status: null, caps: {}, facilityIds: [], engagementIds: [], profile };
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
    return { authorized: false, reason: `Account is ${effective.status}`, status: effective.status, caps: {}, facilityIds: [], engagementIds: [], profile };
  }

  const caps = effectiveCapabilities(membership, effective.status);

  const [{ data: facilities, error: facilitiesError }, { data: engagements, error: engagementsError }] = await Promise.all([
    admin.from("client_membership_facilities").select("facility_id").eq("membership_id", membership.id),
    admin.from("client_membership_engagements").select("engagement_id").eq("membership_id", membership.id),
  ]);
  if (facilitiesError) throw facilitiesError;
  if (engagementsError) throw engagementsError;

  await admin.from("client_accounts").update({ last_entitlement_check: new Date().toISOString() }).eq("id", account.id);

  return {
    authorized: true,
    reason: "Authorized",
    status: effective.status,
    caps,
    facilityIds: (facilities || []).map((x) => x.facility_id),
    engagementIds: (engagements || []).map((x) => x.engagement_id),
    profile,
  };
}

async function auditDeny(
  admin: ReturnType<typeof createClient>,
  actualReason: string,
  recordType: string,
  recordId: string,
  userId: string,
  userName: string | null,
  source: string,
) {
  try {
    const now = new Date().toISOString();
    await admin.from("automation_logs").insert({
      automation: "Client Access Change",
      started: now,
      completed: now,
      status: "Success",
      previous_access_state: "N/A",
      new_access_state: "Denied — Non-Disclosing",
      reason: actualReason,
      triggering_source: source,
      acting_user_id: userId,
      acting_user_name: userName,
      affected_record_ids: recordId ? [recordId] : [],
      manual_override: false,
    });
  } catch (error) {
    console.error("Non-blocking denial audit failure", error);
  }
  return json({ error: "Record not found or unavailable" }, 404);
}

async function visibleForEngagement(
  admin: ReturnType<typeof createClient>,
  table: string,
  engagementId: string,
  linked = false,
  orderColumn = "created_date",
  limit = 200,
) {
  const field = linked ? "linked_engagement_id" : "engagement_id";
  const { data, error } = await admin.from(table).select("*")
    .eq("client_visibility", true)
    .eq(field, engagementId)
    .order(orderColumn, { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
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

    let resource: string | null = null;
    let id: string | null = null;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      resource = typeof body.resource === "string" ? body.resource : null;
      id = typeof body.id === "string" ? body.id : null;
    } else {
      const requestUrl = new URL(req.url);
      resource = requestUrl.searchParams.get("resource");
      id = requestUrl.searchParams.get("id");
    }
    if (!resource || !id) return json({ error: "resource and id are required" }, 400);
    if (!["engagement","case","deficiency"].includes(resource)) return json({ error: `Unknown resource: ${resource}` }, 400);

    const admin = createClient(url, getSecretKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const entitlement = await resolveEntitlement(admin, user.id);
    const displayName = entitlement.profile?.full_name || entitlement.profile?.email || user.email || null;

    if (!entitlement.authorized || !entitlement.caps.can_view_engagement) {
      return await auditDeny(admin, entitlement.reason || "Access denied", resource, id, user.id, displayName, "get-client-portal-detail:entitlement");
    }

    const { facilityIds, engagementIds, caps } = entitlement;

    if (resource === "engagement") {
      if (!engagementIds.includes(id)) {
        return await auditDeny(admin, "Engagement not in authorized scope", "Engagement", id, user.id, displayName, "get-client-portal-detail:engagement_scope");
      }

      const { data: engagement, error } = await admin.from("engagements").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!engagement || engagement.client_visibility !== true) {
        return await auditDeny(admin, engagement ? "Engagement not published" : "Engagement not found", "Engagement", id, user.id, displayName, "get-client-portal-detail:engagement_notfound");
      }

      const [cases, deficiencies] = await Promise.all([
        visibleForEngagement(admin, "regulatory_cases", id),
        visibleForEngagement(admin, "deficiencies", id),
      ]);

      let pocs: Record<string, unknown>[] = [];
      let workProducts: Record<string, unknown>[] = [];
      let evidence: Record<string, unknown>[] = [];
      let tasks: Record<string, unknown>[] = [];
      let audits: Record<string, unknown>[] = [];

      if (caps.can_view_poc) {
        pocs = (await visibleForEngagement(admin, "pocs", id))
          .filter((x) => !["AI Draft","Clinical Review"].includes(String(x.status)));
      }
      if (caps.can_view_documents) {
        workProducts = (await visibleForEngagement(admin, "work_products", id))
          .filter((x) => !["DRAFT","CLINICAL REVIEW"].includes(String(x.document_status)));
      }
      if (caps.can_view_evidence) evidence = await visibleForEngagement(admin, "evidence_items", id);
      if (caps.can_view_tasks) tasks = await visibleForEngagement(admin, "tasks", id, true, "due_date", 100);
      if (caps.can_view_audits) audits = await visibleForEngagement(admin, "audit_tools", id);
      const readiness = await visibleForEngagement(admin, "revisit_readiness_criteria", id);

      return json({
        engagement: pick(engagement, DTO_FIELDS.engagement),
        cases: cases.map((x) => pick(x, DTO_FIELDS.case)),
        deficiencies: deficiencies.map((x) => pick(x, DTO_FIELDS.deficiency)),
        pocs: pocs.map((x) => pick(x, DTO_FIELDS.poc)),
        work_products: workProducts.map((x) => pick(x, DTO_FIELDS.work_product)),
        evidence: evidence.map((x) => pick(x, DTO_FIELDS.evidence)),
        tasks: tasks.map((x) => pick(x, DTO_FIELDS.task)),
        audits: audits.map((x) => pick(x, DTO_FIELDS.audit)),
        readiness: readiness.map((x) => pick(x, DTO_FIELDS.readiness)),
      });
    }

    if (resource === "case") {
      const { data: regCase, error } = await admin.from("regulatory_cases").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!regCase || regCase.client_visibility !== true) {
        return await auditDeny(admin, regCase ? "Case not published" : "Case not found", "Case", id, user.id, displayName, "get-client-portal-detail:case_notfound");
      }
      if (!recordInScope(regCase, facilityIds, engagementIds)) {
        return await auditDeny(admin, "Case not in authorized tenant scope", "Case", id, user.id, displayName, "get-client-portal-detail:case_scope");
      }

      const { data: rawDeficiencies, error: defError } = await admin.from("deficiencies")
        .select("*").eq("client_visibility", true).eq("regulatory_case_id", id)
        .order("created_date", { ascending: false }).limit(200);
      if (defError) throw defError;
      const deficiencies = (rawDeficiencies || []).filter((x) => recordInScope(x, facilityIds, engagementIds));

      return json({
        case: pick(regCase, DTO_FIELDS.case),
        deficiencies: deficiencies.map((x) => pick(x, DTO_FIELDS.deficiency)),
      });
    }

    const { data: deficiency, error } = await admin.from("deficiencies").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!deficiency || deficiency.client_visibility !== true) {
      return await auditDeny(admin, deficiency ? "Deficiency not published" : "Deficiency not found", "Deficiency", id, user.id, displayName, "get-client-portal-detail:deficiency_notfound");
    }
    if (!recordInScope(deficiency, facilityIds, engagementIds)) {
      return await auditDeny(admin, "Deficiency not in authorized tenant scope", "Deficiency", id, user.id, displayName, "get-client-portal-detail:deficiency_scope");
    }

    let pocs: Record<string, unknown>[] = [];
    if (caps.can_view_poc) {
      const { data: rawPocs, error: pocError } = await admin.from("pocs").select("*")
        .eq("client_visibility", true).eq("deficiency_id", id)
        .order("created_date", { ascending: false }).limit(200);
      if (pocError) throw pocError;
      pocs = (rawPocs || [])
        .filter((x) => recordInScope(x, facilityIds, engagementIds))
        .filter((x) => !["AI Draft","Clinical Review"].includes(String(x.status)));
    }

    return json({
      deficiency: pick(deficiency, DTO_FIELDS.deficiency),
      pocs: pocs.map((x) => pick(x, DTO_FIELDS.poc)),
    });
  } catch (error) {
    console.error("get-client-portal-detail failed", error);
    return json({ error: "Unable to load client portal detail" }, 500);
  }
});
