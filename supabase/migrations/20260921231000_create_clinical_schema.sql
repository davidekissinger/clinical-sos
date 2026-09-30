begin;

-- Clinical and regulatory records retain Base44-compatible text identifiers and
-- metadata names. Dates arriving from the legacy UI must be normalized from an
-- empty string to null by the data adapter before writes reach Postgres.
create schema if not exists private;
revoke all on schema private from public;

create or replace function private.set_base44_updated_date()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_date := now();
  return new;
end;
$function$;

revoke all on function private.set_base44_updated_date()
  from public, anon, authenticated;

create table public.regulatory_knowledge (
  id text primary key default gen_random_uuid()::text,
  f_tag text not null,
  title text not null,
  regulation_reference text,
  cms_appendix_pp_reference text,
  plain_language_regulatory_focus text,
  common_deficiency_patterns text,
  possible_root_cause_categories text[],
  possible_corrective_approaches text,
  possible_education_topics text,
  possible_audit_items text,
  possible_evidence text,
  possible_monitoring_approaches text,
  source text,
  source_url text,
  source_date date,
  last_verified_date timestamptz,
  last_reviewed timestamptz,
  clinical_sos_reviewer text,
  approval_status text not null default 'Verification Required',
  version text,
  description text,
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint regulatory_knowledge_approval_status_check check (
    approval_status in (
      'Draft',
      'Verification Required',
      'Clinical Review',
      'Approved',
      'Retired'
    )
  ),
  constraint regulatory_knowledge_description_length_check check (
    description is null or char_length(description) <= 1000
  )
);

create table public.regulatory_signals (
  id text primary key default gen_random_uuid()::text,
  facility_id text references public.facilities (id) on delete restrict,
  facility_name text not null,
  ccn text,
  signal_type text not null,
  severity text,
  event_date date,
  source text,
  source_url text,
  date_retrieved timestamptz,
  factual_evidence_summary text,
  enforcement_amount numeric(14, 2),
  deficiency_tag text,
  status text,
  confidence_score smallint,
  verified boolean not null default false,
  verification_method text,
  stale_data_flag boolean not null default false,
  reviewer text,
  reviewer_id text,
  is_test_data boolean not null default false,
  cmp_type text not null default 'Unknown',
  verified_daily_rate numeric(14, 2),
  dpna_present text not null default 'Unknown',
  dpna_effective_date date,
  ij_start_date date,
  ij_removal_date date,
  sff_status text not null default 'Unknown',
  scope_severity text,
  survey_date date,
  revisit_date date,
  revisit_status text,
  substantial_compliance_status text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint regulatory_signals_signal_type_check check (
    signal_type in (
      'Immediate Jeopardy',
      'CMP',
      'DPNA',
      'Special Focus Facility',
      'SFF Candidate',
      'Repeat Deficiency',
      'Infection-Control Deficiency',
      'Low Health Inspection Rating',
      'Follow-Up Survey',
      'Ownership Change',
      'Leadership/Operational Signal',
      'Other Regulatory Signal'
    )
  ),
  constraint regulatory_signals_severity_check check (
    severity is null or severity in ('High', 'Medium', 'Low')
  ),
  constraint regulatory_signals_status_check check (
    status is null or status in ('Current', 'Resolved', 'Unknown')
  ),
  constraint regulatory_signals_confidence_score_check check (
    confidence_score is null or confidence_score between 0 and 100
  ),
  constraint regulatory_signals_cmp_type_check check (
    cmp_type in ('Per Day', 'Per Instance', 'Other', 'Unknown')
  ),
  constraint regulatory_signals_dpna_present_check check (
    dpna_present in ('Yes', 'No', 'Unknown')
  ),
  constraint regulatory_signals_sff_status_check check (
    sff_status in ('Not SFF', 'SFF Candidate', 'Active SFF', 'Unknown')
  )
);

