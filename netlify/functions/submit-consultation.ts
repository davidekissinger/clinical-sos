import { isIP } from "node:net";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Config, Context } from "@netlify/functions";

const FIELD_MAX_LENGTHS = {
  name: 120,
  organization: 200,
  title: 200,
  business_email: 254,
  business_phone: 40,
  facility_or_org_name: 200,
  state: 60,
  number_of_facilities: 100,
  service_needed: 200,
  current_challenge: 2000,
  urgency_level: 60,
  preferred_contact_method: 40,
  preferred_consultation_time: 200,
  source_page: 200,
  campaign: 200,
} as const;

const URGENCY_LEVELS = new Set([
  "General inquiry",
  "Proactive survey preparation",
  "Corrective action support",
  "Operational concern",
  "Leadership support",
  "Regulatory issue",
  "Urgent assistance requested",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_GATE_MIN_MS = 3_000;
const MAX_BODY_BYTES = 64 * 1024;

type IntakeBody = Record<string, unknown>;

type IntakeResult = {
  ok: boolean;
  code?: string;
  consultation_id?: string | null;
  contact_id?: string | null;
  opportunity_id?: string | null;
  contact_match_method?: string | null;
};

function getAdminClient(): SupabaseClient {
  const url = Netlify.env.get("SUPABASE_URL");
  const secretKey =
    Netlify.env.get("SUPABASE_SECRET_KEY") ??
    Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !secretKey) {
    throw new Error("Supabase server environment is not configured");
  }

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function json(
  body: unknown,
  status = 200,
  additionalHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...additionalHeaders,
    },
  });
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown): string | null {
  const normalized = text(value);
  return normalized || null;
}

function sourceIp(context: Context): string | null {
  const candidate = context.ip?.trim();
  return candidate && isIP(candidate) !== 0 ? candidate : null;
}

async function logAbuse(
  supabase: SupabaseClient,
  reason: string,
  ip: string | null,
  email: string,
): Promise<void> {
  try {
    const timestamp = new Date().toISOString();

    await supabase.from("automation_logs").insert({
      automation: "Consultation Form Abuse Rejection",
      started: timestamp,
      completed: timestamp,
      status: "Failed",
      records_processed: 0,
      triggered_by: "submitConsultation:anti_abuse",
      reason,
      acting_user_name: email || "unknown",
      manual_override_details: `Source IP: ${ip ?? "unknown"}`,
    });
  } catch {
    // Abuse logging is best-effort and must not expose internal errors.
  }
}

function honeypotResponse(): Response {
  return json({
    ok: true,
    consultation_id: null,
    contact_id: null,
    opportunity_id: null,
    contact_match_method: "honeypot_blocked",
  });
}

export default async function submitConsultation(
  request: Request,
  context: Context,
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ error: "Content-Type must be application/json" }, 415);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return json({ error: "Unable to read request body" }, 400);
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json({ error: "Request body is too large" }, 413);
  }

  let body: IntakeBody;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
      return json({ error: "Request body must be a JSON object" }, 400);
    }
    body = parsed as IntakeBody;
  } catch {
    return json({ error: "Invalid JSON request body" }, 400);
  }

  let supabase: SupabaseClient;
  try {
    supabase = getAdminClient();
  } catch (error) {
    console.error("Consultation intake configuration error", {
      requestId: context.requestId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return json({ error: "Consultation service is temporarily unavailable" }, 503);
  }

  const ip = sourceIp(context);
  const normalizedEmail = text(body.business_email).toLowerCase();

  if (text(body.company_website)) {
    await logAbuse(supabase, "Honeypot field populated", ip, normalizedEmail);
    return honeypotResponse();
  }

  for (const [field, maximum] of Object.entries(FIELD_MAX_LENGTHS)) {
    const value = body[field];
    if (value !== undefined && value !== null && typeof value !== "string") {
      return json({ error: `Field '${field}' must be a string` }, 400);
    }
    if (typeof value === "string" && value.length > maximum) {
      return json({ error: `Field '${field}' exceeds maximum length` }, 400);
    }
  }

  for (const field of ["name", "business_email", "urgency_level"]) {
    if (!text(body[field])) {
      return json({ error: `Missing required field: ${field}` }, 400);
    }
  }

  if (body.consent_acknowledged !== true) {
    await logAbuse(supabase, "Consent not acknowledged", ip, normalizedEmail);
    return json({ error: "Consent acknowledgment is required" }, 400);
  }

  if (!EMAIL_RE.test(normalizedEmail)) {
    return json({ error: "Invalid email address" }, 400);
  }

  const urgencyLevel = text(body.urgency_level);
  if (!URGENCY_LEVELS.has(urgencyLevel)) {
    return json({ error: "Invalid urgency level" }, 400);
  }

  const loadedAt = text(body.form_loaded_at);
  const loadedAtMs = Date.parse(loadedAt);
  if (!loadedAt || !Number.isFinite(loadedAtMs) || Date.now() - loadedAtMs < TIME_GATE_MIN_MS) {
    await logAbuse(supabase, "Form submitted too quickly after load", ip, normalizedEmail);
    return json({ error: "Form submission too fast. Please try again." }, 400);
  }

  const sanitizedPayload = {
    name: text(body.name),
    organization: optionalText(body.organization),
    title: optionalText(body.title),
    business_email: normalizedEmail,
    business_phone: optionalText(body.business_phone),
    facility_or_org_name: optionalText(body.facility_or_org_name),
    state: optionalText(body.state),
    number_of_facilities: optionalText(body.number_of_facilities),
    service_needed: optionalText(body.service_needed),
    current_challenge: optionalText(body.current_challenge),
    urgency_level: urgencyLevel,
    preferred_contact_method: optionalText(body.preferred_contact_method),
    preferred_consultation_time: optionalText(body.preferred_consultation_time),
    consent_acknowledged: true,
    source_page: optionalText(body.source_page) ?? "/contact",
    campaign: optionalText(body.campaign),
  };

  const { data, error } = await supabase.rpc("ingest_consultation", {
    p_payload: sanitizedPayload,
    p_source_ip: ip,
  });

  if (error) {
    console.error("Consultation intake RPC failed", {
      requestId: context.requestId,
      code: error.code,
    });
    return json({ error: "Unable to submit your request right now" }, 500);
  }

  const result = data as IntakeResult | null;
  if (!result?.ok && result?.code === "rate_limited") {
    return json(
      { error: "A consultation request was recently submitted. Please wait a few minutes before trying again." },
      429,
      { "Retry-After": "600" },
    );
  }

  if (!result?.ok) {
    return json({ error: "Unable to submit your request right now" }, 500);
  }

  return json({
    ok: true,
    consultation_id: result.consultation_id ?? null,
    contact_id: result.contact_id ?? null,
    opportunity_id: result.opportunity_id ?? null,
    contact_match_method: result.contact_match_method ?? "unavailable",
  });
}

export const config: Config = {
  path: "/api/consultations",
};
