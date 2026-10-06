-- Importance: 100. Auth, isolation, immutable uploads, quota, publication, and cleanup are security boundaries.
begin;
\ir fixtures/setup.sql.inc
select no_plan();
select has_table('public','memories','public.memories exists');
select has_table('public','memory_photos','public.memory_photos exists');
select ok(not has_table_privilege('authenticated','public.memories','INSERT'),'Clients cannot insert metadata');
select ok(not has_table_privilege('authenticated','public.memory_photos','UPDATE'),'Clients cannot claim validation');
select ok(not has_function_privilege('authenticated','public.publish_memory(uuid,uuid,uuid,uuid)','EXECUTE'),'Only service publishes');
select ok(not has_function_privilege('authenticated','public.validate_memory_photo(uuid,uuid,uuid,uuid,jsonb)','EXECUTE'),'Only service validates');
select ok(not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and cmd in('SELECT','UPDATE','DELETE')),'No public download or overwrite policy');
select is((select public from storage.buckets where id='memory-photos'),false,'Private bucket');
create temporary table draft as select '{"id":"40000000-0000-4000-8000-000000000101","pairId":"30000000-0000-4000-8000-000000000001","memoryDate":"2026-10-04","caption":"Synthetic memory","photos":[{"id":"60000000-0000-4000-8000-000000000101","fullBytes":100,"thumbBytes":30,"width":20,"height":10,"thumbWidth":10,"thumbHeight":5}]}'::jsonb value;
grant select on draft to authenticated;
select pg_temp.as_user(1);
set local role authenticated;
create temporary table saved as select public.reserve_memory((select value from draft),'50000000-0000-4000-8000-000000000101') result;
select ok((select (result->>'ok')::boolean from saved),'Author reserves upload');
select is(public.reserve_memory((select value from draft),'50000000-0000-4000-8000-000000000101'),(select result from saved),'Reservation replay remains stable');
select is(public.reserve_memory((select value||'{"caption":"Changed"}' from draft),'50000000-0000-4000-8000-000000000101')->'error'->>'code','CONFLICT','Same command rejects different request');
select is(public.reserve_memory((select value||'{"id":"40000000-0000-4000-8000-000000000102","photos":[]}' from draft),'50000000-0000-4000-8000-000000000102')->'error'->>'code','VALIDATION','At least one photo required');
select is(public.reserve_memory((select value||jsonb_build_object('id','40000000-0000-4000-8000-000000000102','photos',jsonb_build_array(value->'photos'->0,value->'photos'->0)) from draft),'50000000-0000-4000-8000-000000000102')->'error'->>'code','CONFLICT','Duplicate photo IDs roll back reservation');
select is((select count(*)::integer from public.memories where pair_id='30000000-0000-4000-8000-000000000001'),1,'Rejected duplicate leaves no memory');
select is(jsonb_array_length(public.list_memories('30000000-0000-4000-8000-000000000001')->'data'->'items'),0,'Feed hides pending memory');
select is(public.get_memory_media('60000000-0000-4000-8000-000000000101')->'error'->>'code','FORBIDDEN','Pending photos cannot get links');
select ok((public.get_memory('40000000-0000-4000-8000-000000000101')->>'ok')::boolean,'Author can resume pending upload');
select pg_temp.as_user(2);
select is((select count(*)::integer from public.memories where pair_id='30000000-0000-4000-8000-000000000001'),0,'Partner cannot read pending memory');
select is(public.get_memory('40000000-0000-4000-8000-000000000101')->'error'->>'code','FORBIDDEN','Partner pending ID probe denied');
select pg_temp.as_user(3);
select is(public.list_memories('30000000-0000-4000-8000-000000000001')->'error'->>'code','FORBIDDEN','Unrelated pair feed denied');
select is((select count(*)::integer from public.memory_photos where pair_id='30000000-0000-4000-8000-000000000001'),0,'Unrelated account cannot read photos');
select pg_temp.as_user(1);
reset role;
select is((select bytes::integer from private.memory_reservations where memory_id='40000000-0000-4000-8000-000000000101'),130,'Quota includes full and thumbnail');
-- Importance: 100. Storage final registration has only the service JWT, not caller sub/session claims.
select throws_ok($$insert into storage.objects(bucket_id,name,version,owner_id,user_metadata,metadata) values('memory-photos',
 '30000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000101/60000000-0000-4000-8000-000000000101/full.jpg','1',
 '10000000-0000-4000-8000-000000000001','{"sessionId":"20000000-0000-4000-8000-000000000002"}','{"mimetype":"image/jpeg"}')$$,
 'P0001','FORBIDDEN','Preflight rejects a session from a different caller');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select throws_ok($$insert into storage.objects(bucket_id,name,version,owner_id,user_metadata,metadata) values('memory-photos',
 '30000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000101/60000000-0000-4000-8000-000000000101/full.jpg',gen_random_uuid()::text,
 '10000000-0000-4000-8000-000000000001','{"sessionId":"20000000-0000-4000-8000-000000000001"}','{"size":101}')$$,
 'P0001','VALIDATION','Stored bytes must equal reservation');
