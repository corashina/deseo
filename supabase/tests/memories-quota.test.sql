-- Importance: 100. Reservation totals, expiry, leases, disabled sessions, and feed bounds protect private content.
begin;
\ir fixtures/setup.sql.inc
select no_plan();
\ir fixtures/memory-worker.sql.inc
-- Importance 100: fixture leases and expiry must survive more than one global worker batch.
select is((select count(*)::integer from private.memory_cleanup_jobs where pair_id='30000000-0000-4000-8000-000000000003' and state='queued' and due_at<=now()),120,'Unrelated eligible cleanup backlog exceeds 50');
select is((select count(*)::integer from private.memory_reservations where pair_id='30000000-0000-4000-8000-000000000003' and expires_at<=now() and released_at is null),120,'Unrelated expired reservation backlog exceeds 50');
create temporary table draft as select '{"id":"40000000-0000-4000-8000-000000000201","pairId":"30000000-0000-4000-8000-000000000001","memoryDate":"2026-10-04","caption":"Synthetic","photos":[{"id":"60000000-0000-4000-8000-000000000201","fullBytes":100,"thumbBytes":30,"width":20,"height":10,"thumbWidth":10,"thumbHeight":5}]}'::jsonb value;
grant select on draft to authenticated;
select pg_temp.as_user(1);
set local role authenticated;
select is(public.reserve_memory((select value||'{"memoryDate":"infinity"}' from draft),gen_random_uuid())->'error'->>'code','VALIDATION','Infinite date rejected');
select is(public.reserve_memory((select value||'{"memoryDate":"10/04/2026"}' from draft),gen_random_uuid())->'error'->>'code','VALIDATION','Non-ISO date rejected');
select is(public.reserve_memory((select value||'{"memoryDate":"2026-02-30"}' from draft),gen_random_uuid())->'error'->>'code','VALIDATION','Invalid day rejected');
select is(public.reserve_memory((select jsonb_set(value,'{photos,0,fullBytes}','5242881') from draft),gen_random_uuid())->'error'->>'code','VALIDATION','Full file capped at 5 MiB');
select is(public.reserve_memory((select jsonb_set(value,'{photos,0,thumbWidth}','513') from draft),gen_random_uuid())->'error'->>'code','VALIDATION','Thumbnail capped at 512 pixels');
select is(public.reserve_memory((select jsonb_set(value,'{photos,0,height}','2561') from draft),gen_random_uuid())->'error'->>'code','VALIDATION','Full image capped at 2560 pixels');
select is(public.reserve_memory((select value||jsonb_build_object('photos',(select jsonb_agg(photo) from
 (select value->'photos'->0 as photo from generate_series(1,6)) copies)) from draft),gen_random_uuid())->'error'->>'code','VALIDATION','Six photos rejected');
reset role;
-- A synthetic 1 GiB ledger fills quota without writing image objects.
insert into public.memories(id,pair_id,created_by,memory_date,state)
select ('40000000-0000-4000-8001-'||lpad(n::text,12,'0'))::uuid,'30000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000001','2026-10-04','published' from generate_series(1,22) n;
insert into private.memory_reservations(memory_id,pair_id,bytes)
select id,pair_id,case when right(id::text,12)::integer=22 then 25165824 else 49932190 end from public.memories where pair_id='30000000-0000-4000-8000-000000000001';
-- 21 * 49932190 + 25165824 = 1073741814, leaving ten bytes.
set local role authenticated;
select is(public.reserve_memory((select value from draft),gen_random_uuid())->'error'->>'code','QUOTA_EXCEEDED','Pair quota includes published ledger');
reset role;
update private.memory_reservations set released_at=now() where pair_id='30000000-0000-4000-8000-000000000001';
set local role authenticated;
select ok((public.reserve_memory((select value from draft),'50000000-0000-4000-8000-000000000201')->>'ok')::boolean,'Released quota permits reservation');
select is(jsonb_array_length(public.list_memories('30000000-0000-4000-8000-000000000001',null,5)->'data'->'items'),5,'Feed page stays bounded');
create temporary table page as select public.list_memories('30000000-0000-4000-8000-000000000001',null,5)->'data' data;
select ok((select data->'nextCursor' is not null and data->'nextCursor'<>'null'::jsonb from page),'Full feed page includes keyset cursor');
select ok(not exists(select 1 from jsonb_array_elements((select data->'items' from page)) a
 join jsonb_array_elements(public.list_memories('30000000-0000-4000-8000-000000000001',(select data->'nextCursor' from page),5)->'data'->'items') b
 on a.value->>'id'=b.value->>'id'),'Following page has no duplicate IDs');
