begin;

create schema if not exists private;
revoke all on schema private from public;

-- Base44 records expose created_date/updated_date directly to the current
-- compatibility client. Keep those names until the frontend is migrated away
-- from the legacy entity contract.
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

-- This function is deliberately security-invoker. It can only see the caller's
-- own profile through profiles RLS, while role values remain server-managed.
create or replace function public.has_app_role(allowed_roles public.app_role[])
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.role = any (allowed_roles)
  );
$function$;

revoke all on function public.has_app_role(public.app_role[])
  from public, anon;
grant execute on function public.has_app_role(public.app_role[])
  to authenticated, service_role;

create table if not exists public.organizations (
  id text primary key default gen_random_uuid()::text,
  organization_name text not null,
  parent_company text,
  facility_count numeric,
  address text,
  website text,
  ownership_structure text,
  geographic_footprint text,
  identified_decision_makers text[],
  notes text,
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false
);

create table if not exists public.facilities (
  id text primary key default gen_random_uuid()::text,
  facility_name text not null,
  ccn text,
  address text,
  city text,
  state text,
  zip text,
  phone text,
  website text,
  facility_type text,
  bed_count numeric,
  cms_rating numeric,
  operator_id text,
  operator_name text,
  chain text,
  ownership_type text,
  source_urls text[],
  last_verified_date timestamptz,
  notes text,
  is_test_data boolean not null default false,
  cmp_present text default 'Unknown',
  cmp_type text default 'Unknown',
  verified_cmp_amount numeric,
  verified_daily_rate numeric,
  cmp_effective_date date,
  cmp_end_date date,
  dpna_present text default 'Unknown',
  dpna_effective_date date,
  dpna_duration text,
  immediate_jeopardy text default 'Unknown',
  ij_start_date date,
  ij_removal_date date,
  sff_status text default 'Unknown',
  scope_severity text,
  survey_date date,
  revisit_date date,
  revisit_status text,
  substantial_compliance_status text,
  enforcement_source text,
  enforcement_source_url text,
  last_verified timestamptz,
  evidence_summary text,
  confidence numeric,
  research_required boolean not null default false,
  regulatory_urgency text default 'Unknown / Research Required',
  regulatory_urgency_score numeric,
  commercial_opportunity_score numeric,
  clinical_sos_priority_score numeric,
  score_explanation text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint facilities_operator_id_fkey
    foreign key (operator_id) references public.organizations (id)
    on delete set null,
  constraint facilities_facility_type_check check (
    facility_type is null or facility_type in (
      'Skilled Nursing', 'Long-Term Care', 'Assisted Living', 'CCRC', 'Other'
    )
  ),
  constraint facilities_cmp_present_check check (
    cmp_present is null or cmp_present in ('Yes', 'No', 'Unknown')
  ),
  constraint facilities_cmp_type_check check (
    cmp_type is null or cmp_type in ('Per Day', 'Per Instance', 'Other', 'Unknown')
  ),
  constraint facilities_dpna_present_check check (
    dpna_present is null or dpna_present in ('Yes', 'No', 'Unknown')
  ),
  constraint facilities_immediate_jeopardy_check check (
    immediate_jeopardy is null or immediate_jeopardy in ('Yes', 'No', 'Unknown')
  ),
  constraint facilities_sff_status_check check (
    sff_status is null or sff_status in (
      'Not SFF', 'SFF Candidate', 'Active SFF', 'Unknown'
    )
  ),
  constraint facilities_regulatory_urgency_check check (
    regulatory_urgency is null or regulatory_urgency in (
      'Critical', 'Severe', 'High', 'Moderate', 'Proactive',
      'Unknown / Research Required'
    )
  )
);

create table if not exists public.contacts (
  id text primary key default gen_random_uuid()::text,
  first_name text not null,
  last_name text not null,
  title text,
  role_category text,
  organization_id text,
  organization_name text,
  facility_id text,
  facility_name text,
  business_email text,
  business_email_normalized text generated always as (
    nullif(lower(btrim(business_email)), '')
  ) stored,
  business_phone text,
  public_profile_source text,
  source_url text,
  verified_date timestamptz,
  contact_confidence numeric,
  do_not_contact boolean not null default false,
  opt_out boolean not null default false,
  inferred boolean not null default false,
  notes text,
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint contacts_organization_id_fkey
    foreign key (organization_id) references public.organizations (id)
    on delete set null,
  constraint contacts_facility_id_fkey
    foreign key (facility_id) references public.facilities (id)
    on delete set null,
  constraint contacts_role_category_check check (
    role_category is null or role_category in (
      'Administrator', 'Director of Nursing', 'Regional Clinical',
      'Regional Operations', 'COO', 'CEO', 'Owner', 'Compliance',
      'Legal/Risk', 'Other Executive'
    )
  )
);

