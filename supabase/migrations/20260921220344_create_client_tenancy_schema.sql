-- Recovered from applied Supabase migration history on 2026-10-04.
begin;

-- RLS policies below reuse public.has_app_role(public.app_role[]) from the
-- immediately preceding staff/CRM migration.


create table public.subscription_tiers (
  id text primary key default gen_random_uuid()::text,
  tier_name text not null check (btrim(tier_name) <> ''),
  tier_key text not null check (btrim(tier_key) <> ''),
  description text,
  annual_price numeric(12, 2) not null check (annual_price >= 0),
  stripe_product_id text,
  stripe_price_id text not null check (btrim(stripe_price_id) <> ''),
  features text[] not null default '{}',
  included_capabilities text[] not null default '{}',
  facility_limit integer check (facility_limit is null or facility_limit >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint subscription_tiers_tier_key_unique unique (tier_key),
  constraint subscription_tiers_stripe_price_id_unique unique (stripe_price_id),
  constraint subscription_tiers_capabilities_known check (
    included_capabilities <@ array[
      'can_login',
      'can_view_engagement',
      'can_view_documents',
      'can_download_documents',
      'can_view_poc',
      'can_review_poc',
      'can_approve_poc',
      'can_view_tasks',
      'can_complete_tasks',
      'can_view_evidence',
      'can_submit_evidence',
      'can_view_audits',
      'can_complete_audits',
      'can_message_consultant'
    ]::text[]
  )
);

comment on table public.subscription_tiers is
  'Staff-managed subscription catalog. Client-facing responses must use a server-side DTO, not raw table access.';


create table public.client_accounts (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null
    references public.organizations (id) on update cascade on delete restrict,
  organization_name text,
  account_name text not null check (btrim(account_name) <> ''),
  access_status text not null default 'Active'
    check (access_status in (
      'Active',
      'Grace Period',
      'Restricted',
      'Suspended',
      'Terminated'
    )),
  billing_status text not null default 'Unknown'
    check (billing_status in (
      'Current',
      'Invoice Due',
      'Past Due',
      'Payment Arrangement',
      'Paid',
      'Disputed',
      'Unknown'
    )),
  subscription_status text not null default 'Not Applicable'
    check (subscription_status in (
      'Active',
      'Trial',
      'Grace Period',
      'Past Due',
      'Cancelled',
      'Expired',
      'Not Applicable'
    )),
  subscription_tier_id text
    references public.subscription_tiers (id) on update cascade on delete set null,
  subscription_plan text,
  subscription_start_date date,
  subscription_renewal_date date,
  subscription_end_date date,
  past_due_since date,
  grace_period_end date,
  access_restriction_reason text,
  access_restriction_effective_date timestamptz,
  manual_access_override text not null default 'None'
    check (manual_access_override in (
      'None',
      'Extend Access',
      'Maintain Access',
      'Reactivate',
      'Suspend',
      'Terminate'
    )),
  manual_override_reason text,
  manual_override_by text,
  manual_override_by_id uuid
    references public.profiles (id) on update cascade on delete set null,
  legacy_manual_override_by_id text,
  manual_override_effective_date timestamptz,
  manual_override_expiration timestamptz,
  last_entitlement_check timestamptz,
  notes text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint client_accounts_subscription_dates_ordered check (
    subscription_end_date is null
    or subscription_start_date is null
    or subscription_end_date >= subscription_start_date
  ),
  constraint client_accounts_grace_period_ordered check (
    grace_period_end is null
    or past_due_since is null
    or grace_period_end >= past_due_since
  )
);

comment on table public.client_accounts is
  'Internal account, billing, and access state for a Clinical SOS client tenant.';


-- Retain an explicit Base44-user-to-Supabase-profile crosswalk during import.
-- profile_id may remain null until that legacy user accepts a Supabase invite.
create table public.legacy_user_profile_links (
  legacy_user_id text primary key,
  profile_id uuid unique
    references public.profiles (id) on update cascade on delete set null,
  legacy_email text,
  source_system text not null default 'base44',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint legacy_user_profile_links_legacy_user_id_nonempty
    check (btrim(legacy_user_id) <> ''),
  constraint legacy_user_profile_links_source_nonempty
    check (btrim(source_system) <> '')
);


create table public.client_memberships (
  id text primary key default gen_random_uuid()::text,
  client_user_id uuid
    references public.profiles (id) on update cascade on delete restrict,
  legacy_client_user_id text
    references public.legacy_user_profile_links (legacy_user_id)
      on update cascade on delete restrict,
  client_user_name text,
  client_user_email text,
  client_account_id text not null
    references public.client_accounts (id) on update cascade on delete cascade,
  organization_id text not null
    references public.organizations (id) on update cascade on delete restrict,
  organization_name text,
  membership_status text not null default 'Invited'
    check (membership_status in (
      'Invited',
      'Active',
      'Suspended',
      'Revoked',
      'Expired'
    )),
  can_login boolean not null default true,
  can_view_engagement boolean not null default true,
  can_view_documents boolean not null default true,
  can_download_documents boolean not null default true,
  can_view_poc boolean not null default true,
  can_review_poc boolean not null default true,
  can_approve_poc boolean not null default false,
  can_view_tasks boolean not null default true,
  can_complete_tasks boolean not null default false,
  can_view_evidence boolean not null default true,
  can_submit_evidence boolean not null default false,
  can_view_audits boolean not null default true,
  can_complete_audits boolean not null default false,
  can_message_consultant boolean not null default true,
  invited_date timestamptz,
  activated_date timestamptz,
  suspended_date timestamptz,
  revoked_date timestamptz,
  suspension_reason text,
  revocation_reason text,
  notes text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint client_memberships_user_reference_required check (
    client_user_id is not null or legacy_client_user_id is not null
  )
);

comment on table public.client_memberships is
  'Client-user tenancy and capability grants. Facility and engagement scope is normalized into junction tables.';
comment on column public.client_memberships.client_user_id is
  'Canonical Supabase auth/profile UUID. Authorization must use this field after migration.';
comment on column public.client_memberships.legacy_client_user_id is
  'Optional Base44 user ID retained only as a migration crosswalk.';


create table public.client_membership_facilities (
  membership_id text not null
    references public.client_memberships (id) on update cascade on delete cascade,
  facility_id text not null
    references public.facilities (id) on update cascade on delete restrict,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  primary key (membership_id, facility_id)
);

create table public.client_membership_engagements (
  membership_id text not null
    references public.client_memberships (id) on update cascade on delete cascade,
  engagement_id text not null
    references public.engagements (id) on update cascade on delete restrict,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  primary key (membership_id, engagement_id)
);

comment on table public.client_membership_facilities is
  'Normalized replacement for ClientMembership.authorized_facility_ids.';
comment on table public.client_membership_engagements is
  'Normalized replacement for ClientMembership.authorized_engagement_ids.';


create table public.automation_logs (
  id text primary key default gen_random_uuid()::text,
  automation text not null check (btrim(automation) <> ''),
  started timestamptz,
  completed timestamptz,
  status text not null default 'Running'
    check (status in ('Running', 'Success', 'Failed', 'Partial', 'Retry')),
  records_processed integer check (
    records_processed is null or records_processed >= 0
  ),
  errors text,
  retry_state text,
  affected_record_ids text[] not null default '{}',
  triggered_by text,
  client_account_id text
    references public.client_accounts (id) on update cascade on delete set null,
  previous_access_state text,
  new_access_state text,
  reason text,
  triggering_source text,
  acting_user_id text,
  acting_profile_id uuid
    references public.profiles (id) on update cascade on delete set null,
  acting_user_name text,
  manual_override boolean not null default false,
  manual_override_details text,
  description text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

comment on table public.automation_logs is
  'Internal automation and access-change audit events, including Stripe webhook idempotency markers.';


create table public.vendors (
  id text primary key default gen_random_uuid()::text,
  vendor_legal_name text not null check (btrim(vendor_legal_name) <> ''),
  dba_name text,
  vendor_category text not null check (vendor_category in (
    'Pharmacy',
    'Therapy',
    'Staffing Agency',
    'Laboratory',
    'Radiology',
    'Wound Care Provider',
    'Medical Equipment and DME',
    'Medical Supplies',
    'Electronic Health Records / Healthcare Technology',
    'Cybersecurity and IT',
    'Billing and Revenue-Cycle Services',
    'Dietary and Food Services',
    'Environmental Services',
    'Transportation',
    'Behavioral Health',
    'Hospice and Home Health',
    'Infection-Prevention Services',
    'Emergency-Preparedness Vendors',
    'Consultant Services',
    'Maintenance and Life-Safety Services',
    'Other Facility-Selected Category'
  )),
  description_of_services text,
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  website text,
  headquarters_address text,
  service_locations text,
  geographic_coverage text,
  parent_organization text,
  ownership_information text,
  relevant_licenses text,
  relevant_certifications text,
  accreditation text,
  insurance_information text,
  insurance_expiration_date date,
  baa_status text not null default 'Unknown'
    check (baa_status in ('Executed', 'Pending', 'Not Required', 'Unknown')),
  data_access_level text,
  phi_access_expected text not null default 'Unknown'
    check (phi_access_expected in ('Yes', 'No', 'Unknown')),
  contract_status text,
  active_relationship_status text,
  preferred_vendor_status boolean not null default false,
  known_regulatory_concerns text,
  source text,
  source_url text,
  last_verified timestamptz,
  confidence text not null default 'Unverified'
    check (confidence in ('High', 'Medium', 'Low', 'Unverified')),
  research_required boolean not null default false,
  internal_notes text,
  client_visible_summary text,
  record_status text not null default 'Active'
    check (record_status in ('Active', 'Inactive', 'Archived', 'Research Required')),
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);


create table public.vendor_relationships (
  id text primary key default gen_random_uuid()::text,
  vendor_id text not null
    references public.vendors (id) on update cascade on delete restrict,
  vendor_name text not null check (btrim(vendor_name) <> ''),
  client_account_id text
    references public.client_accounts (id) on update cascade on delete set null,
  client_name text,
  organization_id text
    references public.organizations (id) on update cascade on delete set null,
  organization_name text,
  facility_ids text[] not null default '{}',
  facility_names text[] not null default '{}',
  engagement_id text
    references public.engagements (id) on update cascade on delete set null,
  engagement_name text,
  service_provided text,
  relationship_owner_id text,
  relationship_owner_profile_id uuid
    references public.profiles (id) on update cascade on delete set null,
  relationship_owner_name text,
  facility_contact text,
  vendor_contact text,
  contract_start_date date,
  contract_expiration_date date,
  renewal_deadline date,
  notice_deadline date,
  auto_renewal boolean not null default false,
  service_level_expectations text,
  pricing_structure text,
  baa_status text not null default 'Unknown'
    check (baa_status in ('Executed', 'Pending', 'Not Required', 'Unknown')),
  insurance_requirements text,
  required_reporting text,
  performance_review_frequency text,
  relationship_status text not null default 'Prospective'
    check (relationship_status in (
      'Prospective',
      'Due Diligence',
      'Contract Review',
      'Implementation',
      'Active',
      'Active With Conditions',
      'Performance Improvement',
      'Renewal Review',
      'Replacement Under Consideration',
      'Terminated',
      'Archived'
    )),
  corrective_action_status text,
  replacement_consideration boolean not null default false,
  notes text,
  client_visibility boolean not null default false,
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint vendor_relationships_contract_dates_ordered check (
    contract_expiration_date is null
    or contract_start_date is null
    or contract_expiration_date >= contract_start_date
  )
);


create table public.vendor_evaluations (
  id text primary key default gen_random_uuid()::text,
  evaluation_name text not null check (btrim(evaluation_name) <> ''),
  vendor_id text
    references public.vendors (id) on update cascade on delete set null,
  vendor_name text,
  vendor_relationship_id text
    references public.vendor_relationships (id) on update cascade on delete set null,
  vendor_relationship_name text,
  client_account_id text
    references public.client_accounts (id) on update cascade on delete set null,
  client_name text,
  facility_ids text[] not null default '{}',
  facility_names text[] not null default '{}',
  engagement_id text
    references public.engagements (id) on update cascade on delete set null,
  engagement_name text,
  regulatory_case_id text,
  regulatory_case_name text,
  deficiency_id text,
  deficiency_name text,
  evaluation_type text not null check (evaluation_type in (
    'Pre-Contract Vendor Due Diligence',
    'Competitive Vendor Comparison',
    'New-Vendor Implementation Readiness',
    'Existing-Vendor Performance Review',
    'Contract-Renewal Evaluation',
    'Service-Level Agreement Review',
    'Corrective-Action Evaluation',
    'Incident-Triggered Vendor Review',
    'Regulatory-Case-Related Vendor Review',
    'Routine Annual Vendor Evaluation',
    'Organization-Wide Vendor Portfolio Review'
  )),
  evaluation_scope text,
  evaluation_period_start date,
  evaluation_period_end date,
  evaluation_owner_id text,
  evaluation_owner_profile_id uuid
    references public.profiles (id) on update cascade on delete set null,
  evaluation_owner_name text,
  clinical_reviewer text,
  operational_reviewer text,
  compliance_reviewer text,
  evaluation_status text not null default 'Intake'
    check (evaluation_status in (
      'Intake',
      'Scope Definition',
      'Evidence Requested',
      'Evidence Collection',
      'Under Evaluation',
      'Additional Information Required',
      'Clinical Review',
      'Operational Review',
      'Compliance Review',
      'Client Review',
      'Improvement Plan',
      'Monitoring',
      'Final Review',
      'Final',
      'Closed',
      'On Hold'
    )),
  evidence_completeness_status text not null default 'Not Started'
    check (evidence_completeness_status in (
      'Complete',
      'Substantially Complete',
      'Partially Complete',
      'Insufficient',
      'Not Started'
    )),
  overall_score numeric(8, 2),
  risk_level text not null default 'Unknown / Insufficient Evidence'
    check (risk_level in (
      'Low',
      'Moderate',
      'High',
      'Critical',
      'Unknown / Insufficient Evidence'
    )),
  recommendation text not null default 'No Final Recommendation'
    check (recommendation in (
      'Recommended',
      'Recommended With Conditions',
      'Continue With Monitoring',
      'Performance Improvement Required',
      'Renewal Review Required',
      'Replacement Should Be Considered',
      'Not Recommended',
      'Insufficient Evidence',
      'No Final Recommendation'
    )),
  recommendation_rationale text,
  conditions_or_required_improvements text,
  follow_up_date date,
  re_evaluation_date date,
  executive_approval_status text not null default 'Draft'
    check (executive_approval_status in ('Draft', 'Pending Approval', 'Approved', 'Rejected')),
  client_review_status text not null default 'Pending'
    check (client_review_status in ('Pending', 'Acknowledged', 'Revision Requested', 'Client Approved')),
  last_reviewed timestamptz,
  finalized_date timestamptz,
  version text not null default '1.0',
  client_visibility boolean not null default false,
  description text,
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint vendor_evaluations_period_ordered check (
    evaluation_period_end is null
    or evaluation_period_start is null
    or evaluation_period_end >= evaluation_period_start
  )
);


create table public.vendor_evaluation_items (
  id text primary key default gen_random_uuid()::text,
  vendor_evaluation_id text not null
    references public.vendor_evaluations (id) on update cascade on delete cascade,
  vendor_evaluation_name text,
  evaluation_category text not null check (evaluation_category in (
    'Corporate and Credentialing',
    'Regulatory and Compliance',
    'Clinical Quality and Resident Safety',
    'Staffing and Competency',
    'Service Performance',
    'Data Privacy and Security',
    'Business Continuity',
    'Financial and Commercial Fit',
    'Contract and Service-Level Terms',
    'Implementation and Integration',
    'Reporting and QAPI Support',
    'References and Reputation'
  )),
  criterion text not null check (btrim(criterion) <> ''),
  criterion_description text,
  weight numeric(8, 2),
  max_points numeric(8, 2) not null default 100 check (max_points >= 0),
  points_awarded numeric(8, 2) check (points_awarded is null or points_awarded >= 0),
  evidence_requirement text,
  evidence_received text not null default 'Requested'
    check (evidence_received in (
      'Received',
      'Partially Received',
      'Not Received',
      'Not Applicable',
      'Requested'
    )),
  evidence_source text,
  source_url text,
  source_date date,
  last_verified timestamptz,
  evidence_summary text,
  reviewer text,
  reviewer_comments text,
  confidence text not null default 'Unverified'
    check (confidence in ('High', 'Medium', 'Low', 'Unverified')),
  finding_status text not null default 'Not Yet Reviewed'
    check (finding_status in (
      'Meets Expectations',
      'Partially Meets Expectations',
      'Does Not Meet Expectations',
      'Not Applicable',
      'Insufficient Evidence',
      'Not Yet Reviewed'
    )),
  risk_flag boolean not null default false,
  corrective_action_required boolean not null default false,
  client_visibility boolean not null default false,
  research_required boolean not null default false,
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint vendor_evaluation_items_points_valid check (
    points_awarded is null or points_awarded <= max_points
  )
);


create table public.vendor_performance_improvement_plans (
  id text primary key default gen_random_uuid()::text,
  vendor_id text
    references public.vendors (id) on update cascade on delete set null,
  vendor_name text,
  vendor_relationship_id text
    references public.vendor_relationships (id) on update cascade on delete set null,
  vendor_relationship_name text,
  vendor_evaluation_id text
    references public.vendor_evaluations (id) on update cascade on delete set null,
  vendor_evaluation_name text,
  performance_issue text not null check (btrim(performance_issue) <> ''),
  root_cause text,
  required_corrective_action text,
  responsible_vendor_representative text,
  responsible_client_leader text,
  target_completion_date date,
  evidence_required text,
  monitoring_method text,
  service_level_expectation text,
  escalation_threshold text,
  follow_up_date date,
  current_status text not null default 'Draft'
    check (current_status in (
      'Draft',
      'Submitted to Vendor',
      'Acknowledged',
      'In Progress',
      'Evidence Submitted',
      'Under Review',
      'Monitoring',
      'Completed',
      'Overdue',
      'Escalated',
      'Closed'
    )),
  closure_approval text,
  override_rationale text,
  qapi_review text,
  client_visibility boolean not null default false,
  description text,
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);


-- The earlier staff/CRM migration intentionally leaves this dependency for
-- the client-tenancy migration, because client_accounts is created here.
alter table public.engagements
  add constraint engagements_client_account_id_fkey
  foreign key (client_account_id)
  references public.client_accounts (id)
  on update cascade
  on delete set null;


-- Exactly one active membership per canonical client user. During import,
-- unresolved legacy users get the same invariant by Base44 user ID.
create unique index client_memberships_one_active_profile_idx
  on public.client_memberships (client_user_id)
  where membership_status = 'Active' and client_user_id is not null;

create unique index client_memberships_one_active_legacy_user_idx
  on public.client_memberships (legacy_client_user_id)
  where membership_status = 'Active'
    and client_user_id is null
    and legacy_client_user_id is not null;

create unique index client_memberships_open_profile_account_idx
  on public.client_memberships (client_user_id, client_account_id)
  where client_user_id is not null
    and membership_status not in ('Revoked', 'Expired');

create unique index client_memberships_open_legacy_account_idx
  on public.client_memberships (legacy_client_user_id, client_account_id)
  where client_user_id is null
    and legacy_client_user_id is not null
    and membership_status not in ('Revoked', 'Expired');

create index subscription_tiers_active_sort_idx
  on public.subscription_tiers (is_active, sort_order);
create index client_accounts_organization_id_idx
  on public.client_accounts (organization_id);
create index client_accounts_access_status_idx
  on public.client_accounts (access_status, created_date desc);
create index client_accounts_subscription_tier_id_idx
  on public.client_accounts (subscription_tier_id)
  where subscription_tier_id is not null;
create index client_accounts_manual_override_by_id_idx
  on public.client_accounts (manual_override_by_id)
  where manual_override_by_id is not null;
create index client_memberships_account_status_idx
  on public.client_memberships (client_account_id, membership_status);
create index client_memberships_client_user_id_idx
  on public.client_memberships (client_user_id)
  where client_user_id is not null;
create index client_memberships_legacy_client_user_id_idx
  on public.client_memberships (legacy_client_user_id)
  where legacy_client_user_id is not null;
create index client_memberships_organization_id_idx
  on public.client_memberships (organization_id);
create index client_membership_facilities_facility_id_idx
  on public.client_membership_facilities (facility_id);
create index client_membership_engagements_engagement_id_idx
  on public.client_membership_engagements (engagement_id);
create index if not exists engagements_client_account_id_idx
  on public.engagements (client_account_id)
  where client_account_id is not null;
create index automation_logs_client_account_created_idx
  on public.automation_logs (client_account_id, created_date desc)
  where client_account_id is not null;
create index automation_logs_automation_created_idx
  on public.automation_logs (automation, created_date desc);
create index automation_logs_status_created_idx
  on public.automation_logs (status, created_date desc);
create index automation_logs_acting_profile_id_idx
  on public.automation_logs (acting_profile_id)
  where acting_profile_id is not null;
create index automation_logs_triggered_by_idx
  on public.automation_logs (triggered_by)
  where triggered_by is not null;
create unique index automation_logs_stripe_success_event_idx
  on public.automation_logs (triggered_by)
  where status = 'Success' and triggered_by like 'stripe_event:%';
create index vendors_status_category_created_idx
  on public.vendors (record_status, vendor_category, created_date desc);
create index vendor_relationships_vendor_id_idx
  on public.vendor_relationships (vendor_id);
create index vendor_relationships_client_account_id_idx
  on public.vendor_relationships (client_account_id)
  where client_account_id is not null;
create index vendor_relationships_organization_id_idx
  on public.vendor_relationships (organization_id)
  where organization_id is not null;
create index vendor_relationships_engagement_id_idx
  on public.vendor_relationships (engagement_id)
  where engagement_id is not null;
create index vendor_relationships_owner_profile_id_idx
  on public.vendor_relationships (relationship_owner_profile_id)
  where relationship_owner_profile_id is not null;
create index vendor_relationships_status_expiration_idx
  on public.vendor_relationships (relationship_status, contract_expiration_date);
create index vendor_evaluations_vendor_id_idx
  on public.vendor_evaluations (vendor_id)
  where vendor_id is not null;
create index vendor_evaluations_relationship_id_idx
  on public.vendor_evaluations (vendor_relationship_id)
  where vendor_relationship_id is not null;
create index vendor_evaluations_client_account_id_idx
  on public.vendor_evaluations (client_account_id)
  where client_account_id is not null;
create index vendor_evaluations_engagement_id_idx
  on public.vendor_evaluations (engagement_id)
  where engagement_id is not null;
create index vendor_evaluations_owner_profile_id_idx
  on public.vendor_evaluations (evaluation_owner_profile_id)
  where evaluation_owner_profile_id is not null;
create index vendor_evaluations_regulatory_case_id_idx
  on public.vendor_evaluations (regulatory_case_id)
  where regulatory_case_id is not null;
create index vendor_evaluations_deficiency_id_idx
  on public.vendor_evaluations (deficiency_id)
  where deficiency_id is not null;
create index vendor_evaluations_status_risk_created_idx
  on public.vendor_evaluations (evaluation_status, risk_level, created_date desc);
create index vendor_evaluation_items_evaluation_category_idx
  on public.vendor_evaluation_items (vendor_evaluation_id, evaluation_category);
create index vendor_performance_plans_vendor_status_idx
  on public.vendor_performance_improvement_plans (vendor_id, current_status);
create index vendor_performance_plans_relationship_id_idx
  on public.vendor_performance_improvement_plans (vendor_relationship_id)
  where vendor_relationship_id is not null;
create index vendor_performance_plans_evaluation_id_idx
  on public.vendor_performance_improvement_plans (vendor_evaluation_id)
  where vendor_evaluation_id is not null;


-- Enforce tenant scope at the database boundary. The trigger functions are
-- private and cannot be invoked directly by browser roles.
create or replace function private.validate_client_membership_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  account_organization_id text;
  linked_profile_id uuid;
begin
  select account.organization_id
  into account_organization_id
  from public.client_accounts as account
  where account.id = new.client_account_id;

  if account_organization_id is null
     or account_organization_id is distinct from new.organization_id then
    raise exception using
      errcode = '23514',
      message = 'Membership organization must match its client account';
  end if;

  if new.legacy_client_user_id is not null then
    select link.profile_id
    into linked_profile_id
    from public.legacy_user_profile_links as link
    where link.legacy_user_id = new.legacy_client_user_id;

    if new.client_user_id is null and linked_profile_id is not null then
      new.client_user_id := linked_profile_id;
    elsif new.client_user_id is not null
          and linked_profile_id is not null
          and new.client_user_id is distinct from linked_profile_id then
      raise exception using
        errcode = '23514',
        message = 'Membership profile conflicts with its legacy user crosswalk';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if exists (
      select 1
      from public.client_membership_facilities as scope
      join public.facilities as facility on facility.id = scope.facility_id
      where scope.membership_id = old.id
        and facility.operator_id is distinct from new.organization_id
    ) then
      raise exception using
        errcode = '23514',
        message = 'Membership account change would invalidate a facility scope grant';
    end if;

    if exists (
      select 1
      from public.client_membership_engagements as scope
      join public.engagements as engagement on engagement.id = scope.engagement_id
      where scope.membership_id = old.id
        and engagement.client_account_id is distinct from new.client_account_id
        and not (
          engagement.client_account_id is null
          and engagement.organization_id is not distinct from new.organization_id
        )
    ) then
      raise exception using
        errcode = '23514',
        message = 'Membership account change would invalidate an engagement scope grant';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function private.validate_client_membership_facility_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  account_organization_id text;
  facility_organization_id text;
begin
  select account.organization_id
  into account_organization_id
  from public.client_memberships as membership
  join public.client_accounts as account
    on account.id = membership.client_account_id
  where membership.id = new.membership_id;

  select facility.operator_id
  into facility_organization_id
  from public.facilities as facility
  where facility.id = new.facility_id;

  if account_organization_id is null
     or facility_organization_id is null
     or account_organization_id is distinct from facility_organization_id then
    raise exception using
      errcode = '23514',
      message = 'Facility is outside the client membership tenant scope';
  end if;

  return new;
end;
$function$;

create or replace function private.validate_client_membership_engagement_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  account_id text;
  account_organization_id text;
  engagement_account_id text;
  engagement_organization_id text;
begin
  select account.id, account.organization_id
  into account_id, account_organization_id
  from public.client_memberships as membership
  join public.client_accounts as account
    on account.id = membership.client_account_id
  where membership.id = new.membership_id;

  select engagement.client_account_id, engagement.organization_id
  into engagement_account_id, engagement_organization_id
  from public.engagements as engagement
  where engagement.id = new.engagement_id;

  if account_id is null
     or (
       engagement_account_id is distinct from account_id
       and not (
         engagement_account_id is null
         and engagement_organization_id is not distinct from account_organization_id
       )
     ) then
    raise exception using
      errcode = '23514',
      message = 'Engagement is outside the client membership tenant scope';
  end if;

  return new;
end;
$function$;

revoke all
  on function private.validate_client_membership_account()
  from public, anon, authenticated;
revoke all
  on function private.validate_client_membership_facility_scope()
  from public, anon, authenticated;
revoke all
  on function private.validate_client_membership_engagement_scope()
  from public, anon, authenticated;

create trigger client_memberships_validate_account
  before insert or update of client_account_id, organization_id, client_user_id, legacy_client_user_id
  on public.client_memberships
  for each row
  execute function private.validate_client_membership_account();

create trigger client_membership_facilities_validate_scope
  before insert or update
  on public.client_membership_facilities
  for each row
  execute function private.validate_client_membership_facility_scope();

create trigger client_membership_engagements_validate_scope
  before insert or update
  on public.client_membership_engagements
  for each row
  execute function private.validate_client_membership_engagement_scope();


-- Reuse the Base44-compatible updated_date helper created by the staff/CRM
-- migration immediately before this one.
create trigger subscription_tiers_set_updated_date
  before update on public.subscription_tiers
  for each row execute function private.set_base44_updated_date();
create trigger client_accounts_set_updated_date
  before update on public.client_accounts
  for each row execute function private.set_base44_updated_date();
create trigger legacy_user_profile_links_set_updated_date
  before update on public.legacy_user_profile_links
  for each row execute function private.set_base44_updated_date();
create trigger client_memberships_set_updated_date
  before update on public.client_memberships
  for each row execute function private.set_base44_updated_date();
create trigger client_membership_facilities_set_updated_date
  before update on public.client_membership_facilities
  for each row execute function private.set_base44_updated_date();
create trigger client_membership_engagements_set_updated_date
  before update on public.client_membership_engagements
  for each row execute function private.set_base44_updated_date();
create trigger automation_logs_set_updated_date
  before update on public.automation_logs
  for each row execute function private.set_base44_updated_date();
create trigger vendors_set_updated_date
  before update on public.vendors
  for each row execute function private.set_base44_updated_date();
create trigger vendor_relationships_set_updated_date
  before update on public.vendor_relationships
  for each row execute function private.set_base44_updated_date();
create trigger vendor_evaluations_set_updated_date
  before update on public.vendor_evaluations
  for each row execute function private.set_base44_updated_date();
create trigger vendor_evaluation_items_set_updated_date
  before update on public.vendor_evaluation_items
  for each row execute function private.set_base44_updated_date();
create trigger vendor_performance_plans_set_updated_date
  before update on public.vendor_performance_improvement_plans
  for each row execute function private.set_base44_updated_date();


alter table public.subscription_tiers enable row level security;
alter table public.client_accounts enable row level security;
alter table public.legacy_user_profile_links enable row level security;
alter table public.client_memberships enable row level security;
alter table public.client_membership_facilities enable row level security;
alter table public.client_membership_engagements enable row level security;
alter table public.automation_logs enable row level security;
alter table public.vendors enable row level security;
alter table public.vendor_relationships enable row level security;
alter table public.vendor_evaluations enable row level security;
alter table public.vendor_evaluation_items enable row level security;
alter table public.vendor_performance_improvement_plans enable row level security;

revoke all
  on table
    public.subscription_tiers,
    public.client_accounts,
    public.legacy_user_profile_links,
    public.client_memberships,
    public.client_membership_facilities,
    public.client_membership_engagements,
    public.automation_logs,
    public.vendors,
    public.vendor_relationships,
    public.vendor_evaluations,
    public.vendor_evaluation_items,
    public.vendor_performance_improvement_plans
  from public, anon, authenticated;

grant select, insert, update, delete
  on table
    public.subscription_tiers,
    public.client_accounts,
    public.legacy_user_profile_links,
    public.client_memberships,
    public.client_membership_facilities,
    public.client_membership_engagements,
    public.automation_logs,
    public.vendors,
    public.vendor_relationships,
    public.vendor_evaluations,
    public.vendor_evaluation_items,
    public.vendor_performance_improvement_plans
  to authenticated, service_role;


-- Subscription tiers: staff billing catalog only. Clients receive a curated
-- server-side DTO; they have no direct raw-table policy.
create policy subscription_tiers_select_staff
  on public.subscription_tiers for select to authenticated
  using ((select public.has_app_role(array['admin', 'finance']::public.app_role[])));
create policy subscription_tiers_insert_admin
  on public.subscription_tiers for insert to authenticated
  with check ((select public.has_app_role(array['admin']::public.app_role[])));
create policy subscription_tiers_update_admin
  on public.subscription_tiers for update to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])))
  with check ((select public.has_app_role(array['admin']::public.app_role[])));
