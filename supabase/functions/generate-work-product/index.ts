import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

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

function textValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function renderValue(value: unknown) {
  const text = textValue(value);
  return text || "To be completed.";
}

function section(title: string, value: unknown) {
  return `## ${title}\n\n${renderValue(value)}\n`;
}

function unique(values: (string | null | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function sourceVersion(record: Record<string, unknown> | null) {
  if (!record?.id || !record?.updated_date) return null;
  return {
    id: record.id,
    updated_date: record.updated_date,
  };
}

function includeField(
  used: string[],
  prefix: string,
  field: string,
  value: unknown,
) {
  if (textValue(value)) used.push(`${prefix}.${field}`);
}

function isTestRecord(record: Record<string, unknown> | null) {
  return record?.is_test_data === true || record?.is_sample === true;
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
      .select("id,email,full_name,role")
      .eq("id", user.id)
      .maybeSingle();
    if (actorError) throw actorError;
    if (!actor || !["admin","clinical"].includes(actor.role)) {
      return json({ error: "Forbidden — admin or clinical only" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const documentType = typeof body.document_type === "string"
      ? body.document_type.trim()
      : "";
    let deficiencyId = typeof body.deficiency_id === "string" && body.deficiency_id
      ? body.deficiency_id
      : null;
    const pocId = typeof body.poc_id === "string" && body.poc_id
      ? body.poc_id
      : null;
    let regulatoryCaseId = typeof body.regulatory_case_id === "string" && body.regulatory_case_id
      ? body.regulatory_case_id
      : null;
    let engagementId = typeof body.engagement_id === "string" && body.engagement_id
      ? body.engagement_id
      : null;

    if (!documentType) return json({ error: "document_type is required" }, 400);
    if (!deficiencyId && !pocId && !regulatoryCaseId) {
      return json({ error: "At least one of deficiency_id, poc_id, or regulatory_case_id is required" }, 400);
    }

    let poc: Record<string, any> | null = null;
    let deficiency: Record<string, any> | null = null;
    let regCase: Record<string, any> | null = null;
    let facility: Record<string, any> | null = null;
    let engagement: Record<string, any> | null = null;
    let regKnowledge: Record<string, any> | null = null;

    if (pocId) {
      const { data, error } = await admin.from("pocs").select("*").eq("id", pocId).maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "POC not found" }, 404);
      poc = data;
      deficiencyId ||= poc.deficiency_id || null;
      regulatoryCaseId ||= poc.regulatory_case_id || null;
      engagementId ||= poc.engagement_id || null;
    }

    if (deficiencyId) {
      const { data, error } = await admin.from("deficiencies")
        .select("*").eq("id", deficiencyId).maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Deficiency not found" }, 404);
      deficiency = data;
      regulatoryCaseId ||= deficiency.regulatory_case_id || null;
      engagementId ||= deficiency.engagement_id || null;
    }

    if (regulatoryCaseId) {
      const { data, error } = await admin.from("regulatory_cases")
        .select("*").eq("id", regulatoryCaseId).maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Regulatory case not found" }, 404);
      regCase = data;
      engagementId ||= regCase.engagement_id || null;
    }

    const facilityId =
      deficiency?.facility_id ||
      poc?.facility_id ||
      regCase?.facility_id ||
      null;

    if (facilityId) {
      const { data, error } = await admin.from("facilities")
        .select("id,facility_name,is_test_data,is_sample,updated_date")
        .eq("id", facilityId)
        .maybeSingle();
      if (error) throw error;
      facility = data;
    }

    if (engagementId) {
      const { data, error } = await admin.from("engagements")
        .select("id,engagement_name,client_account_id,facility_id,facility_name,is_test_data,is_sample,updated_date")
        .eq("id", engagementId)
        .maybeSingle();
      if (error) throw error;
      engagement = data;
    }

    if (deficiency?.regulatory_knowledge_id) {
      const { data, error } = await admin.from("regulatory_knowledge")
        .select("*")
        .eq("id", deficiency.regulatory_knowledge_id)
        .maybeSingle();
      if (error) throw error;
      if (data?.approval_status === "Approved") regKnowledge = data;
    }

    const sourceFieldsUsed: string[] = [];
    const sourceRecordIds = unique([
      poc?.id,
      deficiency?.id,
      regCase?.id,
      facility?.id,
      engagement?.id,
      regKnowledge?.id,
    ]);

    const sourceSnapshot: Record<string, unknown> = {};

    if (poc) {
      const fields = {
        id: poc.id,
        version: poc.version,
        status: poc.status,
        element_1_specific_correction: poc.element_1_specific_correction,
        element_2_others_potentially_affected: poc.element_2_others_potentially_affected,
        element_3_systemic_correction: poc.element_3_systemic_correction,
        element_4_monitoring: poc.element_4_monitoring,
        element_5_responsibility_qapi_completion: poc.element_5_responsibility_qapi_completion,
        education_plan: poc.education_plan,
        competency_plan: poc.competency_plan,
        evidence_requirements: poc.evidence_requirements,
      };
      sourceSnapshot.poc = fields;
      for (const [field, value] of Object.entries(fields)) {
        if (field !== "id" && field !== "version" && field !== "status") {
          includeField(sourceFieldsUsed, "poc", field, value);
        }
      }
    }

    if (deficiency) {
      const fields = {
        id: deficiency.id,
        f_tag: deficiency.f_tag,
        deficiency_title: deficiency.deficiency_title,
        regulation_reference: deficiency.regulation_reference,
        scope_severity: deficiency.scope_severity,
        immediate_jeopardy: deficiency.immediate_jeopardy,
        survey_finding: deficiency.survey_finding,
        factual_summary: deficiency.factual_summary,
        immediate_correction: deficiency.immediate_correction,
        potentially_affected_population: deficiency.potentially_affected_population,
        systemic_correction: deficiency.systemic_correction,
        audit_monitoring: deficiency.audit_monitoring,
        education_training: deficiency.education_training,
        competency_validation: deficiency.competency_validation,
        responsible_leader: deficiency.responsible_leader,
        target_completion_date: deficiency.target_completion_date,
        qapi_oversight: deficiency.qapi_oversight,
        regulatory_mapping_verified: deficiency.regulatory_mapping_verified,
      };
      sourceSnapshot.deficiency = fields;
      for (const [field, value] of Object.entries(fields)) {
        if (field !== "id") includeField(sourceFieldsUsed, "deficiency", field, value);
      }
    }

    if (regCase) {
      sourceSnapshot.regulatory_case = {
        id: regCase.id,
        case_name: regCase.case_name,
        case_status: regCase.case_status,
        current_regulatory_status: regCase.current_regulatory_status,
      };
      includeField(sourceFieldsUsed, "regulatory_case", "case_name", regCase.case_name);
      includeField(sourceFieldsUsed, "regulatory_case", "case_status", regCase.case_status);
      includeField(sourceFieldsUsed, "regulatory_case", "current_regulatory_status", regCase.current_regulatory_status);
    }

    if (facility) {
      sourceSnapshot.facility = {
        id: facility.id,
        facility_name: facility.facility_name,
      };
      includeField(sourceFieldsUsed, "facility", "facility_name", facility.facility_name);
    }

    if (engagement) {
      sourceSnapshot.engagement = {
        id: engagement.id,
        engagement_name: engagement.engagement_name,
      };
      includeField(sourceFieldsUsed, "engagement", "engagement_name", engagement.engagement_name);
    }

    if (regKnowledge) {
      sourceSnapshot.regulatory_knowledge = {
        id: regKnowledge.id,
        f_tag: regKnowledge.f_tag,
        title: regKnowledge.title,
        regulation_reference: regKnowledge.regulation_reference,
        plain_language_regulatory_focus: regKnowledge.plain_language_regulatory_focus,
        possible_corrective_approaches: regKnowledge.possible_corrective_approaches,
        approval_status: regKnowledge.approval_status,
      };
      includeField(sourceFieldsUsed, "regulatory_knowledge", "title", regKnowledge.title);
      includeField(sourceFieldsUsed, "regulatory_knowledge", "regulation_reference", regKnowledge.regulation_reference);
      includeField(sourceFieldsUsed, "regulatory_knowledge", "plain_language_regulatory_focus", regKnowledge.plain_language_regulatory_focus);
      includeField(sourceFieldsUsed, "regulatory_knowledge", "possible_corrective_approaches", regKnowledge.possible_corrective_approaches);
    }

    const mappingVerified = deficiency?.regulatory_mapping_verified === true;
    const content: string[] = [
      `# ${documentType} — DRAFT`,
      "",
      "> Source-control notice: This draft is assembled only from the structured ClinicalSOS records identified in the provenance section. Missing source fields are shown as “To be completed.” No clinical action, completion, approval, training, audit, verification, resident fact, date, regulatory fact, or responsible person is inferred.",
      "",
    ];

    if (!mappingVerified && deficiency) {
      content.push("> **REGULATORY MAPPING REQUIRES VERIFICATION**", "");
    }

    content.push(
      section("Facility", facility?.facility_name || deficiency?.facility_name || poc?.facility_name),
      section("F-Tag / Regulatory Identifier", deficiency?.f_tag || poc?.f_tag),
      section("Regulation Reference", deficiency?.regulation_reference),
      section("Regulatory Case", regCase?.case_name),
      section("Case Status", regCase?.case_status),
      section("Engagement", engagement?.engagement_name || regCase?.engagement_name || poc?.engagement_name),
    );

    if (deficiency) {
      content.push(
        section("Deficiency Title", deficiency.deficiency_title),
        section("Scope and Severity", deficiency.scope_severity),
        section("Immediate Jeopardy", deficiency.immediate_jeopardy),
        section("Survey Finding", deficiency.survey_finding),
        section("Factual Summary", deficiency.factual_summary),
        section("Immediate Correction", deficiency.immediate_correction),
        section("Others Potentially Affected", deficiency.potentially_affected_population),
        section("Systemic Correction", deficiency.systemic_correction),
        section("Monitoring / Audit", deficiency.audit_monitoring),
        section("Education / Training", deficiency.education_training),
        section("Competency Validation", deficiency.competency_validation),
        section("Responsible Leader", deficiency.responsible_leader),
        section("Target Completion Date", deficiency.target_completion_date),
        section("QAPI Oversight", deficiency.qapi_oversight),
      );
    }

    if (poc) {
      content.push(
        `## Plan of Correction — Version ${poc.version ?? "To be completed."}\n`,
        section("Element 1 — Specific Correction", poc.element_1_specific_correction),
        section("Element 2 — Others Potentially Affected", poc.element_2_others_potentially_affected),
        section("Element 3 — Systemic Correction", poc.element_3_systemic_correction),
        section("Element 4 — Monitoring", poc.element_4_monitoring),
        section("Element 5 — Responsibility / QAPI / Completion", poc.element_5_responsibility_qapi_completion),
        section("Education Plan", poc.education_plan),
        section("Competency Plan", poc.competency_plan),
        section("Evidence Requirements", poc.evidence_requirements),
      );
    }

    if (regKnowledge) {
      content.push(
        "## Approved Regulatory Knowledge Reference\n",
        "> The following material is reference guidance from an approved ClinicalSOS regulatory-knowledge record. It is not evidence that any corrective action has been completed.\n",
        section("Reference Title", regKnowledge.title),
        section("Regulatory Focus", regKnowledge.plain_language_regulatory_focus),
        section("Possible Corrective Approaches", regKnowledge.possible_corrective_approaches),
      );
    }

    content.push(
      "## Provenance\n",
      `Source record IDs: ${sourceRecordIds.length ? sourceRecordIds.join(", ") : "None"}\n`,
      `Structured source fields used: ${sourceFieldsUsed.length ? sourceFieldsUsed.join(", ") : "None"}\n`,
      "Document status: DRAFT\n",
    );

    const finalContent = content.join("\n").trim();
    if (finalContent.length > 200000) {
      return json({ error: "Generated content exceeds the maximum supported length" }, 413);
    }

    const sourceVersions: Record<string, unknown> = {};
    const versions = {
      poc: sourceVersion(poc),
      deficiency: sourceVersion(deficiency),
      regulatory_case: sourceVersion(regCase),
      facility: sourceVersion(facility),
      regulatory_knowledge: sourceVersion(regKnowledge),
      engagement: sourceVersion(engagement),
    };
    for (const [key, value] of Object.entries(versions)) {
      if (value) sourceVersions[key] = value;
    }

    const isTestData = [
      poc, deficiency, regCase, facility, engagement, regKnowledge,
    ].some(isTestRecord);

    const clientAccountId =
      poc?.client_account_id ||
      deficiency?.client_account_id ||
      regCase?.client_account_id ||
      engagement?.client_account_id ||
      null;

    const payload = {
      document_type: documentType,
      client_account_id: clientAccountId,
      facility_id: facility?.id || facilityId || null,
      facility_name: facility?.facility_name || deficiency?.facility_name || poc?.facility_name || null,
      engagement_id: engagement?.id || engagementId || null,
      regulatory_case_id: regCase?.id || regulatoryCaseId || null,
      regulatory_case_name: regCase?.case_name || poc?.regulatory_case_name || deficiency?.regulatory_case_name || null,
      deficiency_id: deficiency?.id || deficiencyId || null,
      deficiency_name: deficiency?.deficiency_title || null,
      f_tag: deficiency?.f_tag || poc?.f_tag || null,
      poc_id: poc?.id || pocId || null,
      content: finalContent,
      source_snapshot: JSON.stringify(sourceSnapshot),
      source_fields_used: unique(sourceFieldsUsed),
      source_record_ids: sourceRecordIds,
      source_versions: sourceVersions,
      is_test_data: isTestData,
    };

    const { data, error } = await admin.rpc("clinical_save_generated_work_product", {
      p_actor_id: user.id,
      p_payload: payload,
    });
    if (error) throw error;

    const result = data || {};
    const status = typeof result._http_status === "number" ? result._http_status : 200;
    const response = { ...result };
    delete response._http_status;

    if (status >= 400) return json(response, status);

    return json({
      ...response,
      generation_mode: "deterministic_structured_template",
      source_snapshot: sourceSnapshot,
      regulatory_mapping_verified: deficiency ? mappingVerified : null,
    }, status);
  } catch (error) {
    console.error("generate-work-product failed", error);
    return json({ error: "Unable to generate work product" }, 500);
  }
});
