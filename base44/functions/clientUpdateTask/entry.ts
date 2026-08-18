import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { resolveClientEntitlement, auditAccessChange } from "../../shared/clientEntitlements.ts";

const ALLOWED_STATUSES = ['Not Started', 'In Progress', 'Complete'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'client') return Response.json({ error: 'Forbidden — client role required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { task_id, status, completion_note } = body;
    if (!task_id) return Response.json({ error: 'task_id is required' }, { status: 400 });
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return Response.json({ error: 'status must be one of: Not Started, In Progress, Complete' }, { status: 400 });
    }

    // 1. Retrieve the task server-side
    const task = await base44.asServiceRole.entities.Task.get(task_id);
    if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });

    // 2. Fail closed if task lacks authoritative engagement relationship
    if (!task.linked_engagement_id) {
      return Response.json({ error: 'Access denied', reason: 'Task is missing an authoritative engagement relationship.' }, { status: 403 });
    }

    // 3. Resolve client entitlement — check can_complete_tasks capability + engagement-first tenant scope
    const entitlement = await resolveClientEntitlement(base44, user, {
      requestedCapability: 'can_complete_tasks',
      recordEngagementId: task.linked_engagement_id,
      recordClientVisibility: task.client_visibility,
      recordType: 'Task'
    });

    if (!entitlement.authorized) {
      return Response.json({ error: 'Access denied', reason: entitlement.reason }, { status: 403 });
    }

    // 4. Defense-in-depth: confirm engagement is in authorized scope
    if (!entitlement.engagement_ids.includes(task.linked_engagement_id)) {
      return Response.json({ error: 'Access denied', reason: 'Task engagement not in authorized tenant scope' }, { status: 403 });
    }

    // 5. Build whitelisted update — ONLY client-safe fields
    const update = {
      status: status,
      client_completion_note: completion_note || null,
      client_completed_by: user.full_name || user.email,
      client_completed_date: new Date().toISOString()
    };

    await base44.asServiceRole.entities.Task.update(task_id, update);

    // 6. Audit log
    await auditAccessChange(base44, {
      client_account_id: null,
      previous_access_state: task.status,
      new_access_state: status,
      reason: `Client task update: ${task_id}`,
      triggering_source: 'clientUpdateTask',
      acting_user_id: user.id,
      acting_user_name: user.full_name || user.email
    });

    return Response.json({
      success: true,
      task_id,
      status: status,
      client_completed_by: update.client_completed_by,
      client_completed_date: update.client_completed_date
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}