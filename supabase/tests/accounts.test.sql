-- Importance: 100. Unauthorized accounts must not read protected rows.
begin;
\ir fixtures/setup.sql.inc
select plan(12);
select has_table('public','profiles','public.profiles exists');
select has_table('private','command_receipts','private.command_receipts exists');
select has_table('private','verification_proofs','private.verification_proofs exists');
select ok(not has_table_privilege('anon', 'public.profiles', 'SELECT'), 'No public profiles');
select ok(not has_table_privilege('authenticated', 'private.verification_proofs', 'SELECT'), 'Proofs stay private');
select pg_temp.as_user(1);
set local role authenticated;
select is((select count(*)::integer from public.profiles),2,'Self and current partner only');
select is(public.get_session_context()->'data'->>'userId','10000000-0000-4000-8000-000000000001','Account from real session');
select is(public.save_profile('Changed','Europe/Warsaw','en',9)->'error'->>'code','CONFLICT','Stale profile version denied');
reset role;
update public.profiles set account_status='disabled' where user_id='10000000-0000-4000-8000-000000000001';
set local role authenticated;
select is((select count(*)::integer from public.profiles),0,'Disabled account loses reads');
select is(public.get_session_context()->'error'->>'code','FORBIDDEN','Disabled restore denied');
reset role;
update public.profiles set account_status='active' where user_id='10000000-0000-4000-8000-000000000001';
delete from auth.sessions where id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
select is((select count(*)::integer from public.profiles),0,'Revoked session loses reads');
select is(public.get_session_context()->'error'->>'code','UNAUTHENTICATED','Old JWT cannot restore');
reset role;
select * from finish();
rollback;
