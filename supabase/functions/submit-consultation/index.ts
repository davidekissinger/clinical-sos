import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TIME_GATE_MIN_MS = 3000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

function clientIp(req: Request) {
  for (const header of ["cf-connecting-ip", "x-forwarded-for", "x-real-ip"]) {
    const raw = req.headers.get(header);
    if (!raw) continue;
    const value = raw.split(",")[0].trim();
    if (value.length <= 45 && /^[0-9a-fA-F:.]+$/.test(value)) return value;
  }
  return null;
}

async function logAbuse(
  admin: ReturnType<typeof createClient>,
  reason: string,
  ip: string | null,
  email: string,
) {
  try {
    const now = new Date().toISOString();
    await admin.from("automation_logs").insert({
      automation: "Consultation Form Abuse Rejection",
      started: now,
      completed: now,
      status: "Failed",
      records_processed: 0,
      triggered_by: "submitConsultation:anti_abuse",
      reason,
      acting_user_name: email || "unknown",
      manual_override_details: `Source IP: ${ip || "unknown"}`,
    });
  } catch (error) {
    console.error("Non-blocking abuse log failure", error);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "Invalid request body" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL");
    if (!url) throw new Error("SUPABASE_URL unavailable");

    const admin = createClient(url, secretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const ip = clientIp(req);
    const email = String(body.business_email || "").toLowerCase().trim();

    // Silent honeypot block: preserve the legacy behavior so bots receive success.
    if (body.company_website && String(body.company_website).trim()) {
      await logAbuse(admin, "Honeypot field populated", ip, email);
      return json({
        ok: true,
        consultation_id: null,
        contact_id: null,
        opportunity_id: null,
        contact_match_method: "honeypot_blocked",
      });
    }

    // Keep the browser time-gate at the HTTP boundary.
    if (!body.form_loaded_at) {
      await logAbuse(admin, "Missing form_loaded_at timestamp", ip, email);
      return json({ error: "Form submission too fast. Please try again." }, 400);
    }
    const loadedAt = new Date(String(body.form_loaded_at)).getTime();
    if (!Number.isFinite(loadedAt) || Date.now() - loadedAt < TIME_GATE_MIN_MS) {
      await logAbuse(admin, "Form submitted too quickly after load", ip, email);
      return json({ error: "Form submission too fast. Please try again." }, 400);
    }

    // Remove transport-only anti-bot fields before handing the payload to the
    // database contract. The RPC performs required-field, consent, email,
    // urgency, input-length, rate-limit, scoring, dedupe and CRM fan-out logic.
    const payload = { ...body };
    delete payload.company_website;
    delete payload.form_loaded_at;

    const { data, error } = await admin.rpc("ingest_consultation", {
      p_payload: payload,
      p_source_ip: ip,
    });

    if (error) {
      // 22023 is the RPC's explicit validation error class.
      if (error.code === "22023") return json({ error: error.message }, 400);
      console.error("ingest_consultation failed", error);
      return json({ error: "Unable to submit consultation request" }, 500);
    }

    if (data?.ok === false && data?.code === "rate_limited") {
      return json({
        error: "A consultation request was recently submitted. Please wait a few minutes before trying again.",
      }, 429);
    }

    // RPC deliberately returns only public-safe identifiers/match metadata.
    return json(data || { ok: true });
  } catch (error) {
    console.error("submit-consultation failed", error);
    return json({ error: "Unable to submit consultation request" }, 500);
  }
});