create table if not exists public.leads (
  id text primary key default gen_random_uuid()::text,
  facility_id text,
  facility_name text not null,
  organization_id text,
  organization_name text,
  primary_contact_id text,
  primary_contact_name text,
  lead_source text,
  regulatory_signal_ids text[],
  lead_score numeric,
  lead_tier text,
  score_explanation text,
  regulatory_urgency text default 'Unknown / Research Required',
  regulatory_urgency_score numeric,
  commercial_opportunity_score numeric,
  clinical_sos_priority_score numeric,
  score_breakdown text,
  verification_status text,
  recommended_service text,
  potential_urgency text,
  owner_id text,
  owner_name text,
  next_action text,
  next_action_date date,
  description varchar(1000),
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint leads_facility_id_fkey
    foreign key (facility_id) references public.facilities (id)
    on delete set null,
  constraint leads_organization_id_fkey
    foreign key (organization_id) references public.organizations (id)
    on delete set null,
  constraint leads_primary_contact_id_fkey
    foreign key (primary_contact_id) references public.contacts (id)
    on delete set null,
  constraint leads_lead_tier_check check (
    lead_tier is null or lead_tier in ('Tier 1', 'Tier 2', 'Tier 3', 'Nurture')
  ),
  constraint leads_regulatory_urgency_check check (
    regulatory_urgency is null or regulatory_urgency in (
      'Critical', 'Severe', 'High', 'Moderate', 'Proactive',
      'Unknown / Research Required'
    )
  ),
  constraint leads_verification_status_check check (
    verification_status is null or verification_status in (
      'Unverified', 'Verified', 'Research Required', 'Suppressed'
    )
  ),
  constraint leads_potential_urgency_check check (
    potential_urgency is null or potential_urgency in (
      'General Inquiry', 'Proactive', 'Corrective Action', 'Operational',
      'Leadership', 'Regulatory', 'Urgent'
    )
  )
);

create table if not exists public.opportunities (
  id text primary key default gen_random_uuid()::text,
  opportunity_name text not null,
  lead_id text,
  facility_id text,
  facility_name text,
  organization_id text,
  organization_name text,
  primary_contact_id text,
  primary_contact_name text,
  stage text not null,
  estimated_value numeric,
  probability numeric,
  expected_close date,
  service_interest text,
  source text,
  owner_id text,
  owner_name text,
  reason_lost text,
  lead_tier text,
  regulatory_urgency text default 'Unknown / Research Required',
  regulatory_urgency_score numeric,
  commercial_opportunity_score numeric,
  clinical_sos_priority_score numeric,
  description varchar(1000),
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint opportunities_lead_id_fkey
    foreign key (lead_id) references public.leads (id)
    on delete set null,
  constraint opportunities_facility_id_fkey
    foreign key (facility_id) references public.facilities (id)
    on delete set null,
  constraint opportunities_organization_id_fkey
    foreign key (organization_id) references public.organizations (id)
    on delete set null,
  constraint opportunities_primary_contact_id_fkey
    foreign key (primary_contact_id) references public.contacts (id)
    on delete set null,
  constraint opportunities_stage_check check (
    stage in (
      'New', 'Researching', 'Verified', 'Qualified', 'Outreach Review',
      'Contacted', 'Engaged', 'Discovery Scheduled', 'Discovery Completed',
      'Proposal Draft', 'Proposal Sent', 'Negotiation', 'Won', 'Lost',
      'Nurture', 'Suppressed'
    )
  ),
  constraint opportunities_regulatory_urgency_check check (
    regulatory_urgency is null or regulatory_urgency in (
      'Critical', 'Severe', 'High', 'Moderate', 'Proactive',
      'Unknown / Research Required'
    )
  )
);