create table public.regulatory_cases (
  id text primary key default gen_random_uuid()::text,
  client_account_id text references public.client_accounts (id) on delete restrict,
  case_name text not null,
  client_name text,
  facility_id text references public.facilities (id) on delete restrict,
  facility_name text,
  organization_id text references public.organizations (id) on delete restrict,
  organization_name text,
  engagement_id text references public.engagements (id) on delete restrict,
  engagement_name text,
  survey_event_type text,
  survey_date date,
  cms_2567_date date,
  state_agency text,
  revisit_date date,
  current_regulatory_status text,
  scope_severity_overview text,
  ij_status text not null default 'Unknown',
  cmp_status text not null default 'Unknown',
  dpna_status text not null default 'Unknown',
  sff_status text not null default 'Unknown',
  total_deficiencies integer,
  high_priority_deficiencies integer,
  case_status text not null default 'Intake',
  case_owner_id text,
  case_owner_name text,
  clinical_lead_id text,
  clinical_lead_name text,
  regulatory_urgency text not null default 'Unknown / Research Required',
  regulatory_urgency_score smallint,
  commercial_opportunity_score smallint,
  clinical_sos_priority_score smallint,
  score_explanation text,
  source_documents text[],
  notes text,
  last_reviewed timestamptz,
  clinical_approval_status text not null default 'Draft',
  client_visibility boolean not null default false,
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint regulatory_cases_ij_status_check check (
    ij_status in ('Yes', 'No', 'Unknown')
  ),
  constraint regulatory_cases_cmp_status_check check (
    cmp_status in ('Yes', 'No', 'Unknown')
  ),
  constraint regulatory_cases_dpna_status_check check (
    dpna_status in ('Yes', 'No', 'Unknown')
  ),
  constraint regulatory_cases_sff_status_check check (
    sff_status in ('Not SFF', 'SFF Candidate', 'Active SFF', 'Unknown')
  ),
  constraint regulatory_cases_total_deficiencies_check check (
    total_deficiencies is null or total_deficiencies >= 0
  ),
  constraint regulatory_cases_high_priority_deficiencies_check check (
    high_priority_deficiencies is null or high_priority_deficiencies >= 0
  ),
  constraint regulatory_cases_case_status_check check (
    case_status in (
      'Intake',
      'Source Documents Pending',
      'Initial Review',
      'Deficiencies Extracted',
      'Clinical Analysis',
      'Corrective Strategy',
      'POC Development',
      'Implementation',
      'Monitoring',
      'Revisit Preparation',
      'Revisit Pending',
      'Substantial Compliance Pending',
      'Closed',
      'On Hold'
    )
  ),
  constraint regulatory_cases_regulatory_urgency_check check (
    regulatory_urgency in (
      'Critical',
      'Severe',
      'High',
      'Moderate',
      'Proactive',
      'Unknown / Research Required'
    )
  ),
  constraint regulatory_cases_regulatory_urgency_score_check check (
    regulatory_urgency_score is null or regulatory_urgency_score between 0 and 100
  ),
  constraint regulatory_cases_commercial_opportunity_score_check check (
    commercial_opportunity_score is null or commercial_opportunity_score between 0 and 100
  ),
  constraint regulatory_cases_clinical_sos_priority_score_check check (
    clinical_sos_priority_score is null or clinical_sos_priority_score between 0 and 100
  ),
  constraint regulatory_cases_clinical_approval_status_check check (
    clinical_approval_status in ('Draft', 'Clinical Review', 'Approved')
  )
);

