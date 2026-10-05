-- Importance: 100. Calendar commands enforce privacy and version checks.
begin;
\ir fixtures/setup.sql.inc
select plan(21);
select has_table('public','events','public.events exists');
select ok(not has_table_privilege('authenticated', 'public.events', 'INSERT'), 'Create through commands');
select ok(not has_table_privilege('authenticated', 'public.events', 'UPDATE'), 'Update through commands');
select pg_temp.as_user(1);
set local role authenticated;
create temporary table input as select '{"id":"40000000-0000-4000-8000-000000000001","pair_id":"30000000-0000-4000-8000-000000000001","title":"Private plan","owner":"a","visibility":"private","timezone":"Europe/Warsaw","starts_at":"2026-10-03T22:00:00Z","ends_at":"2026-10-05T00:00:00Z"}'::jsonb value;
create temporary table saved as select public.create_event((select value from input),'50000000-0000-4000-8000-000000000010') result;
select ok((select (result->>'ok')::boolean from saved),'Create event');
select is(public.create_event((select value from input),'50000000-0000-4000-8000-000000000010'),(select result from saved),'Create retry does not duplicate');
select is(jsonb_array_length(public.list_agenda('30000000-0000-4000-8000-000000000001','2026-10-04','2026-10-05')->'data'),1,'Range includes overlapping start');
select is(public.update_event('40000000-0000-4000-8000-000000000001',(select value from input),9,'50000000-0000-4000-8000-000000000011')->'error'->>'code','CONFLICT','Stale edit denied');
select is(public.update_event('40000000-0000-4000-8000-000000000001',(select value||'{"visibility":"shared"}' from input),1,'50000000-0000-4000-8000-000000000012')->'error'->>'code','VALIDATION','Sharing needs author confirmation');
select pg_temp.as_user(2);
select is((select count(*)::integer from public.events),0,'Partner cannot read private event');
select is(public.delete_event('40000000-0000-4000-8000-000000000001',1,'50000000-0000-4000-8000-000000000013')->'error'->>'code','FORBIDDEN','Private ID probe denied');
select pg_temp.as_user(3);
select is((select count(*)::integer from public.events),0,'Other pair cannot read event');
select is(public.create_event((select value||'{"id":"40000000-0000-4000-8000-000000000002"}' from input),'50000000-0000-4000-8000-000000000014')->'error'->>'code','FORBIDDEN','Other pair cannot create event');
select is(public.list_agenda('30000000-0000-4000-8000-000000000002','2026-01-01','2028-01-01')->'error'->>'code','VALIDATION','Range bound');
select pg_temp.as_user(1);
create temporary table shared as select public.update_event('40000000-0000-4000-8000-000000000001',
  (select value||'{"visibility":"shared","confirm_shared":true}' from input),1,'50000000-0000-4000-8000-000000000015') result;
select ok((select (result->>'ok')::boolean from shared),'Author confirms sharing');
select pg_temp.as_user(2);
select is((select count(*)::integer from public.events),1,'Partner reads confirmed shared event');
select is(public.update_event('40000000-0000-4000-8000-000000000001',
  (select value||'{"visibility":"private","owner":"b"}' from input),2,'50000000-0000-4000-8000-000000000016')->'error'->>'code','FORBIDDEN','Only author changes visibility');
-- Importance: 100. Receipt replay must recheck current visibility.
create temporary table partner_edit as select public.update_event('40000000-0000-4000-8000-000000000001',
  (select value||'{"visibility":"shared","title":"Partner edit"}' from input),2,'50000000-0000-4000-8000-000000000017') result;
select ok((select (result->>'ok')::boolean from partner_edit),'Partner edits shared event');
select pg_temp.as_user(1);
select ok((public.update_event('40000000-0000-4000-8000-000000000001',(select value from input),3,
  '50000000-0000-4000-8000-000000000018')->>'ok')::boolean,'Author makes shared event private');
select pg_temp.as_user(2);
select is(public.update_event('40000000-0000-4000-8000-000000000001',
  (select value||'{"visibility":"shared","title":"Partner edit"}' from input),2,
  '50000000-0000-4000-8000-000000000017')->'error'->>'code','FORBIDDEN','Private transition denies prior edit receipt');
select is((select count(*)::integer from public.event_access_revocations),1,'Former reader receives a content-free durable revocation');
reset role;
select throws_ok($$update public.events set created_by='10000000-0000-4000-8000-000000000002'
  where id='40000000-0000-4000-8000-000000000001'$$,'P0001','FORBIDDEN','Author stays immutable');
select * from finish();
rollback;