create policy subscription_tiers_delete_admin
  on public.subscription_tiers for delete to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])));

-- Client accounts preserve the legacy admin/finance update boundary.
create policy client_accounts_select_staff
  on public.client_accounts for select to authenticated
  using ((select public.has_app_role(array[
    'admin', 'finance', 'clinical', 'read_only'
  ]::public.app_role[])));
create policy client_accounts_insert_admin
  on public.client_accounts for insert to authenticated
  with check ((select public.has_app_role(array['admin']::public.app_role[])));
create policy client_accounts_update_admin_finance
  on public.client_accounts for update to authenticated
  using ((select public.has_app_role(array['admin', 'finance']::public.app_role[])))
  with check ((select public.has_app_role(array['admin', 'finance']::public.app_role[])));
create policy client_accounts_delete_admin
  on public.client_accounts for delete to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])));

-- Memberships, scope grants, and migration identity links are admin-managed.
create policy legacy_user_profile_links_admin_all
  on public.legacy_user_profile_links for all to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])))
  with check ((select public.has_app_role(array['admin']::public.app_role[])));
create policy client_memberships_select_staff
  on public.client_memberships for select to authenticated
  using ((select public.has_app_role(array[
    'admin', 'finance', 'clinical', 'read_only'
  ]::public.app_role[])));
