// Centralized client entitlement resolution logic.
// Shared by all client-facing backend functions to avoid duplication.

export const ACCESS_STATUSES = ["Active", "Grace Period", "Restricted", "Suspended", "Terminated"];

export const MEMBERSHIP_STATUSES = ["Invited", "Active", "Suspended", "Revoked", "Expired"];

export const ALL_CAPABILITIES = [
  "can_login",
  "can_view_engagement",
  "can_view_documents",
  "can_download_documents",
  "can_review_poc",
  "can_approve_poc",
  "can_view_tasks",
  "can_complete_tasks",
  "can_submit_evidence",
  "can_view_audits",
  "can_complete_audits",
  "can_message_consultant"
];

// POC statuses that are NEVER client-visible
export const POC_INTERNAL_STATUSES = ["AI Draft", "Clinical Review"];

// WorkProduct statuses that are NEVER client-visible
export const WORKPRODUCT_INTERNAL_STATUSES = ["DRAFT", "CLINICAL REVIEW"];

/**
 * Resolve the effective client entitlement for an authenticated user.
 *
 * Security chain: Authenticated User → ClientMembership → ClientAccount →
 * Authorized Facility IDs → Authorized Engagement IDs → Record Tenant →
 * Client Visibility → Capability → Current Entitlement Status.
 *
 * @param {object} base44 - The Base44 SDK client (createClientFromRequest result)
 * @param {object} user - The authenticated user (from base44.auth.me())
 * @param {object} options - { requestedCapability, recordFacilityId, recordEngagementId, recordClientVisibility, recordType }
 * @returns {object} { authorized, access_status, membership_status, effective_capabilities, reason, facility_ids, engagement_ids, account_name }
 */
