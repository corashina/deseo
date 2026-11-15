-- Importance: 95. Ending a pair removes shared access for both people and needs a fresh sign-in.
begin;
\ir fixtures/setup.sql.inc
select plan(5);
insert into auth.mfa_amr_claims(id,session_id,authentication_method,created_at,updated_at) values
  (gen_random_uuid(),'20000000-0000-4000-8000-000000000001','otp',now()-interval '11 minutes',now()-interval '11 minutes'),
  (gen_random_uuid(),'20000000-0000-4000-8000-000000000003','otp',now()-interval '1 minute',now()-interval '1 minute');
select pg_temp.as_user(1);
set local role authenticated;
select is(public.end_pair('30000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001')->'error'->>'code','FORBIDDEN','An old sign-in cannot end a pair');
reset role;
select pg_temp.as_user(3);
set local role authenticated;
select is(public.end_pair('30000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002')->'error'->>'code','FORBIDDEN','A fresh sign-in cannot end another pair');
select ok((public.end_pair('30000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000003')->>'ok')::boolean,'A fresh sign-in ends its own pair');
reset role;
update auth.mfa_amr_claims set updated_at=now()-interval '1 hour' where session_id='20000000-0000-4000-8000-000000000003';
select pg_temp.as_user(3);
set local role authenticated;
select ok((public.end_pair('30000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000003')->>'ok')::boolean,'A retry replays its receipt without a fresh sign-in');
reset role;
select is((select state from public.pairs where id='30000000-0000-4000-8000-000000000002'),'ended','The pair is ended');
select * from finish();
rollback;
