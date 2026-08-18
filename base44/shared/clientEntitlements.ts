// Centralized client entitlement resolution logic.
// Shared by all client-facing backend functions to avoid duplication.

export const ACCESS_STATUSES = ["Active", "Grace Period", "Restricted", "Suspended", "Terminated"];
export const MEMBERSHIP_STATUSES = ["Invited", "Active", "Suspended", "Revoked", "Expired"];
export const ALL_CAPABILITIES = [
  "can_login", "can_view_engagement", "can_view_documents", "can_download_documents",
  "can_review_poc", "can_approve_poc", "can_view_tasks", "can_complete_tasks",
  "can_submit_evidence", "can_view_audits", "can_complete_audits", "can_message_consultant"
];
export const POC_INTERNAL_STATUSES = ["AI Draft", "Clinical Review"];
export const WORKPRODUCT_INTERNAL_STATUSES = ["DRAFT", "CLINICAL REVIEW"];

/**
 * THE ONE AUTHORITATIVE effective access status helper.
 * ALL client security functions must use this same helper.
 *
 * Handles: base access_status, manual_access_override, override expiration.
 * Does NOT auto-suspend based on billing (admin-confirmed for V1).
 *
 * @param {object} account - ClientAccount record
 * @returns {{ effective_access_status: string, override_active: boolean, override_expired: boolean, reason: string }}
 */
export function calculateEffectiveClientAccessStatus(account) {
  if (!account) {
    return { effective_access_status: null, override_active: false, override_expired: false, reason: "Account not found" };
  }

  const baseStatus = account.access_status || "Active";
  const override = account.manual_access_override;

  if (!override || override === "None") {
    return { effective_access_status: baseStatus, override_active: false, override_expired: false, reason: "Base access status" };
  }

  const now = new Date();
  const expiration = account.manual_override_expiration ? new Date(account.manual_override_expiration) : null;
  const isExpired = expiration && expiration < now;

  if (isExpired) {
    return {
      effective_access_status: baseStatus,
      override_active: false,
      override_expired: true,
      reason: `Manual override '${override}' expired on ${expiration.toISOString()}`
    };
  }

  // Override is active — apply it
  let effectiveStatus = baseStatus;
  if (override === "Suspend") effectiveStatus = "Suspended";
  else if (override === "Terminate") effectiveStatus = "Terminated";
  else if (override === "Reactivate") effectiveStatus = "Active";
  else if (override === "Extend Access") effectiveStatus = "Active";
  else if (override === "Maintain Access") effectiveStatus = baseStatus;

  return {
    effective_access_status: effectiveStatus,
    override_active: true,
    override_expired: false,
    reason: `Manual override '${override}' active`
  };
}

/**
 * Resolve the effective client entitlement for an authenticated user.
 * Uses calculateEffectiveClientAccessStatus as the single source of truth.
 */
