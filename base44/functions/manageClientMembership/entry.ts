import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { calculateEffectiveClientAccessStatus, syncClientUserAuthorization, auditAccessChange } from "../../shared/clientEntitlements.ts";

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

      const account = await base44.asServiceRole.entities.ClientAccount.get(client_account_id);
      if (!account) return Response.json({ error: 'Client account not found' }, { status: 404 });

      // STRICT: ClientAccount MUST have organization_id — no fallback
      if (!account.organization_id) {
        return Response.json({ error: 'Client Account must be linked to an Organization before tenant resources can be assigned.' }, { status: 400 });
      }

      const validatedFacilityIds = await validateFacilityIds(base44, authorized_facility_ids || [], account);
      const validatedEngagementIds = await validateEngagementIds(base44, authorized_engagement_ids || [], account);

      const newMembership = {
        client_user_id, client_account_id,
        organization_id: account.organization_id,
        organization_name: account.organization_name,
        authorized_facility_ids: validatedFacilityIds,
        authorized_engagement_ids: validatedEngagementIds,
        membership_status: 'Invited', invited_date: new Date().toISOString(),
        can_login: capabilities?.can_login ?? true,
        can_view_engagement: capabilities?.can_view_engagement ?? true,
        can_view_documents: capabilities?.can_view_documents ?? true,
        can_download_documents: capabilities?.can_download_documents ?? true,
        can_view_poc: capabilities?.can_view_poc ?? true,
        can_review_poc: capabilities?.can_review_poc ?? true,
        can_approve_poc: capabilities?.can_approve_poc ?? false,
        can_view_tasks: capabilities?.can_view_tasks ?? true,
        can_complete_tasks: capabilities?.can_complete_tasks ?? false,
        can_view_evidence: capabilities?.can_view_evidence ?? true,
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
      // V1 INVARIANT: Check for another Active membership BEFORE updating status
      const allMemberships = await base44.asServiceRole.entities.ClientMembership.filter({ client_user_id: membership.client_user_id });
      const otherActive = (allMemberships || []).filter(m => m.membership_status === "Active" && m.id !== membership_id);
      if (otherActive.length > 0) {
        return Response.json({
          error: 'V1 Client Portal supports one active Client Membership per user. Suspend, revoke, or expire the existing membership before activating another.'
        }, { status: 409 });
      }

      await base44.asServiceRole.entities.ClientMembership.update(membership_id, {
        membership_status: 'Active', activated_date: new Date().toISOString()
      });
      const account = await base44.asServiceRole.entities.ClientAccount.get(membership.client_account_id);
      const effective = calculateEffectiveClientAccessStatus(account);
      await syncClientUserAuthorization(base44, membership, effective.effective_access_status, 'Active');
    } else if (action === 'suspend') {
      await base44.asServiceRole.entities.ClientMembership.update(membership_id, {
        membership_status: 'Suspended', suspended_date: new Date().toISOString(), suspension_reason: reason || null
      });
      await syncClientUserAuthorization(base44, membership, 'Active', 'Suspended');
    } else if (action === 'revoke') {
      await base44.asServiceRole.entities.ClientMembership.update(membership_id, {
        membership_status: 'Revoked', revoked_date: new Date().toISOString(), revocation_reason: reason || null
      });
      await syncClientUserAuthorization(base44, membership, 'Active', 'Revoked');
    } else if (action === 'update_capabilities') {
      const update = {};
      const caps = capabilities || {};
      for (const [key, value] of Object.entries(caps)) { if (key.startsWith('can_')) update[key] = value; }

      // STRICT tenant validation — no fallback for missing organization_id
      const account = await base44.asServiceRole.entities.ClientAccount.get(membership.client_account_id);
      if (!account) return Response.json({ error: 'Client account not found' }, { status: 404 });
      if (!account.organization_id) {
        return Response.json({ error: 'Client Account must be linked to an Organization before tenant resources can be assigned.' }, { status: 400 });
      }

      if (authorized_facility_ids !== undefined) {
        update.authorized_facility_ids = await validateFacilityIds(base44, authorized_facility_ids, account);
      }
      if (authorized_engagement_ids !== undefined) {
        update.authorized_engagement_ids = await validateEngagementIds(base44, authorized_engagement_ids, account);
      }

      await base44.asServiceRole.entities.ClientMembership.update(membership_id, update);

      // Re-sync using centralized helper — preserves one-active invariant
      if (membership.membership_status === 'Active') {
        const effective = calculateEffectiveClientAccessStatus(account);
        const updated = { ...membership, ...update };
        await syncClientUserAuthorization(base44, updated, effective.effective_access_status, 'Active');
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
 * STRICT facility tenant validation.
 * Facility.operator_id MUST match ClientAccount.organization_id.
 * No fallback for missing organization_id — that is blocked before this function is called.
 * Mismatches cause a hard 400 rejection.
 */
async function validateFacilityIds(base44, facilityIds, account) {
  if (!facilityIds || facilityIds.length === 0) return [];
  if (!account || !account.organization_id) {
    throw new Error("Client Account must be linked to an Organization before tenant resources can be assigned.");
  }

  const facRes = await base44.asServiceRole.entities.Facility.list("-facility_name", 200);
  const allFacilities = Array.isArray(facRes) ? facRes : (facRes?.data || []);

  const validIds = facilityIds.filter(fid => {
    const fac = allFacilities.find(f => f.id === fid);
    if (!fac) return false;
    return fac.operator_id === account.organization_id;
  });

  if (validIds.length !== facilityIds.length) {
    throw new Error(`Tenant validation failed: ${facilityIds.length - validIds.length} facility ID(s) do not belong to this client account's organization`);
  }

  return validIds;
}

/**
 * STRICT engagement tenant validation.
 * Engagement.client_account_id must match (preferred), OR organization_id must match.
 * No fallback for missing organization_id.
 */
async function validateEngagementIds(base44, engagementIds, account) {
  if (!engagementIds || engagementIds.length === 0) return [];
  if (!account || !account.organization_id) {
    throw new Error("Client Account must be linked to an Organization before tenant resources can be assigned.");
  }

  const engRes = await base44.asServiceRole.entities.Engagement.list("-created_date", 200);
  const allEngagements = Array.isArray(engRes) ? engRes : (engRes?.data || []);

  const validIds = engagementIds.filter(eid => {
    const eng = allEngagements.find(e => e.id === eid);
    if (!eng) return false;
    // Prefer client_account_id match
    if (eng.client_account_id && eng.client_account_id === account.id) return true;
    // Fallback to organization_id match
    return eng.organization_id === account.organization_id;
  });

  if (validIds.length !== engagementIds.length) {
    throw new Error(`Tenant validation failed: ${engagementIds.length - validIds.length} engagement ID(s) do not belong to this client account`);
  }

  return validIds;
}