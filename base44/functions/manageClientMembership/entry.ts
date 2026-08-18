import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { calculateEffectiveClientAccessStatus, auditAccessChange } from "../../shared/clientEntitlements.ts";

const VALID_MEMBERSHIP_STATUSES = ['Invited', 'Active', 'Suspended', 'Revoked', 'Expired'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { action, membership_id, client_user_id, client_account_id, organization_id, organization_name, authorized_facility_ids, authorized_engagement_ids, capabilities, reason } = body;

    if (!action) return Response.json({ error: 'action is required' }, { status: 400 });

    let membership = null;
    let previousState = null;

    if (action === 'create') {
      if (!client_user_id || !client_account_id) return Response.json({ error: 'client_user_id and client_account_id required' }, { status: 400 });

      // Validate tenant: every facility/engagement must belong to the ClientAccount
      const account = await base44.asServiceRole.entities.ClientAccount.get(client_account_id);
      if (!account) return Response.json({ error: 'Client account not found' }, { status: 404 });

      const validatedFacilityIds = await validateFacilityIds(base44, authorized_facility_ids || [], account);
      const validatedEngagementIds = await validateEngagementIds(base44, authorized_engagement_ids || [], account);

      const newMembership = {
        client_user_id, client_account_id,
        organization_id: organization_id || account.organization_id,
        organization_name: organization_name || account.organization_name,
        authorized_facility_ids: validatedFacilityIds,
        authorized_engagement_ids: validatedEngagementIds,
        membership_status: 'Invited', invited_date: new Date().toISOString(),
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
        client_account_id, previous_access_state: 'None', new_access_state: 'Invited',
        reason: reason || 'Membership created', triggering_source: 'manageClientMembership:create',
        acting_user_id: user.id, acting_user_name: user.full_name || user.email
      });

      return Response.json({ success: true, membership_id: membership.id, action: 'create' });
    }

    if (!membership_id) return Response.json({ error: 'membership_id is required' }, { status: 400 });
    membership = await base44.asServiceRole.entities.ClientMembership.get(membership_id);
    if (!membership) return Response.json({ error: 'Membership not found' }, { status: 404 });
    previousState = membership.membership_status;

    if (action === 'activate') {
      await base44.asServiceRole.entities.ClientMembership.update(membership_id, {
        membership_status: 'Active', activated_date: new Date().toISOString()
      });
      // Check EFFECTIVE account status before populating tenant arrays
      const account = await base44.asServiceRole.entities.ClientAccount.get(membership.client_account_id);
      const effective = calculateEffectiveClientAccessStatus(account);
      const isNoDataAccess = effective.effective_access_status === 'Suspended' || effective.effective_access_status === 'Terminated';
      await syncAccessToUser(base44, membership, 'Active', !isNoDataAccess);
    } else if (action === 'suspend') {
      await base44.asServiceRole.entities.ClientMembership.update(membership_id, {
        membership_status: 'Suspended', suspended_date: new Date().toISOString(), suspension_reason: reason || null
      });
      // Membership suspension = user loses client access entirely
      await syncAccessToUser(base44, membership, 'Suspended', false);
    } else if (action === 'revoke') {
      await base44.asServiceRole.entities.ClientMembership.update(membership_id, {
        membership_status: 'Revoked', revoked_date: new Date().toISOString(), revocation_reason: reason || null
      });
      await syncAccessToUser(base44, membership, 'Revoked', false);
    } else if (action === 'update_capabilities') {
      const update = {};
      const caps = capabilities || {};
      for (const [key, value] of Object.entries(caps)) { if (key.startsWith('can_')) update[key] = value; }

      // Validate tenant for facility/engagement changes
      const account = await base44.asServiceRole.entities.ClientAccount.get(membership.client_account_id);
      if (authorized_facility_ids !== undefined) {
        update.authorized_facility_ids = await validateFacilityIds(base44, authorized_facility_ids, account);
      }
      if (authorized_engagement_ids !== undefined) {
        update.authorized_engagement_ids = await validateEngagementIds(base44, authorized_engagement_ids, account);
      }

      await base44.asServiceRole.entities.ClientMembership.update(membership_id, update);

      // Re-sync using EFFECTIVE account status
      if (membership.membership_status === 'Active') {
        const effective = calculateEffectiveClientAccessStatus(account);
        const isNoDataAccess = effective.effective_access_status === 'Suspended' || effective.effective_access_status === 'Terminated';
        const updated = { ...membership, ...update };
        await syncAccessToUser(base44, updated, 'Active', !isNoDataAccess);
      }
    } else {
      return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });
    }

    await auditAccessChange(base44, {
      client_account_id: membership.client_account_id, previous_access_state: previousState,
      new_access_state: action === 'activate' ? 'Active' : action === 'suspend' ? 'Suspended' : action === 'revoke' ? 'Revoked' : previousState,
      reason: reason || `Membership ${action}`, triggering_source: `manageClientMembership:${action}`,
      acting_user_id: user.id, acting_user_name: user.full_name || user.email
    });

    return Response.json({ success: true, membership_id, action, previous_state: previousState });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Sync access to user — distinguishes account suspension from membership suspension.
 * - canAccess=false: user arrays cleared, role→pending (membership-level)
 * - canAccess=true but account suspended: arrays still cleared (account-level)
 * - canAccess=true and account active: arrays populated, role=client
 */
