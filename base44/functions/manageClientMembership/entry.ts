import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { auditAccessChange } from "../../shared/clientEntitlements.ts";

const VALID_MEMBERSHIP_STATUSES = ['Invited', 'Active', 'Suspended', 'Revoked', 'Expired'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { action, membership_id, client_user_id, client_account_id, organization_id, organization_name, authorized_facility_ids, authorized_engagement_ids, capabilities, reason, invite_email } = body;

    if (!action) return Response.json({ error: 'action is required' }, { status: 400 });

    let membership = null;
    let previousState = null;

    if (action === 'create') {
      if (!client_user_id || !client_account_id) return Response.json({ error: 'client_user_id and client_account_id required' }, { status: 400 });

      const newMembership = {
        client_user_id,
        client_account_id,
        organization_id,
        organization_name,
        authorized_facility_ids: authorized_facility_ids || [],
        authorized_engagement_ids: authorized_engagement_ids || [],
        membership_status: 'Invited',
        invited_date: new Date().toISOString(),
        can_login: capabilities?.can_login ?? true,
        can_view_engagement: capabilities?.can_view_engagement ?? true,
        can_view_documents: capabilities?.can_view_documents ?? true,
        can_download_documents: capabilities?.can_download_documents ?? true,
        can_review_poc: capabilities?.can_review_poc ?? true,
        can_approve_poc: capabilities?.can_approve_poc ?? false,
        can_view_tasks: capabilities?.can_view_tasks ?? true,
        can_complete_tasks: capabilities?.can_complete_tasks ?? false,
        can_submit_evidence: capabilities?.can_submit_evidence ?? false,
        can_view_audits: capabilities?.can_view_audits ?? true,
        can_complete_audits: capabilities?.can_complete_audits ?? false,
        can_message_consultant: capabilities?.can_message_consultant ?? true
      };

      membership = await base44.asServiceRole.entities.ClientMembership.create(newMembership);

      await auditAccessChange(base44, {
        client_account_id,
        previous_access_state: 'None',
        new_access_state: 'Invited',
        reason: reason || 'Membership created',
        triggering_source: 'manageClientMembership:create',
        acting_user_id: user.id,
        acting_user_name: user.full_name || user.email
      });

      return Response.json({ success: true, membership_id: membership.id, action: 'create' });
    }

    // For suspend/revoke/reactivate/update — need membership_id
    if (!membership_id) return Response.json({ error: 'membership_id is required' }, { status: 400 });
    membership = await base44.asServiceRole.entities.ClientMembership.get(membership_id);
    if (!membership) return Response.json({ error: 'Membership not found' }, { status: 404 });
    previousState = membership.membership_status;

    if (action === 'activate') {
      await base44.asServiceRole.entities.ClientMembership.update(membership_id, {
        membership_status: 'Active',
        activated_date: new Date().toISOString()
      });
      // Sync access to user
      await syncAccessToUser(base44, membership, 'Active');
    } else if (action === 'suspend') {
      await base44.asServiceRole.entities.ClientMembership.update(membership_id, {
        membership_status: 'Suspended',
        suspended_date: new Date().toISOString(),
        suspension_reason: reason || null
      });
      // Remove access from user
      await syncAccessToUser(base44, membership, 'Suspended');
    } else if (action === 'revoke') {
      await base44.asServiceRole.entities.ClientMembership.update(membership_id, {
        membership_status: 'Revoked',
        revoked_date: new Date().toISOString(),
        revocation_reason: reason || null
      });
      await syncAccessToUser(base44, membership, 'Revoked');
    } else if (action === 'update_capabilities') {
      const update = {};
      const caps = capabilities || {};
      for (const [key, value] of Object.entries(caps)) {
        if (key.startsWith('can_')) update[key] = value;
      }
      if (authorized_facility_ids !== undefined) update.authorized_facility_ids = authorized_facility_ids;
      if (authorized_engagement_ids !== undefined) update.authorized_engagement_ids = authorized_engagement_ids;
      await base44.asServiceRole.entities.ClientMembership.update(membership_id, update);
      // Re-sync if active
      if (membership.membership_status === 'Active') {
        const updated = { ...membership, ...update };
        await syncAccessToUser(base44, updated, 'Active');
      }
    } else {
      return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });
    }

    await auditAccessChange(base44, {
      client_account_id: membership.client_account_id,
      previous_access_state: previousState,
      new_access_state: action === 'activate' ? 'Active' : action === 'suspend' ? 'Suspended' : action === 'revoke' ? 'Revoked' : previousState,
      reason: reason || `Membership ${action}`,
      triggering_source: `manageClientMembership:${action}`,
      acting_user_id: user.id,
      acting_user_name: user.full_name || user.email
    });

    return Response.json({ success: true, membership_id, action, previous_state: previousState });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function syncAccessToUser(base44, membership, newStatus) {
  const shouldBeClient = newStatus === 'Active';
  const currentMember = await base44.asServiceRole.entities.User.get(membership.client_user_id);
  if (!currentMember) return;

  const newRole = shouldBeClient ? 'client' : (currentMember.role === 'client' ? 'pending' : currentMember.role);
  await base44.asServiceRole.entities.User.update(membership.client_user_id, {
    authorized_facility_ids: shouldBeClient ? (membership.authorized_facility_ids || []) : [],
    authorized_engagement_ids: shouldBeClient ? (membership.authorized_engagement_ids || []) : [],
    role: newRole
  });
}