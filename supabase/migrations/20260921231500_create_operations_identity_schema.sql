begin;

-- Operational configuration, outreach, launch-readiness, and identity records
-- retain Base44-compatible text primary keys and timestamp field names while
-- the frontend compatibility layer is migrated to Supabase.

create table public.launch_readiness_checks (
  id text primary key default gen_random_uuid()::text,
  check_name text not null,
  category text not null,
  status text not null default 'NOT TESTED',
  implementation_status text not null default 'Not Implemented',
  test_status text not null default 'Not Tested',
  last_tested_date timestamptz,
  test_method text,
  test_evidence text,
  tester text,
  result text,
  unresolved_issue text,
  owner text,
  description text,
  is_critical boolean not null default true,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint launch_readiness_checks_check_name_nonempty check (
    btrim(check_name) <> ''
  ),
  constraint launch_readiness_checks_category_check check (
    category in (
      'Security',
      'Privacy',
      'Verification',
      'Communication',
      'Workflow',
      'Infrastructure',
      'Regulatory Integrity',
      'Work Product Integrity',
      'Test Data',
      'Route Security',
      'Accessibility',
      'Client Portal',
      'Public Marketing Site',
      'Lead Capture',
      'Public Claims and Disclosures',
      'Client Portal Authentication',
      'Existence Non-Disclosure',
      'Foreign Read Isolation',
      'Foreign Write Isolation',
      'Stripe Test Lifecycle',
      'Privacy and Terms',
      'End-to-End Dry Run',
      'Operating Agreement Executed',
      'Production Stripe Authorization',
      'Overall Controlled Launch Decision'
    )
  ),
  constraint launch_readiness_checks_status_check check (
    status in ('PASS', 'WARNING', 'FAIL', 'NOT TESTED')
  ),
  constraint launch_readiness_checks_implementation_status_check check (
    implementation_status in ('Not Implemented', 'Implemented', 'N/A')
  ),
  constraint launch_readiness_checks_test_status_check check (
    test_status in ('Not Tested', 'Passed', 'Failed', 'Blocked')
  ),
  constraint launch_readiness_checks_description_length_check check (
    description is null or char_length(description) <= 1000
  )
);


create table public.lead_engine_configs (
  id text primary key default gen_random_uuid()::text,
  active_states text[],
  target_geography text,
  minimum_lead_score numeric,
  regulatory_lookback_days numeric,
  signal_weights jsonb,
  data_sources text[],
  refresh_frequency_hours numeric,
  outreach_mode text not null default 'Human Approved Outreach',
  sender_name text,
  sender_email text,
  follow_up_intervals numeric[],
  daily_outreach_limit numeric,
  bd_owner_id text,
  bd_owner_profile_id uuid
    references public.profiles (id) on update cascade on delete set null,
  bd_owner_name text,
  clinical_owner_id text,
  clinical_owner_profile_id uuid
    references public.profiles (id) on update cascade on delete set null,
  clinical_owner_name text,
  finance_owner_id text,
  finance_owner_profile_id uuid
    references public.profiles (id) on update cascade on delete set null,
  finance_owner_name text,
  last_updated timestamptz,
  test_mode boolean not null default false,
  test_email_recipients text[],
  regulatory_urgency_weights jsonb,
  commercial_opportunity_weights jsonb,
  priority_score_weights jsonb,
  description text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint lead_engine_configs_outreach_mode_check check (
    outreach_mode in (
      'Research Only',
      'Human Approved Outreach',
      'Approved Automated Sequence'
    )
  ),
  constraint lead_engine_configs_signal_weights_object_check check (
    signal_weights is null or jsonb_typeof(signal_weights) = 'object'
  ),
  constraint lead_engine_configs_regulatory_weights_object_check check (
    regulatory_urgency_weights is null
    or jsonb_typeof(regulatory_urgency_weights) = 'object'
  ),
  constraint lead_engine_configs_commercial_weights_object_check check (
    commercial_opportunity_weights is null
    or jsonb_typeof(commercial_opportunity_weights) = 'object'
  ),
  constraint lead_engine_configs_priority_weights_object_check check (
    priority_score_weights is null
    or jsonb_typeof(priority_score_weights) = 'object'
  ),
  constraint lead_engine_configs_description_length_check check (
    description is null or char_length(description) <= 1000
  )
);