create table public.deficiencies (
  id text primary key default gen_random_uuid()::text,
  client_account_id text references public.client_accounts (id) on delete restrict,
  regulatory_case_id text not null references public.regulatory_cases (id) on delete restrict,
  regulatory_case_name text,
  engagement_id text references public.engagements (id) on delete restrict,
  engagement_name text,
  facility_id text references public.facilities (id) on delete restrict,
  facility_name text,
  f_tag text not null,
  regulation_reference text,
  regulatory_knowledge_id text references public.regulatory_knowledge (id) on delete restrict,
  regulatory_mapping_verified boolean not null default false,
  deficiency_title text,
  scope_severity text,
  scope_severity_letter text,
  harm_level text,
  scope_level text,
  immediate_jeopardy text not null default 'Unknown',
  source_cms_2567 text,
  page_reference text,
  survey_finding text,
  factual_summary text,
  affected_residents_deidentified text,
  deficiency_date date,
  regulatory_focus text,
  clinical_significance text,
  immediate_safety_concern boolean not null default false,
  likely_contributing_factors text,
  root_cause_categories text[],
  systemic_issue boolean not null default false,
  policy_process_issue boolean not null default false,
  staffing_issue boolean not null default false,
  competency_issue boolean not null default false,
  documentation_issue boolean not null default false,
  oversight_accountability_issue boolean not null default false,
  other_relevant_factor text,
  immediate_correction text,
  potentially_affected_population text,
  systemic_correction text,
  education_training text,
  competency_validation text,
  audit_monitoring text,
  evidence_needed text,
  responsible_leader text,
  target_completion_date date,
  qapi_oversight text,
  revisit_readiness_status text not null default 'Not Assessed',
  revisit_readiness_score smallint,
  revisit_readiness_explanation text,
  deficiency_status text not null default 'Draft',
  closure_override boolean not null default false,
  closure_override_reason text,
  closure_override_by text,
  closure_override_date timestamptz,
  priority_ranking numeric,
  priority_explanation text,
  client_visibility boolean not null default false,
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint deficiencies_scope_severity_letter_check check (
    scope_severity_letter is null
    or scope_severity_letter in (
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'Unknown', ''
    )
  ),
  constraint deficiencies_harm_level_check check (
    harm_level is null
    or harm_level in (
      'No actual harm with potential for minimal harm',
      'Minimal harm',
      'No actual harm with potential for more than minimal harm',
      'Actual harm',
      'Immediate jeopardy',
      'Unknown',
      ''
    )
  ),
  constraint deficiencies_scope_level_check check (
    scope_level is null or scope_level in ('Isolated', 'Pattern', 'Widespread', 'Unknown', '')
  ),
  constraint deficiencies_immediate_jeopardy_check check (
    immediate_jeopardy in ('Yes', 'No', 'Unknown')
  ),
  constraint deficiencies_revisit_readiness_status_check check (
    revisit_readiness_status in (
      'Ready', 'Nearly Ready', 'Significant Gaps', 'Not Ready', 'Not Assessed'
    )
  ),
  constraint deficiencies_revisit_readiness_score_check check (
    revisit_readiness_score is null or revisit_readiness_score between 0 and 100
  ),
  constraint deficiencies_status_check check (
    deficiency_status in (
      'Draft',
      'Clinical Review',
      'Client Review',
      'Approved',
      'Implementation',
      'Evidence Pending',
      'Monitoring',
      'Revisit Ready',
      'Closed'
    )
  )
);

create table public.pocs (
  id text primary key default gen_random_uuid()::text,
  client_account_id text references public.client_accounts (id) on delete restrict,
  regulatory_case_id text references public.regulatory_cases (id) on delete restrict,
  regulatory_case_name text,
  deficiency_id text not null references public.deficiencies (id) on delete restrict,
  engagement_id text references public.engagements (id) on delete restrict,
  engagement_name text,
  facility_id text references public.facilities (id) on delete restrict,
  facility_name text,
  f_tag text not null,
  version integer not null default 1,
  element_1_specific_correction text,
  element_2_others_potentially_affected text,
  element_3_systemic_correction text,
  element_4_monitoring text,
  element_5_responsibility_qapi_completion text,
  education_plan text,
  competency_plan text,
  evidence_requirements text,
  generated_narrative text,
  source_snapshot text,
  source_fields_used text[],
  status text not null default 'AI Draft',
  prepared_by text,
  reviewed_by text,
  clinical_approved_by text,
  client_reviewed_by text,
  client_reviewed_by_id text,
  client_reviewed_date timestamptz,
  client_review_comment text,
  client_review_status text not null default 'Pending',
  submitted_date timestamptz,
  submission_source text,
  submitted_by text,
  accepted_date timestamptz,
  acceptance_source text,
  accepted_by text,
  revision_requested_date timestamptz,
  revision_notes text,
  superseded_by_version integer,
  client_visibility boolean not null default false,
  description text,
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint pocs_deficiency_version_key unique (deficiency_id, version),
  constraint pocs_version_check check (version > 0),
  constraint pocs_status_check check (
    status in (
      'AI Draft',
      'Clinical Review',
      'Client Review',
      'Approved for Use',
      'Submitted',
      'Accepted',
      'Revision Requested',
      'Superseded'
    )
  ),
  constraint pocs_client_review_status_check check (
    client_review_status in ('Pending', 'Acknowledged', 'Revision Requested', 'Client Approved')
  ),
  constraint pocs_superseded_by_version_check check (
    superseded_by_version is null or superseded_by_version > 0
  ),
  constraint pocs_description_length_check check (
    description is null or char_length(description) <= 1000
  )
);

