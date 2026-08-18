import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { resolveClientEntitlement, auditAccessChange } from "../../shared/clientEntitlements.ts";

const ALLOWED_RESPONSES = ['Prepared', 'Available', 'Clarification Requested', 'Noted'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'client') return Response.json({ error: 'Forbidden — client role required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { evidence_id, response_status, note } = body;
    if (!evidence_id) return Response.json({ error: 'evidence_id is required' }, { status: 400 });
    if (!response_status || !ALLOWED_RESPONSES.includes(response_status)) {
      return Response.json({ error: 'response_status must be one of: ' + ALLOWED_RESPONSES.join(', ') }, { status: 400 });
    }

    // 1. Retrieve the evidence item server-side
    const evidence = await base44.asServiceRole.entities.EvidenceItem.get(evidence_id);
    if (!evidence) return Response.json({ error: 'Evidence item not found' }, { status: 404 });

    // 2. Fail closed if evidence lacks authoritative engagement relationship
    if (!evidence.engagement_id) {
      return Response.json({ error: 'Access denied', reason: 'Evidence item is missing an authoritative engagement relationship.' }, { status: 403 });
    }

    // 3. Resolve client entitlement — check can_submit_evidence + engagement-first tenant scope
    const entitlement = await resolveClientEntitlement(base44, user, {
      requestedCapability: 'can_submit_evidence',
      recordEngagementId: evidence.engagement_id,
      recordClientVisibility: evidence.client_visibility,
      recordType: 'EvidenceItem'
    });

    if (!entitlement.authorized) {
      return Response.json({ error: 'Access denied', reason: entitlement.reason }, { status: 403 });
    }

    // 4. Defense-in-depth: confirm engagement is in authorized scope
    if (!entitlement.engagement_ids.includes(evidence.engagement_id)) {
      return Response.json({ error: 'Access denied', reason: 'Evidence engagement not in authorized tenant scope' }, { status: 403 });
    }

    // 5. Build whitelisted update — ONLY client-response fields, NOT clinical review_status
    const update = {
      client_response_status: response_status,
      client_response_note: note || null,
      client_responded_by: user.full_name || user.email,
      client_responded_by_id: user.id,
      client_response_date: new Date().toISOString()
    };

    await base44.asServiceRole.entities.EvidenceItem.update(evidence_id, update);

    // 6. Audit log
    await auditAccessChange(base44, {
      client_account_id: null,
      previous_access_state: evidence.client_response_status || 'Pending',
      new_access_state: response_status,
      reason: `Client evidence response: ${evidence_id}`,
      triggering_source: 'clientRespondEvidence',
      acting_user_id: user.id,
      acting_user_name: user.full_name || user.email
    });

    return Response.json({
      success: true,
      evidence_id,
      client_response_status: response_status,
      client_responded_by: update.client_responded_by,
      client_response_date: update.client_response_date
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}