reset role;
update private.memory_reservations set expires_at=now()-interval '1 minute' where memory_id='40000000-0000-4000-8000-000000000201';
select ok(not private.memory_upload_allowed('30000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000201/60000000-0000-4000-8000-000000000201/full.jpg'),'Expired reservation rejects upload');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select is(public.verify_memory_reservation('40000000-0000-4000-8000-000000000201','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001')->'error'->>'code','FORBIDDEN','Expired reservation cannot validate');
create temporary table lease as select job from jsonb_array_elements(pg_temp.claim_fixture_memory(50)->'data') job
where job->>'memoryId'='40000000-0000-4000-8000-000000000201';
select is((select job->>'memoryId' from lease),'40000000-0000-4000-8000-000000000201','Expiry sweep queues abandoned upload');
reset role;
update private.memory_cleanup_jobs set lease_until=now()-interval '1 minute' where state='leased' and pair_id='30000000-0000-4000-8000-000000000001';
set local role service_role;
create temporary table renewed as select job from jsonb_array_elements(pg_temp.claim_fixture_memory(50)->'data') job
where job->>'memoryId'='40000000-0000-4000-8000-000000000201';
select isnt((select job->>'leaseToken' from renewed),(select job->>'leaseToken' from lease),'Expired lease gets a new token');
select is(public.complete_memory_cleanup((select(job->>'id')::uuid from lease),(select(job->>'leaseToken')::uuid from lease))->'error'->>'code','CONFLICT','Old worker cannot acknowledge new lease');
select is(public.complete_memory_cleanup((select(job->>'id')::uuid from renewed),(select(job->>'leaseToken')::uuid from renewed))->'data'->>'state','completed','Missing objects permit cleanup completion');
reset role;
select pg_temp.as_user(1);
set local role authenticated;
select is(public.reserve_memory((select value from draft),'50000000-0000-4000-8000-000000000201')->'error'->>'code','FORBIDDEN','Expired-and-cleaned ID cannot recreate');
reset role;
select pg_temp.as_user(2);
set local role authenticated;
select ok((public.reserve_memory((select jsonb_set(jsonb_set(value,'{id}','"40000000-0000-4000-8000-000000000202"'),'{photos,0,id}','"60000000-0000-4000-8000-000000000202"') from draft),'50000000-0000-4000-8000-000000000202')->>'ok')::boolean,'Second author can reserve');
reset role;
update public.profiles set account_status='disabled' where user_id='10000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select is(public.verify_memory_reservation('40000000-0000-4000-8000-000000000202','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002')->'error'->>'code','FORBIDDEN','Disabled actor cannot validate with live session');
select is(public.publish_memory('40000000-0000-4000-8000-000000000202','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002',gen_random_uuid())->'error'->>'code','FORBIDDEN','Disabled actor cannot publish');
select throws_ok($$insert into storage.objects(bucket_id,name,version,owner_id,user_metadata,metadata) values('memory-photos',
 '30000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000202/60000000-0000-4000-8000-000000000202/full.jpg',gen_random_uuid()::text,
 '10000000-0000-4000-8000-000000000002','{"sessionId":"20000000-0000-4000-8000-000000000002"}','{"size":100}')$$,
 'P0001','FORBIDDEN','Storage service completion rejects a disabled original uploader');
reset role;
update public.profiles set account_status='active' where user_id='10000000-0000-4000-8000-000000000002';
delete from auth.sessions where id='20000000-0000-4000-8000-000000000002';
set local role service_role;
select throws_ok($$insert into storage.objects(bucket_id,name,version,owner_id,user_metadata,metadata) values('memory-photos',
 '30000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000202/60000000-0000-4000-8000-000000000202/full.jpg',gen_random_uuid()::text,
 '10000000-0000-4000-8000-000000000002','{"sessionId":"20000000-0000-4000-8000-000000000002"}','{"size":100}')$$,
 'P0001','FORBIDDEN','Storage service completion rejects the revoked original session');
reset role;
select * from finish();
rollback;