create table if not exists public.proposals (
  id text primary key default gen_random_uuid()::text,
  proposal_name text not null,
  opportunity_id text,
  facility_id text,
  facility_name text,
  scope text,
  objectives text,
  phases text,
  deliverables text,
  engagement_model text,
  pricing_method text,
  fee numeric,
  payment_milestones text,
  status text not null,
  generated_date timestamptz,
  reviewer_id text,
  reviewer_name text,
  sent_date timestamptz,
  acceptance_status text,
  description varchar(1000),
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint proposals_opportunity_id_fkey
    foreign key (opportunity_id) references public.opportunities (id)
    on delete set null,
  constraint proposals_facility_id_fkey
    foreign key (facility_id) references public.facilities (id)
    on delete set null,
  constraint proposals_engagement_model_check check (
    engagement_model is null or engagement_model in (
      'Fixed Fee', 'Hourly', 'Time and Expense', 'Hybrid'
    )
  ),
  constraint proposals_status_check check (
    status in ('Draft', 'In Review', 'Approved', 'Sent', 'Accepted', 'Rejected', 'Expired')
  ),
  constraint proposals_acceptance_status_check check (
    acceptance_status is null or acceptance_status in ('Pending', 'Accepted', 'Rejected')
  )
);

create table if not exists public.engagements (
  id text primary key default gen_random_uuid()::text,
  engagement_name text not null,
  client_name text,
  client_account_id text,
  organization_id text,
  organization_name text,
  facility_id text,
  facility_name text,
  opportunity_id text,
  start_date date,
  estimated_end_date date,
  service_type text,
  phase text,
  engagement_model text,
  accepted_proposal_id text,
  accepted_proposal_name text,
  manager_id text,
  manager_name text,
  clinical_lead_id text,
  clinical_lead_name text,
  deliverables text,
  milestones text,
  invoice_milestones text,
  status text not null,
  client_visibility boolean not null default false,
  description varchar(1000),
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint engagements_organization_id_fkey
    foreign key (organization_id) references public.organizations (id)
    on delete set null,
  constraint engagements_facility_id_fkey
    foreign key (facility_id) references public.facilities (id)
    on delete set null,
  constraint engagements_opportunity_id_fkey
    foreign key (opportunity_id) references public.opportunities (id)
    on delete set null,
  constraint engagements_accepted_proposal_id_fkey
    foreign key (accepted_proposal_id) references public.proposals (id)
    on delete set null,
  constraint engagements_phase_check check (
    phase is null or phase in (
      'Phase 1 — Initial Assessment',
      'Phase 2 — POC/Improvement Development',
      'Phase 3 — Implementation/Stabilization/Follow-Up',
      'Onboarding', 'Complete'
    )
  ),
  constraint engagements_engagement_model_check check (
    engagement_model is null or engagement_model in (
      'Fixed Fee', 'Hourly', 'Time and Expense', 'Hybrid'
    )
  ),
  constraint engagements_status_check check (
    status in ('Active', 'On Hold', 'Complete', 'Cancelled')
  )
);

create table if not exists public.tasks (
  id text primary key default gen_random_uuid()::text,
  workstream text,
  task text not null,
  owner_id text,
  owner_name text,
  start_date date,
  due_date date,
  priority text,
  status text not null,
  notes text,
  linked_lead_id text,
  linked_opportunity_id text,
  linked_engagement_id text,
  client_completion_note text,
  client_completed_by text,
  client_completed_date timestamptz,
  client_visibility boolean not null default false,
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint tasks_linked_lead_id_fkey
    foreign key (linked_lead_id) references public.leads (id)
    on delete set null,
  constraint tasks_linked_opportunity_id_fkey
    foreign key (linked_opportunity_id) references public.opportunities (id)
    on delete set null,
  constraint tasks_linked_engagement_id_fkey
    foreign key (linked_engagement_id) references public.engagements (id)
    on delete set null,
  constraint tasks_priority_check check (
    priority is null or priority in ('Low', 'Medium', 'High', 'Urgent')
  ),
  constraint tasks_status_check check (
    status in ('Not Started', 'In Progress', 'Blocked', 'Complete')
  )
);

