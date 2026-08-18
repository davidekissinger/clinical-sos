import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { ACCESS_STATUSES, auditAccessChange } from "../../shared/clientEntitlements.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { client_account_id, new_access_status, reason, manual_override, manual_override_type, override_expiration } = body;

    if (!client_account_id) return Response.json({ error: 'client_account_id is required' }, { status: 400 });
    if (!new_access_status || !ACCESS_STATUSES.includes(new_access_status)) {
      return Response.json({ error: 'Valid new_access_status is required' }, { status: 400 });
    }

    // Retrieve the account
    const account = await base44.asServiceRole.entities.ClientAccount.get(client_account_id);
    if (!account) return Response.json({ error: 'Client account not found' }, { status: 404 });

    const previousAccessState = account.access_status;

    // Never delete records — only change access_status
    const update = {
      access_status: new_access_status,
      access_restriction_reason: reason || null,
      access_restriction_effective_date: new_access_status !== 'Active' ? new Date().toISOString() : null
    };

    // Handle manual override fields
    if (manual_override && manual_override_type) {
      update.manual_access_override = manual_override_type;
      update.manual_override_reason = reason || null;
      update.manual_override_by = user.full_name || user.email;
      update.manual_override_by_id = user.id;
      update.manual_override_effective_date = new Date().toISOString();
      update.manual_override_expiration = override_expiration || null;
    }

    await base44.asServiceRole.entities.ClientAccount.update(client_account_id, update);

    // Write audit log
    await auditAccessChange(base44, {
      client_account_id,
      previous_access_state: previousAccessState,
      new_access_state: new_access_status,
      reason: reason || 'No reason provided',
      triggering_source: manual_override ? 'admin_manual_override' : 'admin_transition',
      acting_user_id: user.id,
      acting_user_name: user.full_name || user.email,
      manual_override: manual_override || false,
      manual_override_details: manual_override ? `${manual_override_type}${override_expiration ? ' (expires ' + override_expiration + ')' : ''}` : null
    });

    // After access change, re-sync all memberships for this account
    const memberships = await base44.asServiceRole.entities.ClientMembership.filter({ client_account_id });
    for (const m of memberships) {
      const shouldBeClient = m.membership_status === 'Active' && new_access_status !== 'Terminated';
      const currentMember = await base44.asServiceRole.entities.User.get(m.client_user_id);
      if (currentMember) {
        const newRole = shouldBeClient ? 'client' : (currentMember.role === 'client' ? 'pending' : currentMember.role);
        await base44.asServiceRole.entities.User.update(m.client_user_id, {
          authorized_facility_ids: shouldBeClient ? (m.authorized_facility_ids || []) : [],
          authorized_engagement_ids: shouldBeClient ? (m.authorized_engagement_ids || []) : [],
          role: newRole
        });
      }
    }

    return Response.json({
      success: true,
      client_account_id,
      previous_access_state: previousAccessState,
      new_access_state: new_access_status,
      memberships_synced: memberships.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}