export async function resolveClientEntitlement(base44, user, options = {}) {
  const { requestedCapability, recordFacilityId, recordEngagementId, recordClientVisibility, recordType, recordStatus } = options;

  if (user.role !== "client") {
    return { authorized: false, access_status: null, membership_status: null, effective_capabilities: {}, reason: "User does not have client role", facility_ids: [], engagement_ids: [], account_name: null };
  }

  // Find active ClientMembership
  const memberships = await base44.asServiceRole.entities.ClientMembership.filter({ client_user_id: user.id });
  if (!memberships || memberships.length === 0) {
    return { authorized: false, access_status: null, membership_status: null, effective_capabilities: {}, reason: "No client membership found", facility_ids: [], engagement_ids: [], account_name: null };
  }

  const membership = memberships.find(m => m.membership_status === "Active") || memberships[0];

  // Membership must be Active
  if (membership.membership_status !== "Active") {
    return { authorized: false, access_status: null, membership_status: membership.membership_status, effective_capabilities: {}, reason: `Membership is ${membership.membership_status}`, facility_ids: [], engagement_ids: [], account_name: null };
  }

  if (membership.can_login === false) {
    return { authorized: false, access_status: null, membership_status: membership.membership_status, effective_capabilities: {}, reason: "Login capability not granted", facility_ids: [], engagement_ids: [], account_name: null };
  }

  // Retrieve ClientAccount
  const account = await base44.asServiceRole.entities.ClientAccount.get(membership.client_account_id);
  if (!account) {
    return { authorized: false, access_status: null, membership_status: membership.membership_status, effective_capabilities: {}, reason: "Client account not found", facility_ids: [], engagement_ids: [], account_name: null };
  }

  // Use centralized helper
  const effective = calculateEffectiveClientAccessStatus(account);

  // If override expired, clear it and re-sync
  if (effective.override_expired) {
    try {
      await base44.asServiceRole.entities.ClientAccount.update(account.id, {
        manual_access_override: "None", manual_override_reason: null, manual_override_by: null,
        manual_override_by_id: null, manual_override_effective_date: null, manual_override_expiration: null,
        last_entitlement_check: new Date().toISOString()
      });
      // Re-sync user arrays based on base status
      const syncedUser = await base44.asServiceRole.entities.User.get(membership.client_user_id);
      if (syncedUser) {
        const shouldBeClient = effective.effective_access_status !== "Suspended" && effective.effective_access_status !== "Terminated";
        await base44.asServiceRole.entities.User.update(membership.client_user_id, {
          authorized_facility_ids: shouldBeClient ? (membership.authorized_facility_ids || []) : [],
          authorized_engagement_ids: shouldBeClient ? (membership.authorized_engagement_ids || []) : [],
          role: shouldBeClient ? "client" : (syncedUser.role === "client" ? "pending" : syncedUser.role)
        });
      }
      await auditAccessChange(base44, {
        client_account_id: account.id, previous_access_state: account.manual_access_override,
        new_access_state: effective.effective_access_status, reason: "Manual override expired — automatic recalculation",
        triggering_source: "resolveClientEntitlement:override_expired", acting_user_id: "system",
        acting_user_name: "System — Override Expiration", manual_override: true,
        manual_override_details: "Override expired and was automatically cleared"
      });
    } catch (e) { /* non-blocking */ }
  }

  // Suspended / Terminated — account-level: membership stays Active but NO tenant data
  // User can still reach /client/account to see suspension message
  if (effective.effective_access_status === "Suspended" || effective.effective_access_status === "Terminated") {
    return { authorized: false, access_status: effective.effective_access_status, membership_status: membership.membership_status, effective_capabilities: {}, reason: `Account is ${effective.effective_access_status}`, facility_ids: [], engagement_ids: [], account_name: account.account_name };
  }

  // Compute effective capabilities
  const membershipCaps = {};
  for (const cap of ALL_CAPABILITIES) membershipCaps[cap] = membership[cap] === true;
  let effectiveCapabilities = { ...membershipCaps };

  if (effective.effective_access_status === "Restricted") {
    effectiveCapabilities.can_submit_evidence = false;
    effectiveCapabilities.can_complete_audits = false;
    effectiveCapabilities.can_approve_poc = false;
    effectiveCapabilities.can_complete_tasks = false;
    effectiveCapabilities.can_review_poc = false;
    effectiveCapabilities.can_message_consultant = false;
  }

  // Check specific capability
  if (requestedCapability && !effectiveCapabilities[requestedCapability]) {
    return { authorized: false, access_status: effective.effective_access_status, membership_status: membership.membership_status, effective_capabilities: effectiveCapabilities, reason: `Capability '${requestedCapability}' not granted or restricted`, facility_ids: membership.authorized_facility_ids || [], engagement_ids: membership.authorized_engagement_ids || [], account_name: account.account_name };
  }

  // Tenant scope check
  const authorizedFacilityIds = membership.authorized_facility_ids || [];
  const authorizedEngagementIds = membership.authorized_engagement_ids || [];

  if (recordFacilityId || recordEngagementId) {
    const facilityMatch = recordFacilityId && authorizedFacilityIds.includes(recordFacilityId);
    const engagementMatch = recordEngagementId && authorizedEngagementIds.includes(recordEngagementId);
    if (!facilityMatch && !engagementMatch) {
      return { authorized: false, access_status: effective.effective_access_status, membership_status: membership.membership_status, effective_capabilities: effectiveCapabilities, reason: "Record is not within authorized tenant scope", facility_ids: authorizedFacilityIds, engagement_ids: authorizedEngagementIds, account_name: account.account_name };
    }
  }

  // client_visibility check
  if (recordClientVisibility === false) {
    return { authorized: false, access_status: effective.effective_access_status, membership_status: membership.membership_status, effective_capabilities: effectiveCapabilities, reason: "Record is not published to client portal", facility_ids: authorizedFacilityIds, engagement_ids: authorizedEngagementIds, account_name: account.account_name };
  }

  // Lifecycle checks
  if (recordType === "POC" && recordStatus && POC_INTERNAL_STATUSES.includes(recordStatus)) {
    return { authorized: false, access_status: effective.effective_access_status, membership_status: membership.membership_status, effective_capabilities: effectiveCapabilities, reason: `POC status '${recordStatus}' is not client-visible`, facility_ids: authorizedFacilityIds, engagement_ids: authorizedEngagementIds, account_name: account.account_name };
  }
  if (recordType === "WorkProduct" && recordStatus && WORKPRODUCT_INTERNAL_STATUSES.includes(recordStatus)) {
    return { authorized: false, access_status: effective.effective_access_status, membership_status: membership.membership_status, effective_capabilities: effectiveCapabilities, reason: `WorkProduct status '${recordStatus}' is not client-visible`, facility_ids: authorizedFacilityIds, engagement_ids: authorizedEngagementIds, account_name: account.account_name };
  }

  // Update last_entitlement_check (non-blocking)
  try { await base44.asServiceRole.entities.ClientAccount.update(account.id, { last_entitlement_check: new Date().toISOString() }); } catch (e) {}

  return { authorized: true, access_status: effective.effective_access_status, membership_status: membership.membership_status, effective_capabilities: effectiveCapabilities, reason: "Authorized", facility_ids: authorizedFacilityIds, engagement_ids: authorizedEngagementIds, account_name: account.account_name };
}

/**
 * Write an access-change audit record to AutomationLog.
 */
export async function auditAccessChange(base44, params) {
  const { client_account_id, previous_access_state, new_access_state, reason, triggering_source, acting_user_id, acting_user_name, manual_override, manual_override_details } = params;
  await base44.asServiceRole.entities.AutomationLog.create({
    automation: "Client Access Change", started: new Date().toISOString(), completed: new Date().toISOString(),
    status: "Success", client_account_id, previous_access_state, new_access_state, reason, triggering_source,
    acting_user_id, acting_user_name, manual_override: manual_override || false,
    manual_override_details: manual_override_details || null, affected_record_ids: client_account_id ? [client_account_id] : []
  });
}