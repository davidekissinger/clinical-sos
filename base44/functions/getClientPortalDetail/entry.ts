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
    const flt = (r) => Array.isArray(r) ? r : (r?.data || []);

    // ── Engagement Detail ──
    if (resource === 'engagement') {
      if (!engagementIds.includes(id)) {
        return Response.json({ error: 'Access denied — engagement not in authorized scope' }, { status: 403 });
      }
      const engagement = await base44.asServiceRole.entities.Engagement.get(id);
      if (!engagement || !engagement.client_visibility) {
        return Response.json({ error: 'Engagement not found or not published' }, { status: 404 });
      }

      const [cases, deficiencies, pocs, workProducts, evidence, tasks, audits, readiness] = await Promise.all([
        base44.asServiceRole.entities.RegulatoryCase.list("-created_date", 200),
        base44.asServiceRole.entities.Deficiency.list("-created_date", 200),
        base44.asServiceRole.entities.POC.list("-created_date", 200),
        base44.asServiceRole.entities.WorkProduct.list("-created_date", 200),
        base44.asServiceRole.entities.EvidenceItem.list("-created_date", 200),
        base44.asServiceRole.entities.Task.list("-due_date", 100),
        base44.asServiceRole.entities.AuditTool.list("-created_date", 200),
        base44.asServiceRole.entities.RevisitReadinessCriterion.list("-created_date", 200),
      ]);

      const scopedCases = filterByEngagement(filterClientVisible(flt(cases)), id);
      const scopedDeficiencies = filterByEngagement(filterClientVisible(flt(deficiencies)), id);
      const scopedPocs = filterByEngagement(filterClientVisible(flt(pocs)), id).filter(p => !["AI Draft", "Clinical Review"].includes(p.status));
      const scopedWorkProducts = filterByEngagement(filterClientVisible(flt(workProducts)), id).filter(w => !["DRAFT", "CLINICAL REVIEW"].includes(w.document_status));
      const scopedEvidence = filterByEngagement(filterClientVisible(flt(evidence)), id);
      const scopedTasks = filterByEngagement(filterClientVisible(flt(tasks)), id);
      const scopedAudits = filterByEngagement(filterClientVisible(flt(audits)), id);
      const scopedReadiness = filterByEngagement(filterClientVisible(flt(readiness)), id);

      return Response.json({
        engagement: sanitizeEngagement(engagement),
        cases: scopedCases.map(sanitizeCase),
        deficiencies: scopedDeficiencies.map(sanitizeDeficiency),
        pocs: scopedPocs.map(sanitizePOC).filter(Boolean),
        work_products: scopedWorkProducts.map(sanitizeWorkProduct).filter(Boolean),
        evidence: scopedEvidence.map(sanitizeEvidence),
        tasks: scopedTasks.map(sanitizeTask),
        audits: scopedAudits.map(sanitizeAudit),
        readiness: scopedReadiness.map(sanitizeReadinessCriterion),
      });
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

      const defRes = await base44.asServiceRole.entities.Deficiency.list("-created_date", 200);
      const scopedDeficiencies = filterByEngagement(filterClientVisible(flt(defRes)), regCase.engagement_id)
        .filter(d => d.regulatory_case_id === id);

      return Response.json({
        case: sanitizeCase(regCase),
        deficiencies: scopedDeficiencies.map(sanitizeDeficiency),
      });
    }

    // ── Deficiency Detail (engagement-first) ──
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

      const pocRes = await base44.asServiceRole.entities.POC.list("-created_date", 200);
      const scopedPocs = filterClientVisible(flt(pocRes))
        .filter(p => p.deficiency_id === id && !["AI Draft", "Clinical Review"].includes(p.status));

      return Response.json({
        deficiency: sanitizeDeficiency(deficiency),
        pocs: scopedPocs.map(sanitizePOC).filter(Boolean),
      });
    }

    return Response.json({ error: `Unknown resource: ${resource}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}