create table if not exists public.interactions (
  id text primary key default gen_random_uuid()::text,
  interaction_type text not null,
  direction text,
  team_member_id text,
  team_member_name text,
  contact_id text,
  contact_name text,
  facility_id text,
  facility_name text,
  opportunity_id text,
  summary text not null,
  next_step text,
  "date" timestamptz,
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint interactions_contact_id_fkey
    foreign key (contact_id) references public.contacts (id)
    on delete set null,
  constraint interactions_facility_id_fkey
    foreign key (facility_id) references public.facilities (id)
    on delete set null,
  constraint interactions_opportunity_id_fkey
    foreign key (opportunity_id) references public.opportunities (id)
    on delete set null,
  constraint interactions_interaction_type_check check (
    interaction_type in (
      'Email', 'Inbound Form', 'Phone', 'Meeting', 'Note', 'Follow-Up',
      'Proposal', 'Other'
    )
  ),
  constraint interactions_direction_check check (
    direction is null or direction in ('Inbound', 'Outbound', 'Internal')
  )
);

create table if not exists public.sources (
  id text primary key default gen_random_uuid()::text,
  source_name text not null,
  source_type text,
  url text,
  date_retrieved timestamptz,
  last_checked timestamptz,
  reliability_classification text,
  description varchar(1000),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint sources_source_type_check check (
    source_type is null or source_type in (
      'Government', 'State Agency', 'Third-Party Database', 'News',
      'Public Record', 'Other'
    )
  ),
  constraint sources_reliability_classification_check check (
    reliability_classification is null or reliability_classification in (
      'Authoritative', 'Reliable', 'Supplementary', 'Unverified'
    )
  )
);

create table if not exists public.suppressions (
  id text primary key default gen_random_uuid()::text,
  contact_email text not null,
  contact_id text,
  contact_name text,
  do_not_contact boolean not null default true,
  opt_out boolean not null default false,
  reason text,
  "date" timestamptz,
  source text,
  compliance_notes text,
  description varchar(1000),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint suppressions_contact_id_fkey
    foreign key (contact_id) references public.contacts (id)
    on delete set null
);

-- Foreign-key and application access-path indexes.
create index if not exists facilities_operator_id_idx
  on public.facilities (operator_id);
create index if not exists facilities_facility_name_idx
  on public.facilities (facility_name);
create index if not exists facilities_ccn_idx
  on public.facilities (ccn) where ccn is not null;

create index if not exists contacts_organization_id_idx
  on public.contacts (organization_id);
create index if not exists contacts_facility_id_idx
  on public.contacts (facility_id);
create unique index if not exists contacts_business_email_normalized_uidx
  on public.contacts (business_email_normalized)
  where business_email_normalized is not null;

create index if not exists leads_facility_id_idx
  on public.leads (facility_id);
create index if not exists leads_organization_id_idx
  on public.leads (organization_id);
create index if not exists leads_primary_contact_id_idx
  on public.leads (primary_contact_id);
create index if not exists leads_owner_id_idx
  on public.leads (owner_id);
create index if not exists leads_verification_next_action_idx
  on public.leads (verification_status, next_action_date);

create index if not exists opportunities_lead_id_idx
  on public.opportunities (lead_id);
create index if not exists opportunities_facility_id_idx
  on public.opportunities (facility_id);
create index if not exists opportunities_organization_id_idx
  on public.opportunities (organization_id);
create index if not exists opportunities_primary_contact_id_idx
  on public.opportunities (primary_contact_id);
create index if not exists opportunities_owner_id_idx
  on public.opportunities (owner_id);
create index if not exists opportunities_stage_created_date_idx
  on public.opportunities (stage, created_date desc);

create index if not exists proposals_opportunity_id_idx
  on public.proposals (opportunity_id);
create index if not exists proposals_facility_id_idx
  on public.proposals (facility_id);
create index if not exists proposals_reviewer_id_idx
  on public.proposals (reviewer_id);
create index if not exists proposals_status_created_date_idx
  on public.proposals (status, created_date desc);

create index if not exists engagements_client_account_id_idx
  on public.engagements (client_account_id);
create index if not exists engagements_organization_id_idx
  on public.engagements (organization_id);
create index if not exists engagements_facility_id_idx
  on public.engagements (facility_id);
