import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { resolveClientEntitlement, auditAccessChange } from "../../shared/clientEntitlements.ts";

const ALLOWED_ACTIONS = ['acknowledge', 'request_revision', 'client_approve'];
const CLIENT_REVIEW_STATUSES = ['Client Review', 'Revision Requested'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'client') return Response.json({ error: 'Forbidden — client role required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { poc_id, action, comment } = body;
    if (!poc_id) return Response.json({ error: 'poc_id is required' }, { status: 400 });
    if (!action || !ALLOWED_ACTIONS.includes(action)) {
      return Response.json({ error: 'action must be one of: ' + ALLOWED_ACTIONS.join(', ') }, { status: 400 });
    }

    // client_approve requires can_approve_poc; others require can_review_poc
    const requiredCap = action === 'client_approve' ? 'can_approve_poc' : 'can_review_poc';

    // 1. Retrieve the POC server-side
    const poc = await base44.asServiceRole.entities.POC.get(poc_id);
    if (!poc) return Response.json({ error: 'POC not found' }, { status: 404 });

    // 2. Fail closed if POC lacks authoritative engagement relationship
    if (!poc.engagement_id) {
      return Response.json({ error: 'Access denied', reason: 'POC is missing an authoritative engagement relationship.' }, { status: 403 });
    }

    // 3. Resolve client entitlement — check capability + engagement-first tenant scope + client_visibility + lifecycle
    const entitlement = await resolveClientEntitlement(base44, user, {
      requestedCapability: requiredCap,
      recordEngagementId: poc.engagement_id,
      recordClientVisibility: poc.client_visibility,
      recordType: 'POC',
      recordStatus: poc.status
    });

    if (!entitlement.authorized) {
      return Response.json({ error: 'Access denied', reason: entitlement.reason }, { status: 403 });
    }

    // 4. Defense-in-depth: confirm engagement is in authorized scope
    if (!entitlement.engagement_ids.includes(poc.engagement_id)) {
      return Response.json({ error: 'Access denied', reason: 'POC engagement not in authorized tenant scope' }, { status: 403 });
    }

    // 5. Verify POC is in a client-review-safe lifecycle state
    if (!CLIENT_REVIEW_STATUSES.includes(poc.status)) {
      return Response.json({ error: `POC status '${poc.status}' is not in client review state` }, { status: 403 });
    }

    // 6. Map action to client_review_status — NEVER touch regulatory lifecycle status
    let clientReviewStatus;
    if (action === 'acknowledge') clientReviewStatus = 'Acknowledged';
    else if (action === 'request_revision') clientReviewStatus = 'Revision Requested';
    else if (action === 'client_approve') clientReviewStatus = 'Client Approved';

    const update = {
      client_review_status: clientReviewStatus,
      client_reviewed_by: user.full_name || user.email,
      client_reviewed_by_id: user.id,
      client_reviewed_date: new Date().toISOString(),
      client_review_comment: comment || null
    };

    await base44.asServiceRole.entities.POC.update(poc_id, update);

    // 7. Audit log
    await auditAccessChange(base44, {
      client_account_id: null,
      previous_access_state: poc.client_review_status || 'Pending',
      new_access_state: clientReviewStatus,
      reason: `Client POC review (${action}): ${poc_id}`,
      triggering_source: 'clientReviewPOC',
      acting_user_id: user.id,
      acting_user_name: user.full_name || user.email
    });

    return Response.json({
      success: true,
      poc_id,
      client_review_status: clientReviewStatus,
      client_reviewed_by: update.client_reviewed_by,
      client_reviewed_date: update.client_reviewed_date,
      regulatory_status_unchanged: poc.status
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}