export async function resolveClientEntitlement(base44, user, options = {}) {
  const {
    requestedCapability,
    recordFacilityId,
    recordEngagementId,
    recordClientVisibility,
    recordType,
    recordStatus
  } = options;

  // 1. User must have client role
  if (user.role !== "client") {
    return {
      authorized: false,
      access_status: null,
      membership_status: null,
      effective_capabilities: {},
      reason: "User does not have client role",
      facility_ids: [],
      engagement_ids: [],
      account_name: null
    };
  }

  // 2. Find active ClientMembership for this user
  const memberships = await base44.asServiceRole.entities.ClientMembership.filter({
    client_user_id: user.id
  });

  if (!memberships || memberships.length === 0) {
    return {
      authorized: false,
      access_status: null,
      membership_status: null,
      effective_capabilities: {},
      reason: "No client membership found for this user",
      facility_ids: [],
      engagement_ids: [],
      account_name: null
    };
  }

  // Use the first active membership (a user should have one active membership)
  const membership = memberships.find(m => m.membership_status === "Active") || memberships[0];

  // 3. Validate membership status
  if (membership.membership_status !== "Active") {
    return {
      authorized: false,
      access_status: null,
      membership_status: membership.membership_status,
      effective_capabilities: {},
      reason: `Membership is ${membership.membership_status}`,
      facility_ids: [],
      engagement_ids: [],
      account_name: null
    };
  }

  // 4. Check can_login capability
  if (membership.can_login === false) {
    return {
      authorized: false,
      access_status: null,
      membership_status: membership.membership_status,
      effective_capabilities: {},
      reason: "Login capability not granted",
      facility_ids: [],
      engagement_ids: [],
      account_name: null
    };
  }

  // 5. Retrieve ClientAccount
  const account = await base44.asServiceRole.entities.ClientAccount.get(membership.client_account_id);
  if (!account) {
    return {
      authorized: false,
      access_status: null,
      membership_status: membership.membership_status,
      effective_capabilities: {},
      reason: "Client account not found",
      facility_ids: [],
      engagement_ids: [],
      account_name: null
    };
  }

  // 6. Evaluate manual override expiration
  let effectiveAccessStatus = account.access_status;
  const now = new Date();

  if (account.manual_access_override && account.manual_access_override !== "None") {
    // Check if override has expired
    if (account.manual_override_expiration) {
      const expiration = new Date(account.manual_override_expiration);
      if (expiration < now) {
        // Override expired — recalculate normal entitlement
        effectiveAccessStatus = account.access_status;
      } else {
        // Override is active — apply it
        if (account.manual_access_override === "Suspend") effectiveAccessStatus = "Suspended";
        else if (account.manual_access_override === "Terminate") effectiveAccessStatus = "Terminated";
        else if (account.manual_access_override === "Reactivate") effectiveAccessStatus = "Active";
        else if (account.manual_access_override === "Extend Access") effectiveAccessStatus = "Active";
        else if (account.manual_access_override === "Maintain Access") effectiveAccessStatus = account.access_status;
      }
    } else {
      // No expiration — override is active indefinitely
      if (account.manual_access_override === "Suspend") effectiveAccessStatus = "Suspended";
      else if (account.manual_access_override === "Terminate") effectiveAccessStatus = "Terminated";
      else if (account.manual_access_override === "Reactivate") effectiveAccessStatus = "Active";
      else if (account.manual_access_override === "Extend Access") effectiveAccessStatus = "Active";
      else if (account.manual_access_override === "Maintain Access") effectiveAccessStatus = account.access_status;
    }
  }

  // 7. Suspended / Terminated — no portal data access
  if (effectiveAccessStatus === "Suspended" || effectiveAccessStatus === "Terminated") {
    return {
      authorized: false,
      access_status: effectiveAccessStatus,
      membership_status: membership.membership_status,
      effective_capabilities: {},
      reason: `Account is ${effectiveAccessStatus}`,
      facility_ids: membership.authorized_facility_ids || [],
      engagement_ids: membership.authorized_engagement_ids || [],
      account_name: account.account_name
    };
  }

  // 8. Compute effective capabilities based on access status
  const membershipCaps = {};
  for (const cap of ALL_CAPABILITIES) {
    membershipCaps[cap] = membership[cap] === true;
  }

  let effectiveCapabilities = { ...membershipCaps };

  if (effectiveAccessStatus === "Restricted") {
    // Restricted: read-only historical access — block all interactive actions
    effectiveCapabilities.can_submit_evidence = false;
    effectiveCapabilities.can_complete_audits = false;
    effectiveCapabilities.can_approve_poc = false;
    effectiveCapabilities.can_complete_tasks = false;
    effectiveCapabilities.can_review_poc = false;
    effectiveCapabilities.can_message_consultant = false;
  }

  // 9. If a specific capability is requested, check it
  if (requestedCapability) {
    if (!effectiveCapabilities[requestedCapability]) {
      return {
        authorized: false,
        access_status: effectiveAccessStatus,
        membership_status: membership.membership_status,
        effective_capabilities: effectiveCapabilities,
        reason: `Capability '${requestedCapability}' not granted or restricted`,
        facility_ids: membership.authorized_facility_ids || [],
        engagement_ids: membership.authorized_engagement_ids || [],
        account_name: account.account_name
      };
    }
  }

  // 10. If a specific record is being accessed, verify tenant authorization
  const authorizedFacilityIds = membership.authorized_facility_ids || [];
  const authorizedEngagementIds = membership.authorized_engagement_ids || [];

  if (recordFacilityId || recordEngagementId) {
    const facilityMatch = recordFacilityId && authorizedFacilityIds.includes(recordFacilityId);
    const engagementMatch = recordEngagementId && authorizedEngagementIds.includes(recordEngagementId);

    if (!facilityMatch && !engagementMatch) {
      return {
        authorized: false,
        access_status: effectiveAccessStatus,
        membership_status: membership.membership_status,
        effective_capabilities: effectiveCapabilities,
        reason: "Record is not within authorized tenant scope",
        facility_ids: authorizedFacilityIds,
        engagement_ids: authorizedEngagementIds,
        account_name: account.account_name
      };
    }
  }

  // 11. Check record client_visibility
  if (recordClientVisibility === false) {
    return {
      authorized: false,
      access_status: effectiveAccessStatus,
      membership_status: membership.membership_status,
      effective_capabilities: effectiveCapabilities,
      reason: "Record is not published to client portal",
      facility_ids: authorizedFacilityIds,
      engagement_ids: authorizedEngagementIds,
      account_name: account.account_name
    };
  }

  // 12. Check record lifecycle status (POC / WorkProduct)
  if (recordType === "POC" && recordStatus && POC_INTERNAL_STATUSES.includes(recordStatus)) {
    return {
      authorized: false,
      access_status: effectiveAccessStatus,
      membership_status: membership.membership_status,
      effective_capabilities: effectiveCapabilities,
      reason: `POC status '${recordStatus}' is not client-visible`,
      facility_ids: authorizedFacilityIds,
      engagement_ids: authorizedEngagementIds,
      account_name: account.account_name
    };
  }

  if (recordType === "WorkProduct" && recordStatus && WORKPRODUCT_INTERNAL_STATUSES.includes(recordStatus)) {
    return {
      authorized: false,
      access_status: effectiveAccessStatus,
      membership_status: membership.membership_status,
      effective_capabilities: effectiveCapabilities,
      reason: `WorkProduct status '${recordStatus}' is not client-visible`,
      facility_ids: authorizedFacilityIds,
      engagement_ids: authorizedEngagementIds,
      account_name: account.account_name
    };
  }

  // 13. Update last_entitlement_check (non-blocking)
  try {
    await base44.asServiceRole.entities.ClientAccount.update(account.id, {
      last_entitlement_check: new Date().toISOString()
    });
  } catch (e) {
    // Non-blocking — entitlement still valid
  }

  return {
    authorized: true,
    access_status: effectiveAccessStatus,
    membership_status: membership.membership_status,
    effective_capabilities: effectiveCapabilities,
    reason: "Authorized",
    facility_ids: authorizedFacilityIds,
    engagement_ids: authorizedEngagementIds,
    account_name: account.account_name
  };
}

/**
 * Write an access-change audit record to AutomationLog.
 */
export async function auditAccessChange(base44, params) {
  const {
    client_account_id,
    previous_access_state,
    new_access_state,
    reason,
    triggering_source,
    acting_user_id,
    acting_user_name,
    manual_override,
    manual_override_details
  } = params;

  await base44.asServiceRole.entities.AutomationLog.create({
    automation: "Client Access Change",
    started: new Date().toISOString(),
    completed: new Date().toISOString(),
    status: "Success",
    client_account_id,
    previous_access_state,
    new_access_state,
    reason,
    triggering_source,
    acting_user_id,
    acting_user_name,
    manual_override: manual_override || false,
    manual_override_details: manual_override_details || null,
    affected_record_ids: client_account_id ? [client_account_id] : []
  });
}