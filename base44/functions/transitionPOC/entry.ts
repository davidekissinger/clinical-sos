import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireAdminOrClinical } from '../../shared/roleAuth.ts';

// POC Lifecycle Transition handler.
// Enforces the full POC lifecycle with authenticated user identity capture.
// AI can NEVER mark Submitted or Accepted — those require human action via this function.
//
// Lifecycle: AI Draft → Clinical Review → Client Review → Approved for Use → Submitted → Accepted
// Also supports: Revision Requested, Superseded
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const authCheck = requireAdminOrClinical(user);
    if (!authCheck.authorized) return Response.json({ error: authCheck.error }, { status: authCheck.status });

    const body = await req.json();
    const { poc_id, action, evidence, revision_notes } = body;
    if (!poc_id) return Response.json({ error: 'poc_id is required' }, { status: 400 });
    if (!action) return Response.json({ error: 'action is required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const poc = await svc.entities.POC.get(poc_id);
    if (!poc) return Response.json({ error: 'POC not found' }, { status: 404 });

    const userName = user.full_name || user.email || 'Unknown';
    const now = new Date().toISOString();

    // Define valid transitions
    const transitions: Record<string, { from: string; to: string; requiresEvidence?: boolean; fields: any }> = {
      submit_for_clinical_review: { from: 'AI Draft', to: 'Clinical Review', fields: { reviewed_by: userName } },
      approve_for_use: { from: 'Clinical Review', to: 'Approved for Use', fields: { clinical_approved_by: userName } },
      send_to_client_review: { from: 'Clinical Review', to: 'Client Review', fields: { clinical_approved_by: userName, reviewed_by: userName } },
      return_to_clinical_review: { from: 'Client Review', to: 'Clinical Review', fields: { client_reviewed_by: userName } },
      approve_from_client_review: { from: 'Client Review', to: 'Approved for Use', fields: { client_reviewed_by: userName, clinical_approved_by: userName } },
      return_for_revision: { from: '', to: 'Revision Requested', fields: { revision_requested_date: now, revision_notes: revision_notes || 'Revision requested by reviewer', reviewed_by: userName } },
      submit_poc: { from: 'Approved for Use', to: 'Submitted', requiresEvidence: true, fields: { submitted_by: userName, submitted_date: now, submission_source: evidence } },
      record_acceptance: { from: 'Submitted', to: 'Accepted', requiresEvidence: true, fields: { accepted_by: userName, accepted_date: now, acceptance_source: evidence } },
      supersede: { from: '', to: 'Superseded', fields: { superseded_by_version: poc.version + 1 } },
    };

    const transition = transitions[action];
    if (!transition) return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

    // Validate from-state (except for actions that can come from any state)
    if (transition.from && poc.status !== transition.from) {
      return Response.json({ error: `Invalid transition: POC is in '${poc.status}' but action '${action}' requires '${transition.from}'`, status: 'invalid_transition' }, { status: 400 });
    }

    // Validate evidence requirement
    if (transition.requiresEvidence && !evidence) {
      return Response.json({ error: `${action} requires evidence/source confirmation`, status: 'evidence_required' }, { status: 400 });
    }

    // Perform the transition
    const updateFields = { status: transition.to, ...transition.fields };
    await svc.entities.POC.update(poc_id, updateFields);

    // If superseding, mark prior versions as Superseded
    if (action === 'supersede') {
      try {
        const allPocs = await svc.entities.POC.filter({ deficiency_id: poc.deficiency_id });
        for (const p of allPocs) {
          if (p.id !== poc_id && p.status !== 'Superseded') {
            await svc.entities.POC.update(p.id, { status: 'Superseded', superseded_by_version: poc.version + 1 });
          }
        }
      } catch (e) { /* best-effort */ }
    }

    // Log the transition
    try {
      await svc.entities.AutomationLog.create({
        automation: `POC Lifecycle Transition: ${action}`,
        started: now,
        completed: now,
        status: 'Success',
        records_processed: 1,
        affected_record_ids: [poc_id],
        triggered_by: userName,
        errors: `POC v${poc.version} transitioned from ${poc.status} to ${transition.to}. User: ${userName}. Evidence: ${evidence || 'N/A'}`,
      });
    } catch (e) { /* best-effort */ }

    return Response.json({
      ok: true,
      poc_id,
      previous_status: poc.status,
      new_status: transition.to,
      action,
      performed_by: userName,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}