comment on column public.lead_engine_configs.bd_owner_id is
  'Legacy Base44 user ID retained for import and compatibility.';
comment on column public.lead_engine_configs.clinical_owner_id is
  'Legacy Base44 user ID retained for import and compatibility.';
comment on column public.lead_engine_configs.finance_owner_id is
  'Legacy Base44 user ID retained for import and compatibility.';


create table public.outreach_templates (
  id text primary key default gen_random_uuid()::text,
  sequence_name text not null,
  step_number numeric not null,
  step_label text,
  stage text not null default 'Qualified',
  channel text not null default 'Email',
  timing text,
  subject text,
  body text,
  active boolean not null default true,
  notes text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint outreach_templates_sequence_name_nonempty check (
    btrim(sequence_name) <> ''
  ),
  constraint outreach_templates_stage_check check (
    stage in (
      'New',
      'Researching',
      'Verified',
      'Qualified',
      'Outreach Review',
      'Contacted',
      'Engaged',
      'Discovery Scheduled',
      'Discovery Completed',
      'Proposal Draft',
      'Proposal Sent',
      'Negotiation',
      'Nurture'
    )
  ),
  constraint outreach_templates_channel_check check (
    channel in ('Email', 'Phone', 'LinkedIn', 'In-Person', 'Other')
  )
);


create table public.outreach_sequences (
  id text primary key default gen_random_uuid()::text,
  sequence_name text not null,
  audience text,
  step numeric not null,
  step_label text,
  timing text,
  template text,
  approval_status text,
  sent_date timestamptz,
  response text,
  opt_out boolean not null default false,
  lead_id text
    references public.leads (id) on update cascade on delete set null,
  contact_id text
    references public.contacts (id) on update cascade on delete set null,
  opportunity_id text
    references public.opportunities (id) on update cascade on delete set null,
  description text,
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint outreach_sequences_sequence_name_nonempty check (
    btrim(sequence_name) <> ''
  ),
  constraint outreach_sequences_approval_status_check check (
    approval_status is null
    or approval_status in (
      'Pending Approval',
      'Approved',
      'Sent',
      'Cancelled',
      'Skipped'
    )
  ),
  constraint outreach_sequences_description_length_check check (
    description is null or char_length(description) <= 1000
  )
);


-- Every legacy Base44 user ID remains in its original text property. Canonical
-- Supabase profile UUIDs are stored separately so imports do not coerce IDs or
-- weaken referential integrity.
create table public.user_identity_profiles (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  user_profile_id uuid
    references public.profiles (id) on update cascade on delete set null,
  email_snapshot text,
  provider_full_name_snapshot text,
  verified_display_name text,
  verified_credentials text,
  identity_status text not null default 'Pending Verification',
  verified_by_user_id text,
  verified_by_profile_id uuid
    references public.profiles (id) on update cascade on delete set null,
  verified_by_name_snapshot text,
  verified_at timestamptz,
  last_changed_at timestamptz,
  last_change_request_id text,
  active boolean not null default true,
  internal_notes text,
  description text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint user_identity_profiles_user_id_unique unique (user_id),
  constraint user_identity_profiles_user_profile_id_unique unique (user_profile_id),
  constraint user_identity_profiles_user_id_nonempty check (
    btrim(user_id) <> ''
  ),
  constraint user_identity_profiles_status_check check (
    identity_status in (
      'Pending Verification',
      'Verified',
      'Correction Requested',
      'Suspended',
      'Retired'
    )
  ),
  constraint user_identity_profiles_display_name_length_check check (
    verified_display_name is null
    or char_length(btrim(verified_display_name)) between 2 and 100
  ),
  constraint user_identity_profiles_credentials_length_check check (
    verified_credentials is null
    or char_length(btrim(verified_credentials)) between 2 and 50
  ),
  constraint user_identity_profiles_description_length_check check (
    description is null or char_length(description) <= 1000
  )
);

