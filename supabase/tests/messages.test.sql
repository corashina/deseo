-- Importance: 100 for privacy, retries, and cursors; 95 for pagination.
begin;
\ir fixtures/setup.sql.inc
select plan(62);
select has_table('public','messages','public.messages exists');
select has_table('private','conversation_reads','private.conversation_reads exists');
select ok(not has_table_privilege('anon','public.messages','SELECT'),'Anonymous users cannot read messages');
select ok(not has_table_privilege('authenticated','public.messages','INSERT'),'Messages require send commands');
select ok(not has_table_privilege('authenticated','public.messages','UPDATE'),'Sent messages cannot be edited directly');
select ok(not has_table_privilege('authenticated','public.messages','DELETE'),'Messages require delete commands');
select ok(not has_column_privilege('authenticated','public.messages','payload_hash','SELECT'),'Payload hash stays private');
select ok(not has_table_privilege('authenticated','private.conversation_reads','UPDATE'),'Read cursors require commands');
select ok(not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
  and schemaname='private' and tablename='conversation_reads'),'Read cursors never enter Realtime');
select pg_temp.as_user(1);
set local role authenticated;
create temporary table first_send as select public.send_message('30000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001','First message') result;
select ok((select (result->>'ok')::boolean from first_send),'Send own message');
select ok((select not (result->'data' ? 'payload_hash') from first_send),'Send result contains no payload hash');
select is(public.send_message('30000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','First message'),
  (select result from first_send),'Lost acknowledgement retry returns the durable message');
select is((select count(*)::integer from public.messages),1,'Retry creates no duplicate');
select is(public.send_message('30000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','Changed body')->'error'->>'code',
  'CONFLICT','Client UUID cannot change payload');
select is(public.send_message('30000000-0000-4000-8000-000000000001',gen_random_uuid(),E' \n\t ')->'error'->>'code','VALIDATION','Whitespace is not a message');
select is(public.send_message('30000000-0000-4000-8000-000000000001',gen_random_uuid(),repeat('x',4001))->'error'->>'code','VALIDATION','Body length is bounded');
select is((public.get_unread_count('30000000-0000-4000-8000-000000000001')->'data'->>'count')::integer,0,'Own message is not unread');
select throws_ok('select payload_hash from public.messages','42501',null,'Hash cannot be selected');
select pg_temp.as_user(2);
select is((select count(*)::integer from public.messages),1,'Partner sees the message');
select is(public.delete_message((select (result->'data'->>'id')::uuid from first_send),gen_random_uuid())->'error'->>'code','FORBIDDEN','Partner cannot delete the message');
select is(jsonb_array_length(public.reconcile_message_sends('30000000-0000-4000-8000-000000000001',
  array['60000000-0000-4000-8000-000000000001'::uuid])->'data'->'messages'),0,'Reconciliation returns only own sends');
create temporary table second_send as select public.send_message('30000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000002','Second message') result;
create temporary table third_send as select public.send_message('30000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000003','Third message') result;
select ok((select (result->'data'->>'created_at')::timestamptz from third_send)
  >(select (result->'data'->>'created_at')::timestamptz from second_send),'Pair timestamps strictly increase');
select pg_temp.as_user(1);
select is((public.get_unread_count('30000000-0000-4000-8000-000000000001')->'data'->>'count')::integer,2,'Only partner messages count as unread');
select ok((public.set_read_cursor('30000000-0000-4000-8000-000000000001',
  (select (result->'data'->>'created_at')::timestamptz from second_send),(select (result->'data'->>'id')::uuid from second_send))->>'ok')::boolean,'Set visible cursor');
select is((public.get_unread_count('30000000-0000-4000-8000-000000000001')->'data'->>'count')::integer,1,'Cursor counts only later partner messages');
select ok((public.set_read_cursor('30000000-0000-4000-8000-000000000001',
  (select (result->'data'->>'created_at')::timestamptz from third_send),(select (result->'data'->>'id')::uuid from third_send))->>'ok')::boolean,'Advance cursor');
