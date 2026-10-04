-- Recovered from applied Supabase migration history on 2026-10-04.
begin;

-- Stripe retries and concurrent deliveries require an atomic event claim.
-- Keeping this table separate from the human-readable automation log avoids a
-- check-then-insert race while preserving the existing audit contract.
create table public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  status text not null default 'Processing'
    check (status in ('Processing', 'Success', 'Failed')),
  attempt_count integer not null default 1
    check (attempt_count > 0),
  locked_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint stripe_webhook_events_event_id_nonempty
    check (btrim(event_id) <> ''),
  constraint stripe_webhook_events_event_type_nonempty
    check (btrim(event_type) <> '')
);

comment on table public.stripe_webhook_events is
  'Server-only atomic Stripe event claims. No browser role receives table or RPC access.';

create index stripe_webhook_events_status_locked_idx
  on public.stripe_webhook_events (status, locked_at);

create trigger stripe_webhook_events_set_updated_date
  before update on public.stripe_webhook_events
  for each row execute function private.set_base44_updated_date();

alter table public.stripe_webhook_events enable row level security;

revoke all on table public.stripe_webhook_events
  from public, anon, authenticated;
grant select, insert, update, delete on table public.stripe_webhook_events
  to service_role;


create or replace function public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  inserted_count integer := 0;
  reclaimed boolean := false;
  existing_status text;
begin
  if nullif(btrim(p_event_id), '') is null
     or nullif(btrim(p_event_type), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Stripe event ID and type are required';
  end if;

  insert into public.stripe_webhook_events (
    event_id,
    event_type,
    status,
    attempt_count,
    locked_at
  )
  values (
    p_event_id,
    p_event_type,
    'Processing',
    1,
    now()
  )
  on conflict (event_id) do nothing;

  get diagnostics inserted_count = row_count;
  if inserted_count = 1 then
    return 'claimed';
  end if;

  select event.status
  into existing_status
  from public.stripe_webhook_events as event
  where event.event_id = p_event_id;

  if existing_status = 'Success' then
    return 'duplicate';
  end if;

  -- Failed attempts may retry immediately. Processing claims become eligible
  -- after ten minutes so a crashed invocation cannot block an event forever.
  update public.stripe_webhook_events as event
  set event_type = p_event_type,
      status = 'Processing',
      attempt_count = event.attempt_count + 1,
      locked_at = now(),
      processed_at = null,
      last_error = null
  where event.event_id = p_event_id
    and (
      event.status = 'Failed'
      or (
        event.status = 'Processing'
        and event.locked_at <= now() - interval '10 minutes'
      )
    )
  returning true into reclaimed;

  if coalesce(reclaimed, false) then
    return 'claimed';
  end if;

  return 'in_progress';
end;
$function$;


create or replace function public.complete_stripe_webhook_event(
  p_event_id text,
  p_status text,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  updated_count integer := 0;
begin
  if p_status not in ('Success', 'Failed') then
    raise exception using
      errcode = '22023',
      message = 'Stripe event completion status must be Success or Failed';
  end if;

  update public.stripe_webhook_events
  set status = p_status,
      processed_at = case when p_status = 'Success' then now() else null end,
      last_error = case
        when p_status = 'Failed' then left(coalesce(p_error, ''), 4000)
        else null
      end
  where event_id = p_event_id
    and status = 'Processing';

  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$function$;


revoke all
  on function public.claim_stripe_webhook_event(text, text)
  from public, anon, authenticated;
revoke all
  on function public.complete_stripe_webhook_event(text, text, text)
  from public, anon, authenticated;

grant execute
  on function public.claim_stripe_webhook_event(text, text)
  to service_role;
grant execute
  on function public.complete_stripe_webhook_event(text, text, text)
  to service_role;

commit;

