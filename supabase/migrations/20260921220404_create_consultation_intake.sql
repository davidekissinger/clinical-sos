-- Recovered from applied Supabase migration history on 2026-10-04.
begin;

create table public.consultation_requests (
  id text primary key default gen_random_uuid()::text,
  name varchar(120) not null,
  organization varchar(200),
  title varchar(200),
  business_email varchar(254) not null,
  business_email_normalized text generated always as (
    lower(btrim(business_email))
  ) stored,
  business_phone varchar(40),
  facility_or_org_name varchar(200),
  state varchar(60),
  number_of_facilities varchar(100),
  service_needed varchar(200),
  current_challenge varchar(2000),
  urgency_level text not null,
  preferred_contact_method varchar(40),
  preferred_consultation_time varchar(200),
  consent_acknowledged boolean not null default false,
  source_page varchar(200),
  source_ip inet,
  campaign varchar(200),
  lead_score numeric(5, 2),
  lead_tier varchar(40),
  created_contact_id text references public.contacts (id) on delete set null,
  created_opportunity_id text references public.opportunities (id) on delete set null,
  status text not null default 'New',
  description varchar(1000),
  is_test_data boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  is_sample boolean not null default false,
  constraint consultation_requests_name_not_blank check (btrim(name) <> ''),
  constraint consultation_requests_email_not_blank check (
    btrim(business_email) <> ''
  ),
  constraint consultation_requests_urgency_check check (
    urgency_level in (
      'General inquiry',
      'Proactive survey preparation',
      'Corrective action support',
      'Operational concern',
      'Leadership support',
      'Regulatory issue',
      'Urgent assistance requested'
    )
  ),
  constraint consultation_requests_score_check check (
    lead_score is null or lead_score between 0 and 100
  ),
  constraint consultation_requests_status_check check (
    status in ('New', 'Acknowledged', 'Qualified', 'Scheduled', 'Converted')
  )
);

create index consultation_requests_email_created_date_idx
  on public.consultation_requests (
    business_email_normalized,
    created_date desc
  );
create index consultation_requests_ip_created_date_idx
  on public.consultation_requests (source_ip, created_date desc)
  where source_ip is not null;
create index consultation_requests_status_created_date_idx
  on public.consultation_requests (status, created_date desc);
create index consultation_requests_created_contact_id_idx
  on public.consultation_requests (created_contact_id)
  where created_contact_id is not null;
create index consultation_requests_created_opportunity_id_idx
  on public.consultation_requests (created_opportunity_id)
  where created_opportunity_id is not null;

create trigger set_consultation_requests_updated_date
  before update on public.consultation_requests
  for each row
  execute function private.set_base44_updated_date();

alter table public.consultation_requests enable row level security;
alter table public.consultation_requests force row level security;

revoke all privileges on table public.consultation_requests
from public, anon, authenticated;

grant select, insert, update, delete on table public.consultation_requests
to authenticated, service_role;

create policy consultation_requests_select_staff
  on public.consultation_requests
  for select
  to authenticated
  using (
    (select public.has_app_role(array[
      'admin'::public.app_role,
      'business_development'::public.app_role
    ]))
  );

create policy consultation_requests_insert_admin
  on public.consultation_requests
  for insert
  to authenticated
  with check (
    (select public.has_app_role(array['admin'::public.app_role]))
  );

create policy consultation_requests_update_staff
  on public.consultation_requests
  for update
  to authenticated
  using (
    (select public.has_app_role(array[
      'admin'::public.app_role,
      'business_development'::public.app_role
    ]))
  )
  with check (
    (select public.has_app_role(array[
      'admin'::public.app_role,
      'business_development'::public.app_role
    ]))
  );

create policy consultation_requests_delete_admin
  on public.consultation_requests
  for delete
  to authenticated
  using (
    (select public.has_app_role(array['admin'::public.app_role]))
  );