create table public.evidence_items (
  id text primary key default gen_random_uuid()::text,
  client_account_id text references public.client_accounts (id) on delete restrict,
  deficiency_id text references public.deficiencies (id) on delete restrict,
  deficiency_name text,
  regulatory_case_id text references public.regulatory_cases (id) on delete restrict,
  regulatory_case_name text,
  facility_id text references public.facilities (id) on delete restrict,
  facility_name text not null,
  engagement_id text references public.engagements (id) on delete restrict,
  evidence_type text not null,
  description text,
  date date,
  source text,
  responsible_person text,
  uploaded_document_url text,
  review_status text not null default 'Required',
  reviewer text,
  accepted_as_sufficient boolean not null default false,
  client_response_status text not null default 'Pending',
  client_response_note text,
  client_responded_by text,
  client_responded_by_id text,
  client_response_date timestamptz,
  notes text,
  client_visibility boolean not null default false,
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint evidence_items_evidence_type_check check (
    evidence_type in (
      'Corrected Resident-Specific Documentation',
      'Policy Revision',
      'Care-Plan Revision',
      'Physician Orders',
      'Equipment Correction',
      'Inspection Record',
      'Training Materials',
      'Attendance Roster',
      'Competency Validation',
      'Completed Audit',
      'Follow-Up Correction',
      'Photograph',
      'Log',
      'Leadership Rounding',
      'QAPI Documentation',
      'Consultant Review',
      'Other Supporting Evidence'
    )
  ),
  constraint evidence_items_review_status_check check (
    review_status in (
      'Required',
      'Requested',
      'Received',
      'Under Review',
      'Accepted',
      'Insufficient',
      'Replaced',
      'Not Applicable'
    )
  ),
  constraint evidence_items_client_response_status_check check (
    client_response_status in (
      'Pending', 'Prepared', 'Available', 'Clarification Requested', 'Noted'
    )
  )
);

create table public.audit_tools (
  id text primary key default gen_random_uuid()::text,
  client_account_id text references public.client_accounts (id) on delete restrict,
  facility_id text references public.facilities (id) on delete restrict,
  facility_name text not null,
  regulatory_case_id text references public.regulatory_cases (id) on delete restrict,
  regulatory_case_name text,
  engagement_id text references public.engagements (id) on delete restrict,
  engagement_name text,
  deficiency_id text references public.deficiencies (id) on delete restrict,
  deficiency_name text,
  f_tag text not null,
  cms_regulatory_reference text,
  plain_language_regulatory_focus text,
  specific_deficiency_focus text,
  corrective_action_focus text,
  audit_date date,
  auditor text,
  unit_hall text,
  resident_record_area_reviewed text,
  shift text,
  meal text,
  med_pass text,
  follow_up_due_date date,
  checklist_json text,
  training_topic text,
  training_date date,
  departments_staff_taught text,
  educator text,
  competency_required text,
  competency_completed text,
  monitoring_sample_size text,
  monitoring_frequency text,
  monitoring_duration text,
  monitoring_responsible_person text,
  monitoring_reporting_route text,
  audit_result text not null default 'Not Completed',
  what_was_corrected text,
  what_remains_unresolved text,
  responsible_person text,
  don_qapi_review text,
  review_date date,
  client_visibility boolean not null default false,
  description text,
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint audit_tools_audit_result_check check (
    audit_result in (
      'Pass',
      'Needs Follow-Up',
      'Immediate Correction Completed',
      'Failed',
      'Not Completed'
    )
  ),
  constraint audit_tools_description_length_check check (
    description is null or char_length(description) <= 1000
  )
);

