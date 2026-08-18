import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireAdminBDorClinical } from '../../shared/roleAuth.ts';

// Transparent lead scoring: takes a facility_id, gathers its regulatory signals,
// computes an explainable 0-100 score, assigns a tier, and upserts a Lead record.
// Every score component is documented in score_explanation — never a black box.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const authCheck = requireAdminBDorClinical(user);
    if (!authCheck.authorized) return Response.json({ error: authCheck.error }, { status: authCheck.status });

    const body = await req.json();
    const facilityId = body.facility_id;
    if (!facilityId) return Response.json({ error: 'facility_id is required' }, { status: 400 });

    const svc = base44.asServiceRole;

    const facility = await svc.entities.Facility.get(facilityId);
    if (!facility) return Response.json({ error: 'Facility not found' }, { status: 404 });

    const signals = await svc.entities.RegulatorySignal.filter({ facility_id: facilityId });

    if (!signals || signals.length === 0) {
      return Response.json({ ok: true, score: 0, tier: "Nurture", explanation: "No regulatory signals on file for this facility.", signals_count: 0 });
    }

    let config = null;
    try {
      const configs = await svc.entities.LeadEngineConfig.list();
      config = configs && configs.length ? configs[0] : null;
    } catch (e) { /* config may not exist yet */ }

    const w = config?.signal_weights || {
      immediate_jeopardy: 35, cmp: 25, dpna: 25, sff: 30,
      repeat_deficiency: 18, infection_control: 15, low_rating: 10,
      follow_up_survey: 12, ownership_change: 14, leadership_signal: 12,
    };

    const now = new Date();
    const lookbackDays = config?.regulatory_lookback_days || 365;
    const lookbackCutoff = new Date(now.getTime() - lookbackDays * 86400000);

    const breakdown = [];
    let score = 0;
    let verifiedCount = 0;
    let highSeverityCount = 0;

    for (const sig of signals) {
      if (sig.status === "Resolved") continue;
      let weight = 0;
      const st = sig.signal_type;
      if (st === "Immediate Jeopardy") weight = w.immediate_jeopardy;
      else if (st === "CMP") weight = w.cmp;
      else if (st === "DPNA") weight = w.dpna;
      else if (st === "Special Focus Facility" || st === "SFF Candidate") weight = w.sff;
      else if (st === "Repeat Deficiency") weight = w.repeat_deficiency;
      else if (st === "Infection-Control Deficiency") weight = w.infection_control;
      else if (st === "Low Health Inspection Rating") weight = w.low_rating;
      else if (st === "Follow-Up Survey") weight = w.follow_up_survey;
      else if (st === "Ownership Change") weight = w.ownership_change;
      else if (st === "Leadership/Operational Signal") weight = w.leadership_signal;
      else weight = 8;

      let recencyFactor = 1;
      if (sig.event_date) {
        const eventDate = new Date(sig.event_date);
        if (eventDate < lookbackCutoff) {
          const daysOld = (now.getTime() - eventDate.getTime()) / 86400000;
          recencyFactor = Math.max(0.2, 1 - (daysOld - lookbackDays) / (lookbackDays * 2));
        }
      } else { recencyFactor = 0.5; }

      let severityMult = 1;
      if (sig.severity === "High") { severityMult = 1.2; highSeverityCount++; }
      else if (sig.severity === "Medium") severityMult = 1;
      else if (sig.severity === "Low") severityMult = 0.6;

      let verifyFactor = 0.5;
      if (sig.verified === true) { verifyFactor = 1; verifiedCount++; }
      else if (sig.confidence_score && sig.confidence_score >= 70) verifyFactor = 0.75;

      const component = Math.round(weight * recencyFactor * severityMult * verifyFactor);
      score += component;
      breakdown.push({ signal_type: sig.signal_type, severity: sig.severity, event_date: sig.event_date, verified: sig.verified, weight, recencyFactor, severityMult, verifyFactor, component, source: sig.source });
    }

    score = Math.min(100, score);

    let tier = "Nurture";
    const minScore = config?.minimum_lead_score || 40;
    if (score >= 75 && verifiedCount > 0) tier = "Tier 1";
    else if (score >= 55) tier = "Tier 2";
    else if (score >= minScore) tier = "Tier 3";

    const explanation = [
      `Lead score: ${score}/100 (Tier: ${tier}).`,
      `Based on ${signals.length} regulatory signal(s) — ${verifiedCount} verified, ${highSeverityCount} high-severity.`,
      `Lookback period: ${lookbackDays} days.`,
      ``,
      `Score breakdown:`,
      ...breakdown.map(b =>
        `• ${b.signal_type} (${b.severity || "Unknown"} severity, ${b.verified ? "verified" : "unverified"}, event: ${b.event_date || "unknown"}) ` +
        `→ weight ${b.weight} × recency ${b.recencyFactor.toFixed(2)} × severity ${b.severityMult} × verification ${b.verifyFactor.toFixed(2)} = ${b.component} points.`
      ),
      ``,
      `Tier logic: Tier 1 (score≥75 + ≥1 verified signal), Tier 2 (score≥55), Tier 3 (score≥${minScore}), Nurture (below ${minScore}).`,
      score === 0 && signals.length > 0 ? `All signals are resolved — no active regulatory concern detected.` : ``,
    ].filter(Boolean).join("\n");

    const serviceMap = {
      "Immediate Jeopardy": "Rapid Survey Recovery", "CMP": "Survey Response and Plan of Correction Support",
      "DPNA": "Clinical Operations Stabilization", "Special Focus Facility": "Mock Surveys and Readiness Reviews",
      "SFF Candidate": "Mock Surveys and Readiness Reviews", "Repeat Deficiency": "Compliance Monitoring and Root Cause Analysis",
      "Infection-Control Deficiency": "Policy and Workflow Development", "Low Health Inspection Rating": "Mock Surveys and Readiness Reviews",
      "Follow-Up Survey": "Survey Response and Plan of Correction Support", "Ownership Change": "Interim Leadership and Subject Matter Support",
      "Leadership/Operational Signal": "Interim Leadership and Subject Matter Support",
    };
    let recommendedService = "Survey Response and Plan of Correction Support";
    for (const b of breakdown) { if (serviceMap[b.signal_type]) { recommendedService = serviceMap[b.signal_type]; break; } }

    let urgency = "General Inquiry";
    if (tier === "Tier 1") urgency = "Urgent"; else if (tier === "Tier 2") urgency = "Regulatory"; else if (tier === "Tier 3") urgency = "Proactive";

    const isTestData = !!facility.is_test_data;
    const existing = await svc.entities.Lead.filter({ facility_id: facilityId });
    const leadData = {
      facility_id: facilityId, facility_name: facility.facility_name, organization_name: facility.operator_name,
      lead_score: score, lead_tier: tier, score_explanation: explanation,
      verification_status: verifiedCount > 0 ? "Verified" : "Research Required",
      recommended_service: recommendedService, potential_urgency: urgency,
      next_action: tier === "Tier 1" ? "Immediate outreach review required" : tier === "Tier 2" ? "Queue for outreach approval" : tier === "Tier 3" ? "Add to proactive outreach list" : "Monitor for changes",
      next_action_date: new Date().toISOString().slice(0, 10),
      is_test_data: isTestData,
    };

    let lead;
    if (existing && existing.length > 0) lead = await svc.entities.Lead.update(existing[0].id, leadData);
    else lead = await svc.entities.Lead.create(leadData);

    try {
      await svc.entities.AutomationLog.create({
        automation: "Lead Scoring", started: new Date().toISOString(), completed: new Date().toISOString(),
        status: "Success", records_processed: 1, affected_record_ids: [facilityId, lead?.id].filter(Boolean),
        triggered_by: user.full_name || user.email || "system",
      });
    } catch (e) { /* best-effort */ }

    return Response.json({ ok: true, score, tier, explanation, lead_id: lead?.id, signals_count: signals.length, verified_count: verifiedCount, recommended_service: recommendedService });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}