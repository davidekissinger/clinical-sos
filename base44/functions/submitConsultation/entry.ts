import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Handles public (unauthenticated) consultation form submissions.
// Runs as service role so public visitors can submit without auth,
// while keeping all CRM entities private from public reads.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Basic validation
    const required = ["name", "business_email", "urgency_level"];
    for (const f of required) {
      if (!body[f] || !String(body[f]).trim()) {
        return Response.json({ error: `Missing required field: ${f}` }, { status: 400 });
      }
    }

    const urgencyScore = {
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
    const svc = base44.asServiceRole;

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
      source_page: sourcePage, campaign: body.campaign,
      lead_score: score, lead_tier: tier, status: "New",
    });

    // 2. Contact
    let contact = null;
    try {
      const parts = String(body.name).split(" ");
      const firstName = parts[0] || body.name;
      const lastName = parts.slice(1).join(" ");
      contact = await svc.entities.Contact.create({
        first_name: firstName, last_name: lastName, title: body.title,
        organization_name: body.organization || body.facility_or_org_name,
        business_email: body.business_email, business_phone: body.business_phone,
        contact_confidence: 100, inferred: false,
        notes: `Inbound consultation request. Urgency: ${body.urgency_level}. State: ${body.state || "—"}.`,
      });
    } catch (e) { /* best-effort */ }

    // 3. Opportunity
    let opportunity = null;
    try {
      opportunity = await svc.entities.Opportunity.create({
        opportunity_name: `${body.organization || body.facility_or_org_name || body.name} — ${body.service_needed || "Consultation"}`,
        facility_name: body.facility_or_org_name, organization_name: body.organization,
        primary_contact_name: body.name, stage: "New",
        service_interest: body.service_needed, source: "Website Contact Form",
        estimated_value: 0, probability: score / 100, lead_tier: tier,
      });
    } catch (e) { /* best-effort */ }

    // 4. Interaction
    try {
      await svc.entities.Interaction.create({
        interaction_type: "Inbound Form", direction: "Inbound",
        contact_name: body.name, facility_name: body.facility_or_org_name,
        opportunity_id: opportunity?.id,
        summary: `Inbound consultation request — ${body.urgency_level}. Challenge: ${body.current_challenge || "Not specified"}. Service: ${body.service_needed || "Not specified"}.`,
        next_step: "Acknowledge request and offer consultation scheduling.",
        date: new Date().toISOString(),
      });
    } catch (e) { /* best-effort */ }

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
        notes: `Inbound consultation request. Lead score ${score} (${tier}). Preferred contact: ${body.preferred_contact_method || "—"}. Preferred time: ${body.preferred_consultation_time || "Not specified"}.`,
        linked_opportunity_id: opportunity?.id,
      });
    } catch (e) { /* best-effort */ }

    return Response.json({
      ok: true, score, tier,
      consultation_id: consultation?.id,
      contact_id: contact?.id,
      opportunity_id: opportunity?.id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}