select lives_ok($$insert into storage.objects(bucket_id,name,version,owner_id,user_metadata,metadata)
select 'memory-photos',full_path,gen_random_uuid()::text,uploaded_by::text,'{"sessionId":"20000000-0000-4000-8000-000000000001"}'::jsonb,jsonb_build_object('size',full_bytes,'mimetype','image/jpeg') from public.memory_photos where pair_id='30000000-0000-4000-8000-000000000001'
union all select 'memory-photos',thumb_path,gen_random_uuid()::text,uploaded_by::text,'{"sessionId":"20000000-0000-4000-8000-000000000001"}'::jsonb,jsonb_build_object('size',thumb_bytes,'mimetype','image/jpeg') from public.memory_photos where pair_id='30000000-0000-4000-8000-000000000001'$$,
 'Final Storage service insert rechecks reserved owner and original live session');
select throws_ok($$update storage.objects set metadata='{"size":999}' where bucket_id='memory-photos' and name like '30000000-0000-4000-8000-000000000001/%'$$,'P0001','FORBIDDEN','Uploaded objects stay immutable');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select is(public.publish_memory('40000000-0000-4000-8000-000000000101','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000103')->'error'->>'code','RETRYABLE','Unvalidated files cannot publish');
select is(public.validate_memory_photo('40000000-0000-4000-8000-000000000101','60000000-0000-4000-8000-000000000101','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '{"fullBytes":101,"thumbBytes":30,"width":20,"height":10,"thumbWidth":10,"thumbHeight":5}')->'error'->>'code','VALIDATION','Service evidence must match actual declarations');
select ok((public.validate_memory_photo('40000000-0000-4000-8000-000000000101','60000000-0000-4000-8000-000000000101','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '{"fullBytes":100,"thumbBytes":30,"width":20,"height":10,"thumbWidth":10,"thumbHeight":5}')->>'ok')::boolean,'Verified photo records validation');
create temporary table published as select public.publish_memory('40000000-0000-4000-8000-000000000101','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000103') result;
select ok((select(result->>'ok')::boolean from published),'Validated memory publishes');
select is(public.publish_memory('40000000-0000-4000-8000-000000000101','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000103'),(select result from published),'Lost publication response replays');
select is(public.publish_memory('40000000-0000-4000-8000-000000000101','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000103')->'error'->>'code','FORBIDDEN','Service cannot publish for partner');
select pg_temp.as_user(2);
set local role authenticated;
select is((select count(*)::integer from public.memories where pair_id='30000000-0000-4000-8000-000000000001'),1,'Partner sees published memory');
select is(public.get_memory_media('60000000-0000-4000-8000-000000000101')->'data'->>'expiresIn','60','Media link maximum is 60 seconds');
select is(public.update_memory('40000000-0000-4000-8000-000000000101','{"memoryDate":"2026-10-05","caption":"Probe"}',2,'50000000-0000-4000-8000-000000000104')->'error'->>'code','FORBIDDEN','Partner cannot edit');
select is(public.delete_memory('40000000-0000-4000-8000-000000000101',2,'50000000-0000-4000-8000-000000000104')->'error'->>'code','FORBIDDEN','Partner cannot delete');
select pg_temp.as_user(3);
select is(public.get_memory_media('60000000-0000-4000-8000-000000000101')->'error'->>'code','FORBIDDEN','Unrelated media ID probe denied');
select pg_temp.as_user(1);
select is(public.update_memory('40000000-0000-4000-8000-000000000101','{"memoryDate":"2026-10-05","caption":"Edited"}',99,'50000000-0000-4000-8000-000000000104')->'error'->>'code','CONFLICT','Stale author edit denied');
select ok((public.update_memory('40000000-0000-4000-8000-000000000101','{"memoryDate":"2026-10-05","caption":"Edited"}',2,'50000000-0000-4000-8000-000000000104')->>'ok')::boolean,'Author edits caption and date');
select is(public.latest_memory('30000000-0000-4000-8000-000000000001')->'data'->>'caption','Edited','Latest returns current caption');
select is(public.list_memories('30000000-0000-4000-8000-000000000001',null,51)->'error'->>'code','VALIDATION','Feed limit capped at 50');
select ok((public.delete_memory('40000000-0000-4000-8000-000000000101',3,'50000000-0000-4000-8000-000000000105')->>'ok')::boolean,'Author deletes metadata visibility');
select ok((public.delete_memory('40000000-0000-4000-8000-000000000101',3,gen_random_uuid())->>'ok')::boolean,'Already deleting author retry succeeds after restart');
select is(public.get_memory_media('60000000-0000-4000-8000-000000000101')->'error'->>'code','FORBIDDEN','Deletion revokes new links');
select pg_temp.as_user(2);
select is((select count(*)::integer from public.memory_access_revocations where pair_id='30000000-0000-4000-8000-000000000001'),1,'Partner receives opaque memory deletion signal');
select pg_temp.as_user(3);
select is((select count(*)::integer from public.memory_access_revocations where pair_id='30000000-0000-4000-8000-000000000001'),0,'Unrelated account cannot read deletion signals');
select pg_temp.as_user(1);
reset role;
select is((select bytes::integer from private.memory_reservations where released_at is null and pair_id='30000000-0000-4000-8000-000000000001'),130,'Deleting bytes still occupy quota');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
create temporary table claimed as select job from jsonb_array_elements(public.claim_memory_cleanup(50)->'data') job where job->>'memoryId'='40000000-0000-4000-8000-000000000101';
select is((select job->>'attempt' from claimed),'1','Cleanup leases one job');
select is((select count(*)::integer from jsonb_array_elements(public.claim_memory_cleanup(50)->'data') job where job->>'memoryId'='40000000-0000-4000-8000-000000000101'),0,'Active lease blocks duplicate worker');
select is(public.complete_memory_cleanup((select(job->>'id')::uuid from claimed),gen_random_uuid())->'error'->>'code','CONFLICT','Wrong lease cannot complete');
select is(public.complete_memory_cleanup((select(job->>'id')::uuid from claimed),(select(job->>'leaseToken')::uuid from claimed))->'error'->>'code','RETRYABLE','Remaining objects block quota release');
select is(public.complete_memory_cleanup((select(job->>'id')::uuid from claimed),(select(job->>'leaseToken')::uuid from claimed),'STORAGE_FAILURE')->'data'->>'state','queued','Object deletion failure queues retry');
reset role;
update private.memory_cleanup_jobs set due_at=now()-interval '1 minute',attempts=4 where pair_id='30000000-0000-4000-8000-000000000001';
set local role service_role;
update claimed set job=(select cleanup.item from jsonb_array_elements(public.claim_memory_cleanup(50)->'data') as cleanup(item) where cleanup.item->>'memoryId'='40000000-0000-4000-8000-000000000101');
select is(public.complete_memory_cleanup((select(job->>'id')::uuid from claimed),(select(job->>'leaseToken')::uuid from claimed),'STORAGE_FAILURE')->'data'->>'state','failed','Fifth failure stays visible to operations');
select is((select count(*)::integer from jsonb_array_elements(public.claim_memory_cleanup(50)->'data') job where job->>'memoryId'='40000000-0000-4000-8000-000000000101'),0,'Retained failure is not silently reclaimed');
select ok((public.retry_memory_cleanup((select(job->>'id')::uuid from claimed))->>'ok')::boolean,'Service can retry retained failure');
update claimed set job=(select cleanup.item from jsonb_array_elements(public.claim_memory_cleanup(50)->'data') as cleanup(item) where cleanup.item->>'memoryId'='40000000-0000-4000-8000-000000000101');
-- This transaction contains synthetic metadata only. No Storage API objects exist.
-- The installed storage.protect_delete guard permits this transaction-local override.
set local storage.allow_delete_query='true';
delete from storage.objects where bucket_id='memory-photos' and name like '30000000-0000-4000-8000-000000000001/%';
set local storage.allow_delete_query='false';
select is(public.complete_memory_cleanup((select(job->>'id')::uuid from claimed),(select(job->>'leaseToken')::uuid from claimed))->'data'->>'state','completed','Successful object removal releases quota');
reset role;
select is((select count(*)::integer from private.memory_reservations where released_at is null and pair_id='30000000-0000-4000-8000-000000000001'),0,'Completed cleanup releases reservation');
select is((select count(*)::integer from public.memory_photos where pair_id='30000000-0000-4000-8000-000000000001'),0,'Completed cleanup removes photo metadata');
select is((select count(*)::integer from public.memories where pair_id='30000000-0000-4000-8000-000000000001'),0,'Completed cleanup removes dates and caption metadata');
select is((select count(*)::integer from private.memory_tombstones where pair_id='30000000-0000-4000-8000-000000000001'),1,'Private minimal tombstone preserves stable ID');
select is((select count(*)::integer from public.memory_access_revocations where pair_id='30000000-0000-4000-8000-000000000001'),1,'Cleanup preserves signal for delayed Realtime authorization');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='memories'),'Published memory changes support Realtime');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='memory_access_revocations'),'Memory deletion signals support Realtime');
select pg_temp.as_user(1);
set local role authenticated;
select ok((public.delete_memory('40000000-0000-4000-8000-000000000101',3,'50000000-0000-4000-8000-000000000105')->>'ok')::boolean,'Delete response can replay after cleanup');
select is(public.reserve_memory((select value from draft),'50000000-0000-4000-8000-000000000101')->'error'->>'code','FORBIDDEN','Tombstone blocks deleted reservation replay');
-- New pending upload must fail after pair closure, even with its old valid JWT and command receipt.
select ok((public.reserve_memory((select jsonb_set(jsonb_set(value,'{id}','"40000000-0000-4000-8000-000000000102"'),'{photos,0,id}','"60000000-0000-4000-8000-000000000102"') from draft),'50000000-0000-4000-8000-000000000106')->>'ok')::boolean,'Reserve second upload');
reset role;
update public.pairs set state='ended',ended_at=now(),purge_after=now()+interval '30 days' where id='30000000-0000-4000-8000-000000000001';
update public.pair_members set left_at=now() where pair_id='30000000-0000-4000-8000-000000000001';
select is((select state from public.memories where id='40000000-0000-4000-8000-000000000102'),'deleting','Closure hides and queues pending upload');
select ok(not private.memory_upload_allowed('30000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000102/60000000-0000-4000-8000-000000000102/full.jpg'),'Upload cannot complete after disconnect');
set local role authenticated;
select is(public.reserve_memory((select jsonb_set(jsonb_set(value,'{id}','"40000000-0000-4000-8000-000000000102"'),'{photos,0,id}','"60000000-0000-4000-8000-000000000102"') from draft),'50000000-0000-4000-8000-000000000106')->'error'->>'code','FORBIDDEN','Receipt replay rechecks current pair');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select is(public.publish_memory('40000000-0000-4000-8000-000000000102','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000107')->'error'->>'code','FORBIDDEN','Ended pair cannot publish');
reset role;
-- Current-session enforcement applies to list reads and publication service calls.
delete from auth.sessions where id='20000000-0000-4000-8000-000000000003';
select pg_temp.as_user(3);
set local role authenticated;
select is(public.list_memories('30000000-0000-4000-8000-000000000002')->'error'->>'code','UNAUTHENTICATED','Deleted session rejects old JWT');
reset role;
update public.profiles set account_status='disabled' where user_id='10000000-0000-4000-8000-000000000004';
select pg_temp.as_user(4);
set local role authenticated;
select is((select count(*)::integer from public.memories where pair_id='30000000-0000-4000-8000-000000000001'),0,'Disabled account cannot read despite valid session');
reset role;
select * from finish();
rollback;
