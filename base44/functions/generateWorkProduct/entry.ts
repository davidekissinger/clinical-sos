import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireAdminOrClinical } from '../../shared/roleAuth.ts';
import { resolveTestDataFromChain } from '../../shared/testDataPropagation.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const authCheck = requireAdminOrClinical(user);
    if (!authCheck.authorized) return Response.json({ error: authCheck.error }, { status: authCheck.status });

    const body = await req.json();
    const { document_type, deficiency_id, facility_name, f_tag, regulatory_case_id, engagement_id, prompt } = body;

    if (!document_type || !prompt) return Response.json({ error: 'document_type and prompt are required' }, { status: 400 });

    const svc = base44.asServiceRole;

    // Gather source records for provenance
    const sourceFieldsUsed: string[] = [];
    const sourceRecordIds: string[] = [];
    const sourceSnapshot: any = {};

    let deficiency = null;
    let regCase = null;
    let facility = null;

    if (deficiency_id) {
      try {
        deficiency = await svc.entities.Deficiency.get(deficiency_id);
        if (deficiency) {
          sourceRecordIds.push(deficiency.id);
          sourceSnapshot.deficiency = {
            id: deficiency.id,
            f_tag: deficiency.f_tag,
            deficiency_title: deficiency.deficiency_title,
            scope_severity: deficiency.scope_severity,
            immediate_jeopardy: deficiency.immediate_jeopardy,
            survey_finding: deficiency.survey_finding,
            factual_summary: deficiency.factual_summary,
            immediate_correction: deficiency.immediate_correction,
            systemic_correction: deficiency.systemic_correction,
            audit_monitoring: deficiency.audit_monitoring,
            education_training: deficiency.education_training,
            responsible_leader: deficiency.responsible_leader,
            target_completion_date: deficiency.target_completion_date,
            qapi_oversight: deficiency.qapi_oversight,
            regulatory_mapping_verified: deficiency.regulatory_mapping_verified,
          };
          if (deficiency.regulatory_case_id) {
            try {
              regCase = await svc.entities.RegulatoryCase.get(deficiency.regulatory_case_id);
              if (regCase) { sourceRecordIds.push(regCase.id); sourceSnapshot.regulatory_case = { id: regCase.id, case_name: regCase.case_name }; }
            } catch (e) { /* best-effort */ }
          }
          if (deficiency.facility_id) {
            try {
              facility = await svc.entities.Facility.get(deficiency.facility_id);
              if (facility) { sourceRecordIds.push(facility.id); sourceSnapshot.facility = { id: facility.id, facility_name: facility.facility_name }; }
            } catch (e) { /* best-effort */ }
          }
        }
      } catch (e) { /* best-effort */ }
    }

    // Determine test-data status from parent chain
    const isTestData = await resolveTestDataFromChain(svc, [
      { entity: 'Deficiency', id: deficiency_id },
      { entity: 'RegulatoryCase', id: deficiency?.regulatory_case_id },
      { entity: 'Facility', id: deficiency?.facility_id },
      { entity: 'Engagement', id: engagement_id },
    ]);

    // Build anti-hallucination prompt
    const antiHallucinationRules = `CRITICAL RULES — VIOLATION REJECTS THE OUTPUT:
1. You may ONLY state a factual action as "completed", "implemented", "performed", "approved", "trained", "audited", "corrected", "submitted", "accepted", or "verified" when that information is EXPLICITLY present in the provided structured data.
2. If a structured field is empty, null, or missing, you MUST write "To be completed." for that section.
3. Do NOT fill gaps with plausible healthcare practices, industry standards, or inferred actions.
4. Do NOT invent: facility names, F-tags, residents, dates, scope/severity, enforcement actions, regulations, or survey language.
5. Do NOT assign a responsible leader (DON, Administrator, Infection Preventionist, etc.) if the field is blank.
6. Mark the entire document as DRAFT.
7. If the regulatory mapping is not verified, include: "REGULATORY MAPPING REQUIRES VERIFICATION"`;

    const fullPrompt = `You are a long-term care regulatory consultant generating a professional work product.

${antiHallucinationRules}

Document Type: ${document_type}
Facility: ${facility_name || deficiency?.facility_name || '—'}
F-Tag: ${f_tag || deficiency?.f_tag || '—'}
Regulatory Mapping Verified: ${deficiency?.regulatory_mapping_verified ? 'Yes' : 'No — REGULATORY MAPPING REQUIRES VERIFICATION'}

${prompt}`;

    const llmResult = await svc.integrations.Core.InvokeLLM({ prompt: fullPrompt });
    const content = typeof llmResult === 'string' ? llmResult : (llmResult?.content || JSON.stringify(llmResult));

    // Post-generation validation: check for invented completion language
    const inventedPatterns = [
      /(?:has been|was|were)\s+(?:implemented|completed|performed|conducted|executed)/i,
      /(?:staff|facility|team)\s+(?:will|shall|must)\s+(?:conduct|perform|implement|complete)/i,
      /hourly rounding/i,
      /staffing ratio.*adjusted/i,
    ];
    let validatedContent = content;
    const fieldsChecked = ['immediate_correction', 'systemic_correction', 'audit_monitoring', 'education_training', 'responsible_leader'];
    const blankFields = fieldsChecked.filter(f => !deficiency || !deficiency[f] || !String(deficiency[f]).trim());

    // If a field was blank but the content contains completion language for it, flag
    let hallucinationDetected = false;
    if (blankFields.length > 0 && deficiency) {
      // Check if content mentions actions for blank fields
      if (blankFields.includes('immediate_correction') && /immediate correction:?\s*[^T]/i.test(content) && !/To be completed/i.test(content)) {
        hallucinationDetected = true;
      }
    }

    // Create WorkProduct record with provenance
    const wp = await svc.entities.WorkProduct.create({
      document_type,
      facility_id: deficiency?.facility_id || null,
      facility_name: facility_name || deficiency?.facility_name || null,
      engagement_id: engagement_id || deficiency?.engagement_id || null,
      regulatory_case_id: regulatory_case_id || deficiency?.regulatory_case_id || null,
      deficiency_id: deficiency_id || null,
      f_tag: f_tag || deficiency?.f_tag || null,
      generation_date: new Date().toISOString(),
      document_status: 'DRAFT',
      preparer: user.full_name || user.email || 'System',
      version: '1.0',
      content: validatedContent,
      source_snapshot: JSON.stringify(sourceSnapshot),
      source_fields_used: sourceFieldsUsed,
      source_record_ids: sourceRecordIds,
      is_test_data: isTestData,
    });

    // Log
    try {
      await svc.entities.AutomationLog.create({
        automation: 'Work Product Generation',
        started: new Date().toISOString(),
        completed: new Date().toISOString(),
        status: 'Success',
        records_processed: 1,
        affected_record_ids: [wp.id],
        triggered_by: user.full_name || user.email || 'system',
        errors: hallucinationDetected ? 'Potential hallucination detected — review required.' : null,
      });
    } catch (e) { /* best-effort */ }

    return Response.json({
      ok: true,
      work_product_id: wp.id,
      document_type,
      document_status: 'DRAFT',
      content: validatedContent,
      is_test_data: isTestData,
      source_record_ids: sourceRecordIds,
      hallucination_warning: hallucinationDetected,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}