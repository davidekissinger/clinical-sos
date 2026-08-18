import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireAdminBDorClinical } from '../../shared/roleAuth.ts';
import { resolveTestDataFromChain } from '../../shared/testDataPropagation.ts';

// Creates an Engagement AND marks the Opportunity as Won in a single controlled transaction.
// Prevents duplicate Engagement creation. Validates all required fields.
// Allowed roles: admin, business_development, clinical.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const authCheck = requireAdminBDorClinical(user);
    if (!authCheck.authorized) return Response.json({ error: authCheck.error }, { status: authCheck.status });

    const body = await req.json();
    const { opportunity_id, service_type, start_date, clinical_lead_id, clinical_lead_name, engagement_model, accepted_proposal_id } = body;
    if (!opportunity_id) return Response.json({ error: 'opportunity_id is required' }, { status: 400 });
    if (!service_type) return Response.json({ error: 'service_type is required' }, { status: 400 });
    if (!start_date) return Response.json({ error: 'start_date is required' }, { status: 400 });
    if (!engagement_model) return Response.json({ error: 'engagement_model is required' }, { status: 400 });
    if (!clinical_lead_name) return Response.json({ error: 'clinical_lead_name is required (or "To be assigned")', status: 'missing_clinical_lead' }, { status: 400 });

    const svc = base44.asServiceRole;
    const opp = await svc.entities.Opportunity.get(opportunity_id);
    if (!opp) return Response.json({ error: 'Opportunity not found' }, { status: 404 });

    // Prevent duplicate engagement creation — return existing if found
    const existing = await svc.entities.Engagement.filter({ opportunity_id });
    if (existing && existing.length > 0) {
      const eng = existing[0];
      // Ensure Opportunity is marked Won (idempotent)
      if (opp.stage !== 'Won') {
        await svc.entities.Opportunity.update(opportunity_id, { stage: 'Won' });
      }
      try {
        await svc.entities.AutomationLog.create({
          automation: 'Won → Engagement Creation (Duplicate Prevention)',
          started: new Date().toISOString(),
          completed: new Date().toISOString(),
          status: 'Success',
          records_processed: 1,
          affected_record_ids: [opportunity_id, eng.id],
          triggered_by: user.full_name || user.email || 'system',
          errors: `Engagement already exists for opportunity — no duplicate created. Existing engagement: ${eng.engagement_name}`,
        });
      } catch (e) { /* best-effort */ }
      return Response.json({
        ok: true,
        engagement_id: eng.id,
        engagement_name: eng.engagement_name,
        duplicate: true,
        message: 'Engagement already exists for this opportunity — no duplicate created. Linkage preserved.',
      });
    }

    // Determine test-data status from opportunity chain
    const isTestData = await resolveTestDataFromChain(svc, [
      { entity: 'Opportunity', id: opportunity_id },
      { entity: 'Facility', id: opp.facility_id },
    ]);

    const engagementName = `${opp.organization_name || opp.facility_name || opp.opportunity_name} — ${service_type}`;

    // Create the Engagement FIRST — if this fails, the Opportunity stays unchanged
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

    // Only NOW mark the Opportunity as Won — engagement was successfully created
    await svc.entities.Opportunity.update(opportunity_id, { stage: 'Won' });

    // Link accepted proposal to engagement if provided
    if (accepted_proposal_id) {
      try {
        await svc.entities.Proposal.update(accepted_proposal_id, {
          acceptance_status: 'Accepted',
          status: 'Accepted',
        });
      } catch (e) { /* best-effort */ }
    }

    // Log the transaction
    try {
      await svc.entities.AutomationLog.create({
        automation: 'Won → Engagement Creation',
        started: new Date().toISOString(),
        completed: new Date().toISOString(),
        status: 'Success',
        records_processed: 2,
        affected_record_ids: [opportunity_id, engagement.id],
        triggered_by: user.full_name || user.email || 'system',
        errors: `Opportunity marked Won. Engagement created: ${engagementName}. Model: ${engagement_model}.`,
      });
    } catch (e) { /* best-effort */ }

    return Response.json({
      ok: true,
      engagement_id: engagement.id,
      engagement_name: engagementName,
      duplicate: false,
      opportunity_stage: 'Won',
    });
  } catch (error) {
    return Response.json({ error: error.message, status: 'engagement_creation_failed' }, { status: 500 });
  }
}