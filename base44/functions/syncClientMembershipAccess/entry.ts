import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { calculateEffectiveClientAccessStatus, syncClientUserAuthorization, auditAccessChange } from "../../shared/clientEntitlements.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { membership_id } = body;
    if (!membership_id) return Response.json({ error: 'membership_id is required' }, { status: 400 });

    const membership = await base44.asServiceRole.entities.ClientMembership.get(membership_id);
    if (!membership) return Response.json({ error: 'Membership not found' }, { status: 404 });

    let account = null;
    if (membership.client_account_id) {
      account = await base44.asServiceRole.entities.ClientAccount.get(membership.client_account_id);
    }

    // Use centralized helper
    const effective = calculateEffectiveClientAccessStatus(account);

    // If override expired, clear it
    if (effective.override_expired && account) {
      try {
        await base44.asServiceRole.entities.ClientAccount.update(account.id, {
          manual_access_override: "None", manual_override_reason: null, manual_override_by: null,
          manual_override_by_id: null, manual_override_effective_date: null, manual_override_expiration: null,
          last_entitlement_check: new Date().toISOString()
        });
      } catch (e) {}
    }

    // Use centralized sync helper
    const syncResult = await syncClientUserAuthorization(base44, membership, effective.effective_access_status, membership.membership_status);

    await auditAccessChange(base44, {
      client_account_id: membership.client_account_id,
      previous_access_state: account?.access_status || 'Unknown',
      new_access_state: effective.effective_access_status,
      reason: `Membership sync: ${membership.membership_status} (effective: ${effective.effective_access_status})`,
      triggering_source: 'syncClientMembershipAccess',
      acting_user_id: user.id, acting_user_name: user.full_name || user.email,
      manual_override: effective.override_active || effective.override_expired,
      manual_override_details: effective.reason
    });

    return Response.json({
      synced: true, client_user_id: membership.client_user_id,
      assigned_role: syncResult.role,
      authorized_facility_ids: syncResult.authorized_facility_ids,
      authorized_engagement_ids: syncResult.authorized_engagement_ids,
      membership_status: membership.membership_status,
      effective_access_status: effective.effective_access_status
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}