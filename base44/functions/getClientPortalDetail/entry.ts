import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { resolveClientEntitlement, RESOURCE_CAPABILITY_MAP } from "../../shared/clientEntitlements.ts";
import {
  sanitizeEngagement, sanitizeCase, sanitizeDeficiency, sanitizePOC,
  sanitizeWorkProduct, sanitizeEvidence, sanitizeTask, sanitizeAudit,
  sanitizeReadinessCriterion, filterByEngagement, filterClientVisible
} from "../../shared/clientDtos.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'client') return Response.json({ error: 'Forbidden — client role required' }, { status: 403 });

    // Accept JSON body (preferred) or URL query params (compatibility)
    let body = {};
    try { body = await req.json(); } catch (e) {
      const url = new URL(req.url);
      body = { resource: url.searchParams.get('resource'), id: url.searchParams.get('id') };
    }
    const { resource, id } = body;
    if (!resource || !id) return Response.json({ error: 'resource and id are required' }, { status: 400 });

    // Resolve resource-specific VIEW capability
    const requiredCap = RESOURCE_CAPABILITY_MAP[resource];
    const entitlement = await resolveClientEntitlement(base44, user, { resourceCapability: requiredCap });
    if (!entitlement.authorized) {
      return Response.json({ error: 'Access denied', reason: entitlement.reason, access_status: entitlement.access_status }, { status: 403 });
    }

    const facilityIds = entitlement.facility_ids || [];
    const engagementIds = entitlement.engagement_ids || [];
    const caps = entitlement.effective_capabilities || {};
    const flt = (r) => Array.isArray(r) ? r : (r?.data || []);

    // ── Engagement Detail (capability-aware bundled response) ──
    if (resource === 'engagement') {
      if (!engagementIds.includes(id)) {
        return Response.json({ error: 'Access denied — engagement not in authorized scope' }, { status: 403 });
      }
      const engagement = await base44.asServiceRole.entities.Engagement.get(id);
      if (!engagement || !engagement.client_visibility) {
        return Response.json({ error: 'Engagement not found or not published' }, { status: 404 });
      }

      // Build response with independent capability gating for each child resource
      const response = { engagement: sanitizeEngagement(engagement) };

      // Cases & Deficiencies: governed by can_view_engagement (already verified above)
      const caseRes = await base44.asServiceRole.entities.RegulatoryCase.list("-created_date", 200);
      response.cases = filterByEngagement(filterClientVisible(flt(caseRes)), id).map(sanitizeCase);

      const defRes = await base44.asServiceRole.entities.Deficiency.list("-created_date", 200);
      response.deficiencies = filterByEngagement(filterClientVisible(flt(defRes)), id).map(sanitizeDeficiency);

      // POCs: ONLY if can_view_poc
      if (caps.can_view_poc) {
        const pocRes = await base44.asServiceRole.entities.POC.list("-created_date", 200);
        response.pocs = filterByEngagement(filterClientVisible(flt(pocRes)), id)
          .filter(p => !["AI Draft", "Clinical Review"].includes(p.status))
          .map(sanitizePOC).filter(Boolean);
      } else {
        response.pocs = [];
      }

      // Work Products: ONLY if can_view_documents
      if (caps.can_view_documents) {
        const wpRes = await base44.asServiceRole.entities.WorkProduct.list("-created_date", 200);
        response.work_products = filterByEngagement(filterClientVisible(flt(wpRes)), id)
          .filter(w => !["DRAFT", "CLINICAL REVIEW"].includes(w.document_status))
          .map(sanitizeWorkProduct).filter(Boolean);
      } else {
        response.work_products = [];
      }

      // Evidence: ONLY if can_view_evidence
      if (caps.can_view_evidence) {
        const evidenceRes = await base44.asServiceRole.entities.EvidenceItem.list("-created_date", 200);
        response.evidence = filterByEngagement(filterClientVisible(flt(evidenceRes)), id).map(sanitizeEvidence);
      } else {
        response.evidence = [];
      }

      // Tasks: ONLY if can_view_tasks
      if (caps.can_view_tasks) {
        const taskRes = await base44.asServiceRole.entities.Task.list("-due_date", 100);
        response.tasks = filterByEngagement(filterClientVisible(flt(taskRes)), id).map(sanitizeTask);
      } else {
        response.tasks = [];
      }

      // Audits: ONLY if can_view_audits
      if (caps.can_view_audits) {
        const auditRes = await base44.asServiceRole.entities.AuditTool.list("-created_date", 200);
        response.audits = filterByEngagement(filterClientVisible(flt(auditRes)), id).map(sanitizeAudit);
      } else {
        response.audits = [];
      }

      // Readiness: governed by can_view_engagement for V1
      const readinessRes = await base44.asServiceRole.entities.RevisitReadinessCriterion.list("-created_date", 200);
      response.readiness = filterByEngagement(filterClientVisible(flt(readinessRes)), id).map(sanitizeReadinessCriterion);

      return Response.json(response);
    }

    // ── Case Detail (engagement-first) ──
    if (resource === 'case') {
      const regCase = await base44.asServiceRole.entities.RegulatoryCase.get(id);
      if (!regCase || !regCase.client_visibility) {
        return Response.json({ error: 'Case not found or not published' }, { status: 404 });
      }
      // Engagement-first: if case has engagement_id, require engagement match
      if (regCase.engagement_id) {
        if (!engagementIds.includes(regCase.engagement_id)) {
          return Response.json({ error: 'Access denied — case engagement not in authorized scope' }, { status: 403 });
        }
      } else if (regCase.facility_id) {
        // Facility fallback only if no engagement relationship
        if (!facilityIds.includes(regCase.facility_id)) {
          return Response.json({ error: 'Access denied — case not in authorized scope' }, { status: 403 });
        }
      } else {
        return Response.json({ error: 'Access denied — case has no tenant relationship' }, { status: 403 });
      }

      // Only return deficiencies — no POCs, evidence, documents, audits, or tasks leaked through case detail
      const defRes = await base44.asServiceRole.entities.Deficiency.list("-created_date", 200);
      const scopedDeficiencies = filterByEngagement(filterClientVisible(flt(defRes)), regCase.engagement_id)
        .filter(d => d.regulatory_case_id === id);

      return Response.json({
        case: sanitizeCase(regCase),
        deficiencies: scopedDeficiencies.map(sanitizeDeficiency),
      });
    }

    // ── Deficiency Detail (engagement-first, POC capability-gated) ──
    if (resource === 'deficiency') {
      const deficiency = await base44.asServiceRole.entities.Deficiency.get(id);
      if (!deficiency || !deficiency.client_visibility) {
        return Response.json({ error: 'Deficiency not found or not published' }, { status: 404 });
      }
      // Engagement-first: if deficiency has engagement_id, require engagement match
      if (deficiency.engagement_id) {
        if (!engagementIds.includes(deficiency.engagement_id)) {
          return Response.json({ error: 'Access denied — deficiency engagement not in authorized scope' }, { status: 403 });
        }
      } else if (deficiency.facility_id) {
        // Facility fallback only if no engagement relationship
        if (!facilityIds.includes(deficiency.facility_id)) {
          return Response.json({ error: 'Access denied — deficiency not in authorized scope' }, { status: 403 });
        }
      } else {
        return Response.json({ error: 'Access denied — deficiency has no tenant relationship' }, { status: 403 });
      }

      // POCs: ONLY if can_view_poc — do NOT reject the deficiency view if POC capability is absent
      let pocs = [];
      if (caps.can_view_poc) {
        const pocRes = await base44.asServiceRole.entities.POC.list("-created_date", 200);
        pocs = filterClientVisible(flt(pocRes))
          .filter(p => p.deficiency_id === id && !["AI Draft", "Clinical Review"].includes(p.status))
          .map(sanitizePOC).filter(Boolean);
      }

      return Response.json({
        deficiency: sanitizeDeficiency(deficiency),
        pocs: pocs,
      });
    }

    return Response.json({ error: `Unknown resource: ${resource}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}