async function syncAccessToUser(base44, membership, newStatus, canAccess) {
  const currentUser = await base44.asServiceRole.entities.User.get(membership.client_user_id);
  if (!currentUser) return;

  const shouldBeClient = newStatus === 'Active' && canAccess;
  const newRole = shouldBeClient ? 'client' : (currentUser.role === 'client' ? 'pending' : currentUser.role);
  await base44.asServiceRole.entities.User.update(membership.client_user_id, {
    authorized_facility_ids: shouldBeClient ? (membership.authorized_facility_ids || []) : [],
    authorized_engagement_ids: shouldBeClient ? (membership.authorized_engagement_ids || []) : [],
    role: newRole
  });
}

/**
 * Validate that every facility ID belongs to the ClientAccount's organization.
 * Rejects mismatches with 400.
 */
async function validateFacilityIds(base44, facilityIds, account) {
  if (!facilityIds || facilityIds.length === 0) return [];
  if (!account) return facilityIds; // can't validate without account

  const facRes = await base44.asServiceRole.entities.Facility.list("-facility_name", 200);
  const allFacilities = Array.isArray(facRes) ? facRes : (facRes?.data || []);

  // Facilities must belong to the account's organization or have explicit client_account_id
  const validIds = facilityIds.filter(fid => {
    const fac = allFacilities.find(f => f.id === fid);
    if (!fac) return false;
    // Accept if facility has matching organization_id, or if account has no organization_id (legacy)
    if (!account.organization_id) return true;
    return fac.operator_id === account.organization_id;
  });

  if (validIds.length !== facilityIds.length) {
    throw new Error(`Tenant validation failed: ${facilityIds.length - validIds.length} facility ID(s) do not belong to this client account`);
  }

  return validIds;
}

/**
 * Validate that every engagement ID belongs to the ClientAccount.
 */
async function validateEngagementIds(base44, engagementIds, account) {
  if (!engagementIds || engagementIds.length === 0) return [];
  if (!account) return engagementIds;

  const engRes = await base44.asServiceRole.entities.Engagement.list("-created_date", 200);
  const allEngagements = Array.isArray(engRes) ? engRes : (engRes?.data || []);

  const validIds = engagementIds.filter(eid => {
    const eng = allEngagements.find(e => e.id === eid);
    if (!eng) return false;
    // Accept if engagement has matching client_account_id or organization_id
    if (eng.client_account_id && eng.client_account_id === account.id) return true;
    if (!account.organization_id) return true;
    return eng.organization_id === account.organization_id;
  });

  if (validIds.length !== engagementIds.length) {
    throw new Error(`Tenant validation failed: ${engagementIds.length - validIds.length} engagement ID(s) do not belong to this client account`);
  }

  return validIds;
}