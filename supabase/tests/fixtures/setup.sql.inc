set search_path=public,extensions;
create extension if not exists pgtap with schema extensions;
insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,created_at,updated_at)
select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
  'sql-fixture-'||n||'@example.test',now(),now(),now() from generate_series(1,8) n;
insert into auth.sessions(id,user_id,created_at,updated_at)
select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,now(),now() from generate_series(1,8) n;
insert into public.profiles(user_id,display_name,timezone,locale)
select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Fixture '||n,'Europe/Warsaw','en' from generate_series(1,8) n;
insert into public.pairs(id,state) values
  ('30000000-0000-4000-8000-000000000001','active'),
  ('30000000-0000-4000-8000-000000000002','active');
insert into public.pair_members(pair_id,user_id,slot) values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','a'),
  ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','b'),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','a'),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','b');
create function pg_temp.as_user(n integer) returns void language sql as $$
  select set_config('request.jwt.claims',jsonb_build_object('sub','10000000-0000-4000-8000-'||lpad(n::text,12,'0'),
    'session_id','20000000-0000-4000-8000-'||lpad(n::text,12,'0'),'role','authenticated')::text,true);
$$;
