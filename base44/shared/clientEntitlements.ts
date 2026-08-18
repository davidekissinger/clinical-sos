// Centralized client entitlement resolution logic.
// Shared by all client-facing backend functions to avoid duplication.

export const ACCESS_STATUSES = ["Active", "Grace Period", "Restricted", "Suspended", "Terminated"];
export const MEMBERSHIP_STATUSES = ["Invited", "Active", "Suspended", "Revoked", "Expired"];
export const ALL_CAPABILITIES = [
  "can_login", "can_view_engagement", "can_view_documents", "can_download_documents",
  "can_view_poc", "can_review_poc", "can_approve_poc",
  "can_view_tasks", "can_complete_tasks",
  "can_view_evidence", "can_submit_evidence",
  "can_view_audits", "can_complete_audits",
  "can_message_consultant"
];
export const POC_INTERNAL_STATUSES = ["AI Draft", "Clinical Review"];
export const WORKPRODUCT_INTERNAL_STATUSES = ["DRAFT", "CLINICAL REVIEW"];

// Resource → required VIEW capability mapping
export const RESOURCE_CAPABILITY_MAP = {
  engagements: "can_view_engagement",
  engagement: "can_view_engagement",
  cases: "can_view_engagement",
  case: "can_view_engagement",
  deficiencies: "can_view_engagement",
  deficiency: "can_view_engagement",
  pocs: "can_view_poc",
  work_products: "can_view_documents",
  documents: "can_view_documents",
  evidence: "can_view_evidence",
  tasks: "can_view_tasks",
  audits: "can_view_audits",
  readiness: "can_view_engagement",
  dashboard: null
};

/**
 * THE ONE AUTHORITATIVE effective access status helper.
 * ALL client security functions must use this same helper.
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
    return { effective_access_status: baseStatus, override_active: false, override_expired: true, reason: `Manual override '${override}' expired on ${expiration.toISOString()}` };
  }
  let effectiveStatus = baseStatus;
  if (override === "Suspend") effectiveStatus = "Suspended";
  else if (override === "Terminate") effectiveStatus = "Terminated";
  else if (override === "Reactivate") effectiveStatus = "Active";
  else if (override === "Extend Access") effectiveStatus = "Active";
  else if (override === "Maintain Access") effectiveStatus = baseStatus;
  return { effective_access_status: effectiveStatus, override_active: true, override_expired: false, reason: `Manual override '${override}' active` };
}

/**
 * THE ONE AUTHORITATIVE user authorization sync helper.
 * Used by: manageClientMembership, syncClientMembershipAccess, transitionClientAccess,
 *           override-expiration handling in resolveClientEntitlement.
 *
 * Account-level Suspended: role stays 'client', arrays cleared (user can see /client/account suspension message).
 * Account-level Terminated: role stays 'client', arrays cleared (user can see /client/account terminated message).
 * Membership Suspended/Revoked/Expired: role→'pending' if no other active membership, arrays cleared.
 *
 * @param {object} base44 - SDK client
 * @param {object} membership - ClientMembership record
 * @param {string} effectiveAccessStatus - from calculateEffectiveClientAccessStatus
 * @param {string} membershipStatus - the membership's status
 */
export async function syncClientUserAuthorization(base44, membership, effectiveAccessStatus, membershipStatus) {
  const currentUser = await base44.asServiceRole.entities.User.get(membership.client_user_id);
  if (!currentUser) return { role: null, authorized_facility_ids: [], authorized_engagement_ids: [] };

  const isAccountNoDataAccess = effectiveAccessStatus === "Suspended" || effectiveAccessStatus === "Terminated";

  let role;
  let facilityIds;
  let engagementIds;

  if (isAccountNoDataAccess) {
    // Account-level suspension/termination: role stays 'client', arrays cleared
    // User can still reach /client/account to see the suspension/termination message
    role = "client";
    facilityIds = [];
    engagementIds = [];
  } else if (membershipStatus === "Active") {
    // Fully active: role=client, arrays populated
    role = "client";
    facilityIds = membership.authorized_facility_ids || [];
    engagementIds = membership.authorized_engagement_ids || [];
  } else {
    // Membership suspended/revoked/expired: role→pending, arrays cleared
    role = currentUser.role === "client" ? "pending" : currentUser.role;
    facilityIds = [];
    engagementIds = [];
  }

  await base44.asServiceRole.entities.User.update(membership.client_user_id, {
    authorized_facility_ids: facilityIds,
    authorized_engagement_ids: engagementIds,
    role
  });

  return { role, authorized_facility_ids: facilityIds, authorized_engagement_ids: engagementIds };
}

/**
 * Resolve the effective client entitlement for an authenticated user.
 * Uses calculateEffectiveClientAccessStatus + syncClientUserAuthorization as single sources of truth.
 */
export async function resolveClientEntitlement(base44, user, options = {}) {
  const { requestedCapability, recordEngagementId, recordClientVisibility, recordType, recordStatus, resourceCapability } = options;

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

  // If override expired, clear it and re-sync using centralized sync helper
  if (effective.override_expired) {
    try {
      await base44.asServiceRole.entities.ClientAccount.update(account.id, {
        manual_access_override: "None", manual_override_reason: null, manual_override_by: null,
        manual_override_by_id: null, manual_override_effective_date: null, manual_override_expiration: null,
        last_entitlement_check: new Date().toISOString()
      });
      // Use centralized sync helper
      await syncClientUserAuthorization(base44, membership, effective.effective_access_status, membership.membership_status);
      await auditAccessChange(base44, {
        client_account_id: account.id, previous_access_state: account.manual_access_override,
        new_access_state: effective.effective_access_status, reason: "Manual override expired — automatic recalculation",
        triggering_source: "resolveClientEntitlement:override_expired", acting_user_id: "system",
        acting_user_name: "System — Override Expiration", manual_override: true,
        manual_override_details: "Override expired and was automatically cleared"
      });
    } catch (e) { /* non-blocking */ }
  }

  // Account-level Suspended/Terminated: membership stays Active, role stays client, but NO tenant data
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

  // Check resource-specific VIEW capability
  if (resourceCapability && !effectiveCapabilities[resourceCapability]) {
    return { authorized: false, access_status: effective.effective_access_status, membership_status: membership.membership_status, effective_capabilities: effectiveCapabilities, reason: `Capability '${resourceCapability}' not granted`, facility_ids: membership.authorized_facility_ids || [], engagement_ids: membership.authorized_engagement_ids || [], account_name: account.account_name };
  }

  // Check specific requested capability (for action functions)
  if (requestedCapability && !effectiveCapabilities[requestedCapability]) {
    return { authorized: false, access_status: effective.effective_access_status, membership_status: membership.membership_status, effective_capabilities: effectiveCapabilities, reason: `Capability '${requestedCapability}' not granted or restricted`, facility_ids: membership.authorized_facility_ids || [], engagement_ids: membership.authorized_engagement_ids || [], account_name: account.account_name };
  }

  const authorizedFacilityIds = membership.authorized_facility_ids || [];
  const authorizedEngagementIds = membership.authorized_engagement_ids || [];

  // Engagement-first tenant scope check
  if (recordEngagementId) {
    if (!authorizedEngagementIds.includes(recordEngagementId)) {
      return { authorized: false, access_status: effective.effective_access_status, membership_status: membership.membership_status, effective_capabilities: effectiveCapabilities, reason: "Record engagement is not within authorized tenant scope", facility_ids: authorizedFacilityIds, engagement_ids: authorizedEngagementIds, account_name: account.account_name };
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