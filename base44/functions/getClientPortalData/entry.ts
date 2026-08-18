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
    const caps = entitlement.effective_capabilities || {};
    const flt = (r) => Array.isArray(r) ? r : (r?.data || []);

    // ── Dashboard (capability-aware — does not disclose unauthorized counts) ──
    if (resource === 'dashboard') {
      const summary = {};

      // Only query and return engagement data if can_view_engagement
      let engagements = [];
      if (caps.can_view_engagement) {
        const engRes = await base44.asServiceRole.entities.Engagement.list("-created_date", 200);
        engagements = flt(engRes).filter(e => engagementIds.includes(e.id) && e.client_visibility);
        summary.active_engagements = engagements.filter(e => e.status === "Active").length;
      }

      // Cases are tied to can_view_engagement
      if (caps.can_view_engagement) {
        const caseRes = await base44.asServiceRole.entities.RegulatoryCase.list("-created_date", 200);
        const scopedCases = filterByTenantScope(filterClientVisible(flt(caseRes)), facilityIds, engagementIds);
        summary.open_cases = scopedCases.filter(c => c.case_status !== "Closed").length;
      }

      // Tasks — only if can_view_tasks
      if (caps.can_view_tasks) {
        const taskRes = await base44.asServiceRole.entities.Task.list("-due_date", 100);
        const scopedTasks = filterByTenantScope(filterClientVisible(flt(taskRes)), facilityIds, engagementIds);
        summary.open_tasks = scopedTasks.filter(t => t.status !== "Complete").length;
      }

      // POCs — only if can_view_poc
      if (caps.can_view_poc) {
        const pocRes = await base44.asServiceRole.entities.POC.list("-created_date", 200);
        const scopedPocs = filterByTenantScope(filterClientVisible(flt(pocRes)), facilityIds, engagementIds).filter(p => !["AI Draft", "Clinical Review"].includes(p.status));
        summary.pocs_in_review = scopedPocs.filter(p => p.status === "Client Review").length;
      }

      // Evidence — only if can_view_evidence
      if (caps.can_view_evidence) {
        const evidenceRes = await base44.asServiceRole.entities.EvidenceItem.list("-created_date", 200);
        const scopedEvidence = filterByTenantScope(filterClientVisible(flt(evidenceRes)), facilityIds, engagementIds);
        summary.pending_evidence = scopedEvidence.filter(e => e.review_status === "Required" || e.review_status === "Requested").length;
      }

      return Response.json({
        summary,
        engagements: caps.can_view_engagement ? engagements.map(sanitizeEngagement) : [],
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