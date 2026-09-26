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

function rpcResponse(data: Record<string, unknown> | null) {
  if (!data) return json({ error: "Workflow returned no result" }, 500);
  const status = typeof data._http_status === "number" ? data._http_status : 200;
  const payload = { ...data };
  delete payload._http_status;
  return json(payload, status);
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
    const action = typeof body.action === "string" ? body.action : "";

    const admin = createClient(url, secretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (action === "transition_poc") {
      const { data, error } = await admin.rpc("clinical_transition_poc", {
        p_actor_id: user.id,
        p_poc_id: typeof body.poc_id === "string" ? body.poc_id : "",
        p_action: typeof body.transition_action === "string" ? body.transition_action : "",
        p_evidence: typeof body.evidence === "string" ? body.evidence : null,
        p_revision_notes: typeof body.revision_notes === "string" ? body.revision_notes : null,
      });
      if (error) throw error;
      return rpcResponse(data);
    }

    if (action === "close_deficiency") {
      const { data, error } = await admin.rpc("clinical_close_deficiency", {
        p_actor_id: user.id,
        p_deficiency_id: typeof body.deficiency_id === "string" ? body.deficiency_id : "",
        p_force: body.force === true,
        p_override_reason: typeof body.override_reason === "string" ? body.override_reason : null,
      });
      if (error) throw error;
      return rpcResponse(data);
    }

    if (action === "create_engagement") {
      const { data, error } = await admin.rpc("clinical_create_engagement_from_opportunity", {
        p_actor_id: user.id,
        p_opportunity_id: typeof body.opportunity_id === "string" ? body.opportunity_id : "",
        p_service_type: typeof body.service_type === "string" ? body.service_type : "",
        p_start_date: typeof body.start_date === "string" ? body.start_date : null,
        p_clinical_lead_name: typeof body.clinical_lead_name === "string" ? body.clinical_lead_name : "",
        p_engagement_model: typeof body.engagement_model === "string" ? body.engagement_model : "",
        p_clinical_lead_id: typeof body.clinical_lead_id === "string" ? body.clinical_lead_id : null,
        p_accepted_proposal_id: typeof body.accepted_proposal_id === "string" ? body.accepted_proposal_id : null,
      });
      if (error) throw error;
      return rpcResponse(data);
    }

    if (action === "update_revisit_readiness") {
      const manualCriteria =
        body.manual_criteria && typeof body.manual_criteria === "object" && !Array.isArray(body.manual_criteria)
          ? body.manual_criteria
          : {};

      const { data, error } = await admin.rpc("clinical_update_revisit_readiness", {
        p_actor_id: user.id,
        p_deficiency_id: typeof body.deficiency_id === "string" ? body.deficiency_id : "",
        p_manual_criteria: manualCriteria,
      });
      if (error) throw error;
      return rpcResponse(data);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("clinical-workflow-action failed", error);
    return json({ error: "Unable to complete clinical workflow action" }, 500);
  }
});