create table public.education_plans (
  id text primary key default gen_random_uuid()::text,
  client_account_id text references public.client_accounts (id) on delete restrict,
  deficiency_id text references public.deficiencies (id) on delete restrict,
  deficiency_name text,
  regulatory_case_id text references public.regulatory_cases (id) on delete restrict,
  regulatory_case_name text,
  engagement_id text references public.engagements (id) on delete restrict,
  engagement_name text,
  facility_id text references public.facilities (id) on delete restrict,
  facility_name text not null,
  education_outline text,
  staff_training_content text,
  talking_points text,
  competency_requirements text,
  return_demonstration_checklist text,
  attendance_roster text,
  department_assignments text,
  completion_tracker text,
  remediation_needs text,
  education_status text not null default 'Assigned',
  client_visibility boolean not null default false,
  description text,
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint education_plans_status_check check (
    education_status in (
      'Assigned',
      'Scheduled',
      'Completed',
      'Competency Pending',
      'Competency Completed',
      'Remediation Required'
    )
  ),
  constraint education_plans_description_length_check check (
    description is null or char_length(description) <= 1000
  )
);

create table public.qapi_reviews (
  id text primary key default gen_random_uuid()::text,
  client_account_id text references public.client_accounts (id) on delete restrict,
  deficiency_id text references public.deficiencies (id) on delete restrict,
  deficiency_name text,
  regulatory_case_id text references public.regulatory_cases (id) on delete restrict,
  regulatory_case_name text,
  engagement_id text references public.engagements (id) on delete restrict,
  engagement_name text,
  facility_id text references public.facilities (id) on delete restrict,
  facility_name text not null,
  monitoring_results text,
  trends text,
  failures text,
  corrective_followups text,
  repeated_patterns text,
  responsible_leader text,
  qapi_review_date date,
  qapi_decision text,
  additional_action text,
  monitoring_continuation boolean not null default false,
  monitoring_reduction boolean not null default false,
  monitoring_closure boolean not null default false,
  summary text,
  client_visibility boolean not null default false,
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false
);

create table public.revisit_readiness_criteria (
  id text primary key default gen_random_uuid()::text,
  client_account_id text references public.client_accounts (id) on delete restrict,
  deficiency_id text not null references public.deficiencies (id) on delete restrict,
  regulatory_case_id text references public.regulatory_cases (id) on delete restrict,
  engagement_id text references public.engagements (id) on delete restrict,
  engagement_name text,
  facility_id text references public.facilities (id) on delete restrict,
  facility_name text,
  criterion_label text not null,
  criterion_key text not null,
  derivation_source text not null default 'Automatic',
  source_entity text,
  source_record_id text,
  is_met boolean not null default false,
  met_date timestamptz,
  evidence_summary text,
  manual_reviewer text,
  manual_review_date timestamptz,
  blocks_readiness boolean not null default true,
  notes text,
  client_visibility boolean not null default false,
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint revisit_readiness_deficiency_criterion_key unique (deficiency_id, criterion_key),
  constraint revisit_readiness_derivation_source_check check (
    derivation_source in ('Automatic', 'Manual')
  )
);

