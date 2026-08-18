// Client-safe DTO field allowlists and sanitization functions.
// Each function returns ONLY approved fields — never the full entity object.
// "return ONLY these approved fields" — not "return everything except these internal fields".

import { POC_INTERNAL_STATUSES, WORKPRODUCT_INTERNAL_STATUSES } from "./clientEntitlements.ts";

// ── Field Allowlists ──────────────────────────────────────────

const ENGAGEMENT_FIELDS = [
  "id", "engagement_name", "service_type", "phase", "status",
  "start_date", "estimated_end_date", "client_name", "deliverables",
  "milestones", "client_visibility"
];

const CASE_FIELDS = [
  "id", "case_name", "facility_name", "engagement_id", "engagement_name",
  "survey_event_type", "survey_date", "cms_2567_date", "state_agency",
  "revisit_date", "current_regulatory_status", "case_status",
  "ij_status", "cmp_status", "dpna_status", "sff_status",
  "total_deficiencies", "high_priority_deficiencies", "client_visibility"
];

const DEFICIENCY_FIELDS = [
  "id", "regulatory_case_id", "engagement_id", "facility_name",
  "f_tag", "regulation_reference", "deficiency_title",
  "scope_severity", "scope_severity_letter", "harm_level",
  "scope_level", "immediate_jeopardy", "survey_finding",
  "deficiency_date", "deficiency_status", "revisit_readiness_status",
  "revisit_readiness_score", "revisit_readiness_explanation",
  "immediate_correction", "systemic_correction", "education_training",
  "competency_validation", "audit_monitoring", "evidence_needed",
  "responsible_leader", "target_completion_date", "qapi_oversight",
  "client_visibility"
];

const POC_FIELDS = [
  "id", "deficiency_id", "engagement_id", "facility_name",
  "f_tag", "version",
  "element_1_specific_correction", "element_2_others_potentially_affected",
  "element_3_systemic_correction", "element_4_monitoring",
  "element_5_responsibility_qapi_completion",
  "education_plan", "competency_plan", "evidence_requirements",
  "generated_narrative", "status", "client_review_status",
  "client_reviewed_by", "client_reviewed_date", "client_review_comment",
  "submitted_date", "accepted_date", "revision_requested_date",
  "client_visibility"
];

const WORKPRODUCT_FIELDS = [
  "id", "document_type", "document_status", "facility_name",
  "engagement_name", "regulatory_case_name", "deficiency_name",
  "f_tag", "version", "generation_date", "content", "client_visibility"
];

const EVIDENCE_FIELDS = [
  "id", "deficiency_id", "deficiency_name", "facility_name",
  "engagement_id", "evidence_type", "description", "date",
  "responsible_person", "review_status", "client_response_status",
  "client_response_note", "client_responded_by", "client_response_date",
  "client_visibility"
];

const TASK_FIELDS = [
  "id", "task", "workstream", "owner_name", "start_date",
  "due_date", "priority", "status", "notes",
  "linked_engagement_id", "client_completion_note",
  "client_completed_by", "client_completed_date", "client_visibility"
];

const AUDIT_FIELDS = [
  "id", "facility_name", "engagement_id", "regulatory_case_name",
  "deficiency_name", "f_tag", "plain_language_regulatory_focus",
  "specific_deficiency_focus", "corrective_action_focus",
  "audit_date", "auditor", "unit_hall", "resident_record_area_reviewed",
  "shift", "meal", "med_pass", "follow_up_due_date",
  "training_topic", "training_date", "departments_staff_taught",
  "educator", "competency_required", "competency_completed",
  "monitoring_sample_size", "monitoring_frequency", "monitoring_duration",
  "monitoring_responsible_person", "monitoring_reporting_route",
  "audit_result", "what_was_corrected", "what_remains_unresolved",
  "responsible_person", "don_qapi_review", "review_date", "client_visibility"
];

const READINESS_FIELDS = [
  "id", "deficiency_id", "facility_name", "engagement_id",
  "criterion_label", "criterion_key", "is_met", "met_date",
  "evidence_summary", "blocks_readiness", "notes", "client_visibility"
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

export function sanitizeEngagement(record) {
  return pick(record, ENGAGEMENT_FIELDS);
}

export function sanitizeCase(record) {
  return pick(record, CASE_FIELDS);
}

export function sanitizeDeficiency(record) {
  return pick(record, DEFICIENCY_FIELDS);
}

export function sanitizePOC(record) {
  if (!record) return null;
  // Never expose internal POC statuses
  if (POC_INTERNAL_STATUSES.includes(record.status)) return null;
  return pick(record, POC_FIELDS);
}

export function sanitizeWorkProduct(record) {
  if (!record) return null;
  if (WORKPRODUCT_INTERNAL_STATUSES.includes(record.document_status)) return null;
  return pick(record, WORKPRODUCT_FIELDS);
}

export function sanitizeEvidence(record) {
  return pick(record, EVIDENCE_FIELDS);
}

export function sanitizeTask(record) {
  return pick(record, TASK_FIELDS);
}

export function sanitizeAudit(record) {
  return pick(record, AUDIT_FIELDS);
}

export function sanitizeReadinessCriterion(record) {
  return pick(record, READINESS_FIELDS);
}

export function sanitizeFacilityDisplay(record) {
  return pick(record, FACILITY_DISPLAY_FIELDS);
}

// ── Tenant Filtering Helpers ───────────────────────────────────

/**
 * Filter records to only those within the client's authorized tenant scope.
 * Uses facility_id OR engagement_id matching.
 */
export function filterByTenantScope(records, facilityIds, engagementIds) {
  return (records || []).filter(r => {
    if (r.engagement_id && engagementIds.includes(r.engagement_id)) return true;
    if (r.facility_id && facilityIds.includes(r.facility_id)) return true;
    if (r.linked_engagement_id && engagementIds.includes(r.linked_engagement_id)) return true;
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