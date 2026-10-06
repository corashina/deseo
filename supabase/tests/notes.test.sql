-- Importance: 94. Author-only pins replace atomically and disappear on deletion.
begin;
\ir fixtures/setup.sql.inc
select plan(21);
select pg_temp.as_user(1);
set local role authenticated;
create temporary table first_note as select public.send_message('30000000-0000-4000-8000-000000000001',gen_random_uuid(),'First note')->'data' item;
create temporary table second_note as select public.send_message('30000000-0000-4000-8000-000000000001',gen_random_uuid(),'Second note')->'data' item;
create temporary table first_pin as select public.pin_message((select (item->>'id')::uuid from first_note),'70000000-0000-4000-8000-000000000011') result;
select ok((select (result->>'ok')::boolean from first_pin),'Author pins a message');
select is((select count(*)::integer from public.messages where pinned_at is not null),1,'Pin reads the original message');
select is(public.pin_message((select (item->>'id')::uuid from first_note),'70000000-0000-4000-8000-000000000011'),
  (select result from first_pin),'Pin acknowledgement retry is stable');
select is(public.pin_message((select (item->>'id')::uuid from second_note),'70000000-0000-4000-8000-000000000011')->'error'->>'code',
  'CONFLICT','Pin command UUID cannot change target');
select ok((public.pin_message((select (item->>'id')::uuid from second_note),'70000000-0000-4000-8000-000000000012')->>'ok')::boolean,'Author replaces own pin');
select is((select count(*)::integer from public.messages where pinned_at is not null),1,'Replacement keeps one own pin');
select is((select id::text from public.messages where pinned_at is not null),(select item->>'id' from second_note),'Replacement selects the new message');
select public.pin_message((select (item->>'id')::uuid from first_note),'70000000-0000-4000-8000-000000000011');
select is((select id::text from public.messages where pinned_at is not null),(select item->>'id' from second_note),'Late retry does not restore an old pin');
select pg_temp.as_user(2);
select is(public.pin_message((select (item->>'id')::uuid from first_note),gen_random_uuid())->'error'->>'code','FORBIDDEN','Partner cannot pin another author message');
select is(public.unpin_message((select (item->>'id')::uuid from second_note),gen_random_uuid())->'error'->>'code','FORBIDDEN','Partner cannot remove another author note');
create temporary table partner_note as select public.send_message('30000000-0000-4000-8000-000000000001',gen_random_uuid(),'Partner note')->'data' item;
select ok((public.pin_message((select (item->>'id')::uuid from partner_note),gen_random_uuid())->>'ok')::boolean,'Partner pins own message');
select is((select count(*)::integer from public.messages where pinned_at is not null),2,'Each author may keep one note');
select pg_temp.as_user(3);
select is((select count(*)::integer from public.messages where pinned_at is not null),0,'Foreign pair cannot read notes');
select is(public.pin_message((select (item->>'id')::uuid from second_note),gen_random_uuid())->'error'->>'code','FORBIDDEN','Foreign pair cannot pin');
select pg_temp.as_user(1);
select ok((public.unpin_message((select (item->>'id')::uuid from second_note),gen_random_uuid())->>'ok')::boolean,'Author removes own pin');
select is((select count(*)::integer from public.messages where pinned_at is not null),1,'Unpin preserves partner note');
select public.pin_message((select (item->>'id')::uuid from second_note),'70000000-0000-4000-8000-000000000013');
select public.delete_message((select (item->>'id')::uuid from second_note),gen_random_uuid());
select is((select count(*)::integer from public.messages where pinned_at is not null),1,'Deleting a source removes its note');
select is(public.pin_message((select (item->>'id')::uuid from second_note),'70000000-0000-4000-8000-000000000013')->'error'->>'code',
  'FORBIDDEN','A prior pin receipt cannot restore a deleted source');
reset role;
select throws_ok($$update public.messages set pinned_at=now() where id=(select (item->>'id')::uuid from second_note)$$,
  '23514',null,'Tombstone cannot keep a pin');
update public.pairs set state='ended',ended_at=now(),purge_after=now()+interval '30 days' where id='30000000-0000-4000-8000-000000000001';
update public.pair_members set left_at=now() where pair_id='30000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.pin_message((select (item->>'id')::uuid from first_note),'70000000-0000-4000-8000-000000000011')->'error'->>'code',
  'FORBIDDEN','Ended pair rejects previous pin receipts');
select is((select count(*)::integer from public.messages where pinned_at is not null),0,'Ended pair loses pinned notes');
reset role;
select * from finish();
rollback;