create policy client_memberships_insert_admin
  on public.client_memberships for insert to authenticated
  with check ((select public.has_app_role(array['admin']::public.app_role[])));
create policy client_memberships_update_admin
  on public.client_memberships for update to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])))
  with check ((select public.has_app_role(array['admin']::public.app_role[])));
create policy client_memberships_delete_admin
  on public.client_memberships for delete to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])));

create policy client_membership_facilities_select_staff
  on public.client_membership_facilities for select to authenticated
  using ((select public.has_app_role(array[
    'admin', 'finance', 'clinical', 'read_only'
  ]::public.app_role[])));
create policy client_membership_facilities_insert_admin
  on public.client_membership_facilities for insert to authenticated
  with check ((select public.has_app_role(array['admin']::public.app_role[])));
create policy client_membership_facilities_update_admin
  on public.client_membership_facilities for update to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])))
  with check ((select public.has_app_role(array['admin']::public.app_role[])));
create policy client_membership_facilities_delete_admin
  on public.client_membership_facilities for delete to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])));

create policy client_membership_engagements_select_staff
  on public.client_membership_engagements for select to authenticated
  using ((select public.has_app_role(array[
    'admin', 'finance', 'clinical', 'read_only'
  ]::public.app_role[])));
create policy client_membership_engagements_insert_admin
  on public.client_membership_engagements for insert to authenticated
  with check ((select public.has_app_role(array['admin']::public.app_role[])));