create table public.work_products (
  id text primary key default gen_random_uuid()::text,
  client_account_id text references public.client_accounts (id) on delete restrict,
  document_type text not null,
  facility_id text references public.facilities (id) on delete restrict,
  facility_name text,
  engagement_id text references public.engagements (id) on delete restrict,
  engagement_name text,
  regulatory_case_id text references public.regulatory_cases (id) on delete restrict,
  regulatory_case_name text,
  deficiency_id text references public.deficiencies (id) on delete restrict,
  deficiency_name text,
  f_tag text,
  poc_id text references public.pocs (id) on delete restrict,
  generation_date timestamptz,
  document_status text not null default 'DRAFT',
  preparer text,
  reviewer text,
  version text not null default '1.0',
  content text,
  source_snapshot text,
  source_fields_used text[],
  source_record_ids text[],
  client_visibility boolean not null default false,
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint work_products_document_type_check check (
    document_type in (
      'Executive Regulatory Assessment',
      'Deficiency Analysis',
      'Root Cause Analysis Draft',
      'Plan of Correction Draft',
      'Corrective Action Plan',
      'Audit Form',
      'Audit Packet',
      'Education Outline',
      'Competency Checklist',
      'Evidence Checklist',
      'Monitoring Plan',
      'QAPI Summary',
      'Revisit Readiness Report',
      'Regulatory Recovery Status Report',
      'Final Engagement / Stabilization Report'
    )
  ),
  constraint work_products_document_status_check check (
    document_status in ('DRAFT', 'CLINICAL REVIEW', 'CLIENT REVIEW', 'APPROVED', 'FINAL')
  )
);

-- Foreign-key and application query indexes. Postgres does not create indexes
-- automatically on the referencing side of a foreign key.
create index regulatory_knowledge_f_tag_idx
  on public.regulatory_knowledge (f_tag);
create index regulatory_knowledge_approval_f_tag_idx
  on public.regulatory_knowledge (approval_status, f_tag);

create index regulatory_signals_facility_event_idx
  on public.regulatory_signals (facility_id, event_date desc);
create index regulatory_signals_type_severity_idx
  on public.regulatory_signals (signal_type, severity);
create index regulatory_signals_verified_stale_idx
  on public.regulatory_signals (verified, stale_data_flag);
create index regulatory_signals_retrieved_idx
  on public.regulatory_signals (date_retrieved desc)
  where not is_test_data;

create index regulatory_cases_client_account_idx
  on public.regulatory_cases (client_account_id);
create index regulatory_cases_organization_idx
  on public.regulatory_cases (organization_id);
create index regulatory_cases_facility_created_idx
  on public.regulatory_cases (facility_id, created_date desc);
create index regulatory_cases_engagement_created_idx
  on public.regulatory_cases (engagement_id, created_date desc);
create index regulatory_cases_status_created_idx
  on public.regulatory_cases (case_status, created_date desc);
create index regulatory_cases_client_visible_engagement_idx
  on public.regulatory_cases (engagement_id, created_date desc)
  where client_visibility and not is_test_data;

create index deficiencies_client_account_idx
  on public.deficiencies (client_account_id);
create index deficiencies_case_priority_idx
  on public.deficiencies (regulatory_case_id, priority_ranking desc);
create index deficiencies_engagement_created_idx
  on public.deficiencies (engagement_id, created_date desc);
create index deficiencies_facility_created_idx
  on public.deficiencies (facility_id, created_date desc);
create index deficiencies_regulatory_knowledge_idx
  on public.deficiencies (regulatory_knowledge_id);
create index deficiencies_status_created_idx
  on public.deficiencies (deficiency_status, created_date desc);
create index deficiencies_readiness_status_idx
  on public.deficiencies (revisit_readiness_status);
create index deficiencies_client_visible_engagement_idx
  on public.deficiencies (engagement_id, created_date desc)
  where client_visibility and not is_test_data;

create index pocs_client_account_idx on public.pocs (client_account_id);
create index pocs_case_idx on public.pocs (regulatory_case_id);
create index pocs_engagement_created_idx on public.pocs (engagement_id, created_date desc);
create index pocs_facility_idx on public.pocs (facility_id);
create index pocs_status_idx on public.pocs (status);
create index pocs_client_visible_engagement_idx
  on public.pocs (engagement_id, created_date desc)
  where client_visibility
    and not is_test_data
    and status not in ('AI Draft', 'Clinical Review');

create index evidence_items_client_account_idx
  on public.evidence_items (client_account_id);
create index evidence_items_deficiency_review_idx
  on public.evidence_items (deficiency_id, review_status);
create index evidence_items_case_idx
  on public.evidence_items (regulatory_case_id);
create index evidence_items_engagement_created_idx
  on public.evidence_items (engagement_id, created_date desc);
create index evidence_items_facility_idx
  on public.evidence_items (facility_id);
