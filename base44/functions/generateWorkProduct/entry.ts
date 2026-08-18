import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireAdminOrClinical } from '../../shared/roleAuth.ts';
import { resolveTestDataFromChain } from '../../shared/testDataPropagation.ts';

// Server-side work product generation with anti-hallucination enforcement.
// The server retrieves all authoritative structured data itself and constructs the prompt.
// Client does NOT provide free-text factual prompts — the database is the controlling source.
// If generated content contains unsupported factual claims, it is rejected or regenerated.
// Maximum 2 regeneration attempts. If still invalid, the work product is NOT saved.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const authCheck = requireAdminOrClinical(user);
    if (!authCheck.authorized) return Response.json({ error: authCheck.error }, { status: authCheck.status });

    const body = await req.json();
    const { document_type, deficiency_id, poc_id, regulatory_case_id, engagement_id, action } = body;

    if (!document_type) return Response.json({ error: 'document_type is required' }, { status: 400 });
    if (!deficiency_id && !poc_id && !regulatory_case_id) return Response.json({ error: 'At least one of deficiency_id, poc_id, or regulatory_case_id is required' }, { status: 400 });

    const svc = base44.asServiceRole;

    // --- Retrieve all authoritative source records server-side ---
    const sourceFieldsUsed: string[] = [];
    const sourceRecordIds: string[] = [];
    const sourceSnapshot: any = {};

    let deficiency: any = null;
    let regCase: any = null;
    let facility: any = null;
    let poc: any = null;
    let regKnowledge: any = null;

    let deficiency_id_resolved = deficiency_id;
    let regulatory_case_id_resolved = regulatory_case_id;

    // Retrieve POC if poc_id provided
    if (poc_id) {
      try {
        poc = await svc.entities.POC.get(poc_id);
        if (poc) {
          sourceRecordIds.push(poc.id);
          sourceSnapshot.poc = {
            id: poc.id,
            version: poc.version,
            status: poc.status,
            element_1_specific_correction: poc.element_1_specific_correction,
            element_2_others_potentially_affected: poc.element_2_others_potentially_affected,
            element_3_systemic_correction: poc.element_3_systemic_correction,
            element_4_monitoring: poc.element_4_monitoring,
            element_5_responsibility_qapi_completion: poc.element_5_responsibility_qapi_completion,
            education_plan: poc.education_plan,
            competency_plan: poc.competency_plan,
            evidence_requirements: poc.evidence_requirements,
          };
          sourceFieldsUsed.push('element_1_specific_correction', 'element_2_others_potentially_affected', 'element_3_systemic_correction', 'element_4_monitoring', 'element_5_responsibility_qapi_completion', 'education_plan', 'competency_plan', 'evidence_requirements');
          if (!deficiency_id_resolved && poc.deficiency_id) deficiency_id_resolved = poc.deficiency_id;
          if (!regulatory_case_id_resolved && poc.regulatory_case_id) regulatory_case_id_resolved = poc.regulatory_case_id;
        }
      } catch (e) { /* best-effort */ }
    }

    // Retrieve Deficiency
    if (deficiency_id_resolved) {
      try {
        deficiency = await svc.entities.Deficiency.get(deficiency_id_resolved);
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
            potentially_affected_population: deficiency.potentially_affected_population,
            systemic_correction: deficiency.systemic_correction,
            audit_monitoring: deficiency.audit_monitoring,
            education_training: deficiency.education_training,
            competency_validation: deficiency.competency_validation,
            responsible_leader: deficiency.responsible_leader,
            target_completion_date: deficiency.target_completion_date,
            qapi_oversight: deficiency.qapi_oversight,
            regulatory_mapping_verified: deficiency.regulatory_mapping_verified,
          };
          sourceFieldsUsed.push('survey_finding', 'factual_summary', 'immediate_correction', 'potentially_affected_population', 'systemic_correction', 'audit_monitoring', 'education_training', 'competency_validation', 'responsible_leader', 'target_completion_date', 'qapi_oversight');
          regulatory_case_id_resolved = regulatory_case_id_resolved || deficiency.regulatory_case_id;
        }
      } catch (e) { /* best-effort */ }
    }

    // Retrieve Regulatory Case
    if (regulatory_case_id_resolved) {
      try {
        regCase = await svc.entities.RegulatoryCase.get(regulatory_case_id_resolved);
        if (regCase) {
          sourceRecordIds.push(regCase.id);
          sourceSnapshot.regulatory_case = { id: regCase.id, case_name: regCase.case_name, case_status: regCase.case_status };
        }
      } catch (e) { /* best-effort */ }
    }

    // Retrieve Facility
    const facilityId = deficiency?.facility_id || regCase?.facility_id || poc?.facility_id;
    if (facilityId) {
      try {
        facility = await svc.entities.Facility.get(facilityId);
        if (facility) {
          sourceRecordIds.push(facility.id);
          sourceSnapshot.facility = { id: facility.id, facility_name: facility.facility_name };
        }
      } catch (e) { /* best-effort */ }
    }

    // Retrieve approved RegulatoryKnowledge if linked
    if (deficiency?.regulatory_knowledge_id) {
      try {
        regKnowledge = await svc.entities.RegulatoryKnowledge.get(deficiency.regulatory_knowledge_id);
        if (regKnowledge) {
          sourceRecordIds.push(regKnowledge.id);
          sourceSnapshot.regulatory_knowledge = {
            id: regKnowledge.id,
            f_tag: regKnowledge.f_tag,
            title: regKnowledge.title,
            approval_status: regKnowledge.approval_status,
          };
          // Only use as authoritative if Approved
          if (regKnowledge.approval_status === 'Approved') {
            sourceFieldsUsed.push('regulatory_knowledge.title', 'regulatory_knowledge.plain_language_regulatory_focus', 'regulatory_knowledge.possible_corrective_approaches');
          }
        }
      } catch (e) { /* best-effort */ }
    }

    // Determine test-data status from parent chain
    const isTestData = await resolveTestDataFromChain(svc, [
      { entity: 'Deficiency', id: deficiency_id_resolved },
      { entity: 'RegulatoryCase', id: regulatory_case_id_resolved },
      { entity: 'Facility', id: facilityId },
      { entity: 'Engagement', id: engagement_id },
      { entity: 'POC', id: poc_id },
    ]);

    // --- Construct the generation prompt SERVER-SIDE from structured data ---
    const mappingVerified = deficiency?.regulatory_mapping_verified === true;
    const regKnowledgeApproved = regKnowledge?.approval_status === 'Approved';

    const antiHallucinationRules = `CRITICAL RULES — VIOLATION REJECTS THE OUTPUT:
1. You may ONLY state a factual action as "completed", "implemented", "performed", "approved", "trained", "audited", "corrected", "submitted", "accepted", or "verified" when that information is EXPLICITLY present in the provided structured data.
2. If a structured field is empty, null, or missing, you MUST write "To be completed." for that section.
3. Do NOT fill gaps with plausible healthcare practices, industry standards, or inferred actions.
4. Do NOT invent: facility names, F-tags, residents, dates, scope/severity, enforcement actions, regulations, or survey language.
5. Do NOT assign a responsible leader (DON, Administrator, Infection Preventionist, etc.) if the field is blank.
6. Mark the entire document as DRAFT.
7. If the regulatory mapping is not verified, include: "REGULATORY MAPPING REQUIRES VERIFICATION"
8. Never state that education was completed, competencies were validated, audits were conducted, or evidence was accepted unless the structured data explicitly says so.`;

    // Build structured data context from retrieved records
    let structuredContext = '';
    if (poc) {
      structuredContext += `
--- POC VERSION ${poc.version} ---
Element 1 (Specific Correction): ${poc.element_1_specific_correction || '[BLANK]'}
Element 2 (Others Potentially Affected): ${poc.element_2_others_potentially_affected || '[BLANK]'}
Element 3 (Systemic Correction): ${poc.element_3_systemic_correction || '[BLANK]'}
Element 4 (Monitoring): ${poc.element_4_monitoring || '[BLANK]'}
Element 5 (Responsibility/QAPI/Completion): ${poc.element_5_responsibility_qapi_completion || '[BLANK]'}
Education Plan: ${poc.education_plan || '[BLANK]'}
Competency Plan: ${poc.competency_plan || '[BLANK]'}
Evidence Requirements: ${poc.evidence_requirements || '[BLANK]'}`;
    }
    if (deficiency) {
      structuredContext += `
--- DEFICIENCY ---
F-Tag: ${deficiency.f_tag || '[BLANK]'}
Title: ${deficiency.deficiency_title || '[BLANK]'}
Scope & Severity: ${deficiency.scope_severity || '[BLANK]'}
Immediate Jeopardy: ${deficiency.immediate_jeopardy || '[BLANK]'}
Survey Finding: ${deficiency.survey_finding || '[BLANK]'}
Factual Summary: ${deficiency.factual_summary || '[BLANK]'}
Immediate Correction: ${deficiency.immediate_correction || '[BLANK]'}
Potentially Affected Population: ${deficiency.potentially_affected_population || '[BLANK]'}
Systemic Correction: ${deficiency.systemic_correction || '[BLANK]'}
Audit/Monitoring: ${deficiency.audit_monitoring || '[BLANK]'}
Education/Training: ${deficiency.education_training || '[BLANK]'}
Competency Validation: ${deficiency.competency_validation || '[BLANK]'}
Responsible Leader: ${deficiency.responsible_leader || '[BLANK]'}
Target Completion: ${deficiency.target_completion_date || '[BLANK]'}
QAPI Oversight: ${deficiency.qapi_oversight || '[BLANK]'}`;
    }
    if (regCase) {
      structuredContext += `
--- REGULATORY CASE ---
Case Name: ${regCase.case_name || '[BLANK]'}
Case Status: ${regCase.case_status || '[BLANK]'}`;
    }
    if (facility) {
      structuredContext += `
--- FACILITY ---
Facility Name: ${facility.facility_name || '[BLANK]'}`;
    }

    const serverPrompt = `You are a long-term care regulatory consultant generating a professional work product.

${antiHallucinationRules}

Document Type: ${document_type}
Facility: ${facility?.facility_name || deficiency?.facility_name || '—'}
F-Tag: ${deficiency?.f_tag || poc?.f_tag || '—'}
Regulatory Mapping Verified: ${mappingVerified ? 'Yes' : 'No — REGULATORY MAPPING REQUIRES VERIFICATION'}
Regulatory Knowledge Approved: ${regKnowledgeApproved ? 'Yes' : 'No — unverified guidance cannot be used as authoritative'}

STRUCTURED SOURCE DATA (the ONLY authoritative factual source):
${structuredContext}

INSTRUCTIONS:
- Generate a formal ${document_type} using ONLY the structured data above.
- For any field marked [BLANK], write "To be completed." in the corresponding section.
- Do NOT supplement with inferred clinical interventions, industry best practices, or plausible actions.
- If regulatory mapping is not verified, include the warning: "REGULATORY MAPPING REQUIRES VERIFICATION"
- Mark the document as DRAFT.`;

    // --- Generate with hallucination enforcement ---
    const MAX_ATTEMPTS = 2;
    let attempt = 0;
    let content = '';
    let hallucinationDetected = false;
    let regenerationReason = '';

    while (attempt < MAX_ATTEMPTS) {
      attempt++;
      const promptWithAttempt = attempt === 1 ? serverPrompt : `${serverPrompt}

PREVIOUS ATTEMPT FAILED VALIDATION — unsupported factual content was detected.
STRICTER INSTRUCTIONS: You must ONLY use information explicitly present in the structured data above.
Every blank field MUST say "To be completed." — do NOT infer any action, intervention, or timeline.
Regenerate the document with strict adherence to source data only.`;

      const llmResult = await svc.integrations.Core.InvokeLLM({ prompt: promptWithAttempt });
      content = typeof llmResult === 'string' ? llmResult : (llmResult?.content || JSON.stringify(llmResult));

      // --- Post-generation validation ---
      hallucinationDetected = false;
      regenerationReason = '';

      // Identify which source fields are blank
      const blankFields: string[] = [];
      if (deficiency) {
        for (const f of ['immediate_correction', 'potentially_affected_population', 'systemic_correction', 'audit_monitoring', 'education_training', 'competency_validation', 'responsible_leader']) {
          if (!deficiency[f] || !String(deficiency[f]).trim()) blankFields.push(f);
        }
      }
      if (poc) {
        for (const f of ['element_1_specific_correction', 'element_2_others_potentially_affected', 'element_3_systemic_correction', 'element_4_monitoring', 'element_5_responsibility_qapi_completion']) {
          if (!poc[f] || !String(poc[f]).trim()) blankFields.push(f);
        }
      }

      // Check for invented completion language for blank fields
      const completionPatterns = [
        /\b(?:has been|was|were|is now)\s+(?:implemented|completed|performed|conducted|executed|trained|audited|corrected|approved|submitted|accepted|verified)\b/i,
        /\bstaff\s+(?:will|shall|must|are required to)\s+(?:conduct|perform|implement|complete|undergo|participate in)\b/i,
        /\bhourly rounding\b/i,
        /\bstaffing ratio.*adjusted\b/i,
        /\bcompetency.*(?:demonstrated|validated|confirmed)\b/i,
        /\beducation.*(?:completed|conducted|delivered)\b/i,
        /\baudit.*(?:completed|conducted|performed)\b/i,
      ];

      // If blank fields exist but content contains completion language, flag
      if (blankFields.length > 0) {
        const lowerContent = content.toLowerCase();
        for (const pattern of completionPatterns) {
          if (pattern.test(content)) {
            hallucinationDetected = true;
            regenerationReason = `Content contains completion language but source fields are blank: ${blankFields.join(', ')}`;
            break;
          }
        }
        // Check if "To be completed" appears for blank fields
        if (!hallucinationDetected) {
          const toBeCompletedCount = (content.match(/To be completed/gi) || []).length;
          if (toBeCompletedCount < blankFields.length) {
            hallucinationDetected = true;
            regenerationReason = `Expected ${blankFields.length} "To be completed" markers for blank fields but found ${toBeCompletedCount}`;
          }
        }
      }

      if (!hallucinationDetected) break;
      if (attempt < MAX_ATTEMPTS) {
        // Regenerate with stricter instructions
        continue;
      }
    }

    // If still hallucinated after max attempts, REJECT — do not save
    if (hallucinationDetected) {
      try {
        await svc.entities.AutomationLog.create({
          automation: 'Work Product Generation (REJECTED — Hallucination)',
          started: new Date().toISOString(),
          completed: new Date().toISOString(),
          status: 'Failed',
          records_processed: 0,
          affected_record_ids: [],
          triggered_by: user.full_name || user.email || 'system',
          errors: `WORK PRODUCT VALIDATION FAILED — UNSUPPORTED FACTUAL CONTENT DETECTED. Reason: ${regenerationReason}. Document NOT saved.`,
        });
      } catch (e) { /* best-effort */ }

      return Response.json({
        ok: false,
        error: 'WORK PRODUCT VALIDATION FAILED — UNSUPPORTED FACTUAL CONTENT DETECTED',
        reason: regenerationReason,
        saved: false,
        attempts: attempt,
      }, { status: 422 });
    }

    // --- Save the validated work product with full provenance ---
    const wp = await svc.entities.WorkProduct.create({
      document_type,
      facility_id: facility?.id || deficiency?.facility_id || null,
      facility_name: facility?.facility_name || deficiency?.facility_name || null,
      engagement_id: engagement_id || deficiency?.engagement_id || regCase?.engagement_id || null,
      regulatory_case_id: regulatory_case_id_resolved || deficiency?.regulatory_case_id || null,
      deficiency_id: deficiency_id_resolved || null,
      f_tag: deficiency?.f_tag || poc?.f_tag || null,
      poc_id: poc_id || (poc ? poc.id : null),
      generation_date: new Date().toISOString(),
      document_status: 'DRAFT',
      preparer: user.full_name || user.email || 'System',
      version: '1.0',
      content,
      source_snapshot: JSON.stringify(sourceSnapshot),
      source_fields_used: [...new Set(sourceFieldsUsed)],
      source_record_ids: [...new Set(sourceRecordIds)],
      is_test_data: isTestData,
    });

    // If POC narrative was generated, update the POC's generated_narrative field
    if (poc_id && poc) {
      try {
        await svc.entities.POC.update(poc_id, { generated_narrative: content });
      } catch (e) { /* best-effort */ }
    }

    // Log success
    try {
      await svc.entities.AutomationLog.create({
        automation: 'Work Product Generation',
        started: new Date().toISOString(),
        completed: new Date().toISOString(),
        status: 'Success',
        records_processed: 1,
        affected_record_ids: [wp.id],
        triggered_by: user.full_name || user.email || 'system',
        errors: null,
      });
    } catch (e) { /* best-effort */ }

    return Response.json({
      ok: true,
      work_product_id: wp.id,
      document_type,
      document_status: 'DRAFT',
      content,
      is_test_data: isTestData,
      poc_id: poc_id || (poc ? poc.id : null),
      source_record_ids: [...new Set(sourceRecordIds)],
      source_fields_used: [...new Set(sourceFieldsUsed)],
      hallucination_warning: false,
      validation_passed: true,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}