select is(public.set_read_cursor('30000000-0000-4000-8000-000000000001',
  (select (result->'data'->>'created_at')::timestamptz from second_send),(select (result->'data'->>'id')::uuid from second_send))->'data'->>'id',
  (select result->'data'->>'id' from third_send),'Older requests cannot move the cursor backwards');
select is(public.set_read_cursor('30000000-0000-4000-8000-000000000001',now()+interval '100 years',
  (select (result->'data'->>'id')::uuid from third_send))->'error'->>'code','VALIDATION','Forged future timestamp is rejected');
select is(public.set_read_cursor('30000000-0000-4000-8000-000000000001',now(),gen_random_uuid())->'error'->>'code',
  'VALIDATION','Missing cursor target is rejected');
select is((select count(*)::integer from private.conversation_reads),1,'Reader sees own cursor');
select pg_temp.as_user(2);
select is((select count(*)::integer from private.conversation_reads),0,'Partner sees no read receipt');
select ok((public.delete_message((select (result->'data'->>'id')::uuid from third_send),gen_random_uuid())->>'ok')::boolean,'Author deletes the cursor message');
select pg_temp.as_user(1);
select is((public.get_unread_count('30000000-0000-4000-8000-000000000001')->'data'->>'count')::integer,0,'Deleted cursor still bounds unread messages');
select is((select last_read_message_id::text from private.conversation_reads),(select result->'data'->>'id' from third_send),'Deletion retains the private cursor');
select is(public.set_read_cursor('30000000-0000-4000-8000-000000000001',
  (select (result->'data'->>'created_at')::timestamptz from third_send),(select (result->'data'->>'id')::uuid from third_send))->'error'->>'code',
  'VALIDATION','New cursor calls require a visible target');
select pg_temp.as_user(2);
create temporary table fourth_send as select public.send_message('30000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000004','Fourth message') result;
select pg_temp.as_user(1);
select is((public.get_unread_count('30000000-0000-4000-8000-000000000001')->'data'->>'count')::integer,1,'New send after a deleted cursor remains unread');
select is(jsonb_array_length(public.reconcile_message_sends('30000000-0000-4000-8000-000000000001',
  array['60000000-0000-4000-8000-000000000001'::uuid])->'data'->'messages'),1,'Reconciliation confirms own durable sends');
select is(public.reconcile_message_sends('30000000-0000-4000-8000-000000000001',array_fill(gen_random_uuid(),array[101]))->'error'->>'code',
  'VALIDATION','Reconciliation is bounded');
select pg_temp.as_user(3);
select is((select count(*)::integer from public.messages),0,'Foreign pair cannot read messages');
select is(public.send_message('30000000-0000-4000-8000-000000000001',gen_random_uuid(),'Probe')->'error'->>'code','FORBIDDEN','Foreign pair cannot send');
select is(public.get_unread_count('30000000-0000-4000-8000-000000000001')->'error'->>'code','FORBIDDEN','Foreign pair cannot count messages');
select is(public.reconcile_message_sends('30000000-0000-4000-8000-000000000001',array[]::uuid[])->'error'->>'code',
  'FORBIDDEN','Foreign pair cannot reconcile');
select is(public.set_read_cursor('30000000-0000-4000-8000-000000000001',
  (select (result->'data'->>'created_at')::timestamptz from first_send),(select (result->'data'->>'id')::uuid from first_send))->'error'->>'code',
  'FORBIDDEN','Foreign pair cannot set a cursor');
select pg_temp.as_user(1);
create temporary table own_delete as select public.delete_message((select (result->'data'->>'id')::uuid from first_send),
  '70000000-0000-4000-8000-000000000001') result;
select ok((select (result->>'ok')::boolean from own_delete),'Author deletes own message');
select is(public.delete_message((select (result->'data'->>'id')::uuid from first_send),'70000000-0000-4000-8000-000000000001'),
  (select result from own_delete),'Delete acknowledgement retry is stable');
select is((select count(*)::integer from public.messages),2,'Tombstones are hidden by RLS');
reset role;
delete from private.command_receipts where command_type='message_delete';
select ok((select body is null and pinned_at is null and deleted_at is not null from public.messages
  where id=(select (result->'data'->>'id')::uuid from first_send)),'Tombstone clears body and pin');