create index evidence_items_unresolved_idx
  on public.evidence_items (deficiency_id, created_date desc)
  where review_status in ('Required', 'Requested', 'Insufficient');

create index audit_tools_client_account_idx
  on public.audit_tools (client_account_id);
create index audit_tools_facility_idx on public.audit_tools (facility_id);
create index audit_tools_case_idx on public.audit_tools (regulatory_case_id);
create index audit_tools_engagement_idx on public.audit_tools (engagement_id);
create index audit_tools_deficiency_date_idx
  on public.audit_tools (deficiency_id, audit_date desc);
create index audit_tools_unresolved_idx
  on public.audit_tools (deficiency_id, created_date desc)
  where audit_result in ('Failed', 'Needs Follow-Up', 'Not Completed');

create index education_plans_client_account_idx
  on public.education_plans (client_account_id);
create index education_plans_deficiency_status_idx
  on public.education_plans (deficiency_id, education_status);
create index education_plans_case_idx
  on public.education_plans (regulatory_case_id);
create index education_plans_engagement_idx
  on public.education_plans (engagement_id);
create index education_plans_facility_idx
  on public.education_plans (facility_id);

create index qapi_reviews_client_account_idx
  on public.qapi_reviews (client_account_id);
create index qapi_reviews_deficiency_date_idx
  on public.qapi_reviews (deficiency_id, qapi_review_date desc);
create index qapi_reviews_case_idx on public.qapi_reviews (regulatory_case_id);
create index qapi_reviews_engagement_idx on public.qapi_reviews (engagement_id);
create index qapi_reviews_facility_idx on public.qapi_reviews (facility_id);

create index revisit_readiness_client_account_idx
  on public.revisit_readiness_criteria (client_account_id);
create index revisit_readiness_case_idx
  on public.revisit_readiness_criteria (regulatory_case_id);
create index revisit_readiness_engagement_idx
  on public.revisit_readiness_criteria (engagement_id);
create index revisit_readiness_facility_idx
  on public.revisit_readiness_criteria (facility_id);
create index revisit_readiness_blocking_unmet_idx
  on public.revisit_readiness_criteria (deficiency_id)
  where blocks_readiness and not is_met;

create index work_products_client_account_idx
  on public.work_products (client_account_id);
create index work_products_facility_idx on public.work_products (facility_id);
create index work_products_engagement_generation_idx
  on public.work_products (engagement_id, generation_date desc);
create index work_products_case_idx on public.work_products (regulatory_case_id);
create index work_products_deficiency_generation_idx
  on public.work_products (deficiency_id, generation_date desc);
create index work_products_poc_idx on public.work_products (poc_id);
create index work_products_status_generation_idx
  on public.work_products (document_status, generation_date desc);
create index work_products_client_visible_engagement_idx
  on public.work_products (engagement_id, generation_date desc)
  where client_visibility
    and not is_test_data
    and document_status not in ('DRAFT', 'CLINICAL REVIEW');

-- Keep Base44's updated_date compatibility column synchronized.
do $triggers$
declare
  table_name text;
  trigger_name text;
begin
  foreach table_name in array array[
    'regulatory_knowledge',
    'regulatory_signals',
    'regulatory_cases',
    'deficiencies',
    'pocs',
    'evidence_items',
    'audit_tools',
    'education_plans',
    'qapi_reviews',
    'revisit_readiness_criteria',
    'work_products'
  ]
  loop
    trigger_name := table_name || '_set_updated_date';
    execute format('drop trigger if exists %I on public.%I', trigger_name, table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.set_base44_updated_date()',
      trigger_name,
      table_name
    );
  end loop;
end
$triggers$;

-- Raw clinical tables are staff-only. Client portal reads and mutations must
-- use capability-aware server functions that return explicit DTO allowlists.
do $rls$
declare
  table_name text;
