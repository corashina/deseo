-- Importance: 100. Membership constraints protect pair capacity.
begin;
\ir fixtures/setup.sql.inc
select plan(19);
select has_table('public','pairs','public.pairs exists');
select has_table('public','pair_members','public.pair_members exists');
select has_table('private','pair_invites','private.pair_invites exists');
select ok(not has_table_privilege('authenticated', 'private.pair_invites', 'SELECT'), 'Invite hashes stay private');
select pg_temp.as_user(5);
set local role authenticated;
create temporary table test_pair as select public.create_pair('Europe/Warsaw','50000000-0000-4000-8000-000000000001') result;
select ok((select (result->>'ok')::boolean from test_pair),'Create pending pair');
select is(public.create_pair('Europe/Warsaw','50000000-0000-4000-8000-000000000001'),(select result from test_pair),'Create replay keeps same pair');
select is(public.create_pair('America/New_York','50000000-0000-4000-8000-000000000001')->'error'->>'code','CONFLICT','Command ID cannot change request');
create temporary table test_invite as select public.create_invite((select (result->'data'->>'pairId')::uuid from test_pair),'50000000-0000-4000-8000-000000000002') result;
select matches((select result->'data'->>'token' from test_invite),'^[0-9A-HJKMNP-TV-Z]{12}$','Crockford code');
select is(public.create_invite((select (result->'data'->>'pairId')::uuid from test_pair),'50000000-0000-4000-8000-000000000002')->'data'->>'token',null,'Replay does not store or return plaintext');
select is(public.accept_invite((select result->'data'->>'token' from test_invite),'50000000-0000-4000-8000-000000000003')->'error'->>'code','INVITE_UNAVAILABLE','Self join denied');
select pg_temp.as_user(6);
create temporary table joined as select public.accept_invite((select result->'data'->>'token' from test_invite),'50000000-0000-4000-8000-000000000004') result;
select ok((select (result->>'ok')::boolean from joined),'Join succeeds');
select is(public.accept_invite((select result->'data'->>'token' from test_invite),'50000000-0000-4000-8000-000000000004'),(select result from joined),'Join replay matches');
select pg_temp.as_user(7);
select is(public.accept_invite((select result->'data'->>'token' from test_invite),'50000000-0000-4000-8000-000000000005')->'error'->>'code','INVITE_UNAVAILABLE','Third join denied');
select is((select count(*)::integer from public.pairs),0,'Third account cannot read pair');
select public.preview_invite('bad-one');
select public.preview_invite('bad-two');
select public.preview_invite('bad-three');
select public.preview_invite('bad-four');
select is(public.preview_invite('bad-five')->'error'->>'code','RATE_LIMITED','Five failures block more attempts');
select pg_temp.as_user(8);
create temporary table expiring_pair as select public.create_pair('Europe/Warsaw','50000000-0000-4000-8000-000000000030') result;
create temporary table expiring_invite as select public.create_invite((select (result->'data'->>'pairId')::uuid from expiring_pair),'50000000-0000-4000-8000-000000000031') result;
reset role;
update private.pair_invites set expires_at=now()-interval '1 second'
where pair_id=(select (result->'data'->>'pairId')::uuid from expiring_pair);
select pg_temp.as_user(1);
set local role authenticated;
select is(public.preview_invite((select result->'data'->>'token' from expiring_invite))->'error'->>'code','INVITE_UNAVAILABLE','Expired code cannot preview');
reset role;
select is((select count(*)::integer from private.command_receipts where result->'data'->>'token' is not null),0,'Receipts contain no plaintext invitation');
select throws_ok($$insert into public.pair_members(pair_id,user_id,slot) values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000007','b')$$,
  '23505',null,'Pair slot caps membership at two');
select throws_ok($$insert into public.pair_members(pair_id,user_id,slot) values
  ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','a')$$,
  '23505',null,'Existing membership cannot join another pair');
select * from finish();
rollback;