create index if not exists engagements_opportunity_id_idx
  on public.engagements (opportunity_id);
create index if not exists engagements_accepted_proposal_id_idx
  on public.engagements (accepted_proposal_id);
create index if not exists engagements_manager_id_idx
  on public.engagements (manager_id);
create index if not exists engagements_clinical_lead_id_idx
  on public.engagements (clinical_lead_id);
create index if not exists engagements_status_created_date_idx
  on public.engagements (status, created_date desc);

create index if not exists tasks_owner_id_idx
  on public.tasks (owner_id);
create index if not exists tasks_linked_lead_id_idx
  on public.tasks (linked_lead_id);
create index if not exists tasks_linked_opportunity_id_idx
  on public.tasks (linked_opportunity_id);
create index if not exists tasks_linked_engagement_id_idx
  on public.tasks (linked_engagement_id);
create index if not exists tasks_status_due_date_idx
  on public.tasks (status, due_date);

create index if not exists interactions_team_member_id_idx
  on public.interactions (team_member_id);
create index if not exists interactions_contact_id_idx
  on public.interactions (contact_id);
create index if not exists interactions_facility_id_idx
  on public.interactions (facility_id);
create index if not exists interactions_opportunity_id_idx
  on public.interactions (opportunity_id);
create index if not exists interactions_date_idx
  on public.interactions ("date" desc);

create index if not exists sources_last_checked_idx
  on public.sources (last_checked desc);
create index if not exists suppressions_contact_id_idx
  on public.suppressions (contact_id);
create index if not exists suppressions_contact_email_lower_idx
  on public.suppressions (lower(contact_email));

do $indexes$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations', 'facilities', 'contacts', 'leads', 'opportunities',
    'proposals', 'engagements', 'tasks', 'interactions', 'sources',
    'suppressions'
  ]
  loop
    execute format(
      'create index if not exists %I on public.%I (created_date desc)',
      table_name || '_created_date_idx',
      table_name
    );
  end loop;
end
$indexes$;

do $triggers$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations', 'facilities', 'contacts', 'leads', 'opportunities',
    'proposals', 'engagements', 'tasks', 'interactions', 'sources',
    'suppressions'
  ]
  loop
    execute format(
      'drop trigger if exists %I on public.%I',
      'set_' || table_name || '_updated_date',
      table_name
    );
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.set_base44_updated_date()',
      'set_' || table_name || '_updated_date',
      table_name
    );
  end loop;
end
$triggers$;

alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.facilities enable row level security;
alter table public.facilities force row level security;
alter table public.contacts enable row level security;
alter table public.contacts force row level security;
alter table public.leads enable row level security;
alter table public.leads force row level security;
alter table public.opportunities enable row level security;
alter table public.opportunities force row level security;
alter table public.proposals enable row level security;
alter table public.proposals force row level security;
alter table public.engagements enable row level security;
alter table public.engagements force row level security;
alter table public.tasks enable row level security;
alter table public.tasks force row level security;
alter table public.interactions enable row level security;
alter table public.interactions force row level security;
alter table public.sources enable row level security;
alter table public.sources force row level security;
alter table public.suppressions enable row level security;
alter table public.suppressions force row level security;

revoke all privileges on table
  public.organizations,
  public.facilities,
  public.contacts,
  public.leads,
  public.opportunities,
  public.proposals,
  public.engagements,
  public.tasks,
  public.interactions,
  public.sources,
  public.suppressions
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.organizations,
  public.facilities,
  public.contacts,
  public.leads,
  public.opportunities,
  public.proposals,
  public.engagements,
  public.tasks,
  public.interactions,
  public.sources,
  public.suppressions
to authenticated, service_role;

-- Organizations and facilities share the same staff access matrix.
drop policy if exists organizations_select_staff on public.organizations;
create policy organizations_select_staff on public.organizations
  for select to authenticated
  using ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role,
    'read_only'::public.app_role
  ])));

drop policy if exists organizations_insert_staff on public.organizations;
create policy organizations_insert_staff on public.organizations
  for insert to authenticated
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role
  ])));

drop policy if exists organizations_update_staff on public.organizations;
create policy organizations_update_staff on public.organizations
  for update to authenticated
  using ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role
  ])))
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role
  ])));

