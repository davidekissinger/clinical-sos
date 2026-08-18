import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { resolveClientEntitlement, auditAccessChange } from "../../shared/clientEntitlements.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { requested_capability, record_facility_id, record_engagement_id, record_client_visibility, record_type, record_status } = body;

    const result = await resolveClientEntitlement(base44, user, {
      requestedCapability: requested_capability,
      recordFacilityId: record_facility_id,
      recordEngagementId: record_engagement_id,
      recordClientVisibility: record_client_visibility,
      recordType: record_type,
      recordStatus: record_status
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}