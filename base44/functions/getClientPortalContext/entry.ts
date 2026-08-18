import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { resolveClientEntitlement } from "../../shared/clientEntitlements.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const entitlement = await resolveClientEntitlement(base44, user);

    // If not authorized at all, return minimal info
    if (!entitlement.authorized && !entitlement.access_status) {
      return Response.json({
        authorized: false,
        access_status: null,
        account_name: null,
        membership_status: entitlement.membership_status,
        effective_capabilities: {},
        authorized_engagements: [],
        authorized_facilities: [],
        portal_message: "No active client membership found. Please contact Clinical SOS if you believe this is an error.",
        reason: entitlement.reason
      });
    }

    // Sanitize — never expose internal notes, override rationale, finance details, scoring
    const sanitized = {
      authorized: entitlement.authorized,
      access_status: entitlement.access_status,
      account_name: entitlement.account_name,
      membership_status: entitlement.membership_status,
      effective_capabilities: entitlement.effective_capabilities,
      engagement_ids: entitlement.engagement_ids || [],
      facility_ids: entitlement.facility_ids || [],
      portal_message: getPortalMessage(entitlement.access_status),
      reason: entitlement.authorized ? null : entitlement.reason
    };

    return Response.json(sanitized);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function getPortalMessage(accessStatus) {
  switch (accessStatus) {
    case 'Active':
      return null;
    case 'Grace Period':
      return "Your account is currently within a billing or subscription grace period. Portal access remains available.";
    case 'Restricted':
      return "Your account is currently in restricted mode. You may view previously published documents, but new interactive actions are unavailable.";
    case 'Suspended':
      return "Portal access is temporarily suspended. Please contact Clinical SOS regarding your account.";
    case 'Terminated':
      return "Portal access is no longer available. Please contact Clinical SOS if you have questions.";
    default:
      return null;
  }
}