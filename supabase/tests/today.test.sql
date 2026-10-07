-- Importance: 100. Today returns one pair's content only to its current members.
begin;
\ir fixtures/setup.sql.inc
select plan(6);
set local session_replication_role = replica;
insert into public.tasks(id,pair_id,list_id,title,created_by,due_date)
select ('41000000-0000-4000-8000-00000000000'||n)::uuid,'30000000-0000-4000-8000-000000000001',
  (select id from public.task_lists where pair_id='30000000-0000-4000-8000-000000000001' and is_general),
  'Due '||n,'10000000-0000-4000-8000-000000000001',('2026-10-0'||n)::date from generate_series(1,5) n;
insert into public.messages(id,pair_id,author_id,client_id,body,payload_hash,created_at,pinned_at) values
  ('42000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
   gen_random_uuid(),'See you tonight',sha256('note'::bytea),now(),now());
set local session_replication_role = origin;
select ok(not has_function_privilege('anon','public.get_today(uuid,date)','EXECUTE'),'Anon cannot read Today');
select pg_temp.as_user(1);
set local role authenticated;
create temporary table member_today as select public.get_today('30000000-0000-4000-8000-000000000001','2026-10-04') result;
select ok((select (result->>'ok')::boolean from member_today),'Member reads Today');
select is((select jsonb_array_length(result->'data'->'due_tasks') from member_today),3,'Today caps due tasks at three');
select is((select result->'data'->'due_tasks'->0->>'due_date' from member_today),'2026-10-01','Today orders due tasks by date');
select is((select result->'data'->'notes'->0->>'body' from member_today),'See you tonight','Today returns pinned notes');
select pg_temp.as_user(3);
select is(public.get_today('30000000-0000-4000-8000-000000000001','2026-10-04')->'error'->>'code','FORBIDDEN','Another pair cannot read Today');
select * from finish();
rollback;
