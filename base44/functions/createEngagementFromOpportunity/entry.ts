import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireAdminOrClinical } from '../../shared/roleAuth.ts';

// Creates an Engagement when an Opportunity moves to "Won".
// Prevents duplicate Engagement creation if the stage is changed multiple times.
// Requires: client/facility, service type, start date, clinical lead.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const authCheck = requireAdminOrClinical(user);
    if (!authCheck.authorized) return Response.json({ error: authCheck.error }, { status: authCheck.status });

    const body = await req.json();
    const { opportunity_id, service_type, start_date, clinical_lead_id, clinical_lead_name, engagement_model, accepted_proposal_id } = body;
    if (!opportunity_id) return Response.json({ error: 'opportunity_id is required' }, { status: 400 });
    if (!service_type) return Response.json({ error: 'service_type is required' }, { status: 400 });
    if (!start_date) return Response.json({ error: 'start_date is required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const opp = await svc.entities.Opportunity.get(opportunity_id);
    if (!opp) return Response.json({ error: 'Opportunity not found' }, { status: 404 });

    if (opp.stage !== 'Won') {
      return Response.json({ error: 'Opportunity must be in "Won" stage to create an engagement', status: 'opportunity_not_won' }, { status: 400 });
    }

    // Prevent duplicate engagement creation
    const existing = await svc.entities.Engagement.filter({ opportunity_id });
    if (existing && existing.length > 0) {
      return Response.json({
        ok: true,
        engagement_id: existing[0].id,
        engagement_name: existing[0].engagement_name,
        duplicate: true,
        message: 'Engagement already exists for this opportunity — no duplicate created.',
      });
    }

    const engagementName = `${opp.organization_name || opp.facility_name || opp.opportunity_name} — ${service_type}`;
    const isTestData = !!opp.is_test_data;

    const engagement = await svc.entities.Engagement.create({
      engagement_name: engagementName,
      client_name: opp.organization_name || opp.facility_name || opp.primary_contact_name,
      opportunity_id,
      facility_id: opp.facility_id,
      facility_name: opp.facility_name,
      organization_id: opp.organization_id,
      organization_name: opp.organization_name,
      start_date,
      service_type,
      phase: 'Phase 1 — Initial Assessment',
      clinical_lead_id: clinical_lead_id || null,
      clinical_lead_name: clinical_lead_name || null,
      status: 'Active',
      is_test_data: isTestData,
    });

    // Log
    try {
      await svc.entities.AutomationLog.create({
        automation: 'Won → Engagement Creation',
        started: new Date().toISOString(),
        completed: new Date().toISOString(),
        status: 'Success',
        records_processed: 1,
        affected_record_ids: [opportunity_id, engagement.id],
        triggered_by: user.full_name || user.email || 'system',
      });
    } catch (e) { /* best-effort */ }

    return Response.json({
      ok: true,
      engagement_id: engagement.id,
      engagement_name: engagementName,
      duplicate: false,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}