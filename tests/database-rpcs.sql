-- Run only against an isolated database after replaying the migrations.
-- All fixtures roll back; no production credentials or records are needed.
begin;
insert into auth.users (id,email) values
  ('00000000-0000-4000-8000-000000000001','clinical@example.invalid'),
  ('00000000-0000-4000-8000-000000000002','pending@example.invalid');
update public.profiles set role='clinical' where id='00000000-0000-4000-8000-000000000001';
do $test$
declare result jsonb;
begin
  assert not has_function_privilege('anon','public.claim_stripe_webhook_event(text,text)','EXECUTE');
  assert not has_function_privilege('authenticated','public.complete_stripe_webhook_event(text,text,text)','EXECUTE');
  assert not has_function_privilege('authenticated','public.clinical_save_generated_work_product(uuid,jsonb)','EXECUTE');
  assert has_function_privilege('service_role','public.clinical_save_generated_work_product(uuid,jsonb)','EXECUTE');
  assert public.claim_stripe_webhook_event('evt_fixture','invoice.paid')='claimed';
  assert public.claim_stripe_webhook_event('evt_fixture','invoice.paid')='in_progress';
  assert public.complete_stripe_webhook_event('evt_fixture','Failed','fixture failure');
  assert public.claim_stripe_webhook_event('evt_fixture','invoice.paid')='claimed';
  assert public.complete_stripe_webhook_event('evt_fixture','Success',null);
  assert public.claim_stripe_webhook_event('evt_fixture','invoice.paid')='duplicate';
  assert not public.complete_stripe_webhook_event('evt_missing','Success',null);
  result := public.clinical_save_generated_work_product(
    '00000000-0000-4000-8000-000000000002','{"document_type":"Plan of Correction Draft","content":"Fixture"}');
  assert (result->>'_http_status')::integer=403;
  result := public.clinical_save_generated_work_product(
    '00000000-0000-4000-8000-000000000001',
    '{"document_type":"Plan of Correction Draft","content":"Fixture","source_versions":{"poc":{"id":"missing","updated_date":"2026-10-01T00:00:00Z"}}}');
  assert (result->>'_http_status')::integer=409;
  assert (select count(*)=0 from public.work_products);
  result := public.clinical_save_generated_work_product(
    '00000000-0000-4000-8000-000000000001',
    '{"document_type":"Plan of Correction Draft","content":"To be completed.","source_snapshot":"{}","source_record_ids":[],"source_fields_used":[],"is_test_data":true}');
  assert result->>'document_status'='DRAFT';
  assert (select count(*)=1 from public.work_products where document_status='DRAFT' and is_test_data);
  assert (select count(*)=1 from public.automation_logs where automation='Work Product Generation');
end;
$test$;
rollback;