comment on column public.user_identity_profiles.user_id is
  'Legacy Base44 user ID retained for import and compatibility.';
comment on column public.user_identity_profiles.user_profile_id is
  'Canonical Supabase profile UUID used by migrated server-side identity logic.';


create table public.user_name_change_requests (
  id text primary key default gen_random_uuid()::text,
  requesting_user_id text not null,
  requesting_profile_id uuid
    references public.profiles (id) on update cascade on delete set null,
  identity_profile_id text
    references public.user_identity_profiles (id)
      on update cascade on delete set null,
  current_verified_display_name_snapshot text,
  requested_display_name text not null,
  current_credentials_snapshot text,
  requested_credentials text,
  reason_for_request text,
  supporting_information text,
  request_status text not null default 'Pending',
  requested_at timestamptz,
  reviewed_by_user_id text,
  reviewed_by_profile_id uuid
    references public.profiles (id) on update cascade on delete set null,
  reviewed_by_name_snapshot text,
  reviewed_at timestamptz,
  decision_notes text,
  effective_at timestamptz,
  description text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint user_name_change_requests_requesting_user_id_nonempty check (
    btrim(requesting_user_id) <> ''
  ),
  constraint user_name_change_requests_display_name_length_check check (
    char_length(btrim(requested_display_name)) between 2 and 100
  ),
  constraint user_name_change_requests_credentials_length_check check (
    requested_credentials is null
    or char_length(btrim(requested_credentials)) between 2 and 50
  ),
  constraint user_name_change_requests_status_check check (
    request_status in (
      'Pending',
      'Approved',
      'Denied',
      'Withdrawn',
      'Superseded'
    )
  ),
  constraint user_name_change_requests_description_length_check check (
    description is null or char_length(description) <= 1000
  )
);

comment on column public.user_name_change_requests.requesting_user_id is
  'Legacy Base44 user ID retained for import and compatibility.';

alter table public.user_identity_profiles
  add constraint user_identity_profiles_last_change_request_id_fkey
  foreign key (last_change_request_id)
  references public.user_name_change_requests (id)
  on update cascade
  on delete set null;


create table public.user_identity_audit_events (
  id text primary key default gen_random_uuid()::text,
  subject_user_id text not null,
  subject_profile_id uuid
    references public.profiles (id) on update cascade on delete set null,
  identity_profile_id text
    references public.user_identity_profiles (id)
      on update cascade on delete set null,
  event_type text not null,
  old_display_name text,
  new_display_name text,
  old_credentials text,
  new_credentials text,
  request_id text
    references public.user_name_change_requests (id)
      on update cascade on delete set null,
  reason text,
  performed_by_user_id text,
  performed_by_profile_id uuid
    references public.profiles (id) on update cascade on delete set null,
  performed_by_name_snapshot text,
  event_timestamp timestamptz,
  source text,
  notes text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint user_identity_audit_events_subject_user_id_nonempty check (
    btrim(subject_user_id) <> ''
  ),
  constraint user_identity_audit_events_event_type_check check (
    event_type in (
      'Profile Created',
      'Initial Verification',
      'Name Change Requested',
      'Name Change Approved',
      'Name Change Denied',
      'Credentials Changed',
      'Identity Suspended',
      'Identity Reactivated',
      'Identity Retired'
    )
  )
);

comment on table public.user_identity_audit_events is
  'Administrator-visible identity history. No client or anonymous raw-table access is permitted.';