drop policy if exists organizations_delete_admin on public.organizations;
create policy organizations_delete_admin on public.organizations
  for delete to authenticated
  using ((select public.has_app_role(array['admin'::public.app_role])));

drop policy if exists facilities_select_staff on public.facilities;
create policy facilities_select_staff on public.facilities
  for select to authenticated
  using ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role,
    'read_only'::public.app_role
  ])));

drop policy if exists facilities_insert_staff on public.facilities;
create policy facilities_insert_staff on public.facilities
  for insert to authenticated
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role
  ])));

drop policy if exists facilities_update_staff on public.facilities;
create policy facilities_update_staff on public.facilities
  for update to authenticated
  using ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role
  ])))
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role
  ])));

drop policy if exists facilities_delete_admin on public.facilities;
create policy facilities_delete_admin on public.facilities
  for delete to authenticated
  using ((select public.has_app_role(array['admin'::public.app_role])));

drop policy if exists contacts_select_staff on public.contacts;
create policy contacts_select_staff on public.contacts
  for select to authenticated
  using ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role
  ])));

drop policy if exists contacts_insert_staff on public.contacts;
create policy contacts_insert_staff on public.contacts
  for insert to authenticated
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role
  ])));

drop policy if exists contacts_update_staff on public.contacts;
create policy contacts_update_staff on public.contacts
  for update to authenticated
  using ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role
  ])))
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role
  ])));

drop policy if exists contacts_delete_admin on public.contacts;
create policy contacts_delete_admin on public.contacts
  for delete to authenticated
  using ((select public.has_app_role(array['admin'::public.app_role])));

drop policy if exists leads_select_staff on public.leads;
create policy leads_select_staff on public.leads
  for select to authenticated
  using ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'read_only'::public.app_role
  ])));

drop policy if exists leads_insert_staff on public.leads;
create policy leads_insert_staff on public.leads
  for insert to authenticated
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role
  ])));

drop policy if exists leads_update_staff on public.leads;
create policy leads_update_staff on public.leads
  for update to authenticated
  using ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role
  ])))
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role
  ])));

drop policy if exists leads_delete_admin on public.leads;
create policy leads_delete_admin on public.leads
  for delete to authenticated
  using ((select public.has_app_role(array['admin'::public.app_role])));

drop policy if exists opportunities_select_staff on public.opportunities;
create policy opportunities_select_staff on public.opportunities
  for select to authenticated
  using (
    (select public.has_app_role(array[
      'admin'::public.app_role,
      'business_development'::public.app_role,
      'clinical'::public.app_role,
      'read_only'::public.app_role
    ]))
    or (
      stage = 'Won'
      and (select public.has_app_role(array['finance'::public.app_role]))
    )
  );

drop policy if exists opportunities_insert_staff on public.opportunities;
create policy opportunities_insert_staff on public.opportunities
  for insert to authenticated
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role
  ])));

drop policy if exists opportunities_update_staff on public.opportunities;
create policy opportunities_update_staff on public.opportunities
  for update to authenticated
  using ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role
  ])))
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role
  ])));

drop policy if exists opportunities_delete_admin on public.opportunities;
create policy opportunities_delete_admin on public.opportunities
  for delete to authenticated
  using ((select public.has_app_role(array['admin'::public.app_role])));

drop policy if exists proposals_select_staff on public.proposals;
create policy proposals_select_staff on public.proposals
  for select to authenticated
  using (
    (select public.has_app_role(array[
      'admin'::public.app_role,
      'business_development'::public.app_role,
      'clinical'::public.app_role,
      'read_only'::public.app_role
    ]))
    or (
      status in ('Approved', 'Sent', 'Accepted')
      and (select public.has_app_role(array['finance'::public.app_role]))
    )
  );

drop policy if exists proposals_insert_staff on public.proposals;
create policy proposals_insert_staff on public.proposals
  for insert to authenticated
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role
  ])));

drop policy if exists proposals_update_staff on public.proposals;
create policy proposals_update_staff on public.proposals
  for update to authenticated
  using ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role
  ])))
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role
  ])));

drop policy if exists proposals_delete_admin on public.proposals;
create policy proposals_delete_admin on public.proposals
  for delete to authenticated
  using ((select public.has_app_role(array['admin'::public.app_role])));

