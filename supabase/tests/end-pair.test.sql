-- Importance: 100. Pair closure must consume one fresh proof.
begin;
\ir fixtures/setup.sql.inc
select plan(15);
select has_function('public', 'end_pair', array['uuid', 'text', 'uuid']);
select ok(not has_function_privilege('anon', 'public.end_pair(uuid,text,uuid)', 'EXECUTE'), 'Anonymous closure denied');
insert into private.verification_proofs(proof_hash,user_id,action,expires_at) values
  (extensions.digest(repeat('a',64),'sha256'),'10000000-0000-4000-8000-000000000001','end_pair',now()+interval '10 minutes'),
  (extensions.digest(repeat('b',64),'sha256'),'10000000-0000-4000-8000-000000000001','end_pair',now()+interval '10 minutes');
update private.verification_proofs set created_at=now()-interval '20 minutes',expires_at=now()-interval '10 minutes' where proof_hash=extensions.digest(repeat('b',64),'sha256');
select pg_temp.as_user(2);
set local role authenticated;
select is(public.end_pair('30000000-0000-4000-8000-000000000001',repeat('a',64),'50000000-0000-4000-8000-000000000020')->'error'->>'code','FORBIDDEN','Wrong account proof');
select pg_temp.as_user(1);
select is(public.end_pair('30000000-0000-4000-8000-000000000001',repeat('f',64),'50000000-0000-4000-8000-000000000021')->'error'->>'code','FORBIDDEN','Forged proof');
select is(public.end_pair('30000000-0000-4000-8000-000000000001',repeat('b',64),'50000000-0000-4000-8000-000000000022')->'error'->>'code','FORBIDDEN','Expired proof');
create temporary table ended as select public.end_pair('30000000-0000-4000-8000-000000000001',repeat('a',64),'50000000-0000-4000-8000-000000000023') result;
select ok((select (result->>'ok')::boolean from ended),'Fresh proof closes pair');
select is(public.end_pair('30000000-0000-4000-8000-000000000001',repeat('a',64),'50000000-0000-4000-8000-000000000023'),(select result from ended),'Closure replay returns receipt');
select is(public.get_pair_context()->'data'->>'status','ended','Own export deadline remains');
select is((select count(*)::integer from public.pairs),0,'Ended pair normal reads denied');
select pg_temp.as_user(2);
select is((select count(*)::integer from public.pairs),0,'Former partner normal reads denied');
select ok((public.create_pair('Europe/Warsaw','50000000-0000-4000-8000-000000000024')->>'ok')::boolean,'New pair permitted');
reset role;
select is((select count(*)::integer from private.verification_proofs where consumed_at is not null),1,'Proof consumed once');
insert into public.pairs(id,state,timezone) values('30000000-0000-4000-8000-000000000003','active','Europe/Warsaw');
insert into public.pair_members(pair_id,user_id,slot) values
  ('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','a'),
  ('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000005','b');
select pg_temp.as_user(1);
set local role authenticated;
select is(public.end_pair('30000000-0000-4000-8000-000000000003',repeat('a',64),'50000000-0000-4000-8000-000000000025')->'error'->>'code','FORBIDDEN','Consumed proof cannot close a new pair');
reset role;
select is((select state from public.pairs where id='30000000-0000-4000-8000-000000000003'),'active','Proof replay leaves new pair active');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select is(public.issue_verification_proof('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','export',repeat('c',64))->'error'->>'code','VALIDATION','Wrong action denied');
reset role;
select * from finish();
rollback;