create policy client_membership_engagements_update_admin
  on public.client_membership_engagements for update to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])))
  with check ((select public.has_app_role(array['admin']::public.app_role[])));
create policy client_membership_engagements_delete_admin
  on public.client_membership_engagements for delete to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])));

create policy automation_logs_admin_all
  on public.automation_logs for all to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])))
  with check ((select public.has_app_role(array['admin']::public.app_role[])));

-- Vendor directory.
create policy vendors_select_staff
  on public.vendors for select to authenticated
  using ((select public.has_app_role(array[
    'admin', 'business_development', 'clinical', 'finance', 'read_only'
  ]::public.app_role[])));
create policy vendors_insert_staff
  on public.vendors for insert to authenticated
  with check ((select public.has_app_role(array[
    'admin', 'business_development'
  ]::public.app_role[])));
create policy vendors_update_staff
  on public.vendors for update to authenticated
  using ((select public.has_app_role(array[
    'admin', 'business_development', 'clinical'
  ]::public.app_role[])))
  with check ((select public.has_app_role(array[
    'admin', 'business_development', 'clinical'
  ]::public.app_role[])));
create policy vendors_delete_admin
  on public.vendors for delete to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])));

-- Vendor relationships and evaluations.
create policy vendor_relationships_select_staff
  on public.vendor_relationships for select to authenticated
  using ((select public.has_app_role(array[
    'admin', 'business_development', 'clinical', 'finance', 'read_only'
  ]::public.app_role[])));
