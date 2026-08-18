import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireAdminOrClinical } from '../../shared/roleAuth.ts';

// Evidence-driven revisit readiness assessment.
// Derives readiness from underlying data records rather than manual checkbox toggling.
// Persists RevisitReadinessCriterion records and updates the Deficiency.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const authCheck = requireAdminOrClinical(user);
    if (!authCheck.authorized) return Response.json({ error: authCheck.error }, { status: authCheck.status });

    const body = await req.json();
    const { deficiency_id } = body;
    if (!deficiency_id) return Response.json({ error: 'deficiency_id is required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const def = await svc.entities.Deficiency.get(deficiency_id);
    if (!def) return Response.json({ error: 'Deficiency not found' }, { status: 404 });

    // Gather related records
    const audits = await svc.entities.AuditTool.filter({ deficiency_id });
    const education = await svc.entities.EducationPlan.filter({ deficiency_id });
    const evidence = await svc.entities.EvidenceItem.filter({ deficiency_id });
    const qapi = await svc.entities.QAPIReview.filter({ deficiency_id });
    const pocs = await svc.entities.POC.filter({ deficiency_id });

    const isTestData = !!def.is_test_data;

    // Define criteria and evaluate each
    const criteria: any[] = [];

    // 1. Resident-specific correction complete — derived from deficiency fields
    const hasImmediateCorrection = !!(def.immediate_correction && def.immediate_correction.trim());
    criteria.push({
      criterion_label: 'Resident-specific correction complete',
      criterion_key: 'resident_correction',
      derivation_source: 'Automatic',
      is_met: hasImmediateCorrection,
      evidence_summary: hasImmediateCorrection ? 'Documented in deficiency.immediate_correction' : 'Not documented',
      blocks_readiness: true,
    });

    // 2. Affected universe review complete
    const hasUniverseReview = !!(def.potentially_affected_population && def.potentially_affected_population.trim());
    criteria.push({
      criterion_label: 'Affected universe review complete',
      criterion_key: 'universe_review',
      derivation_source: 'Automatic',
      is_met: hasUniverseReview,
      evidence_summary: hasUniverseReview ? 'Documented in deficiency.potentially_affected_population' : 'Not documented',
      blocks_readiness: true,
    });

    // 3. Systemic changes implemented
    const hasSystemicCorrection = !!(def.systemic_correction && def.systemic_correction.trim());
    criteria.push({
      criterion_label: 'Systemic changes implemented',
      criterion_key: 'systemic_changes',
      derivation_source: 'Automatic',
      is_met: hasSystemicCorrection,
      evidence_summary: hasSystemicCorrection ? 'Documented in deficiency.systemic_correction' : 'Not documented',
      blocks_readiness: true,
    });

    // 4. Education complete — derived from EducationPlan records
    const educationComplete = education && education.length > 0 && education.every(e => e.education_status === 'Completed' || e.education_status === 'Competency Completed');
    criteria.push({
      criterion_label: 'Education complete',
      criterion_key: 'education_complete',
      derivation_source: 'Automatic',
      is_met: !!educationComplete,
      evidence_summary: education && education.length > 0 ? `${education.length} plan(s), ${education.filter(e => e.education_status === 'Completed' || e.education_status === 'Competency Completed').length} complete` : 'No education plans',
      blocks_readiness: true,
    });

    // 5. Competency complete
    const competencyComplete = education && education.length > 0 && education.every(e => e.education_status === 'Competency Completed');
    criteria.push({
      criterion_label: 'Competencies complete',
      criterion_key: 'competencies',
      derivation_source: 'Automatic',
      is_met: !!competencyComplete,
      evidence_summary: education && education.length > 0 ? `${education.filter(e => e.education_status === 'Competency Completed').length}/${education.length} competency completed` : 'No education plans',
      blocks_readiness: true,
    });

    // 6. Required audits complete — derived from AuditTool records
    const auditsComplete = audits && audits.length > 0 && audits.every(a => a.audit_result === 'Pass' || a.audit_result === 'Immediate Correction Completed');
    criteria.push({
      criterion_label: 'Required audits complete',
      criterion_key: 'audits',
      derivation_source: 'Automatic',
      is_met: !!auditsComplete,
      evidence_summary: audits && audits.length > 0 ? `${audits.length} audit(s), ${audits.filter(a => a.audit_result === 'Pass' || a.audit_result === 'Immediate Correction Completed').length} passed` : 'No audits',
      blocks_readiness: true,
    });

    // 7. Audit compliance acceptable
    criteria.push({
      criterion_label: 'Audit compliance acceptable',
      criterion_key: 'audit_compliance',
      derivation_source: 'Automatic',
      is_met: !!auditsComplete,
      evidence_summary: audits && audits.length > 0 ? `${audits.filter(a => a.audit_result === 'Pass').length}/${audits.length} passed` : 'No audits',
      blocks_readiness: true,
    });

    // 8. Failed audits corrected
    const failedAuditsResolved = !audits || audits.length === 0 || audits.every(a => a.audit_result !== 'Failed' || (a.what_was_corrected && a.what_was_corrected.trim()));
    criteria.push({
      criterion_label: 'Failed audits corrected',
      criterion_key: 'failed_audits_corrected',
      derivation_source: 'Automatic',
      is_met: failedAuditsResolved,
      evidence_summary: audits ? `${audits.filter(a => a.audit_result === 'Failed' && (!a.what_was_corrected || !a.what_was_corrected.trim())).length} unresolved failed audit(s)` : 'No audits',
      blocks_readiness: true,
    });

    // 9. Evidence complete — derived from EvidenceItem status
    const evidenceComplete = evidence && evidence.length > 0 && evidence.every(e => e.review_status === 'Accepted' || e.review_status === 'Not Applicable');
    criteria.push({
      criterion_label: 'Evidence complete',
      criterion_key: 'evidence',
      derivation_source: 'Automatic',
      is_met: !!evidenceComplete,
      evidence_summary: evidence && evidence.length > 0 ? `${evidence.filter(e => e.review_status === 'Accepted').length}/${evidence.length} accepted` : 'No evidence items',
      blocks_readiness: true,
    });

    // 10. QAPI reviewed — derived from QAPIReview records
    const qapiReviewed = qapi && qapi.length > 0;
    criteria.push({
      criterion_label: 'QAPI reviewed',
      criterion_key: 'qapi',
      derivation_source: 'Automatic',
      is_met: qapiReviewed,
      evidence_summary: qapi && qapi.length > 0 ? `${qapi.length} QAPI review(s)` : 'No QAPI reviews',
      blocks_readiness: true,
    });

    // 11. POC appropriately approved
    const pocApproved = pocs && pocs.length > 0 && pocs.some(p => p.status === 'Approved for Use' || p.status === 'Accepted');
    criteria.push({
      criterion_label: 'POC appropriately approved',
      criterion_key: 'poc_approved',
      derivation_source: 'Automatic',
      is_met: !!pocApproved,
      evidence_summary: pocs && pocs.length > 0 ? `${pocs.filter(p => p.status === 'Approved for Use' || p.status === 'Accepted').length}/${pocs.length} approved` : 'No POCs',
      blocks_readiness: true,
    });

    // 12-14. Manual judgment items
    const manualCriteria = body.manual_criteria || {};
    criteria.push({ criterion_label: 'Staff interview readiness', criterion_key: 'staff_interview', derivation_source: 'Manual', is_met: !!manualCriteria.staff_interview, evidence_summary: manualCriteria.staff_interview ? 'Marked ready by clinical reviewer' : 'Not assessed', blocks_readiness: false, manual_reviewer: user.full_name || user.email });
    criteria.push({ criterion_label: 'Record review readiness', criterion_key: 'record_review', derivation_source: 'Manual', is_met: !!manualCriteria.record_review, evidence_summary: manualCriteria.record_review ? 'Marked ready by clinical reviewer' : 'Not assessed', blocks_readiness: false, manual_reviewer: user.full_name || user.email });
    criteria.push({ criterion_label: 'Environmental readiness', criterion_key: 'environmental', derivation_source: 'Manual', is_met: !!manualCriteria.environmental, evidence_summary: manualCriteria.environmental ? 'Marked ready by clinical reviewer' : 'Not assessed', blocks_readiness: false, manual_reviewer: user.full_name || user.email });

    // Calculate score
    const blockingCriteria = criteria.filter(c => c.blocks_readiness);
    const blockingMet = blockingCriteria.filter(c => c.is_met);
    const totalCriteria = criteria.length;
    const metCount = criteria.filter(c => c.is_met).length;
    const score = Math.round((metCount / totalCriteria) * 100);

    // Determine status — blocking criteria must ALL be met for "Ready"
    const allBlockingMet = blockingCriteria.every(c => c.is_met);
    let status = 'Not Ready';
    if (allBlockingMet && score >= 90) status = 'Ready';
    else if (allBlockingMet && score >= 70) status = 'Nearly Ready';
    else if (score >= 40) status = 'Significant Gaps';

    const explanation = [
      `Revisit Readiness Score: ${score}/100 (${status})`,
      `${metCount}/${totalCriteria} criteria met.`,
      `Blocking criteria: ${blockingMet.length}/${blockingCriteria.length} met.`,
      '',
      'Criteria breakdown:',
      ...criteria.map(c => `  • ${c.criterion_label}: ${c.is_met ? '✓ Met' : '✗ Not met'} (${c.derivation_source}) — ${c.evidence_summary}`),
      '',
      'This is a Clinical SOS internal readiness assessment. Clinical SOS does not guarantee that a facility will pass a regulatory revisit.',
    ].join('\n');

    // Persist criteria records — delete old ones first
    try {
      const oldCriteria = await svc.entities.RevisitReadinessCriterion.filter({ deficiency_id });
      if (oldCriteria && oldCriteria.length > 0) {
        for (const oc of oldCriteria) {
          await svc.entities.RevisitReadinessCriterion.delete(oc.id);
        }
      }
    } catch (e) { /* best-effort */ }

    // Create new criteria records
    for (const c of criteria) {
      try {
        await svc.entities.RevisitReadinessCriterion.create({
          deficiency_id,
          regulatory_case_id: def.regulatory_case_id,
          facility_id: def.facility_id,
          facility_name: def.facility_name,
          criterion_label: c.criterion_label,
          criterion_key: c.criterion_key,
          derivation_source: c.derivation_source,
          is_met: c.is_met,
          evidence_summary: c.evidence_summary,
          blocks_readiness: c.blocks_readiness,
          manual_reviewer: c.manual_reviewer || null,
          is_test_data: isTestData,
        });
      } catch (e) { /* best-effort */ }
    }

    // Update deficiency
    await svc.entities.Deficiency.update(deficiency_id, {
      revisit_readiness_status: status,
      revisit_readiness_score: score,
      revisit_readiness_explanation: explanation,
    });

    // Log
    try {
      await svc.entities.AutomationLog.create({
        automation: 'Revisit Readiness Assessment', started: new Date().toISOString(), completed: new Date().toISOString(),
        status: 'Success', records_processed: 1, affected_record_ids: [deficiency_id],
        triggered_by: user.full_name || user.email || 'system',
      });
    } catch (e) { /* best-effort */ }

    return Response.json({
      ok: true, deficiency_id, score, status, explanation,
      criteria: criteria.map(c => ({ label: c.criterion_label, key: c.criterion_key, is_met: c.is_met, derivation: c.derivation_source, evidence: c.evidence_summary, blocks: c.blocks_readiness })),
      all_blocking_met: allBlockingMet,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}