import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { auditAccessChange } from "../../shared/clientEntitlements.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { membership_id } = body;
    if (!membership_id) return Response.json({ error: 'membership_id is required' }, { status: 400 });

    // 1. Retrieve the ClientMembership
    const membership = await base44.asServiceRole.entities.ClientMembership.get(membership_id);
    if (!membership) return Response.json({ error: 'Membership not found' }, { status: 404 });

    // 2. Validate membership status
    const validStatuses = ['Active', 'Suspended', 'Revoked', 'Expired', 'Invited'];
    if (!validStatuses.includes(membership.membership_status)) {
      return Response.json({ error: 'Invalid membership status' }, { status: 400 });
    }

    // 3. Validate ClientAccount exists
    let account = null;
    if (membership.client_account_id) {
      account = await base44.asServiceRole.entities.ClientAccount.get(membership.client_account_id);
    }

    // 4. Calculate effective facilities and engagements
    const facilityIds = membership.authorized_facility_ids || [];
    const engagementIds = membership.authorized_engagement_ids || [];

    // 5. Determine if client role should be assigned or removed
    const shouldBeClient = membership.membership_status === 'Active' && account && account.access_status !== 'Terminated';

    // 6. Update the associated User authorization arrays + role
    const userUpdate = {
      authorized_facility_ids: shouldBeClient ? facilityIds : [],
      authorized_engagement_ids: shouldBeClient ? engagementIds : []
    };

    // Only admin can update role — use service role
    const currentUser = await base44.asServiceRole.entities.User.get(membership.client_user_id);
    if (currentUser) {
      const newRole = shouldBeClient ? 'client' : (currentUser.role === 'client' ? 'pending' : currentUser.role);
      await base44.asServiceRole.entities.User.update(membership.client_user_id, {
        ...userUpdate,
        role: newRole
      });
    }

    // 7. Record AutomationLog entry
    await auditAccessChange(base44, {
      client_account_id: membership.client_account_id,
      previous_access_state: account?.access_status || 'Unknown',
      new_access_state: shouldBeClient ? 'Active' : 'Suspended',
      reason: `Membership sync: ${membership.membership_status}`,
      triggering_source: 'syncClientMembershipAccess',
      acting_user_id: user.id,
      acting_user_name: user.full_name || user.email
    });

    return Response.json({
      synced: true,
      client_user_id: membership.client_user_id,
      assigned_role: shouldBeClient ? 'client' : 'pending',
      authorized_facility_ids: userUpdate.authorized_facility_ids,
      authorized_engagement_ids: userUpdate.authorized_engagement_ids,
      membership_status: membership.membership_status
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}