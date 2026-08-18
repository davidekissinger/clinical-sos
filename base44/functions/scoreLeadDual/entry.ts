import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireAdminBDorClinical } from '../../shared/roleAuth.ts';

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

    const configs = await svc.entities.LeadEngineConfig.list();
    const config = (configs && configs.length > 0) ? configs[0] : {};
    const lookbackDays = config.regulatory_lookback_days || 365;
    const ruWeights = config.regulatory_urgency_weights || {};
    const coWeights = config.commercial_opportunity_weights || {};
    const prWeights = config.priority_score_weights || { regulatory_urgency_weight: 0.6, commercial_opportunity_weight: 0.4 };

    const signals = await svc.entities.RegulatorySignal.filter({ facility_id: facilityId });
    if (!signals || signals.length === 0) {
      return Response.json({ ok: true, facility_id: facilityId, facility_name: facility.facility_name, regulatory_urgency_score: 0, commercial_opportunity_score: 0, clinical_sos_priority_score: 0, regulatory_urgency: 'Unknown / Research Required', explanation: 'No regulatory signals found for this facility. Cannot score without verified enforcement data.', regulatory_breakdown: [], commercial_breakdown: [], signals_count: 0 });
    }

    const now = new Date();
    const lookbackMs = lookbackDays * 24 * 60 * 60 * 1000;

    const ruBreakdown: any[] = [];
    let ruScore = 0;

    for (const sig of signals) {
      const eventDate = sig.event_date ? new Date(sig.event_date) : null;
      const ageMs = eventDate ? (now.getTime() - eventDate.getTime()) : lookbackMs;
      const withinLookback = ageMs <= lookbackMs;
      const recencyMultiplier = withinLookback ? Math.max(0.25, 1 - (ageMs / lookbackMs)) : 0.25;
      const verifiedMultiplier = sig.verified ? 1.0 : 0.5;
      const severityMultiplier = sig.severity === 'High' ? 1.2 : sig.severity === 'Medium' ? 1.0 : 0.7;

      let weight = 0; let label = '';
      switch (sig.signal_type) {
        case 'Immediate Jeopardy': weight = ruWeights.immediate_jeopardy ?? 35; label = 'Immediate Jeopardy'; break;
        case 'CMP': weight = (sig.cmp_type === 'Per Day') ? (ruWeights.cmp_per_day ?? 30) : (ruWeights.cmp_per_instance ?? 20); label = `CMP (${sig.cmp_type || 'Unknown'})`; break;
        case 'DPNA': weight = ruWeights.dpna ?? 28; label = 'Denial of Payment for New Admissions'; break;
        case 'Special Focus Facility': weight = ruWeights.sff_active ?? 25; label = 'Special Focus Facility'; break;
        case 'SFF Candidate': weight = ruWeights.sff_candidate ?? 18; label = 'SFF Candidate'; break;
        case 'Repeat Deficiency': weight = ruWeights.repeat_serious_deficiency ?? 18; label = 'Repeat Deficiency'; break;
        case 'Follow-Up Survey': weight = (sig.revisit_status === 'Failed') ? (ruWeights.failed_revisit ?? 22) : (ruWeights.upcoming_revisit ?? 12); label = `Follow-Up Survey (${sig.revisit_status || 'Pending'})`; break;
        case 'Infection-Control Deficiency': weight = ruWeights.infection_control ?? 15; label = 'Infection-Control Deficiency'; break;
        default: weight = sig.severity === 'High' ? (ruWeights.high_severity ?? 12) : sig.severity === 'Medium' ? (ruWeights.medium_severity ?? 8) : (ruWeights.low_severity ?? 4); label = sig.signal_type;
      }

      const points = Math.round(weight * recencyMultiplier * severityMultiplier * verifiedMultiplier);
      ruScore += points;
      ruBreakdown.push({ signal_type: sig.signal_type, label, severity: sig.severity, verified: sig.verified, event_date: sig.event_date, weight, recency_multiplier: Math.round(recencyMultiplier * 100) / 100, severity_multiplier: severityMultiplier, verification_multiplier: verifiedMultiplier, points, source: sig.source, source_url: sig.source_url, evidence_summary: sig.factual_evidence_summary });
    }

    let operatorFacilityCount = 1;
    if (facility.operator_name) {
      const operatorFacilities = await svc.entities.Facility.filter({ operator_name: facility.operator_name });
      operatorFacilityCount = operatorFacilities ? operatorFacilities.length : 1;
      if (operatorFacilityCount > 1) {
        const bonusPoints = Math.round((ruWeights.multi_facility_operator_bonus ?? 5) * Math.min(1, operatorFacilityCount / 5));
        ruScore += bonusPoints;
        ruBreakdown.push({ signal_type: 'Operator Scope', label: `Multi-facility operator (${operatorFacilityCount} facilities)`, weight: ruWeights.multi_facility_operator_bonus ?? 5, recency_multiplier: 1, severity_multiplier: 1, verification_multiplier: 1, points: bonusPoints, source: 'Internal facility database', evidence_summary: `${facility.operator_name} operates ${operatorFacilityCount} facilities — enforcement at one may indicate systemic risk.` });
      }
    }

    ruScore = Math.min(100, Math.round(ruScore));

    let regulatoryUrgency = 'Unknown / Research Required';
    const hasVerified = signals.some(s => s.verified);
    const hasIJ = signals.some(s => s.signal_type === 'Immediate Jeopardy');
    const hasDPNA = signals.some(s => s.signal_type === 'DPNA');
    const hasCMPPerDay = signals.some(s => s.signal_type === 'CMP' && s.cmp_type === 'Per Day');
    const highSeverityCount = signals.filter(s => s.severity === 'High').length;

    if (!hasVerified && ruScore < 40) regulatoryUrgency = 'Unknown / Research Required';
    else if (hasIJ || hasDPNA || hasCMPPerDay || (highSeverityCount >= 3 && hasVerified)) regulatoryUrgency = 'Critical';
    else if (ruScore >= 70) regulatoryUrgency = 'Severe';
    else if (ruScore >= 50) regulatoryUrgency = 'High';
    else if (ruScore >= 30) regulatoryUrgency = 'Moderate';
    else regulatoryUrgency = 'Proactive';

    const coBreakdown: any[] = [];
    let coScore = 0;

    const hasEnforcementSignals = signals.some(s => ['Immediate Jeopardy', 'CMP', 'DPNA', 'Special Focus Facility'].includes(s.signal_type));
    if (hasEnforcementSignals) { coScore += coWeights.service_match ?? 20; coBreakdown.push({ label: 'Strong Clinical SOS service match (enforcement recovery)', points: coWeights.service_match ?? 20 }); }
    else { coScore += (coWeights.service_match ?? 20) * 0.5; coBreakdown.push({ label: 'Moderate service match (consulting/proactive)', points: Math.round((coWeights.service_match ?? 20) * 0.5) }); }

    if (operatorFacilityCount >= 5) { coScore += coWeights.operator_size ?? 15; coBreakdown.push({ label: `Multi-facility operator (${operatorFacilityCount} facilities)`, points: coWeights.operator_size ?? 15 }); }
    else if (operatorFacilityCount >= 2) { coScore += (coWeights.operator_size ?? 15) * 0.7; coBreakdown.push({ label: `Small operator (${operatorFacilityCount} facilities)`, points: Math.round((coWeights.operator_size ?? 15) * 0.7) }); }

    if (operatorFacilityCount > 1) { coScore += coWeights.multi_facility_affected ?? 10; coBreakdown.push({ label: 'Multiple facilities potentially affected', points: coWeights.multi_facility_affected ?? 10 }); }

    if (facility.bed_count && facility.bed_count >= 100) { coScore += 8; coBreakdown.push({ label: `Large facility (${facility.bed_count} beds)`, points: 8 }); }
    else if (facility.bed_count && facility.bed_count >= 50) { coScore += 5; coBreakdown.push({ label: `Medium facility (${facility.bed_count} beds)`, points: 5 }); }

    const contacts = await svc.entities.Contact.filter({ facility_id: facilityId });
    if (contacts && contacts.length > 0) {
      const hasExec = contacts.some(c => ['CEO', 'COO', 'Owner', 'Regional Operations', 'Regional Clinical'].includes(c.role_category));
      if (hasExec) { coScore += coWeights.decision_maker_identified ?? 15; coBreakdown.push({ label: 'Regional/executive decision-maker identified', points: coWeights.decision_maker_identified ?? 15 }); }
      else { coScore += (coWeights.decision_maker_identified ?? 15) * 0.6; coBreakdown.push({ label: 'Facility-level contact identified (administrator/DON)', points: Math.round((coWeights.decision_maker_identified ?? 15) * 0.6) }); }
    }

    if (regulatoryUrgency === 'Critical' || regulatoryUrgency === 'Severe') { coScore += coWeights.urgency_alignment ?? 12; coBreakdown.push({ label: 'High regulatory urgency aligns with immediate need', points: coWeights.urgency_alignment ?? 12 }); }
    else if (regulatoryUrgency === 'High') { coScore += (coWeights.urgency_alignment ?? 12) * 0.7; coBreakdown.push({ label: 'Moderate urgency alignment', points: Math.round((coWeights.urgency_alignment ?? 12) * 0.7) }); }

    const interactions = await svc.entities.Interaction.filter({ facility_id: facilityId });
    if (interactions && interactions.length > 0) { coScore += coWeights.prior_interaction ?? 8; coBreakdown.push({ label: 'Prior interaction recorded', points: coWeights.prior_interaction ?? 8 }); }

    coScore = Math.min(100, Math.round(coScore));

    const ruWeight = prWeights.regulatory_urgency_weight ?? 0.6;
    const coWeight = prWeights.commercial_opportunity_weight ?? 0.4;
    const priorityScore = Math.round(ruScore * ruWeight + coScore * coWeight);

    const explanation = [
      `REGULATORY URGENCY SCORE: ${ruScore}/100`,
      ...ruBreakdown.map(b => `  • ${b.label}: +${b.points} (weight ${b.weight} × recency ${b.recency_multiplier} × severity ${b.severity_multiplier} × verification ${b.verification_multiplier})`),
      '', `COMMERCIAL OPPORTUNITY SCORE: ${coScore}/100`,
      ...coBreakdown.map(b => `  • ${b.label}: +${b.points}`),
      '', `CLINICAL SOS PRIORITY SCORE: ${priorityScore}/100`,
      `  Regulatory Urgency (${ruScore}) × ${ruWeight} + Commercial Opportunity (${coScore}) × ${coWeight} = ${priorityScore}`,
      '', `Regulatory Urgency Classification: ${regulatoryUrgency}`,
      `Based on ${signals.length} regulatory signal(s) — ${signals.filter(s => s.verified).length} verified, ${highSeverityCount} high-severity.`,
      `Operator scope: ${operatorFacilityCount} facilit${operatorFacilityCount === 1 ? 'y' : 'ies'} under ${facility.operator_name || 'Unknown'}.`,
    ].join('\n');

    const isTestData = !!facility.is_test_data;
    let lead = null;
    const existingLeads = await svc.entities.Lead.filter({ facility_id: facilityId });
    const leadData = {
      facility_id: facilityId, facility_name: facility.facility_name, organization_name: facility.operator_name,
      lead_score: priorityScore, lead_tier: priorityScore >= 75 ? 'Tier 1' : priorityScore >= 55 ? 'Tier 2' : priorityScore >= 40 ? 'Tier 3' : 'Nurture',
      score_explanation: explanation, regulatory_urgency: regulatoryUrgency, regulatory_urgency_score: ruScore,
      commercial_opportunity_score: coScore, clinical_sos_priority_score: priorityScore,
      score_breakdown: JSON.stringify({ regulatory: ruBreakdown, commercial: coBreakdown }),
      verification_status: hasVerified ? 'Verified' : 'Research Required',
      recommended_service: hasEnforcementSignals ? 'Rapid Survey Recovery' : 'Proactive Consulting',
      potential_urgency: regulatoryUrgency === 'Critical' ? 'Urgent' : regulatoryUrgency === 'Severe' ? 'Regulatory' : regulatoryUrgency === 'High' ? 'Corrective Action' : 'Proactive',
      is_test_data: isTestData,
    };

    if (existingLeads && existingLeads.length > 0) lead = await svc.entities.Lead.update(existingLeads[0].id, leadData);
    else lead = await svc.entities.Lead.create(leadData);

    await svc.entities.Facility.update(facilityId, { regulatory_urgency: regulatoryUrgency, regulatory_urgency_score: ruScore, commercial_opportunity_score: coScore, clinical_sos_priority_score: priorityScore, score_explanation: explanation });

    try {
      await svc.entities.AutomationLog.create({ automation: 'Dual Lead Scoring', started: new Date().toISOString(), completed: new Date().toISOString(), status: 'Success', records_processed: 1, affected_record_ids: [facilityId, lead?.id].filter(Boolean), triggered_by: user.full_name || user.email || 'system' });
    } catch (e) { /* best-effort */ }

    return Response.json({ ok: true, facility_id: facilityId, facility_name: facility.facility_name, regulatory_urgency_score: ruScore, commercial_opportunity_score: coScore, clinical_sos_priority_score: priorityScore, regulatory_urgency: regulatoryUrgency, explanation, regulatory_breakdown: ruBreakdown, commercial_breakdown: coBreakdown, signals_count: signals.length, verified_count: signals.filter(s => s.verified).length, operator_facility_count: operatorFacilityCount, lead_id: lead?.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}