begin
  foreach table_name in array array[
    'regulatory_knowledge',
    'regulatory_signals',
    'regulatory_cases',
    'deficiencies',
    'pocs',
    'evidence_items',
    'audit_tools',
    'education_plans',
    'qapi_reviews',
    'revisit_readiness_criteria'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);

    execute format(
      'create policy %I on public.%I for select to authenticated using (
        exists (
          select 1 from public.profiles as p
          where p.id = (select auth.uid())
            and p.role in (
              ''admin''::public.app_role,
              ''clinical''::public.app_role,
              ''read_only''::public.app_role
            )
        )
      )',
      table_name || '_staff_select',
      table_name
    );

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (
        exists (
          select 1 from public.profiles as p
          where p.id = (select auth.uid())
            and p.role in (
              ''admin''::public.app_role,
              ''clinical''::public.app_role
            )
        )
      )',
      table_name || '_staff_insert',
      table_name
    );

    execute format(
      'create policy %I on public.%I for update to authenticated using (
        exists (
          select 1 from public.profiles as p
          where p.id = (select auth.uid())
            and p.role in (
              ''admin''::public.app_role,
              ''clinical''::public.app_role
            )
        )
      ) with check (
        exists (
          select 1 from public.profiles as p
          where p.id = (select auth.uid())
            and p.role in (
              ''admin''::public.app_role,
              ''clinical''::public.app_role
            )
        )
      )',
      table_name || '_staff_update',
      table_name
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated using (
        exists (
          select 1 from public.profiles as p
          where p.id = (select auth.uid())
            and p.role = ''admin''::public.app_role
        )
      )',
      table_name || '_admin_delete',
      table_name
    );
  end loop;
end
$rls$;

alter table public.work_products enable row level security;

create policy work_products_staff_select
  on public.work_products
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles as p
      where p.id = (select auth.uid())
        and p.role in (
          'admin'::public.app_role,
          'clinical'::public.app_role,
          'business_development'::public.app_role,
          'read_only'::public.app_role
        )
    )
  );

create policy work_products_staff_insert
  on public.work_products
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles as p
      where p.id = (select auth.uid())
        and p.role in ('admin'::public.app_role, 'clinical'::public.app_role)
    )
  );

create policy work_products_staff_update
  on public.work_products
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles as p
      where p.id = (select auth.uid())
        and p.role in ('admin'::public.app_role, 'clinical'::public.app_role)
    )
  )
  with check (
    exists (
      select 1
      from public.profiles as p
      where p.id = (select auth.uid())
        and p.role in ('admin'::public.app_role, 'clinical'::public.app_role)
    )
  );

create policy work_products_admin_delete
  on public.work_products
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles as p
      where p.id = (select auth.uid())
        and p.role = 'admin'::public.app_role
    )
  );

revoke all privileges on table
  public.regulatory_knowledge,
  public.regulatory_signals,
  public.regulatory_cases,
  public.deficiencies,
  public.pocs,
  public.evidence_items,
  public.audit_tools,
  public.education_plans,
  public.qapi_reviews,
  public.revisit_readiness_criteria,
  public.work_products
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.regulatory_knowledge,
  public.regulatory_signals,
  public.regulatory_cases,
  public.deficiencies,
  public.pocs,
  public.evidence_items,
  public.audit_tools,
  public.education_plans,
  public.qapi_reviews,
  public.revisit_readiness_criteria,
  public.work_products
to authenticated;

grant select, insert, update, delete on table
  public.regulatory_knowledge,
  public.regulatory_signals,
  public.regulatory_cases,
  public.deficiencies,
  public.pocs,
  public.evidence_items,
  public.audit_tools,
  public.education_plans,
  public.qapi_reviews,
  public.revisit_readiness_criteria,
  public.work_products
to service_role;

comment on table public.regulatory_cases is
  'Clinical regulatory cases. Raw access is restricted to staff roles; clients use server DTO functions.';
comment on table public.deficiencies is
  'Regulatory deficiencies and corrective-action analysis. Raw access is staff-only.';
comment on table public.pocs is
  'Versioned plans of correction. Lifecycle transitions must be enforced by server functions.';
comment on table public.evidence_items is
  'Corrective-action evidence metadata. Files must be stored in a private storage bucket.';
comment on table public.work_products is
  'Generated clinical work products with preserved source provenance.';

commit;