drop policy if exists tasks_select_staff on public.tasks;
create policy tasks_select_staff on public.tasks
  for select to authenticated
  using ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role,
    'finance'::public.app_role,
    'read_only'::public.app_role
  ])));

drop policy if exists tasks_insert_staff on public.tasks;
create policy tasks_insert_staff on public.tasks
  for insert to authenticated
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role,
    'finance'::public.app_role
  ])));

drop policy if exists tasks_update_staff on public.tasks;
create policy tasks_update_staff on public.tasks
  for update to authenticated
  using ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role,
    'finance'::public.app_role
  ])))
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role,
    'finance'::public.app_role
  ])));

drop policy if exists tasks_delete_admin on public.tasks;
create policy tasks_delete_admin on public.tasks
  for delete to authenticated
  using ((select public.has_app_role(array['admin'::public.app_role])));

drop policy if exists engagements_select_staff on public.engagements;
create policy engagements_select_staff on public.engagements
  for select to authenticated
  using ((select public.has_app_role(array[
    'admin'::public.app_role,
    'clinical'::public.app_role,
    'finance'::public.app_role,
    'read_only'::public.app_role
  ])));

drop policy if exists engagements_insert_staff on public.engagements;
create policy engagements_insert_staff on public.engagements
  for insert to authenticated
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'clinical'::public.app_role
  ])));

drop policy if exists engagements_update_staff on public.engagements;
create policy engagements_update_staff on public.engagements
  for update to authenticated
  using ((select public.has_app_role(array[
    'admin'::public.app_role,
    'clinical'::public.app_role,
    'finance'::public.app_role
  ])))
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'clinical'::public.app_role,
    'finance'::public.app_role
  ])));

drop policy if exists engagements_delete_admin on public.engagements;
create policy engagements_delete_admin on public.engagements
  for delete to authenticated
  using ((select public.has_app_role(array['admin'::public.app_role])));

drop policy if exists interactions_select_staff on public.interactions;
create policy interactions_select_staff on public.interactions
  for select to authenticated
  using ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role
  ])));

drop policy if exists interactions_insert_staff on public.interactions;
create policy interactions_insert_staff on public.interactions
  for insert to authenticated
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role
  ])));

drop policy if exists interactions_update_staff on public.interactions;
create policy interactions_update_staff on public.interactions
  for update to authenticated
  using ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role
  ])))
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role
  ])));

drop policy if exists interactions_delete_admin on public.interactions;
create policy interactions_delete_admin on public.interactions
  for delete to authenticated
  using ((select public.has_app_role(array['admin'::public.app_role])));

drop policy if exists sources_select_staff on public.sources;
create policy sources_select_staff on public.sources
  for select to authenticated
  using ((select public.has_app_role(array[
    'admin'::public.app_role,
    'clinical'::public.app_role,
    'read_only'::public.app_role
  ])));

drop policy if exists sources_insert_staff on public.sources;
create policy sources_insert_staff on public.sources
  for insert to authenticated
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'clinical'::public.app_role
  ])));

drop policy if exists sources_update_staff on public.sources;
create policy sources_update_staff on public.sources
  for update to authenticated
  using ((select public.has_app_role(array[
    'admin'::public.app_role,
    'clinical'::public.app_role
  ])))
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'clinical'::public.app_role
  ])));

drop policy if exists sources_delete_admin on public.sources;
create policy sources_delete_admin on public.sources
  for delete to authenticated
  using ((select public.has_app_role(array['admin'::public.app_role])));

drop policy if exists suppressions_select_staff on public.suppressions;
create policy suppressions_select_staff on public.suppressions
  for select to authenticated
  using ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role
  ])));

drop policy if exists suppressions_insert_staff on public.suppressions;
create policy suppressions_insert_staff on public.suppressions
  for insert to authenticated
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role
  ])));

drop policy if exists suppressions_update_staff on public.suppressions;
create policy suppressions_update_staff on public.suppressions
  for update to authenticated
  using ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role
  ])))
  with check ((select public.has_app_role(array[
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role
  ])));

drop policy if exists suppressions_delete_admin on public.suppressions;
create policy suppressions_delete_admin on public.suppressions
  for delete to authenticated
  using ((select public.has_app_role(array['admin'::public.app_role])));

commit;
