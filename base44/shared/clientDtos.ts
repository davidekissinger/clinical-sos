// Client-safe DTO field allowlists and sanitization functions.
// Each function returns ONLY approved fields — never the full entity object.
// "return ONLY these approved fields" — not "return everything except these internal fields".

import { POC_INTERNAL_STATUSES, WORKPRODUCT_INTERNAL_STATUSES } from "./clientEntitlements.ts";

// ── Field Allowlists (tightened — minimum necessary client data) ──

const ENGAGEMENT_FIELDS = [
  "id", "engagement_name", "service_type", "phase", "status",
  "start_date", "estimated_end_date", "deliverables", "milestones"
];

const CASE_FIELDS = [
  "id", "case_name", "facility_name", "engagement_id", "engagement_name",
  "survey_event_type", "survey_date", "cms_2567_date", "state_agency",
  "revisit_date", "current_regulatory_status", "case_status",
  "ij_status", "cmp_status", "dpna_status", "sff_status",
  "total_deficiencies", "high_priority_deficiencies"
];

const DEFICIENCY_FIELDS = [
  "id", "regulatory_case_id", "engagement_id", "facility_name",
  "f_tag", "regulation_reference", "deficiency_title",
  "scope_severity", "scope_severity_letter", "harm_level",
  "scope_level", "immediate_jeopardy", "survey_finding",
  "deficiency_date", "deficiency_status", "revisit_readiness_status",
  "revisit_readiness_score"
];

const POC_FIELDS = [
  "id", "deficiency_id", "engagement_id", "facility_name",
  "f_tag", "version",
  "element_1_specific_correction", "element_2_others_potentially_affected",
  "element_3_systemic_correction", "element_4_monitoring",
  "element_5_responsibility_qapi_completion",
  "generated_narrative", "status", "client_review_status",
  "client_reviewed_by", "client_reviewed_date", "client_review_comment"
];

const WORKPRODUCT_FIELDS = [
  "id", "document_type", "document_status", "facility_name",
  "engagement_name", "f_tag", "version", "generation_date"
];

const EVIDENCE_FIELDS = [
  "id", "deficiency_id", "deficiency_name", "facility_name",
  "engagement_id", "evidence_type", "description", "date",
  "review_status", "client_response_status",
  "client_response_note", "client_responded_by", "client_response_date"
];

const TASK_FIELDS = [
  "id", "task", "workstream", "start_date",
  "due_date", "status",
  "linked_engagement_id", "client_completion_note",
  "client_completed_by", "client_completed_date"
];

const AUDIT_FIELDS = [
  "id", "facility_name", "engagement_id",
  "f_tag", "plain_language_regulatory_focus",
  "audit_date", "auditor", "audit_result",
  "what_was_corrected", "review_date"
];

const READINESS_FIELDS = [
  "id", "deficiency_id", "facility_name", "engagement_id",
  "criterion_label", "criterion_key", "is_met", "met_date",
  "evidence_summary", "blocks_readiness"
];

const FACILITY_DISPLAY_FIELDS = ["id", "facility_name", "city", "state"];

// ── Sanitization Functions ─────────────────────────────────────

function pick(record, fields) {
  if (!record) return null;
  const dto = {};
  for (const f of fields) {
    if (record[f] !== undefined) dto[f] = record[f];
  }
  return dto;
}

export function sanitizeEngagement(record) { return pick(record, ENGAGEMENT_FIELDS); }
export function sanitizeCase(record) { return pick(record, CASE_FIELDS); }
export function sanitizeDeficiency(record) { return pick(record, DEFICIENCY_FIELDS); }

export function sanitizePOC(record) {
  if (!record) return null;
  if (POC_INTERNAL_STATUSES.includes(record.status)) return null;
  return pick(record, POC_FIELDS);
}

export function sanitizeWorkProduct(record) {
  if (!record) return null;
  if (WORKPRODUCT_INTERNAL_STATUSES.includes(record.document_status)) return null;
  return pick(record, WORKPRODUCT_FIELDS);
}

export function sanitizeEvidence(record) { return pick(record, EVIDENCE_FIELDS); }
export function sanitizeTask(record) { return pick(record, TASK_FIELDS); }
export function sanitizeAudit(record) { return pick(record, AUDIT_FIELDS); }
export function sanitizeReadinessCriterion(record) { return pick(record, READINESS_FIELDS); }
export function sanitizeFacilityDisplay(record) { return pick(record, FACILITY_DISPLAY_FIELDS); }

// ── Tenant Filtering Helpers (engagement-first) ────────────────

/**
 * Filter records to only those within the client's authorized tenant scope.
 * ENGAGEMENT TAKES PRECEDENCE: if a record has an engagement_id, it must match.
 * Facility fallback is used ONLY for records with no engagement relationship.
 */
export function filterByTenantScope(records, facilityIds, engagementIds) {
  return (records || []).filter(r => {
    // If record has engagement_id, require engagement match (no facility fallback)
    if (r.engagement_id) return engagementIds.includes(r.engagement_id);
    if (r.linked_engagement_id) return engagementIds.includes(r.linked_engagement_id);
    // Only use facility fallback if no engagement relationship exists
    if (r.facility_id) return facilityIds.includes(r.facility_id);
    return false;
  });
}

/**
 * Filter records to only those belonging to a specific engagement.
 */
export function filterByEngagement(records, engagementId) {
  return (records || []).filter(r => {
    if (r.engagement_id === engagementId) return true;
    if (r.linked_engagement_id === engagementId) return true;
    return false;
  });
}

/**
 * Filter records to only client-visible ones.
 */
export function filterClientVisible(records) {
  return (records || []).filter(r => r.client_visibility === true);
}