create policy vendor_relationships_insert_staff
  on public.vendor_relationships for insert to authenticated
  with check ((select public.has_app_role(array[
    'admin', 'business_development', 'clinical'
  ]::public.app_role[])));
create policy vendor_relationships_update_staff
  on public.vendor_relationships for update to authenticated
  using ((select public.has_app_role(array[
    'admin', 'business_development', 'clinical'
  ]::public.app_role[])))
  with check ((select public.has_app_role(array[
    'admin', 'business_development', 'clinical'
  ]::public.app_role[])));
create policy vendor_relationships_delete_admin
  on public.vendor_relationships for delete to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])));

create policy vendor_evaluations_select_staff
  on public.vendor_evaluations for select to authenticated
  using ((select public.has_app_role(array[
    'admin', 'business_development', 'clinical', 'finance', 'read_only'
  ]::public.app_role[])));
create policy vendor_evaluations_insert_staff
  on public.vendor_evaluations for insert to authenticated
  with check ((select public.has_app_role(array[
    'admin', 'business_development', 'clinical'
  ]::public.app_role[])));
create policy vendor_evaluations_update_staff
  on public.vendor_evaluations for update to authenticated
  using ((select public.has_app_role(array[
    'admin', 'business_development', 'clinical'
  ]::public.app_role[])))
  with check ((select public.has_app_role(array[
    'admin', 'business_development', 'clinical'
  ]::public.app_role[])));
