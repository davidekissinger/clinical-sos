-- Recovered from applied Supabase migration history on 2026-10-04.
begin;

-- Serialize engagement creation at both the application and database layers.
-- The RPC also locks the Opportunity row, so concurrent retries are idempotent.
create unique index if not exists engagements_one_per_opportunity_idx
  on public.engagements (opportunity_id)
  where opportunity_id is not null;

create or replace function public.clinical_transition_poc(
  p_actor_id uuid,
  p_poc_id text,
  p_action text,
  p_evidence text default null,
  p_revision_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_actor_role public.app_role;
  v_actor_name text;
  v_poc public.pocs%rowtype;
  v_new_status text;
  v_now timestamptz := now();
begin
  select profile.role,
         coalesce(nullif(btrim(profile.full_name), ''), nullif(btrim(profile.email), ''), 'Unknown')
    into v_actor_role, v_actor_name
  from public.profiles as profile
  where profile.id = p_actor_id;

  if not found or v_actor_role not in ('admin'::public.app_role, 'clinical'::public.app_role) then
    return jsonb_build_object(
      '_http_status', 403,
      'error', format('Access denied — role %L is not permitted for this operation.', coalesce(v_actor_role::text, 'unknown'))
    );
  end if;

  if nullif(btrim(coalesce(p_poc_id, '')), '') is null then
    return jsonb_build_object('_http_status', 400, 'error', 'poc_id is required');
  end if;
  if nullif(btrim(coalesce(p_action, '')), '') is null then
    return jsonb_build_object('_http_status', 400, 'error', 'action is required');
  end if;

  select * into v_poc
  from public.pocs
  where id = p_poc_id
  for update;

  if not found then
    return jsonb_build_object('_http_status', 404, 'error', 'POC not found');
  end if;

  case p_action
    when 'submit_for_clinical_review' then
      v_new_status := 'Clinical Review';
      if v_poc.status <> 'AI Draft' then
        return jsonb_build_object(
          '_http_status', 400,
          'error', format('Invalid transition: POC is in %L but action %L requires %L', v_poc.status, p_action, 'AI Draft'),
          'status', 'invalid_transition'
        );
      end if;
      update public.pocs
        set status = v_new_status,
            reviewed_by = v_actor_name
        where id = p_poc_id;

    when 'approve_for_use' then
      v_new_status := 'Approved for Use';
      if v_poc.status <> 'Clinical Review' then
        return jsonb_build_object(
          '_http_status', 400,
          'error', format('Invalid transition: POC is in %L but action %L requires %L', v_poc.status, p_action, 'Clinical Review'),
          'status', 'invalid_transition'
        );
      end if;
      update public.pocs
        set status = v_new_status,
            clinical_approved_by = v_actor_name
        where id = p_poc_id;

    when 'send_to_client_review' then
      v_new_status := 'Client Review';
      if v_poc.status <> 'Clinical Review' then
        return jsonb_build_object(
          '_http_status', 400,
          'error', format('Invalid transition: POC is in %L but action %L requires %L', v_poc.status, p_action, 'Clinical Review'),
          'status', 'invalid_transition'
        );
      end if;
      update public.pocs
        set status = v_new_status,
            clinical_approved_by = v_actor_name,
            reviewed_by = v_actor_name
        where id = p_poc_id;

    when 'return_to_clinical_review' then
      v_new_status := 'Clinical Review';
      if v_poc.status <> 'Client Review' then
        return jsonb_build_object(
          '_http_status', 400,
          'error', format('Invalid transition: POC is in %L but action %L requires %L', v_poc.status, p_action, 'Client Review'),
          'status', 'invalid_transition'
        );
      end if;
      update public.pocs
        set status = v_new_status,
            client_reviewed_by = v_actor_name
        where id = p_poc_id;

    when 'approve_from_client_review' then
      v_new_status := 'Approved for Use';
      if v_poc.status <> 'Client Review' then
        return jsonb_build_object(
          '_http_status', 400,
          'error', format('Invalid transition: POC is in %L but action %L requires %L', v_poc.status, p_action, 'Client Review'),
          'status', 'invalid_transition'
        );
      end if;
      update public.pocs
        set status = v_new_status,
            client_reviewed_by = v_actor_name,
            clinical_approved_by = v_actor_name
        where id = p_poc_id;

    when 'return_for_revision' then
      v_new_status := 'Revision Requested';
      update public.pocs
        set status = v_new_status,
            revision_requested_date = v_now,
            revision_notes = coalesce(nullif(btrim(p_revision_notes), ''), 'Revision requested by reviewer'),
            reviewed_by = v_actor_name
        where id = p_poc_id;

    when 'submit_poc' then
      v_new_status := 'Submitted';
      if v_poc.status <> 'Approved for Use' then
        return jsonb_build_object(
          '_http_status', 400,
          'error', format('Invalid transition: POC is in %L but action %L requires %L', v_poc.status, p_action, 'Approved for Use'),
          'status', 'invalid_transition'
        );
      end if;
      if nullif(btrim(coalesce(p_evidence, '')), '') is null then
        return jsonb_build_object(
          '_http_status', 400,
          'error', 'submit_poc requires evidence/source confirmation',
          'status', 'evidence_required'
        );
      end if;
      update public.pocs
        set status = v_new_status,
            submitted_by = v_actor_name,
            submitted_date = v_now,
            submission_source = p_evidence
        where id = p_poc_id;

    when 'record_acceptance' then
      v_new_status := 'Accepted';
      if v_poc.status <> 'Submitted' then
        return jsonb_build_object(
          '_http_status', 400,
          'error', format('Invalid transition: POC is in %L but action %L requires %L', v_poc.status, p_action, 'Submitted'),
          'status', 'invalid_transition'
        );
      end if;
      if nullif(btrim(coalesce(p_evidence, '')), '') is null then
        return jsonb_build_object(
          '_http_status', 400,
          'error', 'record_acceptance requires evidence/source confirmation',
          'status', 'evidence_required'
        );
      end if;
      update public.pocs
        set status = v_new_status,
            accepted_by = v_actor_name,
            accepted_date = v_now,
            acceptance_source = p_evidence
        where id = p_poc_id;

    when 'supersede' then
      v_new_status := 'Superseded';
      update public.pocs
        set status = 'Superseded',
            superseded_by_version = v_poc.version + 1
        where deficiency_id = v_poc.deficiency_id
          and status <> 'Superseded';

    else
      return jsonb_build_object('_http_status', 400, 'error', format('Unknown action: %s', p_action));
  end case;

  insert into public.automation_logs (
    automation,
    started,
    completed,
    status,
    records_processed,
    affected_record_ids,
    triggered_by,
    acting_profile_id,
    client_account_id,
    errors
  ) values (
    format('POC Lifecycle Transition: %s', p_action),
    v_now,
    v_now,
    'Success',
    1,
    array[p_poc_id],
    v_actor_name,
    p_actor_id,
    v_poc.client_account_id,
    format(
      'POC v%s transitioned from %s to %s. User: %s. Evidence: %s',
      v_poc.version,
      v_poc.status,
      v_new_status,
      v_actor_name,
      coalesce(nullif(btrim(p_evidence), ''), 'N/A')
    )
  );

  return jsonb_build_object(
    'ok', true,
    'poc_id', p_poc_id,
    'previous_status', v_poc.status,
    'new_status', v_new_status,
    'action', p_action,
    'performed_by', v_actor_name
  );
end;
$function$;

create or replace function public.clinical_create_engagement_from_opportunity(
  p_actor_id uuid,
  p_opportunity_id text,
  p_service_type text,
  p_start_date date,
  p_clinical_lead_name text,
  p_engagement_model text,
  p_clinical_lead_id text default null,
  p_accepted_proposal_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_actor_role public.app_role;
  v_actor_name text;
  v_opportunity public.opportunities%rowtype;
  v_proposal public.proposals%rowtype;
  v_existing public.engagements%rowtype;
  v_engagement public.engagements%rowtype;
  v_engagement_name text;
  v_client_name text;
  v_is_test_data boolean;
  v_now timestamptz := now();
begin
  select profile.role,
         coalesce(nullif(btrim(profile.full_name), ''), nullif(btrim(profile.email), ''), 'Unknown')
    into v_actor_role, v_actor_name
  from public.profiles as profile
  where profile.id = p_actor_id;

  if not found or v_actor_role not in (
    'admin'::public.app_role,
    'business_development'::public.app_role,
    'clinical'::public.app_role
  ) then
    return jsonb_build_object(
      '_http_status', 403,
      'error', format('Access denied — role %L is not permitted for this operation.', coalesce(v_actor_role::text, 'unknown'))
    );
  end if;

  if nullif(btrim(coalesce(p_opportunity_id, '')), '') is null then
    return jsonb_build_object('_http_status', 400, 'error', 'opportunity_id is required');
  end if;
  if nullif(btrim(coalesce(p_service_type, '')), '') is null then
    return jsonb_build_object('_http_status', 400, 'error', 'service_type is required');
  end if;
  if p_start_date is null then
    return jsonb_build_object('_http_status', 400, 'error', 'start_date is required');
  end if;
  if nullif(btrim(coalesce(p_engagement_model, '')), '') is null then
    return jsonb_build_object('_http_status', 400, 'error', 'engagement_model is required');
  end if;
  if nullif(btrim(coalesce(p_clinical_lead_name, '')), '') is null then
    return jsonb_build_object(
      '_http_status', 400,
      'error', 'clinical_lead_name is required (or "To be assigned")',
      'status', 'missing_clinical_lead'
    );
  end if;
  if p_engagement_model not in ('Fixed Fee', 'Hourly', 'Time and Expense', 'Hybrid') then
    return jsonb_build_object(
      '_http_status', 400,
      'error', 'Invalid engagement_model. Allowed: Fixed Fee, Hourly, Time and Expense, Hybrid'
    );
  end if;

  select * into v_opportunity
  from public.opportunities
  where id = p_opportunity_id
  for update;

  if not found then
    return jsonb_build_object('_http_status', 404, 'error', 'Opportunity not found');
  end if;

  if p_accepted_proposal_id is not null then
    select * into v_proposal
    from public.proposals
    where id = p_accepted_proposal_id
    for update;

    if not found then
      return jsonb_build_object('_http_status', 400, 'error', 'Referenced proposal not found');
    end if;
    if v_proposal.opportunity_id is not null
       and v_proposal.opportunity_id <> p_opportunity_id then
      return jsonb_build_object(
        '_http_status', 400,
        'error', 'Proposal does not belong to this opportunity — linkage rejected'
      );
    end if;
  end if;

  select * into v_existing
  from public.engagements
  where opportunity_id = p_opportunity_id
  order by created_date, id
  limit 1
  for update;

  if found then
    if v_opportunity.stage <> 'Won' then
      update public.opportunities set stage = 'Won' where id = p_opportunity_id;
    end if;

    insert into public.automation_logs (
      automation, started, completed, status, records_processed,
      affected_record_ids, triggered_by, acting_profile_id, client_account_id, errors
    ) values (
      'Won → Engagement Creation (Duplicate Prevention)',
      v_now,
      v_now,
      'Success',
      1,
      array[p_opportunity_id, v_existing.id],
      v_actor_name,
      p_actor_id,
      v_existing.client_account_id,
      format(
        'Engagement already exists for opportunity — no duplicate created. Existing engagement: %s',
        v_existing.engagement_name
      )
    );

    return jsonb_build_object(
      'ok', true,
      'engagement_id', v_existing.id,
      'engagement_name', v_existing.engagement_name,
      'duplicate', true,
      'message', 'Engagement already exists for this opportunity — no duplicate created. Linkage preserved.'
    );
  end if;

  select coalesce(v_opportunity.is_test_data, false)
         or coalesce((
           select facility.is_test_data
           from public.facilities as facility
           where facility.id = v_opportunity.facility_id
         ), false)
    into v_is_test_data;

  v_engagement_name := format(
    '%s — %s',
    coalesce(
      nullif(btrim(v_opportunity.organization_name), ''),
      nullif(btrim(v_opportunity.facility_name), ''),
      v_opportunity.opportunity_name
    ),
    p_service_type
  );
  v_client_name := coalesce(
    nullif(btrim(v_opportunity.organization_name), ''),
    nullif(btrim(v_opportunity.facility_name), ''),
    nullif(btrim(v_opportunity.primary_contact_name), '')
  );

  insert into public.engagements (
    engagement_name,
    client_name,
    organization_id,
    organization_name,
    facility_id,
    facility_name,
    opportunity_id,
    start_date,
    service_type,
    phase,
    engagement_model,
    accepted_proposal_id,
    accepted_proposal_name,
    clinical_lead_id,
    clinical_lead_name,
    status,
    is_test_data,
    created_by,
    created_by_id
  ) values (
    v_engagement_name,
    v_client_name,
    v_opportunity.organization_id,
    v_opportunity.organization_name,
    v_opportunity.facility_id,
    v_opportunity.facility_name,
    p_opportunity_id,
    p_start_date,
    p_service_type,
    'Phase 1 — Initial Assessment',
    p_engagement_model,
    p_accepted_proposal_id,
    case when p_accepted_proposal_id is not null then v_proposal.proposal_name else null end,
    p_clinical_lead_id,
    p_clinical_lead_name,
    'Active',
    v_is_test_data,
    v_actor_name,
    p_actor_id::text
  ) returning * into v_engagement;

  update public.opportunities
    set stage = 'Won'
    where id = p_opportunity_id;

  if p_accepted_proposal_id is not null then
    update public.proposals
      set acceptance_status = 'Accepted',
          status = 'Accepted'
      where id = p_accepted_proposal_id;
  end if;

  insert into public.automation_logs (
    automation, started, completed, status, records_processed,
    affected_record_ids, triggered_by, acting_profile_id, client_account_id, errors
  ) values (
    'Won → Engagement Creation',
    v_now,
    v_now,
    'Success',
    2,
    array[p_opportunity_id, v_engagement.id],
    v_actor_name,
    p_actor_id,
    v_engagement.client_account_id,
    format(
      'Opportunity marked Won. Engagement created: %s. Model: %s.',
      v_engagement_name,
      p_engagement_model
    )
  );

  return jsonb_build_object(
    'ok', true,
    'engagement_id', v_engagement.id,
    'engagement_name', v_engagement_name,
    'duplicate', false,
    'opportunity_stage', 'Won'
  );
end;
$function$;

create or replace function public.clinical_save_generated_work_product(
  p_actor_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_actor_role public.app_role;
  v_actor_name text;
  v_now timestamptz := now();
  v_work_product_id text;
  v_content text;
  v_document_type text;
  v_poc_id text;
  v_deficiency_id text;
  v_case_id text;
  v_facility_id text;
  v_knowledge_id text;
  v_engagement_id text;
  v_source_fields text[] := array[]::text[];
  v_source_ids text[] := array[]::text[];
  v_expected timestamptz;
  v_actual timestamptz;
begin
  select profile.role,
         coalesce(nullif(btrim(profile.full_name), ''), nullif(btrim(profile.email), ''), 'Unknown')
    into v_actor_role, v_actor_name
  from public.profiles as profile
  where profile.id = p_actor_id;

  if not found or v_actor_role not in ('admin'::public.app_role, 'clinical'::public.app_role) then
    return jsonb_build_object(
      '_http_status', 403,
      'error', format('Access denied — role %L is not permitted for this operation.', coalesce(v_actor_role::text, 'unknown'))
    );
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('_http_status', 400, 'error', 'Work product payload is invalid');
  end if;

  v_content := p_payload ->> 'content';
  v_document_type := p_payload ->> 'document_type';
  v_poc_id := nullif(p_payload ->> 'poc_id', '');
  v_deficiency_id := nullif(p_payload ->> 'deficiency_id', '');
  v_case_id := nullif(p_payload ->> 'regulatory_case_id', '');
  v_facility_id := nullif(p_payload ->> 'facility_id', '');
  v_engagement_id := nullif(p_payload ->> 'engagement_id', '');
  v_knowledge_id := nullif(p_payload #>> '{source_versions,regulatory_knowledge,id}', '');

  if nullif(btrim(coalesce(v_document_type, '')), '') is null then
    return jsonb_build_object('_http_status', 400, 'error', 'document_type is required');
  end if;
  if nullif(btrim(coalesce(v_content, '')), '') is null or char_length(v_content) > 200000 then
    return jsonb_build_object('_http_status', 400, 'error', 'Generated content is invalid');
  end if;

  -- Lock and compare every source version. AI generation runs outside the
  -- transaction, so stale output is rejected rather than saved against data
  -- that changed while the model request was in flight.
  if p_payload #>> '{source_versions,poc,id}' is not null then
    begin
      v_expected := (p_payload #>> '{source_versions,poc,updated_date}')::timestamptz;
    exception when others then
      return jsonb_build_object('_http_status', 400, 'error', 'Source version is invalid');
    end;
    select updated_date into v_actual
    from public.pocs
    where id = p_payload #>> '{source_versions,poc,id}'
    for share;
    if not found or v_actual is distinct from v_expected then
      return jsonb_build_object('_http_status', 409, 'error', 'Source records changed during generation. Please retry.', 'status', 'source_changed');
    end if;
  end if;

  if p_payload #>> '{source_versions,deficiency,id}' is not null then
    begin
      v_expected := (p_payload #>> '{source_versions,deficiency,updated_date}')::timestamptz;
    exception when others then
      return jsonb_build_object('_http_status', 400, 'error', 'Source version is invalid');
    end;
    select updated_date into v_actual
    from public.deficiencies
    where id = p_payload #>> '{source_versions,deficiency,id}'
    for share;
    if not found or v_actual is distinct from v_expected then
      return jsonb_build_object('_http_status', 409, 'error', 'Source records changed during generation. Please retry.', 'status', 'source_changed');
    end if;
  end if;

  if p_payload #>> '{source_versions,regulatory_case,id}' is not null then
    begin
      v_expected := (p_payload #>> '{source_versions,regulatory_case,updated_date}')::timestamptz;
    exception when others then
      return jsonb_build_object('_http_status', 400, 'error', 'Source version is invalid');
    end;
    select updated_date into v_actual
    from public.regulatory_cases
    where id = p_payload #>> '{source_versions,regulatory_case,id}'
    for share;
    if not found or v_actual is distinct from v_expected then
      return jsonb_build_object('_http_status', 409, 'error', 'Source records changed during generation. Please retry.', 'status', 'source_changed');
    end if;
  end if;

  if p_payload #>> '{source_versions,facility,id}' is not null then
    begin
      v_expected := (p_payload #>> '{source_versions,facility,updated_date}')::timestamptz;
    exception when others then
      return jsonb_build_object('_http_status', 400, 'error', 'Source version is invalid');
    end;
    select updated_date into v_actual
    from public.facilities
    where id = p_payload #>> '{source_versions,facility,id}'
    for share;
    if not found or v_actual is distinct from v_expected then
      return jsonb_build_object('_http_status', 409, 'error', 'Source records changed during generation. Please retry.', 'status', 'source_changed');
    end if;
  end if;

  if v_knowledge_id is not null then
    begin
      v_expected := (p_payload #>> '{source_versions,regulatory_knowledge,updated_date}')::timestamptz;
    exception when others then
      return jsonb_build_object('_http_status', 400, 'error', 'Source version is invalid');
    end;
    select updated_date into v_actual
    from public.regulatory_knowledge
    where id = v_knowledge_id
    for share;
    if not found or v_actual is distinct from v_expected then
      return jsonb_build_object('_http_status', 409, 'error', 'Source records changed during generation. Please retry.', 'status', 'source_changed');
    end if;
  end if;

  if p_payload #>> '{source_versions,engagement,id}' is not null then
    begin
      v_expected := (p_payload #>> '{source_versions,engagement,updated_date}')::timestamptz;
    exception when others then
      return jsonb_build_object('_http_status', 400, 'error', 'Source version is invalid');
    end;
    select updated_date into v_actual
    from public.engagements
    where id = p_payload #>> '{source_versions,engagement,id}'
    for share;
    if not found or v_actual is distinct from v_expected then
      return jsonb_build_object('_http_status', 409, 'error', 'Source records changed during generation. Please retry.', 'status', 'source_changed');
    end if;
  end if;

  if jsonb_typeof(p_payload -> 'source_fields_used') = 'array' then
    select coalesce(array_agg(value), array[]::text[])
      into v_source_fields
    from jsonb_array_elements_text(p_payload -> 'source_fields_used') as fields(value);
  end if;
  if jsonb_typeof(p_payload -> 'source_record_ids') = 'array' then
    select coalesce(array_agg(value), array[]::text[])
      into v_source_ids
    from jsonb_array_elements_text(p_payload -> 'source_record_ids') as ids(value);
  end if;

  insert into public.work_products (
    client_account_id,
    document_type,
    facility_id,
    facility_name,
    engagement_id,
    regulatory_case_id,
    regulatory_case_name,
    deficiency_id,
    deficiency_name,
    f_tag,
    poc_id,
    generation_date,
    document_status,
    preparer,
    version,
    content,
    source_snapshot,
    source_fields_used,
    source_record_ids,
    is_test_data,
    created_by,
    created_by_id
  ) values (
    nullif(p_payload ->> 'client_account_id', ''),
    v_document_type,
    v_facility_id,
    nullif(p_payload ->> 'facility_name', ''),
    v_engagement_id,
    v_case_id,
    nullif(p_payload ->> 'regulatory_case_name', ''),
    v_deficiency_id,
    nullif(p_payload ->> 'deficiency_name', ''),
    nullif(p_payload ->> 'f_tag', ''),
    v_poc_id,
    v_now,
    'DRAFT',
    v_actor_name,
    '1.0',
    v_content,
    p_payload ->> 'source_snapshot',
    v_source_fields,
    v_source_ids,
    coalesce((p_payload ->> 'is_test_data')::boolean, false),
    v_actor_name,
    p_actor_id::text
  ) returning id into v_work_product_id;

  if v_poc_id is not null then
    update public.pocs
      set generated_narrative = v_content
      where id = v_poc_id;
    if not found then
      raise exception using errcode = 'foreign_key_violation', message = 'POC disappeared while saving work product';
    end if;
  end if;

  insert into public.automation_logs (
    automation, started, completed, status, records_processed,
    affected_record_ids, triggered_by, acting_profile_id, client_account_id
  ) values (
    'Work Product Generation',
    v_now,
    v_now,
    'Success',
    1,
    array[v_work_product_id],
    v_actor_name,
    p_actor_id,
    nullif(p_payload ->> 'client_account_id', '')
  );

  return jsonb_build_object(
    'ok', true,
    'work_product_id', v_work_product_id,
    'document_type', v_document_type,
    'document_status', 'DRAFT',
    'content', v_content,
    'is_test_data', coalesce((p_payload ->> 'is_test_data')::boolean, false),
    'poc_id', v_poc_id,
    'source_record_ids', to_jsonb(v_source_ids),
    'source_fields_used', to_jsonb(v_source_fields),
    'hallucination_warning', false,
    'validation_passed', true,
    'generated_at', to_jsonb(v_now)
  );
end;
$function$;

create or replace function public.clinical_update_revisit_readiness(
  p_actor_id uuid,
  p_deficiency_id text,
  p_manual_criteria jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_actor_role public.app_role;
  v_actor_name text;
  v_deficiency public.deficiencies%rowtype;
  v_criteria jsonb := '[]'::jsonb;
  v_public_criteria jsonb;
  v_education_count integer;
  v_education_complete_count integer;
  v_competency_complete_count integer;
  v_audit_count integer;
  v_audit_complete_count integer;
  v_audit_pass_count integer;
  v_failed_audit_count integer;
  v_unresolved_failed_audit_count integer;
  v_evidence_count integer;
  v_evidence_complete_count integer;
  v_evidence_accepted_count integer;
  v_qapi_count integer;
  v_poc_count integer;
  v_poc_approved_count integer;
  v_met_count integer;
  v_blocking_count integer;
  v_blocking_met_count integer;
  v_total_count integer;
  v_score integer;
  v_status text;
  v_all_blocking_met boolean;
  v_breakdown text;
  v_explanation text;
  v_now timestamptz := now();
  v_staff_interview boolean;
  v_record_review boolean;
  v_environmental boolean;
begin
  select profile.role,
         coalesce(nullif(btrim(profile.full_name), ''), nullif(btrim(profile.email), ''), 'Unknown')
    into v_actor_role, v_actor_name
  from public.profiles as profile
  where profile.id = p_actor_id;

  if not found or v_actor_role not in ('admin'::public.app_role, 'clinical'::public.app_role) then
    return jsonb_build_object(
      '_http_status', 403,
      'error', format('Access denied — role %L is not permitted for this operation.', coalesce(v_actor_role::text, 'unknown'))
    );
  end if;

  if nullif(btrim(coalesce(p_deficiency_id, '')), '') is null then
    return jsonb_build_object('_http_status', 400, 'error', 'deficiency_id is required');
  end if;
  if p_manual_criteria is null or jsonb_typeof(p_manual_criteria) <> 'object' then
    return jsonb_build_object('_http_status', 400, 'error', 'manual_criteria must be an object');
  end if;

  select * into v_deficiency
  from public.deficiencies
  where id = p_deficiency_id
  for update;

  if not found then
    return jsonb_build_object('_http_status', 404, 'error', 'Deficiency not found');
  end if;

  select count(*),
         count(*) filter (where education_status in ('Completed', 'Competency Completed')),
         count(*) filter (where education_status = 'Competency Completed')
    into v_education_count, v_education_complete_count, v_competency_complete_count
  from public.education_plans
  where deficiency_id = p_deficiency_id;

  select count(*),
         count(*) filter (where audit_result in ('Pass', 'Immediate Correction Completed')),
         count(*) filter (where audit_result = 'Pass'),
         count(*) filter (where audit_result = 'Failed'),
         count(*) filter (
           where audit_result = 'Failed'
             and nullif(btrim(coalesce(what_was_corrected, '')), '') is null
         )
    into v_audit_count, v_audit_complete_count, v_audit_pass_count,
         v_failed_audit_count, v_unresolved_failed_audit_count
  from public.audit_tools
  where deficiency_id = p_deficiency_id;

  select count(*),
         count(*) filter (where review_status in ('Accepted', 'Not Applicable')),
         count(*) filter (where review_status = 'Accepted')
    into v_evidence_count, v_evidence_complete_count, v_evidence_accepted_count
  from public.evidence_items
  where deficiency_id = p_deficiency_id;

  select count(*) into v_qapi_count
  from public.qapi_reviews
  where deficiency_id = p_deficiency_id;

  select count(*),
         count(*) filter (where status in ('Approved for Use', 'Submitted', 'Accepted'))
    into v_poc_count, v_poc_approved_count
  from public.pocs
  where deficiency_id = p_deficiency_id;

  v_staff_interview := coalesce((p_manual_criteria -> 'staff_interview') = 'true'::jsonb, false);
  v_record_review := coalesce((p_manual_criteria -> 'record_review') = 'true'::jsonb, false);
  v_environmental := coalesce((p_manual_criteria -> 'environmental') = 'true'::jsonb, false);

  v_criteria := v_criteria || jsonb_build_array(jsonb_build_object(
    'criterion_label', 'Resident-specific correction complete',
    'criterion_key', 'resident_correction',
    'derivation_source', 'Automatic',
    'is_met', nullif(btrim(coalesce(v_deficiency.immediate_correction, '')), '') is not null,
    'evidence_summary', case
      when nullif(btrim(coalesce(v_deficiency.immediate_correction, '')), '') is not null
        then 'Documented in deficiency.immediate_correction'
      else 'Not documented — No immediate correction recorded'
    end,
    'blocks_readiness', true
  ));

  v_criteria := v_criteria || jsonb_build_array(jsonb_build_object(
    'criterion_label', 'Affected universe review complete',
    'criterion_key', 'universe_review',
    'derivation_source', 'Automatic',
    'is_met', nullif(btrim(coalesce(v_deficiency.potentially_affected_population, '')), '') is not null,
    'evidence_summary', case
      when nullif(btrim(coalesce(v_deficiency.potentially_affected_population, '')), '') is not null
        then 'Documented in deficiency.potentially_affected_population'
      else 'Not documented — No universe review recorded'
    end,
    'blocks_readiness', true
  ));

  v_criteria := v_criteria || jsonb_build_array(jsonb_build_object(
    'criterion_label', 'Systemic changes implemented',
    'criterion_key', 'systemic_changes',
    'derivation_source', 'Automatic',
    'is_met', nullif(btrim(coalesce(v_deficiency.systemic_correction, '')), '') is not null,
    'evidence_summary', case
      when nullif(btrim(coalesce(v_deficiency.systemic_correction, '')), '') is not null
        then 'Documented in deficiency.systemic_correction'
      else 'Not documented — No systemic correction recorded'
    end,
    'blocks_readiness', true
  ));

  v_criteria := v_criteria || jsonb_build_array(jsonb_build_object(
    'criterion_label', 'Education complete',
    'criterion_key', 'education_complete',
    'derivation_source', 'Automatic',
    'is_met', v_education_count > 0 and v_education_complete_count = v_education_count,
    'evidence_summary', case
      when v_education_count > 0
        then format('%s plan(s), %s complete', v_education_count, v_education_complete_count)
      else 'Not Assessed — No education plans on record. Education is required for corrective action.'
    end,
    'blocks_readiness', true
  ));

  v_criteria := v_criteria || jsonb_build_array(jsonb_build_object(
    'criterion_label', 'Competencies complete',
    'criterion_key', 'competencies',
    'derivation_source', 'Automatic',
    'is_met', v_education_count > 0 and v_competency_complete_count = v_education_count,
    'evidence_summary', case
      when v_education_count > 0
        then format('%s/%s competency completed', v_competency_complete_count, v_education_count)
      else 'Not Assessed — No education plans on record. Competency validation is required.'
    end,
    'blocks_readiness', true
  ));

  v_criteria := v_criteria || jsonb_build_array(jsonb_build_object(
    'criterion_label', 'Required audits complete',
    'criterion_key', 'audits',
    'derivation_source', 'Automatic',
    'is_met', v_audit_count > 0 and v_audit_complete_count = v_audit_count,
    'evidence_summary', case
      when v_audit_count > 0
        then format('%s audit(s), %s passed', v_audit_count, v_audit_complete_count)
      else 'Not Assessed — No audits on record. Monitoring audits are required.'
    end,
    'blocks_readiness', true
  ));

  v_criteria := v_criteria || jsonb_build_array(jsonb_build_object(
    'criterion_label', 'Audit compliance acceptable',
    'criterion_key', 'audit_compliance',
    'derivation_source', 'Automatic',
    'is_met', v_audit_count > 0 and v_audit_complete_count = v_audit_count,
    'evidence_summary', case
      when v_audit_count > 0
        then format('%s/%s passed', v_audit_pass_count, v_audit_count)
      else 'Not Assessed — No audits on record. Audit compliance cannot be evaluated.'
    end,
    'blocks_readiness', true
  ));

  v_criteria := v_criteria || jsonb_build_array(jsonb_build_object(
    'criterion_label', 'Failed audits corrected',
    'criterion_key', 'failed_audits_corrected',
    'derivation_source', 'Automatic',
    'is_met', v_audit_count > 0 and v_unresolved_failed_audit_count = 0,
    'evidence_summary', case
      when v_audit_count = 0
        then 'Not Assessed — No audits on record. Cannot verify failed audit correction.'
      when v_failed_audit_count > 0
        then format('%s unresolved failed audit(s)', v_unresolved_failed_audit_count)
      else 'All failed audits corrected'
    end,
    'blocks_readiness', true
  ));

  v_criteria := v_criteria || jsonb_build_array(jsonb_build_object(
    'criterion_label', 'Evidence complete',
    'criterion_key', 'evidence',
    'derivation_source', 'Automatic',
    'is_met', v_evidence_count > 0 and v_evidence_complete_count = v_evidence_count,
    'evidence_summary', case
      when v_evidence_count > 0
        then format('%s/%s accepted', v_evidence_accepted_count, v_evidence_count)
      else 'Not Assessed — No evidence items on record. Evidence is required for corrective action.'
    end,
    'blocks_readiness', true
  ));

  v_criteria := v_criteria || jsonb_build_array(jsonb_build_object(
    'criterion_label', 'QAPI reviewed',
    'criterion_key', 'qapi',
    'derivation_source', 'Automatic',
    'is_met', v_qapi_count > 0,
    'evidence_summary', case
      when v_qapi_count > 0 then format('%s QAPI review(s)', v_qapi_count)
      else 'Not Assessed — No QAPI reviews on record. QAPI oversight is required.'
    end,
    'blocks_readiness', true
  ));

  v_criteria := v_criteria || jsonb_build_array(jsonb_build_object(
    'criterion_label', 'POC appropriately approved',
    'criterion_key', 'poc_approved',
    'derivation_source', 'Automatic',
    'is_met', v_poc_count > 0 and v_poc_approved_count > 0,
    'evidence_summary', case
      when v_poc_count > 0
        then format('%s/%s approved or submitted', v_poc_approved_count, v_poc_count)
      else 'Not Assessed — No POCs on record. An approved POC is required.'
    end,
    'blocks_readiness', true
  ));

  v_criteria := v_criteria || jsonb_build_array(jsonb_build_object(
    'criterion_label', 'Staff interview readiness',
    'criterion_key', 'staff_interview',
    'derivation_source', 'Manual',
    'is_met', v_staff_interview,
    'evidence_summary', case when v_staff_interview
      then 'Marked ready by clinical reviewer'
      else 'Not assessed — Clinical review required'
    end,
    'blocks_readiness', false,
    'manual_reviewer', v_actor_name
  ));

  v_criteria := v_criteria || jsonb_build_array(jsonb_build_object(
    'criterion_label', 'Record review readiness',
    'criterion_key', 'record_review',
    'derivation_source', 'Manual',
    'is_met', v_record_review,
    'evidence_summary', case when v_record_review
      then 'Marked ready by clinical reviewer'
      else 'Not assessed — Clinical review required'
    end,
    'blocks_readiness', false,
    'manual_reviewer', v_actor_name
  ));

  v_criteria := v_criteria || jsonb_build_array(jsonb_build_object(
    'criterion_label', 'Environmental readiness',
    'criterion_key', 'environmental',
    'derivation_source', 'Manual',
    'is_met', v_environmental,
    'evidence_summary', case when v_environmental
      then 'Marked ready by clinical reviewer'
      else 'Not assessed — Clinical review required'
    end,
    'blocks_readiness', false,
    'manual_reviewer', v_actor_name
  ));

  select count(*),
         count(*) filter (where (criterion ->> 'is_met')::boolean),
         count(*) filter (where (criterion ->> 'blocks_readiness')::boolean),
         count(*) filter (
           where (criterion ->> 'blocks_readiness')::boolean
             and (criterion ->> 'is_met')::boolean
         )
    into v_total_count, v_met_count, v_blocking_count, v_blocking_met_count
  from jsonb_array_elements(v_criteria) as items(criterion);

  v_score := round((v_met_count::numeric / v_total_count::numeric) * 100)::integer;
  v_all_blocking_met := v_blocking_met_count = v_blocking_count;
  v_status := case
    when v_all_blocking_met and v_score >= 90 then 'Ready'
    when v_all_blocking_met and v_score >= 70 then 'Nearly Ready'
    when v_score >= 40 then 'Significant Gaps'
    else 'Not Ready'
  end;

  select string_agg(
           format(
             '  • %s: %s (%s) — %s',
             criterion ->> 'criterion_label',
             case when (criterion ->> 'is_met')::boolean then '✓ Met' else '✗ Not met' end,
             criterion ->> 'derivation_source',
             criterion ->> 'evidence_summary'
           ),
           E'\n' order by ordinal
         )
    into v_breakdown
  from jsonb_array_elements(v_criteria) with ordinality as items(criterion, ordinal);

  v_explanation := format(
    'Revisit Readiness Score: %s/100 (%s)%s%s/%s criteria met.%sBlocking criteria: %s/%s met.%s%sCriteria breakdown:%s%s%s%sThis is a Clinical SOS internal readiness assessment. Clinical SOS does not guarantee that a facility will pass a regulatory revisit.',
    v_score,
    v_status,
    E'\n',
    v_met_count,
    v_total_count,
    E'\n',
    v_blocking_met_count,
    v_blocking_count,
    E'\n',
    E'\n',
    E'\n',
    v_breakdown,
    E'\n',
    E'\n'
  );

  delete from public.revisit_readiness_criteria
  where deficiency_id = p_deficiency_id;

  insert into public.revisit_readiness_criteria (
    client_account_id,
    deficiency_id,
    regulatory_case_id,
    engagement_id,
    engagement_name,
    facility_id,
    facility_name,
    criterion_label,
    criterion_key,
    derivation_source,
    is_met,
    evidence_summary,
    manual_reviewer,
    blocks_readiness,
    is_test_data,
    created_by,
    created_by_id
  )
  select
    v_deficiency.client_account_id,
    p_deficiency_id,
    v_deficiency.regulatory_case_id,
    v_deficiency.engagement_id,
    v_deficiency.engagement_name,
    v_deficiency.facility_id,
    v_deficiency.facility_name,
    criterion ->> 'criterion_label',
    criterion ->> 'criterion_key',
    criterion ->> 'derivation_source',
    (criterion ->> 'is_met')::boolean,
    criterion ->> 'evidence_summary',
    criterion ->> 'manual_reviewer',
    (criterion ->> 'blocks_readiness')::boolean,
    v_deficiency.is_test_data,
    v_actor_name,
    p_actor_id::text
  from jsonb_array_elements(v_criteria) as items(criterion);

  update public.deficiencies
    set revisit_readiness_status = v_status,
        revisit_readiness_score = v_score,
        revisit_readiness_explanation = v_explanation
    where id = p_deficiency_id;

  insert into public.automation_logs (
    automation, started, completed, status, records_processed,
    affected_record_ids, triggered_by, acting_profile_id, client_account_id
  ) values (
    'Revisit Readiness Assessment', v_now, v_now, 'Success', 1,
    array[p_deficiency_id], v_actor_name, p_actor_id, v_deficiency.client_account_id
  );

  select jsonb_agg(
           jsonb_build_object(
             'label', criterion ->> 'criterion_label',
             'key', criterion ->> 'criterion_key',
             'is_met', (criterion ->> 'is_met')::boolean,
             'derivation', criterion ->> 'derivation_source',
             'evidence', criterion ->> 'evidence_summary',
             'blocks', (criterion ->> 'blocks_readiness')::boolean
           ) order by ordinal
         )
    into v_public_criteria
  from jsonb_array_elements(v_criteria) with ordinality as items(criterion, ordinal);

  return jsonb_build_object(
    'ok', true,
    'deficiency_id', p_deficiency_id,
    'score', v_score,
    'status', v_status,
    'explanation', v_explanation,
    'criteria', v_public_criteria,
    'all_blocking_met', v_all_blocking_met
  );
end;
$function$;

create or replace function public.clinical_close_deficiency(
  p_actor_id uuid,
  p_deficiency_id text,
  p_force boolean default false,
  p_override_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_actor_role public.app_role;
  v_actor_name text;
  v_deficiency public.deficiencies%rowtype;
  v_blockers text[] := array[]::text[];
  v_count integer;
  v_poc_count integer;
  v_approved_poc_count integer;
  v_now timestamptz := now();
begin
  select profile.role,
         coalesce(nullif(btrim(profile.full_name), ''), nullif(btrim(profile.email), ''), 'Unknown')
    into v_actor_role, v_actor_name
  from public.profiles as profile
  where profile.id = p_actor_id;

  if not found or v_actor_role not in ('admin'::public.app_role, 'clinical'::public.app_role) then
    return jsonb_build_object(
      '_http_status', 403,
      'error', format('Access denied — role %L is not permitted for this operation.', coalesce(v_actor_role::text, 'unknown'))
    );
  end if;

  if nullif(btrim(coalesce(p_deficiency_id, '')), '') is null then
    return jsonb_build_object('_http_status', 400, 'error', 'deficiency_id is required');
  end if;

  select * into v_deficiency
  from public.deficiencies
  where id = p_deficiency_id
  for update;

  if not found then
    return jsonb_build_object('_http_status', 404, 'error', 'Deficiency not found');
  end if;

  select count(*) into v_count
  from public.audit_tools
  where deficiency_id = p_deficiency_id
    and audit_result = 'Failed'
    and nullif(btrim(coalesce(what_was_corrected, '')), '') is null;
  if v_count > 0 then
    v_blockers := array_append(v_blockers, format('%s unresolved failed audit(s)', v_count));
  end if;

  select count(*) into v_count
  from public.evidence_items
  where deficiency_id = p_deficiency_id
    and review_status in ('Insufficient', 'Required', 'Requested');
  if v_count > 0 then
    v_blockers := array_append(v_blockers, format('%s evidence item(s) unresolved or insufficient', v_count));
  end if;

  select count(*) into v_count
  from public.education_plans
  where deficiency_id = p_deficiency_id
    and education_status not in ('Completed', 'Competency Completed');
  if v_count > 0 then
    v_blockers := array_append(v_blockers, format('%s education plan(s) incomplete', v_count));
  end if;

  select count(*) into v_count
  from public.education_plans
  where deficiency_id = p_deficiency_id
    and education_status = 'Competency Pending';
  if v_count > 0 then
    v_blockers := array_append(v_blockers, format('%s competency validation(s) pending', v_count));
  end if;

  select count(*),
         count(*) filter (where status in ('Approved for Use', 'Accepted'))
    into v_poc_count, v_approved_poc_count
  from public.pocs
  where deficiency_id = p_deficiency_id;
  if v_poc_count > 0 and v_approved_poc_count = 0 then
    v_blockers := array_append(v_blockers, 'POC not appropriately approved');
  end if;

  select count(*) into v_count
  from public.qapi_reviews
  where deficiency_id = p_deficiency_id;
  if v_count = 0 then
    v_blockers := array_append(v_blockers, 'QAPI review incomplete');
  end if;

  if v_deficiency.revisit_readiness_status in ('Not Ready', 'Significant Gaps') then
    v_blockers := array_append(
      v_blockers,
      format('Revisit readiness: %s', v_deficiency.revisit_readiness_status)
    );
  end if;

  if coalesce(array_length(v_blockers, 1), 0) = 0 then
    update public.deficiencies
      set deficiency_status = 'Closed',
          closure_override = false,
          closure_override_reason = null,
          closure_override_by = null,
          closure_override_date = null
      where id = p_deficiency_id;

    insert into public.automation_logs (
      automation, started, completed, status, records_processed,
      affected_record_ids, triggered_by, acting_profile_id, client_account_id
    ) values (
      'Deficiency Closure', v_now, v_now, 'Success', 1,
      array[p_deficiency_id], v_actor_name, p_actor_id, v_deficiency.client_account_id
    );

    return jsonb_build_object(
      'ok', true,
      'closed', true,
      'deficiency_id', p_deficiency_id,
      'blockers', '[]'::jsonb
    );
  end if;

  if coalesce(p_force, false)
     and nullif(btrim(coalesce(p_override_reason, '')), '') is not null then
    update public.deficiencies
      set deficiency_status = 'Closed',
          closure_override = true,
          closure_override_reason = p_override_reason,
          closure_override_by = v_actor_name,
          closure_override_date = v_now
      where id = p_deficiency_id;

    insert into public.automation_logs (
      automation, started, completed, status, records_processed,
      affected_record_ids, triggered_by, acting_profile_id, client_account_id,
      errors, manual_override, manual_override_details
    ) values (
      'Deficiency Closure (Override)', v_now, v_now, 'Success', 1,
      array[p_deficiency_id], v_actor_name, p_actor_id, v_deficiency.client_account_id,
      format('Override reason: %s', p_override_reason), true, p_override_reason
    );

    return jsonb_build_object(
      'ok', true,
      'closed', true,
      'deficiency_id', p_deficiency_id,
      'override', true,
      'blockers', to_jsonb(v_blockers)
    );
  end if;

  return jsonb_build_object(
    'ok', false,
    'closed', false,
    'deficiency_id', p_deficiency_id,
    'blockers', to_jsonb(v_blockers),
    'message', 'Closure blocked — unresolved conditions remain. An authorized Clinical/Admin user may override with a documented rationale.'
  );
end;
$function$;

revoke all on function public.clinical_transition_poc(uuid, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.clinical_close_deficiency(uuid, text, boolean, text)
  from public, anon, authenticated;
revoke all on function public.clinical_update_revisit_readiness(uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.clinical_create_engagement_from_opportunity(uuid, text, text, date, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.clinical_save_generated_work_product(uuid, jsonb)
  from public, anon, authenticated;

grant execute on function public.clinical_transition_poc(uuid, text, text, text, text)
  to service_role;
grant execute on function public.clinical_close_deficiency(uuid, text, boolean, text)
  to service_role;
grant execute on function public.clinical_update_revisit_readiness(uuid, text, jsonb)
  to service_role;
grant execute on function public.clinical_create_engagement_from_opportunity(uuid, text, text, date, text, text, text, text)
  to service_role;
grant execute on function public.clinical_save_generated_work_product(uuid, jsonb)
  to service_role;

comment on function public.clinical_transition_poc(uuid, text, text, text, text) is
  'Authorized, transaction-scoped POC lifecycle transition used only by the Edge Function service client.';
comment on function public.clinical_close_deficiency(uuid, text, boolean, text) is
  'Authorized, transaction-scoped deficiency closure guardrail and audit event.';
comment on function public.clinical_update_revisit_readiness(uuid, text, jsonb) is
  'Atomically replaces derived readiness criteria, updates the deficiency score, and records an audit event.';
comment on function public.clinical_create_engagement_from_opportunity(uuid, text, text, date, text, text, text, text) is
  'Idempotently creates one engagement, wins its opportunity, accepts its proposal, and logs the operation.';
comment on function public.clinical_save_generated_work_product(uuid, jsonb) is
  'Rejects stale source snapshots and atomically saves a validated work product, POC narrative, and audit event.';

commit;

