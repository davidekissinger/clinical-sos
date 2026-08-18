import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { resolveClientEntitlement, RESOURCE_CAPABILITY_MAP } from "../../shared/clientEntitlements.ts";
import {
  sanitizeEngagement, sanitizeCase, sanitizeDeficiency, sanitizePOC,
  sanitizeWorkProduct, sanitizeEvidence, sanitizeTask, sanitizeAudit,
  sanitizeReadinessCriterion, filterByTenantScope, filterClientVisible
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
      body = { resource: url.searchParams.get('resource') || 'dashboard' };
    }
    const resource = body.resource || 'dashboard';

    // Resolve resource-specific VIEW capability
    const requiredCap = RESOURCE_CAPABILITY_MAP[resource];
    const entitlement = await resolveClientEntitlement(base44, user, { resourceCapability: requiredCap });
    if (!entitlement.authorized) {
      return Response.json({ error: 'Access denied', reason: entitlement.reason, access_status: entitlement.access_status }, { status: 403 });
    }

    const facilityIds = entitlement.facility_ids || [];
    const engagementIds = entitlement.engagement_ids || [];
    const flt = (r) => Array.isArray(r) ? r : (r?.data || []);

    // ── Dashboard ──
    if (resource === 'dashboard') {
      const [engagements, cases, tasks, pocs, evidence] = await Promise.all([
        base44.asServiceRole.entities.Engagement.list("-created_date", 200),
        base44.asServiceRole.entities.RegulatoryCase.list("-created_date", 200),
        base44.asServiceRole.entities.Task.list("-due_date", 100),
        base44.asServiceRole.entities.POC.list("-created_date", 200),
        base44.asServiceRole.entities.EvidenceItem.list("-created_date", 200),
      ]);
      const scopedEngagements = flt(engagements).filter(e => engagementIds.includes(e.id) && e.client_visibility);
      const scopedCases = filterByTenantScope(filterClientVisible(flt(cases)), facilityIds, engagementIds);
      const scopedTasks = filterByTenantScope(filterClientVisible(flt(tasks)), facilityIds, engagementIds);
      const scopedPocs = filterByTenantScope(filterClientVisible(flt(pocs)), facilityIds, engagementIds).filter(p => !["AI Draft", "Clinical Review"].includes(p.status));
      const scopedEvidence = filterByTenantScope(filterClientVisible(flt(evidence)), facilityIds, engagementIds);

      return Response.json({
        summary: {
          active_engagements: scopedEngagements.filter(e => e.status === "Active").length,
          open_cases: scopedCases.filter(c => c.case_status !== "Closed").length,
          open_tasks: scopedTasks.filter(t => t.status !== "Complete").length,
          pocs_in_review: scopedPocs.filter(p => p.status === "Client Review").length,
          pending_evidence: scopedEvidence.filter(e => e.review_status === "Required" || e.review_status === "Requested").length,
        },
        engagements: scopedEngagements.map(sanitizeEngagement),
        capabilities: entitlement.effective_capabilities
      });
    }

    // ── List resources ──
    let rawRecords;
    switch (resource) {
      case 'engagements':
        rawRecords = await base44.asServiceRole.entities.Engagement.list("-created_date", 200);
        return Response.json(flt(rawRecords).filter(e => engagementIds.includes(e.id) && e.client_visibility).map(sanitizeEngagement));

      case 'cases':
        rawRecords = await base44.asServiceRole.entities.RegulatoryCase.list("-created_date", 200);
        return Response.json(filterByTenantScope(filterClientVisible(flt(rawRecords)), facilityIds, engagementIds).map(sanitizeCase));

      case 'deficiencies':
        rawRecords = await base44.asServiceRole.entities.Deficiency.list("-created_date", 200);
        return Response.json(filterByTenantScope(filterClientVisible(flt(rawRecords)), facilityIds, engagementIds).map(sanitizeDeficiency));

      case 'pocs':
        rawRecords = await base44.asServiceRole.entities.POC.list("-created_date", 200);
        return Response.json(filterByTenantScope(filterClientVisible(flt(rawRecords)), facilityIds, engagementIds).map(sanitizePOC).filter(Boolean));

      case 'work_products':
        rawRecords = await base44.asServiceRole.entities.WorkProduct.list("-created_date", 200);
        return Response.json(filterByTenantScope(filterClientVisible(flt(rawRecords)), facilityIds, engagementIds).map(sanitizeWorkProduct).filter(Boolean));

      case 'evidence':
        rawRecords = await base44.asServiceRole.entities.EvidenceItem.list("-created_date", 200);
        return Response.json(filterByTenantScope(filterClientVisible(flt(rawRecords)), facilityIds, engagementIds).map(sanitizeEvidence));

      case 'tasks':
        rawRecords = await base44.asServiceRole.entities.Task.list("-due_date", 100);
        return Response.json(filterByTenantScope(filterClientVisible(flt(rawRecords)), facilityIds, engagementIds).map(sanitizeTask));

      case 'audits':
        rawRecords = await base44.asServiceRole.entities.AuditTool.list("-created_date", 200);
        return Response.json(filterByTenantScope(filterClientVisible(flt(rawRecords)), facilityIds, engagementIds).map(sanitizeAudit));

      case 'readiness':
        rawRecords = await base44.asServiceRole.entities.RevisitReadinessCriterion.list("-created_date", 200);
        return Response.json(filterByTenantScope(filterClientVisible(flt(rawRecords)), facilityIds, engagementIds).map(sanitizeReadinessCriterion));

      case 'documents':
        rawRecords = await base44.asServiceRole.entities.WorkProduct.list("-created_date", 200);
        return Response.json(filterByTenantScope(filterClientVisible(flt(rawRecords)), facilityIds, engagementIds).map(sanitizeWorkProduct).filter(Boolean));

      default:
        return Response.json({ error: `Unknown resource: ${resource}` }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}