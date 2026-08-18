import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireAdminOrClinical } from '../../shared/roleAuth.ts';

// Closure guardrail: prevents a Deficiency from being moved to "Closed"
// when required critical conditions remain unresolved.
// Allows authorized Clinical/Admin override with documented rationale.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const authCheck = requireAdminOrClinical(user);
    if (!authCheck.authorized) return Response.json({ error: authCheck.error }, { status: authCheck.status });

    const body = await req.json();
    const { deficiency_id, override_reason, force } = body;
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

    const blockers: string[] = [];

    // Check for unresolved failed audits
    const failedAudits = audits?.filter(a => a.audit_result === 'Failed' && !a.what_was_corrected);
    if (failedAudits && failedAudits.length > 0) {
      blockers.push(`${failedAudits.length} unresolved failed audit(s)`);
    }

    // Check for missing or insufficient evidence
    const insufficientEvidence = evidence?.filter(e => e.review_status === 'Insufficient' || e.review_status === 'Required' || e.review_status === 'Requested');
    if (insufficientEvidence && insufficientEvidence.length > 0) {
      blockers.push(`${insufficientEvidence.length} evidence item(s) unresolved or insufficient`);
    }

    // Check education completeness
    const incompleteEducation = education?.filter(e => e.education_status !== 'Completed' && e.education_status !== 'Competency Completed');
    if (incompleteEducation && incompleteEducation.length > 0) {
      blockers.push(`${incompleteEducation.length} education plan(s) incomplete`);
    }

    // Check competency
    const competencyPending = education?.filter(e => e.education_status === 'Competency Pending');
    if (competencyPending && competencyPending.length > 0) {
      blockers.push(`${competencyPending.length} competency validation(s) pending`);
    }

    // Check POC approval
    const approvedPoc = pocs?.find(p => p.status === 'Approved for Use' || p.status === 'Accepted');
    if (pocs && pocs.length > 0 && !approvedPoc) {
      blockers.push('POC not appropriately approved');
    }

    // Check QAPI review
    if (!qapi || qapi.length === 0) {
      blockers.push('QAPI review incomplete');
    }

    // Check revisit readiness
    if (def.revisit_readiness_status === 'Not Ready' || def.revisit_readiness_status === 'Significant Gaps') {
      blockers.push(`Revisit readiness: ${def.revisit_readiness_status}`);
    }

    const canClose = blockers.length === 0;

    if (canClose) {
      await svc.entities.Deficiency.update(deficiency_id, {
        deficiency_status: 'Closed',
        closure_override: false,
        closure_override_reason: null,
        closure_override_by: null,
        closure_override_date: null,
      });

      try {
        await svc.entities.AutomationLog.create({
          automation: 'Deficiency Closure', started: new Date().toISOString(), completed: new Date().toISOString(),
          status: 'Success', records_processed: 1, affected_record_ids: [deficiency_id],
          triggered_by: user.full_name || user.email || 'system',
        });
      } catch (e) { /* best-effort */ }

      return Response.json({ ok: true, closed: true, deficiency_id, blockers: [] });
    }

    // If force override requested
    if (force && override_reason) {
      await svc.entities.Deficiency.update(deficiency_id, {
        deficiency_status: 'Closed',
        closure_override: true,
        closure_override_reason: override_reason,
        closure_override_by: user.full_name || user.email,
        closure_override_date: new Date().toISOString(),
      });

      try {
        await svc.entities.AutomationLog.create({
          automation: 'Deficiency Closure (Override)', started: new Date().toISOString(), completed: new Date().toISOString(),
          status: 'Success', records_processed: 1, affected_record_ids: [deficiency_id],
          triggered_by: user.full_name || user.email || 'system',
          errors: `Override reason: ${override_reason}`,
        });
      } catch (e) { /* best-effort */ }

      return Response.json({ ok: true, closed: true, deficiency_id, override: true, blockers });
    }

    return Response.json({
      ok: false,
      closed: false,
      deficiency_id,
      blockers,
      message: 'Closure blocked — unresolved conditions remain. An authorized Clinical/Admin user may override with a documented rationale.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}