create policy vendor_evaluations_delete_admin
  on public.vendor_evaluations for delete to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])));

create policy vendor_evaluation_items_select_staff
  on public.vendor_evaluation_items for select to authenticated
  using ((select public.has_app_role(array[
    'admin', 'business_development', 'clinical', 'read_only'
  ]::public.app_role[])));
create policy vendor_evaluation_items_insert_staff
  on public.vendor_evaluation_items for insert to authenticated
  with check ((select public.has_app_role(array['admin', 'clinical']::public.app_role[])));
create policy vendor_evaluation_items_update_staff
  on public.vendor_evaluation_items for update to authenticated
  using ((select public.has_app_role(array['admin', 'clinical']::public.app_role[])))
  with check ((select public.has_app_role(array['admin', 'clinical']::public.app_role[])));
create policy vendor_evaluation_items_delete_admin
  on public.vendor_evaluation_items for delete to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])));

create policy vendor_performance_plans_select_staff
  on public.vendor_performance_improvement_plans for select to authenticated
  using ((select public.has_app_role(array[
    'admin', 'business_development', 'clinical', 'read_only'
  ]::public.app_role[])));
create policy vendor_performance_plans_insert_staff
  on public.vendor_performance_improvement_plans for insert to authenticated
  with check ((select public.has_app_role(array['admin', 'clinical']::public.app_role[])));
create policy vendor_performance_plans_update_staff
  on public.vendor_performance_improvement_plans for update to authenticated
  using ((select public.has_app_role(array['admin', 'clinical']::public.app_role[])))
  with check ((select public.has_app_role(array['admin', 'clinical']::public.app_role[])));
create policy vendor_performance_plans_delete_admin
  on public.vendor_performance_improvement_plans for delete to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])));

commit;