-- This privileged RPC is callable only with a server secret. Advisory locks
-- prevent concurrent requests for the same email or IP from bypassing the
-- ten-minute rate limit, and the CRM fan-out runs in the same transaction.
create or replace function public.ingest_consultation(
  p_payload jsonb,
  p_source_ip inet default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_name text := regexp_replace(
    btrim(coalesce(p_payload ->> 'name', '')),
    '[[:space:]]+',
    ' ',
    'g'
  );
  v_email text := lower(btrim(coalesce(p_payload ->> 'business_email', '')));
  v_urgency text := btrim(coalesce(p_payload ->> 'urgency_level', ''));
  v_source_page text := coalesce(
    nullif(btrim(p_payload ->> 'source_page'), ''),
    '/contact'
  );
  v_score integer;
  v_tier text;
  v_rate_limited boolean;
  v_consultation_id text;
  v_contact_id text;
  v_existing_contact_id text;
  v_opportunity_id text;
  v_contact_match_method text := 'new';
  v_first_name text;
  v_last_name text;
  v_error text;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception using
      errcode = '22023',
      message = 'Payload must be a JSON object';
  end if;

  if v_name = '' or v_email = '' or v_urgency = '' then
    raise exception using
      errcode = '22023',
      message = 'Required consultation fields are missing';
  end if;

  if p_payload -> 'consent_acknowledged' is distinct from 'true'::jsonb then
    raise exception using
      errcode = '22023',
      message = 'Consent acknowledgment is required';
  end if;

  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using
      errcode = '22023',
      message = 'Invalid email address';
  end if;

  if v_urgency not in (
    'General inquiry',
    'Proactive survey preparation',
    'Corrective action support',
    'Operational concern',
    'Leadership support',
    'Regulatory issue',
    'Urgent assistance requested'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Invalid urgency level';
  end if;

  if char_length(v_name) > 120
    or char_length(v_email) > 254
    or char_length(coalesce(p_payload ->> 'organization', '')) > 200
    or char_length(coalesce(p_payload ->> 'title', '')) > 200
    or char_length(coalesce(p_payload ->> 'business_phone', '')) > 40
    or char_length(coalesce(p_payload ->> 'facility_or_org_name', '')) > 200
    or char_length(coalesce(p_payload ->> 'state', '')) > 60
    or char_length(coalesce(p_payload ->> 'number_of_facilities', '')) > 100
    or char_length(coalesce(p_payload ->> 'service_needed', '')) > 200
    or char_length(coalesce(p_payload ->> 'current_challenge', '')) > 2000
    or char_length(coalesce(p_payload ->> 'preferred_contact_method', '')) > 40
    or char_length(coalesce(p_payload ->> 'preferred_consultation_time', '')) > 200
    or char_length(v_source_page) > 200
    or char_length(coalesce(p_payload ->> 'campaign', '')) > 200
  then
    raise exception using
      errcode = '22023',
      message = 'One or more consultation fields exceed the maximum length';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'clinical-sos:consultation:email:' || v_email,
      0
    )
  );

  if p_source_ip is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'clinical-sos:consultation:ip:' || p_source_ip::text,
        0
      )
    );
  end if;

  select
    exists (
      select 1
      from public.consultation_requests as request
      where request.business_email_normalized = v_email
        and request.created_date > v_now - interval '10 minutes'
    )
    or (
      p_source_ip is not null
      and exists (
        select 1
        from public.consultation_requests as request
        where request.source_ip = p_source_ip
          and request.created_date > v_now - interval '10 minutes'
      )
    )
  into v_rate_limited;

  if v_rate_limited then
    insert into public.automation_logs (
      automation,
      started,
      completed,
      status,
      records_processed,
      triggered_by,
      reason,
      acting_user_name,
      manual_override_details
    )
    values (
      'Consultation Form Abuse Rejection',
      v_now,
      clock_timestamp(),
      'Failed',
      0,
      'submitConsultation:anti_abuse',
      'Rate limit: recent submission within 10min window',
      coalesce(nullif(v_email, ''), 'unknown'),
      format(
        'Source IP: %s',
        coalesce(p_source_ip::text, 'unknown')
      )
    );

    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  v_score := case v_urgency
    when 'General inquiry' then 20
    when 'Proactive survey preparation' then 40
    when 'Corrective action support' then 75
    when 'Operational concern' then 55
    when 'Leadership support' then 60
    when 'Regulatory issue' then 80
    when 'Urgent assistance requested' then 95
    else 30
  end;

  if nullif(btrim(p_payload ->> 'service_needed'), '') is not null then
    v_score := v_score + 8;
  end if;

  if coalesce(p_payload ->> 'number_of_facilities', '') ~* '(multi|several|[0-9]+)' then
    v_score := v_score + 7;
  end if;

  v_score := least(100, v_score);
  v_tier := case
    when v_score >= 80 then 'Tier 1'
    when v_score >= 60 then 'Tier 2'
    when v_score >= 40 then 'Tier 3'
    else 'Nurture'
  end;

  insert into public.consultation_requests (
    name,
    organization,
    title,
    business_email,
    business_phone,
    facility_or_org_name,
    state,
    number_of_facilities,
    service_needed,
    current_challenge,
    urgency_level,
    preferred_contact_method,
    preferred_consultation_time,
    consent_acknowledged,
    source_page,
    source_ip,
    campaign,
    lead_score,
    lead_tier,
    status,
    created_date,
    updated_date
  )
  values (
    v_name,
    nullif(btrim(p_payload ->> 'organization'), ''),
    nullif(btrim(p_payload ->> 'title'), ''),
    v_email,
    nullif(btrim(p_payload ->> 'business_phone'), ''),
    nullif(btrim(p_payload ->> 'facility_or_org_name'), ''),
    nullif(btrim(p_payload ->> 'state'), ''),
    nullif(btrim(p_payload ->> 'number_of_facilities'), ''),
    nullif(btrim(p_payload ->> 'service_needed'), ''),
    nullif(btrim(p_payload ->> 'current_challenge'), ''),
    v_urgency,
    nullif(btrim(p_payload ->> 'preferred_contact_method'), ''),
    nullif(btrim(p_payload ->> 'preferred_consultation_time'), ''),
    true,
    v_source_page,
    p_source_ip,
    nullif(btrim(p_payload ->> 'campaign'), ''),
    v_score,
    v_tier,
    'New',
    v_now,
    v_now
  )
  returning id into v_consultation_id;

  v_first_name := split_part(v_name, ' ', 1);
  v_last_name := btrim(substr(v_name, char_length(v_first_name) + 1));

  begin
    select contact.id
      into v_existing_contact_id
    from public.contacts as contact
    where contact.business_email_normalized = v_email
    limit 1;

    if v_existing_contact_id is not null then
      v_contact_match_method := 'existing_email_match';
    end if;

    insert into public.contacts (
      first_name,
      last_name,
      title,
      organization_name,
      business_email,
      business_phone,
      contact_confidence,
      inferred,
      notes
    )
    values (
      v_first_name,
      v_last_name,
      nullif(btrim(p_payload ->> 'title'), ''),
      coalesce(
        nullif(btrim(p_payload ->> 'organization'), ''),
        nullif(btrim(p_payload ->> 'facility_or_org_name'), '')
      ),
      v_email,
      nullif(btrim(p_payload ->> 'business_phone'), ''),
      100,
      false,
      format(
        'Inbound consultation request. Urgency: %s. State: %s.',
        v_urgency,
        coalesce(nullif(btrim(p_payload ->> 'state'), ''), '—')
      )
    )
    on conflict (business_email_normalized)
      where business_email_normalized is not null
    do update
      set title = coalesce(excluded.title, contacts.title),
          organization_name = coalesce(
            excluded.organization_name,
            contacts.organization_name
          ),
          business_email = excluded.business_email,
          business_phone = coalesce(
            excluded.business_phone,
            contacts.business_phone
          ),
          contact_confidence = 100,
          notes = concat_ws(
            E'\n',
            nullif(contacts.notes, ''),
            format(
              'New consultation request — %s. State: %s.',
              v_urgency,
              coalesce(nullif(btrim(p_payload ->> 'state'), ''), '—')
            )
          )
    returning id into v_contact_id;
  exception
    when others then
      get stacked diagnostics v_error = message_text;
      v_contact_id := null;
      v_contact_match_method := 'unavailable';

      insert into public.automation_logs (
        automation,
        started,
        completed,
        status,
        records_processed,
        errors,
        affected_record_ids,
        triggered_by,
        reason
      )
      values (
        'Consultation Intake Fan-out',
        v_now,
        clock_timestamp(),
        'Partial',
        0,
        left(v_error, 4000),
        array[v_consultation_id],
        'submitConsultation',
        'Contact upsert failed'
      );
  end;

  begin
    insert into public.opportunities (
      opportunity_name,
      facility_name,
      organization_name,
      primary_contact_id,
      primary_contact_name,
      stage,
      estimated_value,
      probability,
      service_interest,
      source,
      lead_tier
    )
    values (
      format(
        '%s — %s',
        coalesce(
          nullif(btrim(p_payload ->> 'organization'), ''),
          nullif(btrim(p_payload ->> 'facility_or_org_name'), ''),
          v_name
        ),
        coalesce(
          nullif(btrim(p_payload ->> 'service_needed'), ''),
          'Consultation'
        )
      ),
      nullif(btrim(p_payload ->> 'facility_or_org_name'), ''),
      nullif(btrim(p_payload ->> 'organization'), ''),
      v_contact_id,
      v_name,
      'New',
      0,
      v_score::numeric / 100,
      nullif(btrim(p_payload ->> 'service_needed'), ''),
      'Website Contact Form',
      v_tier
    )
    returning id into v_opportunity_id;
  exception
    when others then
      get stacked diagnostics v_error = message_text;
      v_opportunity_id := null;

      insert into public.automation_logs (
        automation,
        started,
        completed,
        status,
        records_processed,
        errors,
        affected_record_ids,
        triggered_by,
        reason
      )
      values (
        'Consultation Intake Fan-out',
        v_now,
        clock_timestamp(),
        'Partial',
        0,
        left(v_error, 4000),
        array_remove(array[v_consultation_id, v_contact_id], null),
        'submitConsultation',
        'Opportunity creation failed'
      );
  end;

  begin
    insert into public.interactions (
      interaction_type,
      direction,
      contact_id,
      contact_name,
      facility_name,
      opportunity_id,
      summary,
      next_step,
      "date"
    )
    values (
      'Inbound Form',
      'Inbound',
      v_contact_id,
      v_name,
      nullif(btrim(p_payload ->> 'facility_or_org_name'), ''),
      v_opportunity_id,
      format(
        'Inbound consultation request — %s. Challenge: %s. Service: %s.',
        v_urgency,
        coalesce(
          nullif(btrim(p_payload ->> 'current_challenge'), ''),
          'Not specified'
        ),
        coalesce(
          nullif(btrim(p_payload ->> 'service_needed'), ''),
          'Not specified'
        )
      ),
      'Acknowledge request and offer consultation scheduling.',
      v_now
    );
  exception
    when others then
      get stacked diagnostics v_error = message_text;

      insert into public.automation_logs (
        automation,
        started,
        completed,
        status,
        records_processed,
        errors,
        affected_record_ids,
        triggered_by,
        reason
      )
      values (
        'Consultation Intake Fan-out',
        v_now,
        clock_timestamp(),
        'Partial',
        0,
        left(v_error, 4000),
        array_remove(
          array[v_consultation_id, v_contact_id, v_opportunity_id],
          null
        ),
        'submitConsultation',
        'Interaction creation failed'
      );
  end;

  begin
    insert into public.tasks (
      workstream,
      task,
      start_date,
      due_date,
      priority,
      status,
      notes,
      linked_opportunity_id
    )
    values (
      'Business Development',
      format(
        'Follow up with %s (%s) — %s',
        v_name,
        coalesce(
          nullif(btrim(p_payload ->> 'organization'), ''),
          nullif(btrim(p_payload ->> 'facility_or_org_name'), ''),
          '—'
        ),
        v_urgency
      ),
      v_now::date,
      v_now::date + 1,
      case v_tier
        when 'Tier 1' then 'Urgent'
        when 'Tier 2' then 'High'
        else 'Medium'
      end,
      'Not Started',
      format(
        'Inbound consultation request. Preferred contact: %s. Preferred time: %s. Contact match: %s.',
        coalesce(
          nullif(btrim(p_payload ->> 'preferred_contact_method'), ''),
          '—'
        ),
        coalesce(
          nullif(btrim(p_payload ->> 'preferred_consultation_time'), ''),
          'Not specified'
        ),
        v_contact_match_method
      ),
      v_opportunity_id
    );
  exception
    when others then
      get stacked diagnostics v_error = message_text;

      insert into public.automation_logs (
        automation,
        started,
        completed,
        status,
        records_processed,
        errors,
        affected_record_ids,
        triggered_by,
        reason
      )
      values (
        'Consultation Intake Fan-out',
        v_now,
        clock_timestamp(),
        'Partial',
        0,
        left(v_error, 4000),
        array_remove(
          array[v_consultation_id, v_contact_id, v_opportunity_id],
          null
        ),
        'submitConsultation',
        'Follow-up task creation failed'
      );
  end;

  update public.consultation_requests
  set created_contact_id = v_contact_id,
      created_opportunity_id = v_opportunity_id
  where id = v_consultation_id;

  return jsonb_build_object(
    'ok', true,
    'consultation_id', v_consultation_id,
    'contact_id', v_contact_id,
    'opportunity_id', v_opportunity_id,
    'contact_match_method', v_contact_match_method
  );
end;
$function$;

revoke all on function public.ingest_consultation(jsonb, inet)
  from public, anon, authenticated;
grant execute on function public.ingest_consultation(jsonb, inet)
  to service_role;

comment on function public.ingest_consultation(jsonb, inet) is
  'Server-only public consultation intake with rate limiting and transactional CRM fan-out.';

commit;