select throws_ok($$update public.messages set body='Rewritten' where id=(select (result->'data'->>'id')::uuid from second_send)$$,
  'P0001','FORBIDDEN','Sent text is immutable even through privileged SQL');
set local role authenticated;
select is(public.send_message('30000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','First message')->'error'->>'code',
  'FORBIDDEN','Deleted message cannot return after receipt expiry');
select is(public.send_message('30000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','Replacement')->'error'->>'code',
  'CONFLICT','Tombstone still rejects changed payload');
create temporary table reconciled_delete as select public.reconcile_message_sends('30000000-0000-4000-8000-000000000001',
  array['60000000-0000-4000-8000-000000000001'::uuid]) result;
select is(jsonb_array_length((select result->'data'->'messages' from reconciled_delete)),0,'Reconciliation returns no deleted text');
select is((select result->'data'->'deleted_client_ids'->>0 from reconciled_delete),'60000000-0000-4000-8000-000000000001','Reconciliation confirms deleted client ID');
reset role;
update public.profiles set account_status='disabled' where user_id='10000000-0000-4000-8000-000000000001';
set local role authenticated;
select is((select count(*)::integer from public.messages),0,'Disabled account loses reads');
select is(public.delete_message((select (result->'data'->>'id')::uuid from first_send),gen_random_uuid())->'error'->>'code','FORBIDDEN','Disabled account loses commands');
reset role;
update public.profiles set account_status='active' where user_id='10000000-0000-4000-8000-000000000001';
delete from auth.sessions where id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.send_message('30000000-0000-4000-8000-000000000001',gen_random_uuid(),'Old JWT')->'error'->>'code','UNAUTHENTICATED','Revoked session cannot send');
select pg_temp.as_user(3);
do $$ begin
  for n in 1..55 loop
    perform public.send_message('30000000-0000-4000-8000-000000000002',gen_random_uuid(),'Page message '||n);
  end loop;
end $$;
create temporary table first_page as select id,created_at from public.messages
  where pair_id='30000000-0000-4000-8000-000000000002' order by created_at desc,id desc limit 50;
select is((select count(*)::integer from first_page),50,'First page has 50 messages');
select public.send_message('30000000-0000-4000-8000-000000000002',gen_random_uuid(),'New arrival');
create temporary table next_page as select id,created_at from public.messages
  where pair_id='30000000-0000-4000-8000-000000000002'
    and (created_at,id)<(select created_at,id from first_page order by created_at,id limit 1)
  order by created_at desc,id desc limit 50;
select is((select count(*)::integer from next_page),5,'New arrival does not shift older pages');
select is((select count(*)::integer from first_page a join next_page b using(id)),0,'Pages contain no duplicate messages');
reset role;
insert into public.messages(pair_id,author_id,client_id,body,payload_hash,created_at)
  values('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003',gen_random_uuid(),
    'Clock ahead',extensions.digest('Clock ahead','sha256'),clock_timestamp()+interval '1 day');
set local role authenticated;
select ok((public.send_message('30000000-0000-4000-8000-000000000002',gen_random_uuid(),'After clock change')->'data'->>'created_at')::timestamptz
  >(select created_at from public.messages where body='Clock ahead'),'Server clock changes cannot create cursor holes');
reset role;
update public.pairs set state='ended',ended_at=now(),purge_after=now()+interval '30 days' where id='30000000-0000-4000-8000-000000000002';
update public.pair_members set left_at=now() where pair_id='30000000-0000-4000-8000-000000000002';
set local role authenticated;
select is((select count(*)::integer from public.messages),0,'Ended pair loses message reads');
select is(public.get_unread_count('30000000-0000-4000-8000-000000000002')->'error'->>'code','FORBIDDEN','Ended pair loses unread access');
select is(public.send_message('30000000-0000-4000-8000-000000000002',gen_random_uuid(),'Ended pair')->'error'->>'code','FORBIDDEN','Ended pair cannot send');
reset role;
select * from finish();
rollback;