comment on column public.user_identity_audit_events.subject_user_id is
  'Legacy Base44 user ID retained for import and compatibility.';


-- Foreign-key and compatibility-client access paths.
create index launch_readiness_checks_category_created_date_idx
  on public.launch_readiness_checks (category, created_date desc);
create index launch_readiness_checks_critical_status_idx
  on public.launch_readiness_checks (is_critical, status, test_status);

create index lead_engine_configs_created_date_idx
  on public.lead_engine_configs (created_date desc);
create index lead_engine_configs_bd_owner_profile_id_idx
  on public.lead_engine_configs (bd_owner_profile_id)
  where bd_owner_profile_id is not null;
create index lead_engine_configs_clinical_owner_profile_id_idx
  on public.lead_engine_configs (clinical_owner_profile_id)
  where clinical_owner_profile_id is not null;
create index lead_engine_configs_finance_owner_profile_id_idx
  on public.lead_engine_configs (finance_owner_profile_id)
  where finance_owner_profile_id is not null;

create index outreach_templates_sequence_step_idx
  on public.outreach_templates (sequence_name, step_number);
create index outreach_templates_stage_active_idx
  on public.outreach_templates (stage, active);
create index outreach_templates_created_date_idx
  on public.outreach_templates (created_date desc);

create index outreach_sequences_sequence_step_idx
  on public.outreach_sequences (sequence_name, step);
create index outreach_sequences_approval_status_idx
  on public.outreach_sequences (approval_status, created_date desc);
create index outreach_sequences_lead_id_idx
  on public.outreach_sequences (lead_id)
  where lead_id is not null;
create index outreach_sequences_contact_id_idx
  on public.outreach_sequences (contact_id)
  where contact_id is not null;
create index outreach_sequences_opportunity_id_idx
  on public.outreach_sequences (opportunity_id)
  where opportunity_id is not null;

create index user_identity_profiles_status_created_date_idx
  on public.user_identity_profiles (identity_status, created_date desc);
create index user_identity_profiles_verified_name_idx
  on public.user_identity_profiles (verified_display_name, identity_status)
  where verified_display_name is not null;
create index user_identity_profiles_verified_by_profile_id_idx
  on public.user_identity_profiles (verified_by_profile_id)
  where verified_by_profile_id is not null;
create index user_identity_profiles_last_change_request_id_idx
  on public.user_identity_profiles (last_change_request_id)
  where last_change_request_id is not null;

create unique index user_name_change_requests_one_pending_user_idx
  on public.user_name_change_requests (requesting_user_id)
  where request_status = 'Pending';
create unique index user_name_change_requests_one_pending_profile_idx
  on public.user_name_change_requests (requesting_profile_id)
  where request_status = 'Pending' and requesting_profile_id is not null;
create index user_name_change_requests_requesting_profile_id_idx
  on public.user_name_change_requests (requesting_profile_id)
  where requesting_profile_id is not null;
create index user_name_change_requests_identity_profile_id_idx
  on public.user_name_change_requests (identity_profile_id)
  where identity_profile_id is not null;
create index user_name_change_requests_status_requested_at_idx
  on public.user_name_change_requests (request_status, requested_at desc);
create index user_name_change_requests_reviewed_by_profile_id_idx
  on public.user_name_change_requests (reviewed_by_profile_id)
  where reviewed_by_profile_id is not null;

create index user_identity_audit_events_subject_timestamp_idx
  on public.user_identity_audit_events (
    subject_user_id,
    event_timestamp desc
  );
create index user_identity_audit_events_subject_profile_id_idx
  on public.user_identity_audit_events (subject_profile_id)
  where subject_profile_id is not null;
create index user_identity_audit_events_identity_profile_id_idx
  on public.user_identity_audit_events (identity_profile_id)
  where identity_profile_id is not null;
create index user_identity_audit_events_request_id_idx
  on public.user_identity_audit_events (request_id)
  where request_id is not null;
