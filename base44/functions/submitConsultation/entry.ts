import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Handles public (unauthenticated) consultation form submissions.
// Runs as service role so public visitors can submit without auth,
// while keeping all CRM entities private from public reads.
// Performs contact deduplication by normalized email.
// Does NOT return internal scoring to the public caller.
//
// Anti-abuse hardening (all checks run before any entity write):
//   1. Honeypot field (company_website) — silent rejection
//   2. Consent enforcement — 400 if not acknowledged
//   3. Email format validation
//   4. Input length caps
//   5. Time-gate (form_loaded_at) — 400 if < 3s after page load
//   6. Per-email + per-IP rate limit (10 min window)
// Rejected abuse attempts are logged to AutomationLog for admin visibility.

const FIELD_MAX_LENGTHS: Record<string, number> = {
  name: 120, organization: 200, title: 200, business_email: 254, business_phone: 40,
  facility_or_org_name: 200, state: 60, number_of_facilities: 100, service_needed: 200,
  current_challenge: 2000, urgency_level: 60, preferred_contact_method: 40,
  preferred_consultation_time: 200, source_page: 200, campaign: 200,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const TIME_GATE_MIN_MS = 3000; // 3 seconds

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

async function logAbuse(base44: any, reason: string, ip: string, email: string) {
  try {
    await base44.asServiceRole.entities.AutomationLog.create({
      automation: 'Consultation Form Abuse Rejection',
      started: new Date().toISOString(),
      completed: new Date().toISOString(),
      status: 'Failed',
      triggered_by: 'submitConsultation:anti_abuse',
      reason,
      acting_user_name: email || 'unknown',
      manual_override_details: `Source IP: ${ip}`,
    });
  } catch (_e) { /* non-blocking */ }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const clientIp = getClientIp(req);
    const normalizedEmail = String(body.business_email || '').toLowerCase().trim();

    // ── 1. Honeypot — silent rejection (return success so bot moves on) ──
    if (body.company_website && String(body.company_website).trim()) {
      await logAbuse(base44, 'Honeypot field populated', clientIp, normalizedEmail);
      return Response.json({
        ok: true,
        consultation_id: null,
        contact_id: null,
        opportunity_id: null,
        contact_match_method: 'honeypot_blocked',
      });
    }

    // ── 2. Required fields ──
    const required = ["name", "business_email", "urgency_level"];
    for (const f of required) {
      if (!body[f] || !String(body[f]).trim()) {
        return Response.json({ error: `Missing required field: ${f}` }, { status: 400 });
      }
    }

    // ── 3. Consent enforcement ──
    if (!body.consent_acknowledged) {
      await logAbuse(base44, 'Consent not acknowledged', clientIp, normalizedEmail);
      return Response.json({ error: 'Consent acknowledgment is required' }, { status: 400 });
    }

    // ── 4. Email format validation ──
    if (!EMAIL_RE.test(normalizedEmail)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // ── 5. Input length caps ──
    for (const [field, max] of Object.entries(FIELD_MAX_LENGTHS)) {
      if (body[field] && String(body[field]).length > max) {
        return Response.json({ error: `Field '${field}' exceeds maximum length` }, { status: 400 });
      }
    }

    // ── 6. Time-gate — reject if form loaded < 3s ago ──
    if (!body.form_loaded_at) {
      await logAbuse(base44, 'Missing form_loaded_at timestamp', clientIp, normalizedEmail);
      return Response.json({ error: 'Form submission too fast. Please try again.' }, { status: 400 });
    }
    const loadedTime = new Date(body.form_loaded_at).getTime();
    if (isNaN(loadedTime) || (Date.now() - loadedTime) < TIME_GATE_MIN_MS) {
      await logAbuse(base44, 'Form submitted too quickly after load', clientIp, normalizedEmail);
      return Response.json({ error: 'Form submission too fast. Please try again.' }, { status: 400 });
    }

    // ── 7. Rate limit — check for recent submissions from same email or IP ──
    const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const svc = base44.asServiceRole;

    const emailMatches = await svc.entities.ConsultationRequest.filter({ business_email: normalizedEmail });
    const emailList = Array.isArray(emailMatches) ? emailMatches : (emailMatches?.data || []);
    const recentEmail = emailList.some((r: any) => new Date(r.created_date) > cutoff);

    let recentIp = false;
    if (clientIp !== 'unknown') {
      const ipMatches = await svc.entities.ConsultationRequest.filter({ source_ip: clientIp });
      const ipList = Array.isArray(ipMatches) ? ipMatches : (ipMatches?.data || []);
      recentIp = ipList.some((r: any) => new Date(r.created_date) > cutoff);
    }

    if (recentEmail || recentIp) {
      await logAbuse(base44, `Rate limit: recent submission within ${RATE_LIMIT_WINDOW_MS / 60000}min window`, clientIp, normalizedEmail);
      return Response.json({ error: 'A consultation request was recently submitted. Please wait a few minutes before trying again.' }, { status: 429 });
    }

    // ── Proceed with existing CRM logic ──
    const urgencyScore: Record<string, number> = {
      "General inquiry": 20, "Proactive survey preparation": 40,
      "Corrective action support": 75, "Operational concern": 55,
      "Leadership support": 60, "Regulatory issue": 80, "Urgent assistance requested": 95,
    };
    let score = urgencyScore[body.urgency_level] ?? 30;
    if (body.service_needed) score += 8;
    if (body.number_of_facilities && /multi|several|\d+/.test(String(body.number_of_facilities).toLowerCase())) score += 7;
    score = Math.min(100, score);
    let tier = "Nurture";
    if (score >= 80) tier = "Tier 1";
    else if (score >= 60) tier = "Tier 2";
    else if (score >= 40) tier = "Tier 3";

    const sourcePage = body.source_page || "/contact";

    // 1. ConsultationRequest (record of truth)
    const consultation = await svc.entities.ConsultationRequest.create({
      name: body.name, organization: body.organization, title: body.title,
      business_email: body.business_email, business_phone: body.business_phone,
      facility_or_org_name: body.facility_or_org_name, state: body.state,
      number_of_facilities: body.number_of_facilities, service_needed: body.service_needed,
      current_challenge: body.current_challenge, urgency_level: body.urgency_level,
      preferred_contact_method: body.preferred_contact_method,
      preferred_consultation_time: body.preferred_consultation_time,
      consent_acknowledged: !!body.consent_acknowledged,
      source_page: sourcePage, source_ip: clientIp, campaign: body.campaign,
      lead_score: score, lead_tier: tier, status: "New",
    });

    // 2. Contact — deduplicate by normalized email
    let contact = null;
    let contactMatchMethod = "new";
    try {
      const existingContacts = await svc.entities.Contact.filter({ business_email: normalizedEmail });
      if (existingContacts && existingContacts.length > 0) {
        contact = await svc.entities.Contact.update(existingContacts[0].id, {
          title: body.title || existingContacts[0].title,
          organization_name: body.organization || body.facility_or_org_name || existingContacts[0].organization_name,
          business_phone: body.business_phone || existingContacts[0].business_phone,
          contact_confidence: 100,
          notes: (existingContacts[0].notes ? existingContacts[0].notes + "\n" : "") + `New consultation request — ${body.urgency_level}. State: ${body.state || "—"}.`,
        });
        contactMatchMethod = "existing_email_match";
      } else {
        const parts = String(body.name).split(" ");
        const firstName = parts[0] || body.name;
        const lastName = parts.slice(1).join(" ");
        contact = await svc.entities.Contact.create({
          first_name: firstName, last_name: lastName, title: body.title,
          organization_name: body.organization || body.facility_or_org_name,
          business_email: normalizedEmail, business_phone: body.business_phone,
          contact_confidence: 100, inferred: false,
          notes: `Inbound consultation request. Urgency: ${body.urgency_level}. State: ${body.state || "—"}.`,
        });
      }
    } catch (_e) { /* best-effort */ }

    // 3. Opportunity
    let opportunity = null;
    try {
      opportunity = await svc.entities.Opportunity.create({
        opportunity_name: `${body.organization || body.facility_or_org_name || body.name} — ${body.service_needed || "Consultation"}`,
        facility_name: body.facility_or_org_name, organization_name: body.organization,
        primary_contact_name: body.name, primary_contact_id: contact?.id,
        stage: "New", service_interest: body.service_needed, source: "Website Contact Form",
        estimated_value: 0, probability: score / 100, lead_tier: tier,
      });
    } catch (_e) { /* best-effort */ }

    // 4. Interaction
    try {
      await svc.entities.Interaction.create({
        interaction_type: "Inbound Form", direction: "Inbound",
        contact_name: body.name, contact_id: contact?.id,
        facility_name: body.facility_or_org_name, opportunity_id: opportunity?.id,
        summary: `Inbound consultation request — ${body.urgency_level}. Challenge: ${body.current_challenge || "Not specified"}. Service: ${body.service_needed || "Not specified"}.`,
        next_step: "Acknowledge request and offer consultation scheduling.",
        date: new Date().toISOString(),
      });
    } catch (_e) { /* best-effort */ }

    // 5. Follow-up Task
    try {
      const due = new Date(); due.setDate(due.getDate() + 1);
      await svc.entities.Task.create({
        workstream: "Business Development",
        task: `Follow up with ${body.name} (${body.organization || body.facility_or_org_name || "—"}) — ${body.urgency_level}`,
        priority: tier === "Tier 1" ? "Urgent" : tier === "Tier 2" ? "High" : "Medium",
        status: "Not Started",
        start_date: new Date().toISOString().slice(0, 10),
        due_date: due.toISOString().slice(0, 10),
        notes: `Inbound consultation request. Preferred contact: ${body.preferred_contact_method || "—"}. Preferred time: ${body.preferred_consultation_time || "Not specified"}. Contact match: ${contactMatchMethod}.`,
        linked_opportunity_id: opportunity?.id,
      });
    } catch (_e) { /* best-effort */ }

    // Return only public-safe info — NO internal scores, tiers, or routing logic
    return Response.json({
      ok: true,
      consultation_id: consultation?.id,
      contact_id: contact?.id,
      opportunity_id: opportunity?.id,
      contact_match_method: contactMatchMethod,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}