create index user_identity_audit_events_performed_by_profile_id_idx
  on public.user_identity_audit_events (performed_by_profile_id)
  where performed_by_profile_id is not null;
create index user_identity_audit_events_event_type_timestamp_idx
  on public.user_identity_audit_events (event_type, event_timestamp desc);


-- Reuse the Base44-compatible timestamp trigger defined by the staff/CRM
-- migration. It updates updated_date without changing imported created_date.
create trigger launch_readiness_checks_set_updated_date
  before update on public.launch_readiness_checks
  for each row execute function private.set_base44_updated_date();
create trigger lead_engine_configs_set_updated_date
  before update on public.lead_engine_configs
  for each row execute function private.set_base44_updated_date();
create trigger outreach_templates_set_updated_date
  before update on public.outreach_templates
  for each row execute function private.set_base44_updated_date();
create trigger outreach_sequences_set_updated_date
  before update on public.outreach_sequences
  for each row execute function private.set_base44_updated_date();
create trigger user_identity_profiles_set_updated_date
  before update on public.user_identity_profiles
  for each row execute function private.set_base44_updated_date();
create trigger user_name_change_requests_set_updated_date
  before update on public.user_name_change_requests
  for each row execute function private.set_base44_updated_date();
create trigger user_identity_audit_events_set_updated_date
  before update on public.user_identity_audit_events
  for each row execute function private.set_base44_updated_date();


alter table public.launch_readiness_checks enable row level security;
alter table public.launch_readiness_checks force row level security;
alter table public.lead_engine_configs enable row level security;
alter table public.lead_engine_configs force row level security;
alter table public.outreach_templates enable row level security;
alter table public.outreach_templates force row level security;
alter table public.outreach_sequences enable row level security;
alter table public.outreach_sequences force row level security;
alter table public.user_identity_profiles enable row level security;
alter table public.user_identity_profiles force row level security;
alter table public.user_name_change_requests enable row level security;
alter table public.user_name_change_requests force row level security;
alter table public.user_identity_audit_events enable row level security;
alter table public.user_identity_audit_events force row level security;

revoke all privileges
  on table
    public.launch_readiness_checks,
    public.lead_engine_configs,
    public.outreach_templates,
    public.outreach_sequences,
    public.user_identity_profiles,
    public.user_name_change_requests,
    public.user_identity_audit_events
  from public, anon, authenticated;

grant select, insert, update, delete
  on table
    public.launch_readiness_checks,
    public.lead_engine_configs,
    public.outreach_templates,
    public.outreach_sequences,
    public.user_identity_profiles,
    public.user_name_change_requests
  to authenticated, service_role;

grant select, insert, update
  on table public.user_identity_audit_events
  to authenticated;
grant select, insert, update, delete
  on table public.user_identity_audit_events
  to service_role;


-- LaunchReadinessCheck: administrator only.
create policy launch_readiness_checks_select_admin
  on public.launch_readiness_checks for select to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])));
create policy launch_readiness_checks_insert_admin
  on public.launch_readiness_checks for insert to authenticated
  with check ((select public.has_app_role(array['admin']::public.app_role[])));
create policy launch_readiness_checks_update_admin
  on public.launch_readiness_checks for update to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])))
  with check ((select public.has_app_role(array['admin']::public.app_role[])));
create policy launch_readiness_checks_delete_admin
  on public.launch_readiness_checks for delete to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])));

-- LeadEngineConfig: all legacy staff roles read; only administrators mutate.
create policy lead_engine_configs_select_staff
  on public.lead_engine_configs for select to authenticated
  using ((select public.has_app_role(array[
    'admin',
    'business_development',
    'clinical',
    'finance',
    'read_only'
  ]::public.app_role[])));
create policy lead_engine_configs_insert_admin
  on public.lead_engine_configs for insert to authenticated
  with check ((select public.has_app_role(array['admin']::public.app_role[])));
create policy lead_engine_configs_update_admin
  on public.lead_engine_configs for update to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])))
  with check ((select public.has_app_role(array['admin']::public.app_role[])));
create policy lead_engine_configs_delete_admin
  on public.lead_engine_configs for delete to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])));

-- OutreachTemplate: admin/BD/clinical read, admin/BD write, admin delete.
create policy outreach_templates_select_staff
  on public.outreach_templates for select to authenticated
  using ((select public.has_app_role(array[
    'admin',
    'business_development',
    'clinical'
  ]::public.app_role[])));
create policy outreach_templates_insert_staff
  on public.outreach_templates for insert to authenticated
  with check ((select public.has_app_role(array[
    'admin',
    'business_development'
  ]::public.app_role[])));
create policy outreach_templates_update_staff
  on public.outreach_templates for update to authenticated
  using ((select public.has_app_role(array[
    'admin',
    'business_development'
  ]::public.app_role[])))
  with check ((select public.has_app_role(array[
    'admin',
    'business_development'
  ]::public.app_role[])));
create policy outreach_templates_delete_admin
  on public.outreach_templates for delete to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])));

-- OutreachSequence preserves the same policy matrix as OutreachTemplate.
create policy outreach_sequences_select_staff
  on public.outreach_sequences for select to authenticated
  using ((select public.has_app_role(array[
    'admin',
    'business_development',
    'clinical'
  ]::public.app_role[])));
create policy outreach_sequences_insert_staff
  on public.outreach_sequences for insert to authenticated
  with check ((select public.has_app_role(array[
    'admin',
    'business_development'
  ]::public.app_role[])));
create policy outreach_sequences_update_staff
  on public.outreach_sequences for update to authenticated
  using ((select public.has_app_role(array[
    'admin',
    'business_development'
  ]::public.app_role[])))
  with check ((select public.has_app_role(array[
    'admin',
    'business_development'
  ]::public.app_role[])));
create policy outreach_sequences_delete_admin
  on public.outreach_sequences for delete to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])));

-- Raw identity records are deliberately administrator-only. Users receive
-- curated DTOs through authenticated server functions instead of table access.
create policy user_identity_profiles_select_admin
  on public.user_identity_profiles for select to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])));
create policy user_identity_profiles_insert_admin
  on public.user_identity_profiles for insert to authenticated
  with check ((select public.has_app_role(array['admin']::public.app_role[])));
create policy user_identity_profiles_update_admin
  on public.user_identity_profiles for update to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])))
  with check ((select public.has_app_role(array['admin']::public.app_role[])));
create policy user_identity_profiles_delete_admin
  on public.user_identity_profiles for delete to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])));

create policy user_name_change_requests_select_admin
  on public.user_name_change_requests for select to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])));
create policy user_name_change_requests_insert_admin
  on public.user_name_change_requests for insert to authenticated
  with check ((select public.has_app_role(array['admin']::public.app_role[])));
create policy user_name_change_requests_update_admin
  on public.user_name_change_requests for update to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])))
  with check ((select public.has_app_role(array['admin']::public.app_role[])));
create policy user_name_change_requests_delete_admin
  on public.user_name_change_requests for delete to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])));

create policy user_identity_audit_events_select_admin
  on public.user_identity_audit_events for select to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])));
create policy user_identity_audit_events_insert_admin
  on public.user_identity_audit_events for insert to authenticated
  with check ((select public.has_app_role(array['admin']::public.app_role[])));
create policy user_identity_audit_events_update_admin
  on public.user_identity_audit_events for update to authenticated
  using ((select public.has_app_role(array['admin']::public.app_role[])))
  with check ((select public.has_app_role(array['admin']::public.app_role[])));
-- Base44 explicitly declared delete=false for identity audit events. No delete
-- grant or policy is created for authenticated users.

commit;
