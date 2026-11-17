-- Deseo baseline schema. Sections follow feature order. Later sections depend on earlier ones.

-- ========== accounts ==========
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
create extension if not exists pgcrypto with schema extensions;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40 and display_name = btrim(display_name)),
  timezone text not null,
  locale text not null check (char_length(locale) between 2 and 35),
  account_status text not null default 'active' check (account_status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0)
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;

create table private.command_receipts (
  actor uuid not null references auth.users(id) on delete cascade,
  command_id uuid not null,
  command_type text not null,
  pair_id uuid,
  request_hash bytea not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  primary key (actor, command_id, command_type)
);
create index command_receipts_expiry on private.command_receipts(expires_at);
alter table private.command_receipts enable row level security;

revoke all on all tables in schema private from public, anon, authenticated;

-- Check the actual Auth session. Editable metadata does not grant access.
create function private.session_actor() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); session_text text := auth.jwt()->>'session_id';
begin
  if actor is null or session_text is null or session_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null; end if;
  if not exists (
    select 1 from auth.sessions s join auth.users u on u.id = s.user_id
    where s.id = session_text::uuid and s.user_id = actor
      and (s.not_after is null or s.not_after > now())
      and u.email_confirmed_at is not null and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
  ) then return null; end if;
  return actor;
end;
$$;

create function private.active_actor() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.user_id from public.profiles p
  where p.user_id = private.session_actor() and p.account_status = 'active';
$$;

create function private.require_actor() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.session_actor();
begin
  if actor is null then raise exception using message = 'UNAUTHENTICATED', errcode = 'P0001'; end if;
  if not exists(select 1 from public.profiles where user_id = actor and account_status = 'active') then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
  return actor;
end;
$$;

create function private.error(p_code text, p_field text default null) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('ok', false, 'error', jsonb_strip_nulls(jsonb_build_object('code', p_code, 'field', p_field)));
$$;

create function private.account_json(p public.profiles) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', p.user_id, 'displayName', p.display_name, 'timezone', p.timezone,
    'locale', p.locale, 'status', p.account_status, 'version', p.version);
$$;

create function private.check_timezone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception using message = 'VALIDATION', errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger profiles_timezone before insert or update on public.profiles
for each row execute function private.check_timezone();


-- Call only after locking the actor's profile row.
create function private.receipt(p_actor uuid, p_command uuid, p_type text, p_request jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare r private.command_receipts;
begin
  if p_command is null then return private.error('VALIDATION', 'commandId'); end if;
  select * into r from private.command_receipts
  where actor = p_actor and command_id = p_command and command_type = p_type and expires_at > now();
  if not found then return null; end if;
  if r.request_hash <> extensions.digest(p_request::text, 'sha256') then return private.error('CONFLICT'); end if;
  return r.result;
end;
$$;

create function private.save_receipt(p_actor uuid, p_command uuid, p_type text, p_pair uuid, p_request jsonb, p_data jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare result jsonb := jsonb_build_object('ok', true, 'data', p_data);
begin
  insert into private.command_receipts(actor,command_id,command_type,pair_id,request_hash,result)
  values(p_actor,p_command,p_type,p_pair,extensions.digest(p_request::text,'sha256'),result)
  on conflict(actor,command_id,command_type) do update set request_hash=excluded.request_hash,
    result=excluded.result, pair_id=excluded.pair_id, created_at=now(), expires_at=now()+interval '30 days';
  return result;
end;
$$;

create function private.get_session_context() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.session_actor(); profile public.profiles;
begin
  if actor is null then return private.error('UNAUTHENTICATED'); end if;
  select * into profile from public.profiles where user_id=actor;
  if found and profile.account_status <> 'active' then return private.error('FORBIDDEN'); end if;
  return jsonb_build_object('ok',true,'data',jsonb_build_object('userId',actor,'account',
    case when profile.user_id is null then null else private.account_json(profile) end));
end;
$$;

create function private.save_profile(p_display_name text,p_timezone text,p_locale text,p_expected_version integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.session_actor(); profile public.profiles;
begin
  if actor is null then return private.error('UNAUTHENTICATED'); end if;
  if p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 40 then return private.error('VALIDATION','displayName'); end if;
  if p_locale is null or char_length(p_locale) not between 2 and 35 then return private.error('VALIDATION','locale'); end if;
  if p_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then return private.error('VALIDATION','timezone'); end if;
  -- The Auth row serializes profile creation before a profile exists.
  perform 1 from auth.users where id=actor for update;
  select * into profile from public.profiles where user_id=actor for update;
  if found then
    if profile.account_status <> 'active' then return private.error('FORBIDDEN'); end if;
    if p_expected_version is null or profile.version <> p_expected_version then return private.error('CONFLICT'); end if;
    update public.profiles set display_name=btrim(p_display_name),timezone=p_timezone,locale=p_locale,
      version=version+1,updated_at=now() where user_id=actor returning * into profile;
  else
    if p_expected_version is not null then return private.error('CONFLICT'); end if;
    insert into public.profiles(user_id,display_name,timezone,locale)
    values(actor,btrim(p_display_name),p_timezone,p_locale) returning * into profile;
  end if;
  return jsonb_build_object('ok',true,'data',private.account_json(profile));
end;
$$;

create function public.get_session_context() returns jsonb language sql security invoker set search_path = ''
as $$ select private.get_session_context(); $$;
create function public.save_profile(p_display_name text,p_timezone text,p_locale text,p_expected_version integer default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.save_profile(p_display_name,p_timezone,p_locale,p_expected_version); $$;
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.get_session_context(),public.save_profile(text,text,text,integer) from public,anon,authenticated;
grant execute on function private.active_actor(),private.get_session_context(),private.save_profile(text,text,text,integer) to authenticated;
grant execute on function public.get_session_context(),public.save_profile(text,text,text,integer) to authenticated;

-- ========== pairing ==========
create table public.pairs (
  id uuid primary key default gen_random_uuid(),
  state text not null default 'pending' check (state in ('pending','active','ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  purge_after timestamptz,
  check ((state='ended' and ended_at is not null and purge_after=ended_at+interval '30 days')
    or (state<>'ended' and ended_at is null and purge_after is null))
);
create table public.pair_members (
  pair_id uuid not null references public.pairs(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id),
  slot text not null check (slot in ('a','b')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key(pair_id,user_id),
  unique(pair_id,slot),
  check (left_at is null or left_at >= joined_at)
);
create unique index pair_members_one_current on public.pair_members(user_id) where left_at is null;
create index pair_members_user_history on public.pair_members(user_id,joined_at desc);
create table private.pair_invites (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id) on delete cascade,
  token_hash bytea not null unique,
  created_by uuid not null references public.profiles(user_id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '24 hours'),
  accepted_at timestamptz,
  revoked_at timestamptz
);
create unique index pair_invites_one_live on private.pair_invites(pair_id) where accepted_at is null and revoked_at is null;
create index pair_invites_creator on private.pair_invites(created_by);
create table private.invite_attempts (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  window_start timestamptz not null default now(),
  failures integer not null default 0 check (failures >= 0)
);
alter table public.pairs enable row level security;
alter table public.pair_members enable row level security;
alter table private.pair_invites enable row level security;
alter table private.invite_attempts enable row level security;
revoke all on public.pairs,public.pair_members from public,anon,authenticated;
grant select on public.pairs,public.pair_members to authenticated;
grant all on public.pairs,public.pair_members to service_role;
revoke all on private.pair_invites,private.invite_attempts from public,anon,authenticated;
alter table private.command_receipts add constraint command_receipts_pair_fk foreign key(pair_id) references public.pairs(id) on delete cascade;

create function private.is_member(p_pair uuid,p_active_only boolean default true) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.pair_members m join public.pairs p on p.id=m.pair_id
    where m.pair_id=p_pair and m.user_id=private.active_actor() and m.left_at is null
      and p.state = any(case when p_active_only then array['active'] else array['pending','active'] end));
$$;
-- An account has at most one current pair. Policies compare pair_id with (select private.actor_pair()).
-- The wrapping select runs the lookup once per statement, not once per row.
create function private.actor_pair(p_active_only boolean default true) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.pair_id from public.pair_members m join public.pairs p on p.id=m.pair_id
  where m.user_id=private.active_actor() and m.left_at is null
    and p.state = any(case when p_active_only then array['active'] else array['pending','active'] end);
$$;
revoke all on function private.actor_pair(boolean) from public,anon,authenticated;
grant execute on function private.actor_pair(boolean) to authenticated;

create function private.is_partner(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.pair_members mine join public.pair_members theirs on theirs.pair_id=mine.pair_id
    join public.pairs p on p.id=mine.pair_id join public.profiles target on target.user_id=theirs.user_id
    where mine.user_id=private.active_actor() and theirs.user_id=p_user
      and mine.left_at is null and theirs.left_at is null and p.state='active' and target.account_status='active');
$$;
create policy profiles_read on public.profiles for select to authenticated
using(user_id=(select private.active_actor()) or private.is_partner(user_id));
create policy pairs_current on public.pairs for select to authenticated using(id=(select private.actor_pair(false)));
-- A member can read their own content-free closure row for Realtime revocation.
create policy members_current on public.pair_members for select to authenticated
using(user_id=(select private.active_actor()) or pair_id=(select private.actor_pair()));

-- All pair commands take profile locks in UUID order, then the pair lock.
create function private.lock_pair(p_pair uuid,p_actor uuid) returns void
language plpgsql set search_path = '' as $$
begin
  perform 1 from public.profiles where user_id=p_actor or user_id in
    (select user_id from public.pair_members where pair_id=p_pair and left_at is null)
    order by user_id for update;
  perform 1 from public.pairs where id=p_pair for update;
  perform private.require_actor();
end;
$$;
create function private.invite_limited(p_actor uuid) returns boolean
language plpgsql set search_path = '' as $$
begin
  insert into private.invite_attempts(user_id) values(p_actor) on conflict do nothing;
  update private.invite_attempts set window_start=now(),failures=0
    where user_id=p_actor and window_start <= now()-interval '15 minutes';
  return exists(select 1 from private.invite_attempts where user_id=p_actor and failures>=5);
end;
$$;
create function private.invite_failed(p_actor uuid) returns jsonb
language plpgsql set search_path = '' as $$
begin
  update private.invite_attempts set failures=failures+1 where user_id=p_actor;
  return private.error('INVITE_UNAVAILABLE');
end;
$$;
create function private.token_hash(p_token text) returns bytea
language sql immutable set search_path = '' as $$
  select extensions.digest(upper(regexp_replace(coalesce(p_token,''),'[ -]','','g')),'sha256');
$$;

create function private.create_pair(p_command_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid; result jsonb; pair uuid; request jsonb := '{}'::jsonb;
begin
  actor := private.require_actor();
  perform 1 from public.profiles where user_id=actor for update;
  perform private.require_actor();
  result := private.receipt(actor,p_command_id,'create_pair',request);
  if result is not null then return result; end if;
  if exists(select 1 from public.pair_members where user_id=actor and left_at is null) then return private.error('ALREADY_PAIRED'); end if;
  insert into public.pairs default values returning id into pair;
  insert into public.pair_members(pair_id,user_id,slot) values(pair,actor,'a');
  return private.save_receipt(actor,p_command_id,'create_pair',pair,request,jsonb_build_object('pairId',pair));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end;
$$;

create function private.create_invite(p_pair_id uuid,p_command_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid; result jsonb; token text := ''; alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  random_bytes bytea; expiry timestamptz := now()+interval '24 hours'; request jsonb := jsonb_build_object('pairId',p_pair_id);
begin
  actor := private.require_actor(); perform private.lock_pair(p_pair_id,actor);
  if not exists(select 1 from public.pair_members m join public.pairs p on p.id=m.pair_id
    where p.id=p_pair_id and p.state='pending' and m.user_id=actor and m.slot='a' and m.left_at is null)
    then return private.error('FORBIDDEN'); end if;
  result := private.receipt(actor,p_command_id,'create_invite',request);
  if result is not null then return result; end if;
  random_bytes := extensions.gen_random_bytes(12);
  for i in 0..11 loop token := token || substr(alphabet,(get_byte(random_bytes,i) & 31)+1,1); end loop;
  update private.pair_invites set revoked_at=now() where pair_id=p_pair_id and accepted_at is null and revoked_at is null;
  insert into private.pair_invites(pair_id,token_hash,created_by,expires_at) values(p_pair_id,private.token_hash(token),actor,expiry);
  -- A receipt stores metadata only. The code leaves the server once.
  perform private.save_receipt(actor,p_command_id,'create_invite',p_pair_id,request,
    jsonb_build_object('token',null,'expiresAt',expiry,'alreadyDelivered',true));
  return jsonb_build_object('ok',true,'data',jsonb_build_object('token',token,'expiresAt',expiry,'alreadyDelivered',false));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end;
$$;

create function private.preview_invite(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid; invitation private.pair_invites; info jsonb;
begin
  actor := private.require_actor();
  perform 1 from public.profiles where user_id=actor for update;
  perform private.require_actor();
  if private.invite_limited(actor) then return private.error('RATE_LIMITED'); end if;
  select * into invitation from private.pair_invites where token_hash=private.token_hash(p_token)
    and accepted_at is null and revoked_at is null and expires_at>now();
  if not found then return private.invite_failed(actor); end if;
  select jsonb_build_object('pairId',p.id,'inviterName',profile.display_name,'expiresAt',invitation.expires_at)
    into info from public.pairs p join public.profiles profile on profile.user_id=invitation.created_by
    where p.id=invitation.pair_id and p.state='pending' and profile.account_status='active';
  if info is null then return private.invite_failed(actor); end if;
  return jsonb_build_object('ok',true,'data',info);
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end;
$$;

create function private.accept_invite(p_token text,p_command_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid; invitation private.pair_invites; result jsonb;
  request jsonb := jsonb_build_object('tokenHash',encode(private.token_hash(p_token),'hex'));
begin
  actor := private.require_actor();
  select * into invitation from private.pair_invites where token_hash=private.token_hash(p_token);
  -- Include the invitation owner even when its membership has just closed.
  perform 1 from public.profiles where user_id in(actor,invitation.created_by) order by user_id for update;
  perform private.require_actor();
  result := private.receipt(actor,p_command_id,'accept_invite',request);
  if result is not null then return result; end if;
  if private.invite_limited(actor) then return private.error('RATE_LIMITED'); end if;
  if invitation.id is null then return private.invite_failed(actor); end if;
  perform 1 from public.pairs where id=invitation.pair_id for update;
  select * into invitation from private.pair_invites where id=invitation.id for update;
  if invitation.accepted_at is not null or invitation.revoked_at is not null or invitation.expires_at<=now()
    or invitation.created_by=actor or not exists(select 1 from public.pairs where id=invitation.pair_id and state='pending')
    or not exists(select 1 from public.profiles where user_id=invitation.created_by and account_status='active')
    then return private.invite_failed(actor); end if;
  if exists(select 1 from public.pair_members where user_id=actor and left_at is null) then return private.error('ALREADY_PAIRED'); end if;
  if exists(select 1 from public.pair_members where pair_id=invitation.pair_id and slot='b') then return private.invite_failed(actor); end if;
  insert into public.pair_members(pair_id,user_id,slot) values(invitation.pair_id,actor,'b');
  update public.pairs set state='active' where id=invitation.pair_id;
  update private.pair_invites set accepted_at=now() where id=invitation.id;
  update public.profiles set version=version+1,updated_at=now() where user_id in(actor,invitation.created_by);
  return private.save_receipt(actor,p_command_id,'accept_invite',invitation.pair_id,request,jsonb_build_object('pairId',invitation.pair_id));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end;
$$;

create function private.cancel_pending_pair(p_pair_id uuid,p_command_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid; result jsonb; ended timestamptz := now(); request jsonb := jsonb_build_object('pairId',p_pair_id);
begin
  actor := private.require_actor(); perform private.lock_pair(p_pair_id,actor);
  result := private.receipt(actor,p_command_id,'cancel_pending_pair',request);
  if result is not null then return result; end if;
  if not exists(select 1 from public.pair_members m join public.pairs p on p.id=m.pair_id
    where p.id=p_pair_id and p.state='pending' and m.user_id=actor and m.slot='a' and m.left_at is null)
    then return private.error('FORBIDDEN'); end if;
  update public.pairs set state='ended',ended_at=ended,purge_after=ended+interval '30 days' where id=p_pair_id;
  update public.pair_members set left_at=ended where pair_id=p_pair_id and left_at is null;
  update private.pair_invites set revoked_at=ended where pair_id=p_pair_id and accepted_at is null and revoked_at is null;
  update public.profiles set version=version+1,updated_at=now() where user_id=actor;
  return private.save_receipt(actor,p_command_id,'cancel_pending_pair',p_pair_id,request,jsonb_build_object('endedAt',ended));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end;
$$;

create function private.get_pair_context() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid; pair public.pairs; member jsonb; invite jsonb; members jsonb;
begin
  actor := private.require_actor();
  select p.* into pair from public.pairs p join public.pair_members m on m.pair_id=p.id
    where m.user_id=actor and m.left_at is null and p.state in('pending','active');
  if not found then
    select p.* into pair from public.pairs p join public.pair_members m on m.pair_id=p.id
      where m.user_id=actor and p.state='ended' and p.purge_after>now() order by p.ended_at desc limit 1;
    if not found then return jsonb_build_object('ok',true,'data',jsonb_build_object('status','unpaired')); end if;
    return jsonb_build_object('ok',true,'data',jsonb_build_object('status','ended','pairId',pair.id,
      'endedAt',pair.ended_at,'ownExportDeadline',pair.purge_after));
  end if;
  select jsonb_agg(jsonb_build_object('userId',m.user_id,'displayName',p.display_name,'slot',m.slot) order by m.slot)
    into members from public.pair_members m join public.profiles p on p.user_id=m.user_id
    where m.pair_id=pair.id and m.left_at is null;
  if pair.state='active' then
    return jsonb_build_object('ok',true,'data',jsonb_build_object('status','active','pairId',pair.id,'members',members));
  end if;
  select jsonb_build_object('expiresAt',expires_at) into invite from private.pair_invites
    where pair_id=pair.id and accepted_at is null and revoked_at is null and expires_at>now();
  member := members->0;
  return jsonb_build_object('ok',true,'data',jsonb_build_object('status','pending','pairId',pair.id,'member',member,'invite',invite));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end;
$$;

create function public.create_pair(p_command_id uuid) returns jsonb language sql security invoker set search_path = ''
as $$ select private.create_pair(p_command_id); $$;
create function public.create_invite(p_pair_id uuid,p_command_id uuid) returns jsonb language sql security invoker set search_path = ''
as $$ select private.create_invite(p_pair_id,p_command_id); $$;
create function public.preview_invite(p_token text) returns jsonb language sql security invoker set search_path = ''
as $$ select private.preview_invite(p_token); $$;
create function public.accept_invite(p_token text,p_command_id uuid) returns jsonb language sql security invoker set search_path = ''
as $$ select private.accept_invite(p_token,p_command_id); $$;
create function public.cancel_pending_pair(p_pair_id uuid,p_command_id uuid) returns jsonb language sql security invoker set search_path = ''
as $$ select private.cancel_pending_pair(p_pair_id,p_command_id); $$;
create function public.get_pair_context() returns jsonb language sql security invoker set search_path = ''
as $$ select private.get_pair_context(); $$;

revoke all on function private.is_member(uuid,boolean),private.is_partner(uuid),private.lock_pair(uuid,uuid),
private.invite_limited(uuid),private.invite_failed(uuid),private.token_hash(text),private.create_pair(uuid),
private.create_invite(uuid,uuid),private.preview_invite(text),private.accept_invite(text,uuid),private.cancel_pending_pair(uuid,uuid),
private.get_pair_context() from public,anon,authenticated;
grant execute on function private.is_member(uuid,boolean),private.is_partner(uuid),private.create_pair(uuid),
private.create_invite(uuid,uuid),private.preview_invite(text),private.accept_invite(text,uuid),private.cancel_pending_pair(uuid,uuid),
private.get_pair_context() to authenticated;
revoke all on function public.create_pair(uuid),public.create_invite(uuid,uuid),public.preview_invite(text),
public.accept_invite(text,uuid),public.cancel_pending_pair(uuid,uuid),public.get_pair_context() from public,anon,authenticated;
grant execute on function public.create_pair(uuid),public.create_invite(uuid,uuid),public.preview_invite(text),
public.accept_invite(text,uuid),public.cancel_pending_pair(uuid,uuid),public.get_pair_context() to authenticated;
alter publication supabase_realtime add table public.pair_members;
alter publication supabase_realtime add table public.profiles;

create function private.member_identity() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.pair_id<>old.pair_id or new.user_id<>old.user_id or new.slot<>old.slot or new.joined_at<>old.joined_at then
    raise exception using message='FORBIDDEN',errcode='P0001';
  end if;
  return new;
end;
$$;
create trigger member_identity before update on public.pair_members for each row execute function private.member_identity();
revoke all on function private.member_identity() from public,anon,authenticated;

-- ========== events ==========
create table public.events (
  id uuid primary key,
  pair_id uuid not null references public.pairs(id) on delete cascade,
  created_by uuid not null,
  who text not null check(who in('together','a','b','private')),
  title text not null check(char_length(title) between 1 and 120 and title=btrim(title)),
  starts_at timestamptz,
  ends_at timestamptz,
  start_date date,
  end_date_exclusive date,
  repeat text not null default 'none' check(repeat in('none','yearly')),
  repeat_month integer,
  repeat_day integer,
  important_date boolean not null default false,
  location text check(char_length(location)<=200),
  description text check(char_length(description)<=2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check(version>0),
  unique(pair_id,id),
  foreign key(pair_id,created_by) references public.pair_members(pair_id,user_id),
  check((starts_at is not null and ends_at is not null and ends_at>starts_at and start_date is null and end_date_exclusive is null)
    or (start_date is not null and end_date_exclusive is not null and end_date_exclusive>start_date and starts_at is null and ends_at is null))
);
create index events_pair_start on public.events(pair_id,starts_at,id) where starts_at is not null;
create index events_pair_date on public.events(pair_id,start_date,id) where start_date is not null;
create index events_author on public.events(created_by);
alter table public.events add constraint events_yearly_fields check(
  (repeat='none' and repeat_month is null and repeat_day is null) or
  (repeat='yearly' and important_date and repeat_month is not null and repeat_day is not null and starts_at is null and start_date is not null and end_date_exclusive=start_date+1
    and repeat_month=extract(month from start_date) and repeat_day=extract(day from start_date)));
alter table public.events enable row level security;
revoke all on public.events from public,anon,authenticated;
grant select on public.events to authenticated;
grant all on public.events to service_role;
create policy events_visible on public.events for select to authenticated
using(pair_id=(select private.actor_pair()) and (who<>'private' or created_by=(select private.active_actor())));

-- Keep only opaque IDs for former readers. This also removes drafts after an offline change to private.
create table public.event_access_revocations (
  user_id uuid not null references auth.users(id) on delete cascade,
  pair_id uuid not null,
  event_id uuid not null,
  revoked_at timestamptz not null default now(),
  primary key(user_id,event_id),
  foreign key(pair_id,event_id) references public.events(pair_id,id) on delete cascade
);
alter table public.event_access_revocations enable row level security;
revoke all on public.event_access_revocations from public,anon,authenticated;
grant select on public.event_access_revocations to authenticated;
grant all on public.event_access_revocations to service_role;
create policy own_event_revocations on public.event_access_revocations for select to authenticated
using(user_id=(select private.active_actor()));

create function private.event_identity() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id<>old.id or new.pair_id<>old.pair_id or new.created_by<>old.created_by or new.created_at<>old.created_at then
    raise exception using message='FORBIDDEN',errcode='P0001';
  end if;
  return new;
end;
$$;
create trigger events_identity before update on public.events for each row execute function private.event_identity();

-- Fixed public wrappers choose create, update, or delete. Reads remain RLS-scoped.
create function private.event_command(p_action text,p_event_id uuid,p_input jsonb,p_expected_version integer,p_command_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_pair uuid; previous public.events; result public.events; replay jsonb;
  request jsonb := jsonb_build_object('id',p_event_id,'input',p_input,'version',p_expected_version);
  v_important boolean; v_repeat text; v_month integer; v_day integer; v_title text; v_who text; starts timestamptz; ends timestamptz; first_date date; last_date date;
begin
  v_actor := private.require_actor();
  if p_action not in('create','update','delete') then return private.error('VALIDATION'); end if;
  if p_action='create' then
    p_event_id := (p_input->>'id')::uuid;
    v_pair := (p_input->>'pair_id')::uuid;
    if p_event_id is null then return private.error('VALIDATION','id'); end if;
    if v_pair is null then return private.error('VALIDATION','pairId'); end if;
  else
    select pair_id into v_pair from public.events where id=p_event_id;
    if v_pair is null then select r.pair_id into v_pair from private.command_receipts r
      where r.actor=v_actor and r.command_id=p_command_id and r.command_type='event_'||p_action and r.expires_at>now(); end if;
    if v_pair is null then return private.error('FORBIDDEN'); end if;
  end if;
  perform private.lock_pair(v_pair,v_actor);
  if not private.is_member(v_pair) then return private.error('FORBIDDEN'); end if;
  select * into previous from public.events where id=p_event_id for update;
  if previous.id is not null and previous.who='private' and previous.created_by<>v_actor then
    return private.error('FORBIDDEN');
  end if;
  replay := private.receipt(v_actor,p_command_id,'event_'||p_action,request);
  if replay is not null then
    if p_action<>'delete' and previous.id is null then return private.error('FORBIDDEN'); end if;
    return replay;
  end if;
  if p_action='create' and previous.id is not null then
    if previous.pair_id<>v_pair or previous.created_by<>v_actor then return private.error('CONFLICT'); end if;
    return private.save_receipt(v_actor,p_command_id,'event_create',v_pair,request,to_jsonb(previous));
  end if;
  if p_action<>'create' then
    if previous.id is null or previous.pair_id<>v_pair or (previous.who='private' and previous.created_by<>v_actor)
      then return private.error('FORBIDDEN'); end if;
    if p_expected_version is null or p_expected_version<>previous.version then return private.error('CONFLICT'); end if;
  end if;
  if p_action='delete' then
    delete from public.events where id=p_event_id;
    return private.save_receipt(v_actor,p_command_id,'event_delete',v_pair,request,jsonb_build_object('id',p_event_id));
  end if;
  if (p_input->>'id')::uuid is distinct from p_event_id or (p_input->>'pair_id')::uuid is distinct from v_pair then return private.error('VALIDATION','id'); end if;
  v_title := btrim(p_input->>'title'); v_who := p_input->>'who';
  if v_title is null or char_length(v_title) not between 1 and 120 then return private.error('VALIDATION','title'); end if;
  if v_who is null or v_who not in('together','a','b','private') then return private.error('VALIDATION','who'); end if;
  if char_length(p_input->>'location')>200 then return private.error('VALIDATION','location'); end if;
  if char_length(p_input->>'description')>2000 then return private.error('VALIDATION','description'); end if;
  v_repeat := coalesce(p_input->>'repeat','none');
  v_important := coalesce((p_input->>'important_date')::boolean,false) or v_repeat='yearly';
  if v_repeat not in('none','yearly') then return private.error('VALIDATION','repeat'); end if;
  if p_action='update' and (previous.who='private')<>(v_who='private') then
    if previous.created_by<>v_actor then return private.error('FORBIDDEN'); end if;
    if v_who<>'private' and (p_input->>'confirm_shared')::boolean is distinct from true then return private.error('VALIDATION','confirm_shared'); end if;
  end if;
  starts := (p_input->>'starts_at')::timestamptz; ends := (p_input->>'ends_at')::timestamptz;
  first_date := (p_input->>'start_date')::date; last_date := (p_input->>'end_date_exclusive')::date;
  if not ((starts is not null and ends is not null and ends>starts and first_date is null and last_date is null)
    or (first_date is not null and last_date is not null and last_date>first_date and starts is null and ends is null))
    then return private.error('VALIDATION','time'); end if;
  if v_important and first_date is null then return private.error('VALIDATION','importantDate'); end if;
  if v_repeat='yearly' then
    if first_date is null or last_date<>first_date+1 or starts is not null then return private.error('VALIDATION','repeat'); end if;
    v_month := extract(month from first_date)::integer; v_day := extract(day from first_date)::integer;
  end if;
  if p_action='create' then
    insert into public.events(id,pair_id,created_by,who,title,starts_at,ends_at,start_date,end_date_exclusive,location,description,repeat,repeat_month,repeat_day,important_date)
    values(p_event_id,v_pair,v_actor,v_who,v_title,starts,ends,first_date,last_date,p_input->>'location',p_input->>'description',v_repeat,v_month,v_day,v_important) returning * into result;
  else
    update public.events set who=v_who,title=v_title,starts_at=starts,ends_at=ends,
      start_date=first_date,end_date_exclusive=last_date,location=p_input->>'location',description=p_input->>'description',
      important_date=v_important,repeat=v_repeat,repeat_month=v_month,repeat_day=v_day,version=version+1,updated_at=now() where id=p_event_id returning * into result;
    if previous.who<>'private' and v_who='private' then
      insert into public.event_access_revocations(user_id,pair_id,event_id)
      select user_id,v_pair,p_event_id from public.pair_members where pair_id=v_pair and left_at is null and user_id<>v_actor
      on conflict(user_id,event_id) do update set revoked_at=now();
      -- The updated event is hidden by RLS. Notify the former reader through their own profile.
      update public.profiles set updated_at=now(),version=version+1
      where user_id in(select user_id from public.pair_members where pair_id=v_pair and left_at is null and user_id<>v_actor);
    elsif previous.who='private' and v_who<>'private' then
      delete from public.event_access_revocations where event_id=p_event_id;
    end if;
  end if;
  return private.save_receipt(v_actor,p_command_id,'event_'||p_action,v_pair,request,to_jsonb(result));
exception
  when sqlstate 'P0001' then return private.error(sqlerrm);
  when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or check_violation or not_null_violation
    then return private.error('VALIDATION');
  when unique_violation then return private.error('CONFLICT');
end;
$$;

create function public.create_event(p_input jsonb,p_command_id uuid) returns jsonb language sql security invoker set search_path = ''
as $$ select private.event_command('create',null,p_input,null,p_command_id); $$;
create function public.update_event(p_event_id uuid,p_input jsonb,p_expected_version integer,p_command_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.event_command('update',p_event_id,p_input,p_expected_version,p_command_id); $$;
create function public.delete_event(p_event_id uuid,p_expected_version integer,p_command_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.event_command('delete',p_event_id,null,p_expected_version,p_command_id); $$;

create function private.yearly_date(p_year integer,p_month integer,p_day integer) returns date
language sql immutable set search_path = '' as $$
  select make_date(p_year,p_month,least(p_day,extract(day from
    (make_date(p_year,p_month,1)+interval '1 month - 1 day'))::integer));
$$;
revoke all on function private.yearly_date(integer,integer,integer) from public,anon,authenticated;
grant execute on function private.yearly_date(integer,integer,integer) to authenticated;
create function private.list_agenda(p_pair_id uuid,p_from date,p_to date,p_important_only boolean) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare viewer_timezone text; items jsonb;
begin
  if private.active_actor() is null then return private.error('UNAUTHENTICATED'); end if;
  if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>366 then return private.error('VALIDATION','range'); end if;
  if not exists(select 1 from public.pairs where id=p_pair_id and state='active') then return private.error('FORBIDDEN'); end if;
  -- Days start at midnight in the viewer's own timezone.
  select timezone into viewer_timezone from public.profiles where user_id=private.active_actor();
  with occurrences as (
    select to_jsonb(e) item,coalesce(e.starts_at,e.start_date::timestamp at time zone viewer_timezone) sort_time,e.id
    from public.events e where e.pair_id=p_pair_id and e.repeat='none' and (e.important_date or not p_important_only) and
      ((e.starts_at < (p_to::timestamp at time zone viewer_timezone) and e.ends_at > (p_from::timestamp at time zone viewer_timezone))
        or (e.start_date < p_to and e.end_date_exclusive > p_from))
    union all
    select to_jsonb(e)||jsonb_build_object('occurrence_date',d.occurrence_day),d.occurrence_day::timestamp at time zone viewer_timezone,e.id
    from public.events e
    cross join lateral generate_series(extract(year from p_from)::integer,extract(year from p_to-1)::integer) y(year)
    cross join lateral (select private.yearly_date(y.year,e.repeat_month,e.repeat_day) as occurrence_day) d
    where e.pair_id=p_pair_id and e.repeat='yearly' and d.occurrence_day>=greatest(p_from,e.start_date) and d.occurrence_day<p_to
  ) select coalesce(jsonb_agg(item order by sort_time,id),'[]'::jsonb) into items from occurrences;
  return jsonb_build_object('ok',true,'data',items);
end;
$$;
revoke all on function private.list_agenda(uuid,date,date,boolean) from public,anon,authenticated;
grant execute on function private.list_agenda(uuid,date,date,boolean) to authenticated;
create function public.list_agenda(p_pair_id uuid,p_from date,p_to date) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.list_agenda(p_pair_id,p_from,p_to,false); $$;
revoke all on function private.event_identity(),private.event_command(text,uuid,jsonb,integer,uuid) from public,anon,authenticated;
grant execute on function private.event_command(text,uuid,jsonb,integer,uuid) to authenticated;
revoke all on function public.create_event(jsonb,uuid),public.update_event(uuid,jsonb,integer,uuid),
public.delete_event(uuid,integer,uuid),public.list_agenda(uuid,date,date) from public,anon,authenticated;
grant execute on function public.create_event(jsonb,uuid),public.update_event(uuid,jsonb,integer,uuid),
public.delete_event(uuid,integer,uuid),public.list_agenda(uuid,date,date) to authenticated;
alter publication supabase_realtime add table public.events;

-- ========== end pair ==========
-- Fresh verification: this Auth session signed in during the last ten minutes.
-- Auth writes the sign-in time. Token refresh does not change it.
create function private.recently_signed_in() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.mfa_amr_claims c
    where c.session_id::text = auth.jwt()->>'session_id' and c.updated_at > now() - interval '10 minutes');
$$;

create function private.end_pair(p_pair_id uuid,p_command_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid; replay jsonb; ended timestamptz := now();
  request jsonb := jsonb_build_object('pairId',p_pair_id);
begin
  actor := private.require_actor();
  perform private.lock_pair(p_pair_id,actor);
  -- A retry returns its receipt even after closure, without a fresh sign-in.
  replay := private.receipt(actor,p_command_id,'end_pair',request);
  if replay is not null then return replay; end if;
  if not private.is_member(p_pair_id) or not private.recently_signed_in() then return private.error('FORBIDDEN'); end if;
  update public.pairs set state='ended',ended_at=ended,purge_after=ended+interval '30 days' where id=p_pair_id;
  update public.pair_members set left_at=ended where pair_id=p_pair_id and left_at is null;
  update private.pair_invites set revoked_at=ended where pair_id=p_pair_id and accepted_at is null and revoked_at is null;
  update public.profiles set version=version+1,updated_at=now()
    where user_id in(select user_id from public.pair_members where pair_id=p_pair_id);
  -- Notification and memory triggers on pairs run in this same transaction.
  return private.save_receipt(actor,p_command_id,'end_pair',p_pair_id,request,jsonb_build_object('endedAt',ended));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end;
$$;
create function public.end_pair(p_pair_id uuid,p_command_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select private.end_pair(p_pair_id,p_command_id); $$;
revoke all on function private.recently_signed_in(),private.end_pair(uuid,uuid),public.end_pair(uuid,uuid) from public,anon,authenticated;
grant execute on function private.end_pair(uuid,uuid),public.end_pair(uuid,uuid) to authenticated;

-- ========== messages ==========
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id) on delete cascade,
  author_id uuid not null,
  client_id uuid not null,
  body text,
  payload_hash bytea not null check(octet_length(payload_hash)=32),
  created_at timestamptz not null,
  pinned_at timestamptz,
  deleted_at timestamptz,
  version integer not null default 1 check(version>0),
  unique(pair_id,id),
  unique(pair_id,author_id,client_id),
  foreign key(pair_id,author_id) references public.pair_members(pair_id,user_id),
  check((deleted_at is null and body is not null and char_length(body) between 1 and 4000 and body ~ '[^[:space:]]')
    or (deleted_at is not null and body is null and pinned_at is null))
);
create index messages_pair_order on public.messages(pair_id,created_at desc,id desc);
alter table public.messages enable row level security;
revoke all on public.messages from public,anon,authenticated;
-- The retained payload hash must not expose deleted text through dictionary guesses.
grant select(id,pair_id,author_id,client_id,body,created_at,pinned_at,deleted_at,version) on public.messages to authenticated;
grant all on public.messages to service_role;
create policy messages_visible on public.messages for select to authenticated
using(deleted_at is null and pair_id=(select private.actor_pair()));

create table private.conversation_reads (
  pair_id uuid not null references public.pairs(id) on delete cascade,
  user_id uuid not null,
  last_read_created_at timestamptz not null,
  last_read_message_id uuid not null,
  primary key(pair_id,user_id),
  foreign key(pair_id,user_id) references public.pair_members(pair_id,user_id),
  foreign key(pair_id,last_read_message_id) references public.messages(pair_id,id) on delete cascade
);
alter table private.conversation_reads enable row level security;
revoke all on private.conversation_reads from public,anon,authenticated;
grant select on private.conversation_reads to authenticated;
grant all on private.conversation_reads to service_role;
create policy conversation_reads_self on private.conversation_reads for select to authenticated
using(user_id=(select private.active_actor()) and pair_id=(select private.actor_pair()));
-- Read cursors never enter the Realtime publication.

create function private.message_json(p_message public.messages) returns jsonb
language sql immutable set search_path = '' as $$
  select to_jsonb(p_message)-'payload_hash'-'deleted_at';
$$;

create function private.message_identity() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id<>old.id or new.pair_id<>old.pair_id or new.author_id<>old.author_id
    or new.client_id<>old.client_id or new.created_at<>old.created_at or new.payload_hash<>old.payload_hash
    or (new.body is distinct from old.body and not (old.deleted_at is null and new.deleted_at is not null and new.body is null))
    or (old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at) then
    raise exception using message='FORBIDDEN',errcode='P0001';
  end if;
  return new;
end;
$$;
create trigger messages_identity before update on public.messages for each row execute function private.message_identity();

create function private.send_message(p_pair_id uuid,p_client_id uuid,p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid; saved public.messages; sent_at timestamptz; body_hash bytea;
begin
  actor := private.require_actor();
  if p_pair_id is null then return private.error('VALIDATION','pairId'); end if;
  if p_client_id is null then return private.error('VALIDATION','clientId'); end if;
  if p_body is null or char_length(p_body) not between 1 and 4000 or p_body !~ '[^[:space:]]' then
    return private.error('VALIDATION','body');
  end if;
  perform private.lock_pair(p_pair_id,actor);
  if not private.is_member(p_pair_id) then return private.error('FORBIDDEN'); end if;
  body_hash := extensions.digest(p_body,'sha256');
  select * into saved from public.messages
    where pair_id=p_pair_id and author_id=actor and client_id=p_client_id for update;
  if found then
    if saved.payload_hash<>body_hash then return private.error('CONFLICT'); end if;
    if saved.deleted_at is not null then return private.error('FORBIDDEN'); end if;
    return jsonb_build_object('ok',true,'data',private.message_json(saved));
  end if;
  -- The pair lock orders commits. Transaction-start timestamps would leave cursor holes.
  select greatest(clock_timestamp(),coalesce(max(created_at)+interval '1 microsecond','-infinity'::timestamptz))
    into sent_at from public.messages where pair_id=p_pair_id;
  insert into public.messages(pair_id,author_id,client_id,body,payload_hash,created_at)
    values(p_pair_id,actor,p_client_id,p_body,body_hash,sent_at) returning * into saved;
  return jsonb_build_object('ok',true,'data',private.message_json(saved));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end;
$$;

create function private.delete_message(p_message_id uuid,p_command_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid; pair uuid; saved public.messages; replay jsonb;
  request jsonb := jsonb_build_object('id',p_message_id);
begin
  actor := private.require_actor();
  select pair_id into pair from public.messages where id=p_message_id;
  if pair is null then return private.error('FORBIDDEN'); end if;
  perform private.lock_pair(pair,actor);
  if not private.is_member(pair) then return private.error('FORBIDDEN'); end if;
  select * into saved from public.messages where id=p_message_id for update;
  if saved.author_id is distinct from actor then return private.error('FORBIDDEN'); end if;
  replay := private.receipt(actor,p_command_id,'message_delete',request);
  if replay is not null then return replay; end if;
  if saved.deleted_at is null then
    update public.messages set body=null,pinned_at=null,deleted_at=clock_timestamp(),version=version+1 where id=p_message_id;
    -- Deleted rows fail RLS. Each member receives a content-free invalidation signal instead.
    update public.profiles set updated_at=clock_timestamp(),version=version+1
      where user_id in(select user_id from public.pair_members where pair_id=pair and left_at is null);
  end if;
  return private.save_receipt(actor,p_command_id,'message_delete',pair,request,jsonb_build_object('id',p_message_id));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end;
$$;

create function private.set_read_cursor(p_pair_id uuid,p_created_at timestamptz,p_message_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid; saved private.conversation_reads;
begin
  actor := private.require_actor();
  perform private.lock_pair(p_pair_id,actor);
  if not private.is_member(p_pair_id) then return private.error('FORBIDDEN'); end if;
  if p_created_at is null or p_message_id is null or not exists(select 1 from public.messages
    where pair_id=p_pair_id and id=p_message_id and created_at=p_created_at and deleted_at is null) then
    return private.error('VALIDATION','cursor');
  end if;
  insert into private.conversation_reads(pair_id,user_id,last_read_created_at,last_read_message_id)
    values(p_pair_id,actor,p_created_at,p_message_id)
    on conflict(pair_id,user_id) do update
      set last_read_created_at=excluded.last_read_created_at,last_read_message_id=excluded.last_read_message_id
      where (conversation_reads.last_read_created_at,conversation_reads.last_read_message_id)
        < (excluded.last_read_created_at,excluded.last_read_message_id);
  select * into saved from private.conversation_reads where pair_id=p_pair_id and user_id=actor;
  return jsonb_build_object('ok',true,'data',jsonb_build_object('created_at',saved.last_read_created_at,'id',saved.last_read_message_id));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end;
$$;

create function private.get_unread_count(p_pair_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid; cursor_row private.conversation_reads; unread bigint;
begin
  actor := private.require_actor();
  if not private.is_member(p_pair_id) then return private.error('FORBIDDEN'); end if;
  select * into cursor_row from private.conversation_reads where pair_id=p_pair_id and user_id=actor;
  select count(*) into unread from public.messages
    where pair_id=p_pair_id and author_id<>actor and deleted_at is null
      and (cursor_row.user_id is null or (created_at,id)>(cursor_row.last_read_created_at,cursor_row.last_read_message_id));
  return jsonb_build_object('ok',true,'data',jsonb_build_object('count',unread));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end;
$$;

create function private.reconcile_message_sends(p_pair_id uuid,p_client_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid; confirmed jsonb; deleted jsonb;
begin
  actor := private.require_actor();
  if not private.is_member(p_pair_id) then return private.error('FORBIDDEN'); end if;
  if p_client_ids is null or cardinality(p_client_ids)>100 or coalesce(array_ndims(p_client_ids),1)>1 then
    return private.error('VALIDATION','clientIds');
  end if;
  if array_position(p_client_ids,null) is not null then
    return private.error('VALIDATION','clientIds');
  end if;
  select coalesce(jsonb_agg(private.message_json(m) order by m.created_at,m.id) filter(where m.deleted_at is null),'[]'::jsonb),
    coalesce(jsonb_agg(m.client_id order by m.created_at,m.id) filter(where m.deleted_at is not null),'[]'::jsonb)
    into confirmed,deleted from public.messages m
    where m.pair_id=p_pair_id and m.author_id=actor and m.client_id=any(p_client_ids);
  return jsonb_build_object('ok',true,'data',jsonb_build_object('messages',confirmed,'deleted_client_ids',deleted));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end;
$$;

create function public.send_message(p_pair_id uuid,p_client_id uuid,p_body text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.send_message(p_pair_id,p_client_id,p_body); $$;
create function public.delete_message(p_message_id uuid,p_command_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select private.delete_message(p_message_id,p_command_id); $$;
create function public.set_read_cursor(p_pair_id uuid,p_created_at timestamptz,p_message_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select private.set_read_cursor(p_pair_id,p_created_at,p_message_id); $$;
create function public.get_unread_count(p_pair_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select private.get_unread_count(p_pair_id); $$;
create function public.reconcile_message_sends(p_pair_id uuid,p_client_ids uuid[]) returns jsonb
language sql security invoker set search_path = '' as $$ select private.reconcile_message_sends(p_pair_id,p_client_ids); $$;

revoke all on function private.message_json(public.messages),private.message_identity(),
  private.send_message(uuid,uuid,text),private.delete_message(uuid,uuid),private.set_read_cursor(uuid,timestamptz,uuid),
  private.get_unread_count(uuid),private.reconcile_message_sends(uuid,uuid[]) from public,anon,authenticated;
grant execute on function private.send_message(uuid,uuid,text),private.delete_message(uuid,uuid),
  private.set_read_cursor(uuid,timestamptz,uuid),private.get_unread_count(uuid),private.reconcile_message_sends(uuid,uuid[]) to authenticated;
revoke all on function public.send_message(uuid,uuid,text),public.delete_message(uuid,uuid),public.set_read_cursor(uuid,timestamptz,uuid),
  public.get_unread_count(uuid),public.reconcile_message_sends(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.send_message(uuid,uuid,text),public.delete_message(uuid,uuid),public.set_read_cursor(uuid,timestamptz,uuid),
  public.get_unread_count(uuid),public.reconcile_message_sends(uuid,uuid[]) to authenticated;
alter publication supabase_realtime add table public.messages;

-- ========== pinned-notes ==========
create unique index messages_one_pin_per_author on public.messages(pair_id,author_id)
  where pinned_at is not null and deleted_at is null;

create function private.message_pin(p_message_id uuid,p_command_id uuid,p_pin boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid; pair uuid; saved public.messages; replay jsonb;
  command_type text := case when p_pin then 'message_pin' else 'message_unpin' end;
  request jsonb := jsonb_build_object('id',p_message_id);
begin
  actor := private.require_actor();
  if p_pin is null then return private.error('VALIDATION'); end if;
  select pair_id into pair from public.messages where id=p_message_id;
  if pair is null then return private.error('FORBIDDEN'); end if;
  perform private.lock_pair(pair,actor);
  if not private.is_member(pair) then return private.error('FORBIDDEN'); end if;
  select * into saved from public.messages where id=p_message_id for update;
  if saved.author_id is distinct from actor or saved.deleted_at is not null then return private.error('FORBIDDEN'); end if;
  replay := private.receipt(actor,p_command_id,command_type,request);
  if replay is not null then return replay; end if;
  if p_pin then
    update public.messages set pinned_at=null,version=version+1
      where pair_id=pair and author_id=actor and id<>p_message_id and pinned_at is not null;
    update public.messages set pinned_at=clock_timestamp(),version=version+1
      where id=p_message_id and pinned_at is null;
  else
    update public.messages set pinned_at=null,version=version+1 where id=p_message_id and pinned_at is not null;
  end if;
  return private.save_receipt(actor,p_command_id,command_type,pair,request,jsonb_build_object('id',p_message_id));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end;
$$;

create function public.pin_message(p_message_id uuid,p_command_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select private.message_pin(p_message_id,p_command_id,true); $$;
create function public.unpin_message(p_message_id uuid,p_command_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select private.message_pin(p_message_id,p_command_id,false); $$;
revoke all on function private.message_pin(uuid,uuid,boolean),public.pin_message(uuid,uuid),public.unpin_message(uuid,uuid)
  from public,anon,authenticated;
grant execute on function private.message_pin(uuid,uuid,boolean),public.pin_message(uuid,uuid),public.unpin_message(uuid,uuid) to authenticated;

-- ========== memories ==========
-- Private prepared JPEGs. Client declarations reserve quota; only verified service evidence validates bytes.
create table public.memories (
  id uuid primary key,
  pair_id uuid not null references public.pairs(id) on delete cascade,
  created_by uuid not null,
  memory_date date not null check(isfinite(memory_date)),
  caption text not null default '' check(char_length(caption)<=1000),
  state text not null default 'pending' check(state in('pending','published','deleting')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check(version>0),
  unique(pair_id,id),
  foreign key(pair_id,created_by) references public.pair_members(pair_id,user_id)
);
create index memories_feed on public.memories(pair_id,memory_date desc,id desc) where state='published';
create index memories_author on public.memories(pair_id,created_by);
create table private.memory_reservations (
  memory_id uuid primary key,
  pair_id uuid not null,
  bytes bigint not null check(bytes>0 and bytes<=52428800),
  expires_at timestamptz not null default(now()+interval '24 hours'),
  released_at timestamptz,
  foreign key(pair_id,memory_id) references public.memories(pair_id,id) on delete cascade
);
create index memory_reservations_quota on private.memory_reservations(pair_id) include(bytes) where released_at is null;
create index memory_reservations_expiry on private.memory_reservations(expires_at,memory_id) where released_at is null;
create table public.memory_photos (
  id uuid primary key,
  pair_id uuid not null,
  memory_id uuid not null,
  uploaded_by uuid not null,
  photo_order integer not null check(photo_order between 0 and 4),
  full_path text not null unique,
  thumb_path text not null unique,
  full_bytes integer not null check(full_bytes between 1 and 5242880),
  thumb_bytes integer not null check(thumb_bytes between 1 and 5242880),
  width integer not null check(width between 1 and 2560),
  height integer not null check(height between 1 and 2560),
  thumb_width integer not null check(thumb_width between 1 and 512),
  thumb_height integer not null check(thumb_height between 1 and 512),
  validated boolean not null default false,
  full_object_id uuid,
  thumb_object_id uuid,
  unique(memory_id,photo_order),
  foreign key(pair_id,memory_id) references public.memories(pair_id,id) on delete cascade,
  foreign key(pair_id,uploaded_by) references public.pair_members(pair_id,user_id),
  check(full_path=pair_id::text||'/'||memory_id::text||'/'||id::text||'/full.jpg'),
  check(thumb_path=pair_id::text||'/'||memory_id::text||'/'||id::text||'/thumb.jpg'),
  check(not validated or (full_object_id is not null and thumb_object_id is not null))
);
create index memory_photos_memory on public.memory_photos(pair_id,memory_id,photo_order);
create index memory_photos_uploader on public.memory_photos(pair_id,uploaded_by);
create table private.memory_tombstones (
  memory_id uuid primary key,
  pair_id uuid not null references public.pairs(id) on delete cascade,
  created_by uuid not null references public.profiles(user_id)
);
alter table private.memory_tombstones enable row level security;
revoke all on private.memory_tombstones from public,anon,authenticated;
grant all on private.memory_tombstones to service_role;
create index memory_tombstones_author on private.memory_tombstones(created_by,pair_id);
create table private.memory_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null unique,
  pair_id uuid not null references public.pairs(id) on delete cascade,
  paths text[] not null,
  state text not null default 'queued' check(state in('queued','leased','completed')),
  attempts integer not null default 0 check(attempts>=0),
  due_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  error_code text check(char_length(error_code)<=80),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check((state='leased')=(lease_token is not null and lease_until is not null))
);
create index memory_cleanup_due on private.memory_cleanup_jobs(due_at,id) where state in('queued','leased');
alter table public.memories enable row level security;
alter table public.memory_photos enable row level security;
alter table private.memory_reservations enable row level security;
alter table private.memory_cleanup_jobs enable row level security;
revoke all on public.memories,public.memory_photos,private.memory_reservations,private.memory_cleanup_jobs from public,anon,authenticated;
grant select on public.memories,public.memory_photos to authenticated;
grant all on public.memories,public.memory_photos,private.memory_reservations,private.memory_cleanup_jobs to service_role;
create policy memories_visible on public.memories for select to authenticated
using(pair_id=(select private.actor_pair()) and (state='published' or (state='pending' and created_by=(select private.active_actor()))));
create policy memory_photos_visible on public.memory_photos for select to authenticated
using(exists(select 1 from public.memories m where m.id=memory_id and m.pair_id=memory_photos.pair_id));
-- Keep an opaque deletion signal after metadata cleanup for delayed clients and Realtime authorization.
create table public.memory_access_revocations (
 memory_id uuid primary key,
 pair_id uuid not null references public.pairs(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index memory_access_revocations_pair on public.memory_access_revocations(pair_id,memory_id);
alter table public.memory_access_revocations enable row level security;
revoke all on public.memory_access_revocations from public,anon,authenticated;
grant select on public.memory_access_revocations to authenticated;
grant all on public.memory_access_revocations to service_role;
create policy memory_revocations_current on public.memory_access_revocations for select to authenticated
using(pair_id=(select private.actor_pair()));

create function private.memory_identity() returns trigger language plpgsql set search_path='' as $$
begin
  if new.id<>old.id or new.pair_id<>old.pair_id or new.created_by<>old.created_by or new.created_at<>old.created_at then
    raise exception using message='FORBIDDEN',errcode='P0001';
  end if;
  return new;
end; $$;
create trigger memories_identity before update on public.memories for each row execute function private.memory_identity();
create function private.photo_identity() returns trigger language plpgsql set search_path='' as $$
begin
  if (to_jsonb(new)-array['validated','full_object_id','thumb_object_id']) is distinct from
     (to_jsonb(old)-array['validated','full_object_id','thumb_object_id']) then
    raise exception using message='FORBIDDEN',errcode='P0001';
  end if;
  return new;
end; $$;
create trigger memory_photos_identity before update on public.memory_photos for each row execute function private.photo_identity();

create function private.memory_photo_json(p public.memory_photos) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',p.id,'order',p.photo_order,'fullPath',p.full_path,'thumbPath',p.thumb_path,
 'fullBytes',p.full_bytes,'thumbBytes',p.thumb_bytes,'width',p.width,'height',p.height,
 'thumbWidth',p.thumb_width,'thumbHeight',p.thumb_height,'validated',p.validated);
$$;
create function private.memory_json(p public.memories) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 select * into p from public.memories where id=p.id;
 if not found then return null; end if;
 if auth.jwt()->>'role' is distinct from 'service_role' and (not private.is_member(p.pair_id)
 or p.state='deleting' or (p.state='pending' and p.created_by is distinct from private.active_actor())) then return null; end if;
 return jsonb_build_object('id',p.id,'pairId',p.pair_id,'createdBy',p.created_by,'memoryDate',p.memory_date,
 'caption',p.caption,'state',p.state,'version',p.version,'createdAt',p.created_at,'updatedAt',p.updated_at,
 'expiresAt',case when p.state='pending' then(select expires_at from private.memory_reservations where memory_id=p.id) else null end,
 'photos',coalesce((select jsonb_agg(private.memory_photo_json(ph) order by ph.photo_order) from public.memory_photos ph where ph.memory_id=p.id),'[]'::jsonb));
end; $$;

create function private.reserve_memory(p_input jsonb,p_command_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; pair uuid; memory uuid; m public.memories; item jsonb; total bigint:=0; n integer:=0;
 replay jsonb; photos jsonb:=p_input->'photos'; prefix text;
begin
 actor:=private.require_actor(); pair:=(p_input->>'pairId')::uuid; memory:=(p_input->>'id')::uuid;
 if pair is null or memory is null then return private.error('VALIDATION','id'); end if;
 perform private.lock_pair(pair,actor);
 if not private.is_member(pair) then return private.error('FORBIDDEN'); end if;
 if exists(select 1 from private.memory_tombstones where memory_id=memory) then return private.error('FORBIDDEN'); end if;
 select * into m from public.memories where id=memory for update;
 if m.id is not null and (m.pair_id<>pair or m.created_by<>actor or m.state='deleting') then return private.error('FORBIDDEN'); end if;
 replay:=private.receipt(actor,p_command_id,'memory_reserve',p_input);
 if replay is not null then
   if m.id is null then return private.error('FORBIDDEN'); end if;
   if replay->>'ok'='false' then return replay; end if;
   return jsonb_build_object('ok',true,'data',private.memory_json(m));
 end if;
 if m.id is not null then
   -- Stable IDs remain authoritative after receipt expiry. Never recreate a different request.
   if m.memory_date is distinct from (p_input->>'memoryDate')::date or m.caption is distinct from coalesce(p_input->>'caption','')
      or photos is distinct from (select jsonb_agg(jsonb_build_object('id',ph.id,'fullBytes',ph.full_bytes,'thumbBytes',ph.thumb_bytes,
      'width',ph.width,'height',ph.height,'thumbWidth',ph.thumb_width,'thumbHeight',ph.thumb_height) order by ph.photo_order)
      from public.memory_photos ph where ph.memory_id=memory) then return private.error('CONFLICT'); end if;
   return private.save_receipt(actor,p_command_id,'memory_reserve',pair,p_input,private.memory_json(m));
 end if;
 if p_input->>'memoryDate' is null or p_input->>'memoryDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 or char_length(coalesce(p_input->>'caption',''))>1000 or jsonb_typeof(photos) is distinct from 'array' then
   return private.error('VALIDATION'); end if;
 if jsonb_array_length(photos) not between 1 and 5 then return private.error('VALIDATION','photos'); end if;
 for item in select value from jsonb_array_elements(photos) loop
   if (item->>'id')::uuid is null or (item->>'fullBytes')::integer not between 1 and 5242880
    or (item->>'thumbBytes')::integer not between 1 and 5242880 or (item->>'width')::integer not between 1 and 2560
    or (item->>'height')::integer not between 1 and 2560 or (item->>'thumbWidth')::integer not between 1 and 512
    or (item->>'thumbHeight')::integer not between 1 and 512
    or not(item ?& array['fullBytes','thumbBytes','width','height','thumbWidth','thumbHeight']) then return private.error('VALIDATION','photos'); end if;
   total:=total+(item->>'fullBytes')::bigint+(item->>'thumbBytes')::bigint;
 end loop;
 if (select coalesce(sum(bytes),0) from private.memory_reservations where pair_id=pair and released_at is null)+total>1073741824 then
   return private.error('QUOTA_EXCEEDED'); end if;
 insert into public.memories(id,pair_id,created_by,memory_date,caption)
 values(memory,pair,actor,(p_input->>'memoryDate')::date,coalesce(p_input->>'caption','')) returning * into m;
 insert into private.memory_reservations(memory_id,pair_id,bytes) values(memory,pair,total);
 for item in select value from jsonb_array_elements(photos) loop
  prefix:=pair::text||'/'||memory::text||'/'||(item->>'id')::uuid::text||'/';
  insert into public.memory_photos(id,pair_id,memory_id,uploaded_by,photo_order,full_path,thumb_path,full_bytes,thumb_bytes,width,height,thumb_width,thumb_height)
  values((item->>'id')::uuid,pair,memory,actor,n,prefix||'full.jpg',prefix||'thumb.jpg',(item->>'fullBytes')::integer,
  (item->>'thumbBytes')::integer,(item->>'width')::integer,(item->>'height')::integer,(item->>'thumbWidth')::integer,(item->>'thumbHeight')::integer);
  n:=n+1;
 end loop;
 return private.save_receipt(actor,p_command_id,'memory_reserve',pair,p_input,private.memory_json(m));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
 when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow or invalid_datetime_format or check_violation or not_null_violation then return private.error('VALIDATION');
 when unique_violation then return private.error('CONFLICT');
end; $$;

-- INSERT takes the same locks as publication, closure, and cleanup. No client UPDATE or DELETE policy exists.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('memory-photos','memory-photos',false,5242880,array['image/jpeg']);
create function private.memory_upload_allowed(p_path text) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; m public.memories; pair uuid;
begin
 actor:=private.active_actor(); if actor is null then return false; end if;
 select ph.pair_id into pair from public.memory_photos ph where p_path in(ph.full_path,ph.thumb_path) and ph.uploaded_by=actor;
 if pair is null then return false; end if;
 perform private.lock_pair(pair,actor);
 select m0.* into m from public.memories m0 join public.memory_photos ph on ph.memory_id=m0.id
 where p_path in(ph.full_path,ph.thumb_path) and m0.created_by=actor for share of m0;
 return found and private.is_member(pair) and m.state='pending'
 and exists(select 1 from private.memory_reservations r where r.memory_id=m.id and r.released_at is null and r.expires_at>now());
exception when sqlstate 'P0001' then return false;
end; $$;
create policy memory_upload_reserved on storage.objects for insert to authenticated
with check(bucket_id='memory-photos' and private.memory_upload_allowed(name));
-- Current members read validated photos of published memories. Clients sign 60-second links with this policy.
create function private.memory_object_readable(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memory_photos ph join public.memories m on m.id=ph.memory_id
  where ph.id=case when split_part(p_name,'/',3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   then split_part(p_name,'/',3)::uuid end
  and p_name in(ph.full_path,ph.thumb_path) and ph.validated and m.state='published' and private.is_member(m.pair_id));
$$;
create policy memory_photos_readable on storage.objects for select to authenticated
using(bucket_id='memory-photos' and private.memory_object_readable(name));
-- Storage computes metadata.size from uploaded bytes. Check exact reservations before accepting object metadata.
create function private.memory_object_size() returns trigger language plpgsql security definer set search_path='' as $$
declare expected integer; actor uuid; session uuid; ph public.memory_photos; m public.memories;
begin
 if tg_op='UPDATE' and old.bucket_id='memory-photos' then raise exception using message='FORBIDDEN',errcode='P0001'; end if;
 if new.bucket_id<>'memory-photos' then return new; end if;
 if tg_op='UPDATE' then raise exception using message='FORBIDDEN',errcode='P0001'; end if;
 if new.user_metadata->>'sessionId' is null or new.user_metadata->>'sessionId' !~*
 '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
  raise exception using message='FORBIDDEN',errcode='P0001';
 end if;
 session:=(new.user_metadata->>'sessionId')::uuid;
 if auth.jwt()->>'role'='service_role' then
  -- Storage completes standard uploads as service role. Preserve the preflight actor and session explicitly.
  if new.owner_id is null or new.owner_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
   raise exception using message='FORBIDDEN',errcode='P0001';
  end if;
  actor:=new.owner_id::uuid;
  select * into ph from public.memory_photos where new.name in(full_path,thumb_path) and uploaded_by=actor;
  if not found or not private.memory_service_lock(ph.pair_id,actor,session) then raise exception using message='FORBIDDEN',errcode='P0001'; end if;
  select * into m from public.memories where id=ph.memory_id for update;
  if m.created_by is distinct from actor or m.state is distinct from 'pending' or not exists(
   select 1 from private.memory_reservations where memory_id=m.id and released_at is null and expires_at>now()) then
   raise exception using message='FORBIDDEN',errcode='P0001';
  end if;
 else
  actor:=private.active_actor();
  if actor is null or new.owner_id is distinct from actor::text or new.user_metadata->>'sessionId' is distinct from auth.jwt()->>'session_id'
   or not private.memory_upload_allowed(new.name) then raise exception using message='FORBIDDEN',errcode='P0001'; end if;
  select * into ph from public.memory_photos where new.name in(full_path,thumb_path) and uploaded_by=actor;
 end if;
 expected:=case when new.name=ph.full_path then ph.full_bytes else ph.thumb_bytes end;
 -- Storage tests permissions with version='1' in a rolled-back transaction before streaming bytes.
 -- Final uploads carry a random version and server-measured metadata.size.
 if new.version='1' and new.metadata->>'size' is null then return new; end if;
 if new.metadata->>'size' is null or new.metadata->>'size' !~ '^[0-9]{1,8}$'
 or (new.metadata->>'size')::bigint is distinct from expected::bigint then
  raise exception using message='VALIDATION',errcode='P0001';
 end if;
 return new;
end; $$;
create trigger memory_objects_size before insert or update on storage.objects for each row execute function private.memory_object_size();

create function private.memory_command(p_action text,p_memory_id uuid,p_input jsonb,p_expected_version integer,p_command_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; pair uuid; m public.memories; tombstone private.memory_tombstones; replay jsonb;
 request jsonb:=jsonb_build_object('id',p_memory_id,'input',p_input,'version',p_expected_version);
begin
 actor:=private.require_actor(); select * into m from public.memories where id=p_memory_id;
 pair:=m.pair_id;
 if m.id is null then
  select * into tombstone from private.memory_tombstones where memory_id=p_memory_id and created_by=actor;
  if not found or p_action<>'delete' then return private.error('FORBIDDEN'); end if;
  pair:=tombstone.pair_id;
 end if;
 perform private.lock_pair(pair,actor);
 if not private.is_member(pair) then return private.error('FORBIDDEN'); end if;
 select * into m from public.memories where id=p_memory_id for update;
 if m.id is null then
  select * into tombstone from private.memory_tombstones where memory_id=p_memory_id and created_by=actor;
  if not found or p_action<>'delete' then return private.error('FORBIDDEN'); end if;
  replay:=private.receipt(actor,p_command_id,'memory_delete',request);
  if replay is not null then return replay; end if;
  return private.save_receipt(actor,p_command_id,'memory_delete',tombstone.pair_id,request,jsonb_build_object('id',p_memory_id));
 end if;
 if m.created_by<>actor or (m.state='deleting' and p_action<>'delete') then return private.error('FORBIDDEN'); end if;
 replay:=private.receipt(actor,p_command_id,'memory_'||p_action,request);
 if replay is not null then return replay; end if;
 if m.state='deleting' then
  return private.save_receipt(actor,p_command_id,'memory_delete',m.pair_id,request,jsonb_build_object('id',p_memory_id));
 end if;
 if p_expected_version is null or m.version<>p_expected_version then return private.error('CONFLICT'); end if;
 if p_action='update' then
  if m.state<>'published' then return private.error('FORBIDDEN'); end if;
  if p_input->>'memoryDate' is null or p_input->>'memoryDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  or p_input->>'caption' is null or char_length(p_input->>'caption')>1000 then return private.error('VALIDATION'); end if;
  update public.memories set memory_date=(p_input->>'memoryDate')::date,caption=p_input->>'caption',updated_at=now(),version=version+1
  where id=p_memory_id returning * into m;
  return private.save_receipt(actor,p_command_id,'memory_update',m.pair_id,request,private.memory_json(m));
 elsif p_action='delete' then
  update public.memories set state='deleting',updated_at=now(),version=version+1 where id=p_memory_id;
  return private.save_receipt(actor,p_command_id,'memory_delete',m.pair_id,request,jsonb_build_object('id',p_memory_id));
 end if;
 return private.error('VALIDATION');
exception when sqlstate 'P0001' then return private.error(sqlerrm);
 when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or check_violation then return private.error('VALIDATION');
end; $$;

create function private.schedule_memory_cleanup() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.state='deleting' and old.state<>'deleting' then
  if old.state='published' then
   insert into public.memory_access_revocations(memory_id,pair_id) values(new.id,new.pair_id) on conflict(memory_id) do nothing;
  end if;
  insert into private.memory_cleanup_jobs(memory_id,pair_id,paths)
  select new.id,new.pair_id,coalesce(array_agg(path),'{}'::text[]) from
   (select full_path path from public.memory_photos where memory_id=new.id union all
    select thumb_path from public.memory_photos where memory_id=new.id) paths
  on conflict(memory_id) do nothing;
 end if;
 return new;
end; $$;
create trigger memories_cleanup after update of state on public.memories for each row execute function private.schedule_memory_cleanup();
create function private.close_pending_memories() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.state='ended' and old.state<>'ended' then
  update public.memories set state='deleting',updated_at=now(),version=version+1 where pair_id=new.id and state='pending';
 end if;
 return new;
end; $$;
create trigger pairs_pending_memory_cleanup after update of state on public.pairs for each row execute function private.close_pending_memories();

-- Service calls use the core lock order. lock_pair itself requires the caller JWT, so service calls check explicit Auth rows.
create function private.memory_service_lock(p_pair uuid,p_actor uuid,p_session uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then return false; end if;
 perform 1 from public.profiles where user_id=p_actor or user_id in
  (select user_id from public.pair_members where pair_id=p_pair and left_at is null) order by user_id for update;
 perform 1 from public.pairs where id=p_pair for update;
 perform 1 from auth.sessions where id=p_session and user_id=p_actor for share;
 return found and exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
  join public.profiles pr on pr.user_id=u.id join public.pair_members pm on pm.user_id=u.id
  join public.pairs pair on pair.id=pm.pair_id
  where s.id=p_session and s.user_id=p_actor and (s.not_after is null or s.not_after>now())
  and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
  and pr.account_status='active' and pm.pair_id=p_pair and pm.left_at is null and pair.state='active');
end; $$;
create function private.verify_memory_reservation(p_memory_id uuid,p_actor_id uuid,p_session_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m public.memories;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then return private.error('FORBIDDEN'); end if;
 select * into m from public.memories where id=p_memory_id;
 if m.id is null or not private.memory_service_lock(m.pair_id,p_actor_id,p_session_id) then return private.error('FORBIDDEN'); end if;
 select * into m from public.memories where id=p_memory_id for update;
 if m.created_by<>p_actor_id or m.state='deleting' then return private.error('FORBIDDEN'); end if;
 if m.state='pending' and not exists(select 1 from private.memory_reservations where memory_id=m.id and released_at is null and expires_at>now()) then
  return private.error('FORBIDDEN'); end if;
 return jsonb_build_object('ok',true,'data',private.memory_json(m));
end; $$;
create function private.validate_memory_photo(p_memory_id uuid,p_photo_id uuid,p_actor_id uuid,p_session_id uuid,p_evidence jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare access_result jsonb; m public.memories; ph public.memory_photos; full_id uuid; thumb_id uuid;
begin
 access_result:=private.verify_memory_reservation(p_memory_id,p_actor_id,p_session_id);
 if access_result->>'ok'<>'true' then return access_result; end if;
 select * into m from public.memories where id=p_memory_id;
 select * into ph from public.memory_photos where id=p_photo_id and memory_id=p_memory_id for update;
 if ph.id is null then return private.error('FORBIDDEN'); end if;
 if p_evidence is distinct from jsonb_build_object('fullBytes',ph.full_bytes,'thumbBytes',ph.thumb_bytes,
  'width',ph.width,'height',ph.height,'thumbWidth',ph.thumb_width,'thumbHeight',ph.thumb_height) then return private.error('VALIDATION','photos'); end if;
 select id into full_id from storage.objects where bucket_id='memory-photos' and name=ph.full_path for share;
 select id into thumb_id from storage.objects where bucket_id='memory-photos' and name=ph.thumb_path for share;
 if full_id is null or thumb_id is null then return private.error('RETRYABLE'); end if;
 if ph.validated and (ph.full_object_id<>full_id or ph.thumb_object_id<>thumb_id) then return private.error('VALIDATION'); end if;
 if m.state='published' and not ph.validated then return private.error('FORBIDDEN'); end if;
 update public.memory_photos set validated=true,full_object_id=full_id,thumb_object_id=thumb_id where id=ph.id returning * into ph;
 return jsonb_build_object('ok',true,'data',private.memory_photo_json(ph));
end; $$;
create function private.publish_memory(p_memory_id uuid,p_actor_id uuid,p_session_id uuid,p_command_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare access_result jsonb; m public.memories; replay jsonb; request jsonb:=jsonb_build_object('id',p_memory_id);
begin
 access_result:=private.verify_memory_reservation(p_memory_id,p_actor_id,p_session_id);
 if access_result->>'ok'<>'true' then return access_result; end if;
 select * into m from public.memories where id=p_memory_id;
 replay:=private.receipt(p_actor_id,p_command_id,'memory_publish',request);
 if replay is not null then return replay; end if;
 if m.state='published' then return private.save_receipt(p_actor_id,p_command_id,'memory_publish',m.pair_id,request,private.memory_json(m)); end if;
 if (select count(*) from public.memory_photos where memory_id=m.id) not between 1 and 5 or exists(
  select 1 from public.memory_photos ph where ph.memory_id=m.id and (not ph.validated or not exists(
   select 1 from storage.objects o where o.id=ph.full_object_id and o.bucket_id='memory-photos' and o.name=ph.full_path)
   or not exists(select 1 from storage.objects o where o.id=ph.thumb_object_id and o.bucket_id='memory-photos' and o.name=ph.thumb_path))) then
  return private.error('RETRYABLE'); end if;
 update public.memories set state='published',version=version+1,updated_at=now() where id=m.id returning * into m;
 return private.save_receipt(p_actor_id,p_command_id,'memory_publish',m.pair_id,request,private.memory_json(m));
end; $$;

create function public.reserve_memory(p_input jsonb,p_command_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.reserve_memory(p_input,p_command_id);$$;
create function public.update_memory(p_memory_id uuid,p_input jsonb,p_expected_version integer,p_command_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.memory_command('update',p_memory_id,p_input,p_expected_version,p_command_id);$$;
create function public.delete_memory(p_memory_id uuid,p_expected_version integer,p_command_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.memory_command('delete',p_memory_id,null,p_expected_version,p_command_id);$$;
create function public.verify_memory_reservation(p_memory_id uuid,p_actor_id uuid,p_session_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.verify_memory_reservation(p_memory_id,p_actor_id,p_session_id);$$;
create function public.validate_memory_photo(p_memory_id uuid,p_photo_id uuid,p_actor_id uuid,p_session_id uuid,p_evidence jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.validate_memory_photo(p_memory_id,p_photo_id,p_actor_id,p_session_id,p_evidence);$$;
create function public.publish_memory(p_memory_id uuid,p_actor_id uuid,p_session_id uuid,p_command_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.publish_memory(p_memory_id,p_actor_id,p_session_id,p_command_id);$$;

create function public.get_memory(p_memory_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare m public.memories;
begin
 if private.active_actor() is null then return private.error('UNAUTHENTICATED'); end if;
 select * into m from public.memories where id=p_memory_id;
 if not found then return private.error('FORBIDDEN'); end if;
 return jsonb_build_object('ok',true,'data',private.memory_json(m));
end; $$;
create function public.list_memories(p_pair_id uuid,p_cursor jsonb default null,p_limit integer default 50) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare items jsonb; next_cursor jsonb; cursor_date date; cursor_id uuid;
begin
 if private.active_actor() is null then return private.error('UNAUTHENTICATED'); end if;
 if not private.is_member(p_pair_id) then return private.error('FORBIDDEN'); end if;
 if p_limit is null or p_limit not between 1 and 50 then return private.error('VALIDATION','limit'); end if;
 if p_cursor is not null then
 cursor_date:=(p_cursor->>'memoryDate')::date; cursor_id:=(p_cursor->>'id')::uuid;
  if cursor_date is null or not isfinite(cursor_date) or p_cursor->>'memoryDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   or cursor_id is null then return private.error('VALIDATION','cursor'); end if;
 end if;
 select coalesce(jsonb_agg(private.memory_json(page) order by page.memory_date desc,page.id desc),'[]'::jsonb) into items
 from(select m.* from public.memories m where pair_id=p_pair_id and state='published'
  and(p_cursor is null or (memory_date,id)<(cursor_date,cursor_id)) order by memory_date desc,id desc limit p_limit+1) page;
 if jsonb_array_length(items)>p_limit then
  items:=items-p_limit;
  next_cursor:=jsonb_build_object('memoryDate',items->(p_limit-1)->>'memoryDate','id',items->(p_limit-1)->>'id');
 end if;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('items',items,'nextCursor',next_cursor));
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then return private.error('VALIDATION','cursor');
end; $$;
create function public.latest_memory(p_pair_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare page jsonb;
begin
 page:=public.list_memories(p_pair_id,null,1); if page->>'ok'<>'true' then return page; end if;
 return jsonb_build_object('ok',true,'data',page->'data'->'items'->0);
end; $$;
create function private.claim_memory_cleanup(p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare candidate record; job private.memory_cleanup_jobs; jobs jsonb:='[]'; token uuid;
 candidate_pairs uuid[]; expired_memories uuid[];
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then return private.error('FORBIDDEN'); end if;
 if p_limit is null or p_limit not between 1 and 2 then return private.error('VALIDATION','limit'); end if;
 -- Serialize batch claims without waiting. Individual workers keep independent durable leases.
 if not pg_try_advisory_xact_lock(hashtextextended('deseo.memory_cleanup_claim',0)) then
  return jsonb_build_object('ok',true,'data','[]'::jsonb);
 end if;
 -- Select a bounded batch, then lock all account rows before any pair row.
 -- Historical members also participate: an ended-pair delete retry still locks its author.
 select coalesce(array_agg(id),'{}'::uuid[]) into expired_memories from(
  select m.id from public.memories m join private.memory_reservations r on r.memory_id=m.id
  where m.state='pending' and r.expires_at<=now() and r.released_at is null order by r.expires_at,m.id limit p_limit) expired;
 select coalesce(array_agg(distinct pair_id),'{}'::uuid[]) into candidate_pairs from(
  select pair_id from public.memories where id=any(expired_memories)
  union all select pair_id from(select pair_id from private.memory_cleanup_jobs
   where(state='queued' and due_at<=now()) or(state='leased' and lease_until<=now()) order by due_at,id limit p_limit) due) candidates;
 perform 1 from public.profiles where user_id in(select user_id from public.pair_members where pair_id=any(candidate_pairs)) order by user_id for update;
 perform 1 from public.pairs where id=any(candidate_pairs) order by id for update;
 for candidate in select id from public.memories where id=any(expired_memories) loop
  update public.memories set state='deleting',version=version+1,updated_at=now() where id=candidate.id and state='pending';
 end loop;
 for candidate in select id,pair_id,memory_id from private.memory_cleanup_jobs
  where pair_id=any(candidate_pairs) and((state='queued' and due_at<=now()) or(state='leased' and lease_until<=now())) order by due_at,id limit p_limit loop
  perform 1 from public.memories where id=candidate.memory_id for update;
  select * into job from private.memory_cleanup_jobs where id=candidate.id and
   ((state='queued' and due_at<=now()) or(state='leased' and lease_until<=now())) for update skip locked;
  if not found then continue; end if;
  token:=gen_random_uuid();
  update private.memory_cleanup_jobs set state='leased',attempts=attempts+1,lease_token=token,lease_until=now()+interval '5 minutes' where id=job.id returning * into job;
  jobs:=jobs||jsonb_build_array(jsonb_build_object('id',job.id,'memoryId',job.memory_id,'bucket','memory-photos','paths',job.paths,'leaseToken',token,'attempt',job.attempts));
 end loop;
 return jsonb_build_object('ok',true,'data',jobs);
end; $$;
create function private.complete_memory_cleanup(p_job_id uuid,p_lease_token uuid,p_error_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job private.memory_cleanup_jobs; new_state text;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then return private.error('FORBIDDEN'); end if;
 if p_error_code is not null and char_length(p_error_code) not between 1 and 80 then return private.error('VALIDATION'); end if;
 select * into job from private.memory_cleanup_jobs where id=p_job_id;
 if not found then return private.error('FORBIDDEN'); end if;
 -- Tombstones reference the original author. Lock historical profiles before the pair, including ended pairs.
 perform 1 from public.profiles where user_id in(select user_id from public.pair_members where pair_id=job.pair_id) order by user_id for update;
 perform 1 from public.pairs where id=job.pair_id for update;
 perform 1 from public.memories where id=job.memory_id for update;
 select * into job from private.memory_cleanup_jobs where id=p_job_id for update;
 if job.state<>'leased' or job.lease_token is distinct from p_lease_token or job.lease_until<=now() then return private.error('CONFLICT'); end if;
 if p_error_code is null then
  if exists(select 1 from storage.objects where bucket_id='memory-photos' and name=any(job.paths)) then return private.error('RETRYABLE'); end if;
  -- Keep only stable identity in private storage; remove captions, dates, photos, and reservations.
  insert into private.memory_tombstones(memory_id,pair_id,created_by)
   select id,pair_id,created_by from public.memories where id=job.memory_id on conflict do nothing;
  delete from private.command_receipts where command_type in('memory_reserve','memory_update','memory_publish')
   and result->'data'->>'id'=job.memory_id::text;
  delete from public.memories where id=job.memory_id;
  new_state:='completed';
 else new_state:='queued';
 end if;
 update private.memory_cleanup_jobs set state=new_state,lease_token=null,lease_until=null,error_code=p_error_code,
 due_at=now()+case job.attempts when 1 then interval '1 minute' when 2 then interval '5 minutes' else interval '15 minutes' end,
 completed_at=case when new_state='completed' then now() else null end,
 paths=case when new_state='completed' then '{}'::text[] else paths end where id=job.id;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('id',job.id,'state',new_state));
end; $$;
create function public.claim_memory_cleanup(p_limit integer default 2) returns jsonb language sql security invoker set search_path='' as $$select private.claim_memory_cleanup(p_limit);$$;
create function public.complete_memory_cleanup(p_job_id uuid,p_lease_token uuid,p_error_code text default null) returns jsonb language sql security invoker set search_path='' as $$select private.complete_memory_cleanup(p_job_id,p_lease_token,p_error_code);$$;

-- Revoke every newly created function explicitly, including non-definer helpers.
revoke all on function private.memory_identity(),private.photo_identity(),private.memory_object_size(),private.memory_photo_json(public.memory_photos),private.memory_json(public.memories),
 private.reserve_memory(jsonb,uuid),private.memory_upload_allowed(text),private.memory_object_readable(text),private.memory_command(text,uuid,jsonb,integer,uuid),private.schedule_memory_cleanup(),private.close_pending_memories(),
 private.memory_service_lock(uuid,uuid,uuid),private.verify_memory_reservation(uuid,uuid,uuid),private.validate_memory_photo(uuid,uuid,uuid,uuid,jsonb),private.publish_memory(uuid,uuid,uuid,uuid),
 private.claim_memory_cleanup(integer),private.complete_memory_cleanup(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.reserve_memory(jsonb,uuid),public.update_memory(uuid,jsonb,integer,uuid),public.delete_memory(uuid,integer,uuid),
 public.verify_memory_reservation(uuid,uuid,uuid),public.validate_memory_photo(uuid,uuid,uuid,uuid,jsonb),public.publish_memory(uuid,uuid,uuid,uuid),
 public.get_memory(uuid),public.list_memories(uuid,jsonb,integer),public.latest_memory(uuid),
 public.claim_memory_cleanup(integer),public.complete_memory_cleanup(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.error(text,text),private.memory_json(public.memories),private.memory_photo_json(public.memory_photos),private.reserve_memory(jsonb,uuid),
 private.memory_command(text,uuid,jsonb,integer,uuid),private.memory_upload_allowed(text),public.reserve_memory(jsonb,uuid),public.update_memory(uuid,jsonb,integer,uuid),
 public.delete_memory(uuid,integer,uuid),public.get_memory(uuid),public.list_memories(uuid,jsonb,integer),public.latest_memory(uuid),private.memory_object_readable(text) to authenticated;
grant execute on function private.verify_memory_reservation(uuid,uuid,uuid),private.validate_memory_photo(uuid,uuid,uuid,uuid,jsonb),private.publish_memory(uuid,uuid,uuid,uuid),
 private.claim_memory_cleanup(integer),private.complete_memory_cleanup(uuid,uuid,text),
 public.verify_memory_reservation(uuid,uuid,uuid),public.validate_memory_photo(uuid,uuid,uuid,uuid,jsonb),public.publish_memory(uuid,uuid,uuid,uuid),
 public.claim_memory_cleanup(integer),public.complete_memory_cleanup(uuid,uuid,text) to service_role;
alter publication supabase_realtime add table public.memories,public.memory_access_revocations;

-- ========== tasks ==========
create table public.task_lists (
  id uuid primary key,
  pair_id uuid not null references public.pairs(id) on delete cascade,
  name text not null check(char_length(name) between 1 and 40 and name=btrim(name)),
  is_general boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check(version>0),
  unique(pair_id,id),
  foreign key(pair_id,created_by) references public.pair_members(pair_id,user_id),
  check((is_general and name='General' and created_by is null) or (not is_general and created_by is not null))
);
create unique index task_lists_names on public.task_lists(pair_id,lower(name));
create unique index task_lists_general on public.task_lists(pair_id) where is_general;
create table public.tasks (
  id uuid primary key,
  pair_id uuid not null references public.pairs(id) on delete cascade,
  list_id uuid not null,
  title text not null check(char_length(title) between 1 and 200 and title=btrim(title)),
  assignee_id uuid,
  due_date date,
  completed_at timestamptz,
  completed_by uuid,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check(version>0),
  unique(pair_id,id),
  foreign key(pair_id,list_id) references public.task_lists(pair_id,id),
  foreign key(pair_id,created_by) references public.pair_members(pair_id,user_id),
  foreign key(pair_id,assignee_id) references public.pair_members(pair_id,user_id),
  foreign key(pair_id,completed_by) references public.pair_members(pair_id,user_id),
  check((completed_at is null)=(completed_by is null))
);
create index tasks_list on public.tasks(pair_id,list_id,created_at,id);
create index tasks_due on public.tasks(pair_id,due_date,id) where completed_at is null;
create index tasks_author on public.tasks(created_by);
create index tasks_assignee on public.tasks(assignee_id);
create index tasks_completed_by on public.tasks(completed_by);
alter table public.task_lists enable row level security;
alter table public.tasks enable row level security;
revoke all on public.task_lists,public.tasks from public,anon,authenticated;
grant select on public.task_lists,public.tasks to authenticated;
grant all on public.task_lists,public.tasks to service_role;
create policy task_lists_visible on public.task_lists for select to authenticated using(pair_id=(select private.actor_pair()));
create policy tasks_visible on public.tasks for select to authenticated using(pair_id=(select private.actor_pair()));

-- General belongs to the system, so pair activation does not require a pre-existing author row.
create function private.create_general_list() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.state='active' then
    insert into public.task_lists(id,pair_id,name,is_general) values(pg_catalog.gen_random_uuid(),new.id,'General',true)
    on conflict(pair_id) where is_general do nothing;
  end if;
  return new;
end;
$$;
create trigger pairs_general_list after insert or update of state on public.pairs for each row execute function private.create_general_list();
insert into public.task_lists(id,pair_id,name,is_general)
select pg_catalog.gen_random_uuid(),id,'General',true from public.pairs where state='active';

create function private.task_identity() returns trigger language plpgsql set search_path='' as $$
begin
  if new.id<>old.id or new.pair_id<>old.pair_id or new.created_by is distinct from old.created_by or new.created_at<>old.created_at then
    raise exception using message='FORBIDDEN',errcode='P0001';
  end if;
  return new;
end;
$$;
create trigger tasks_identity before update on public.tasks for each row execute function private.task_identity();
create trigger task_lists_identity before update on public.task_lists for each row execute function private.task_identity();
create function private.check_task_assignee() returns trigger language plpgsql set search_path='' as $$
begin
  if new.assignee_id is not null and not exists(select 1 from public.pair_members m join public.profiles p on p.user_id=m.user_id
    where m.pair_id=new.pair_id and m.user_id=new.assignee_id and m.left_at is null and p.account_status='active') then
    raise exception using message='VALIDATION',errcode='P0001';
  end if;
  return new;
end;
$$;
create trigger tasks_assignee before insert or update of assignee_id on public.tasks for each row execute function private.check_task_assignee();
create function private.protect_general_list() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then
    -- Permit parent-pair retention cleanup after the parent row is removed.
    if old.is_general and exists(select 1 from public.pairs where id=old.pair_id) then raise exception using message='FORBIDDEN',errcode='P0001'; end if;
    return old;
  end if;
  if new.is_general<>old.is_general or (old.is_general and new.name<>old.name) then raise exception using message='FORBIDDEN',errcode='P0001'; end if;
  return new;
end;
$$;
create trigger task_lists_general_protection before update or delete on public.task_lists for each row execute function private.protect_general_list();

-- Send only invalidation signals. Do not publish task rows to Postgres Changes.
create policy task_signals_read on realtime.messages for select to authenticated
using(extension='broadcast' and case when realtime.topic() ~ '^tasks:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then private.is_member((substring(realtime.topic() from 7))::uuid) else false end);
create function private.task_change_signal() returns trigger language plpgsql security definer set search_path='' as $$
declare pair uuid;
begin
  pair:=case when tg_op='DELETE' then old.pair_id else new.pair_id end;
  perform realtime.send('{}'::jsonb,'changed','tasks:'||pair::text,true);
  return null;
end;
$$;
create trigger tasks_change_signal after insert or update or delete on public.tasks for each row execute function private.task_change_signal();
create trigger task_lists_change_signal after insert or update or delete on public.task_lists for each row execute function private.task_change_signal();

create function private.task_command(p_action text,p_task_id uuid,p_input jsonb,p_completed boolean,p_expected_version integer,p_command_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid; pair uuid; previous public.tasks; result public.tasks; replay jsonb;
  request jsonb:=jsonb_build_object('id',p_task_id,'input',p_input,'completed',p_completed,'version',p_expected_version);
  task_list uuid; assignee uuid; task_title text; due date;
begin
  v_actor:=private.require_actor();
  if p_action not in('create','update','complete','delete') then return private.error('VALIDATION'); end if;
  if p_action='create' then
    p_task_id:=(p_input->>'id')::uuid; pair:=(p_input->>'pair_id')::uuid;
    if p_task_id is null or pair is null then return private.error('VALIDATION'); end if;
  else
    select pair_id into pair from public.tasks where id=p_task_id;
    if pair is null then select r.pair_id into pair from private.command_receipts r where r.actor=v_actor and r.command_id=p_command_id
      and r.command_type='task_'||p_action and r.expires_at>now(); end if;
    if pair is null then return private.error('FORBIDDEN'); end if;
  end if;
  perform private.lock_pair(pair,v_actor);
  if not private.is_member(pair) then return private.error('FORBIDDEN'); end if;
  select * into previous from public.tasks where id=p_task_id for update;
  if previous.id is not null and previous.pair_id<>pair then return private.error('FORBIDDEN'); end if;
  replay:=private.receipt(v_actor,p_command_id,'task_'||p_action,request);
  if replay is not null then
    if p_action<>'delete' and previous.id is null then return private.error('FORBIDDEN'); end if;
    return replay;
  end if;
  if p_action='create' and previous.id is not null then
    if previous.created_by<>v_actor then return private.error('CONFLICT'); end if;
    return private.save_receipt(v_actor,p_command_id,'task_create',pair,request,to_jsonb(previous));
  end if;
  if p_action<>'create' then
    if previous.id is null then return private.error('FORBIDDEN'); end if;
    if p_expected_version is null or p_expected_version<>previous.version then return private.error('CONFLICT'); end if;
  end if;
  if p_action='delete' then
    delete from public.tasks where id=p_task_id;
    return private.save_receipt(v_actor,p_command_id,'task_delete',pair,request,jsonb_build_object('id',p_task_id));
  end if;
  if p_action='complete' then
    if p_completed is null then return private.error('VALIDATION','completed'); end if;
    if p_completed=(previous.completed_at is not null) then result:=previous;
    else
      update public.tasks set completed_at=case when p_completed then now() end,completed_by=case when p_completed then v_actor end,
        updated_at=now(),version=version+1 where id=p_task_id returning * into result;
    end if;
    return private.save_receipt(v_actor,p_command_id,'task_complete',pair,request,to_jsonb(result));
  end if;
  if (p_input->>'id')::uuid is distinct from p_task_id or (p_input->>'pair_id')::uuid is distinct from pair then return private.error('VALIDATION','id'); end if;
  task_title:=btrim(p_input->>'title'); task_list:=(p_input->>'list_id')::uuid; assignee:=(p_input->>'assignee_id')::uuid;
  if task_title is null or char_length(task_title) not between 1 and 200 then return private.error('VALIDATION','title'); end if;
  if not exists(select 1 from public.task_lists where id=task_list and pair_id=pair) then return private.error('VALIDATION','listId'); end if;
  if assignee is not null and not exists(select 1 from public.pair_members m join public.profiles p on p.user_id=m.user_id
    where m.pair_id=pair and m.user_id=assignee and m.left_at is null and p.account_status='active') then return private.error('VALIDATION','assigneeId'); end if;
  if p_input->>'due_date' is not null then
    if p_input->>'due_date' !~ '^\d{4}-\d{2}-\d{2}$' then return private.error('VALIDATION','dueDate'); end if;
    due:=(p_input->>'due_date')::date;
  end if;
  if p_action='create' then
    insert into public.tasks(id,pair_id,list_id,title,assignee_id,due_date,created_by)
    values(p_task_id,pair,task_list,task_title,assignee,due,v_actor) returning * into result;
  else
    update public.tasks set list_id=task_list,title=task_title,assignee_id=assignee,due_date=due,updated_at=now(),version=version+1
    where id=p_task_id returning * into result;
  end if;
  return private.save_receipt(v_actor,p_command_id,'task_'||p_action,pair,request,to_jsonb(result));
exception
  when sqlstate 'P0001' then return private.error(sqlerrm);
  when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or check_violation or not_null_violation then return private.error('VALIDATION');
  when unique_violation then return private.error('CONFLICT');
  when foreign_key_violation then return private.error('VALIDATION');
end;
$$;

create function private.list_command(p_action text,p_list_id uuid,p_pair_id uuid,p_name text,p_expected_version integer,p_command_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid; pair uuid; previous public.task_lists; result public.task_lists; replay jsonb; general uuid; moved integer;
  request jsonb:=jsonb_build_object('id',p_list_id,'pair',p_pair_id,'name',p_name,'version',p_expected_version);
begin
  v_actor:=private.require_actor();
  if p_action not in('create','rename','move','delete') then return private.error('VALIDATION'); end if;
  if p_action='create' then pair:=p_pair_id; p_list_id:=p_command_id;
  else
    select pair_id into pair from public.task_lists where id=p_list_id;
    if pair is null then select r.pair_id into pair from private.command_receipts r where r.actor=v_actor and r.command_id=p_command_id
      and r.command_type='list_'||p_action and r.expires_at>now(); end if;
  end if;
  if pair is null then return private.error('FORBIDDEN'); end if;
  perform private.lock_pair(pair,v_actor);
  if not private.is_member(pair) then return private.error('FORBIDDEN'); end if;
  select * into previous from public.task_lists where id=p_list_id for update;
  if previous.id is not null and previous.pair_id<>pair then return private.error('FORBIDDEN'); end if;
  replay:=private.receipt(v_actor,p_command_id,'list_'||p_action,request);
  if replay is not null then
    if p_action<>'delete' and previous.id is null then return private.error('FORBIDDEN'); end if;
    return replay;
  end if;
  if p_action='create' and previous.id is not null then
    if previous.created_by<>v_actor then return private.error('CONFLICT'); end if;
    return private.save_receipt(v_actor,p_command_id,'list_create',pair,request,to_jsonb(previous));
  end if;
  if p_action<>'create' and (previous.id is null or previous.is_general) then return private.error('FORBIDDEN'); end if;
  if p_action='rename' and (p_expected_version is null or p_expected_version<>previous.version) then return private.error('CONFLICT'); end if;
  if p_action='move' then
    select id into general from public.task_lists where pair_id=pair and is_general;
    if general is null then return private.error('RETRYABLE'); end if;
    update public.tasks set list_id=general,version=version+1,updated_at=now() where list_id=p_list_id and pair_id=pair;
    get diagnostics moved=row_count;
    return private.save_receipt(v_actor,p_command_id,'list_move',pair,request,jsonb_build_object('id',p_list_id,'generalListId',general,'moved',moved));
  elsif p_action='delete' then
    if exists(select 1 from public.tasks where pair_id=pair and list_id=p_list_id) then return private.error('VALIDATION','listNotEmpty'); end if;
    delete from public.task_lists where id=p_list_id;
    return private.save_receipt(v_actor,p_command_id,'list_delete',pair,request,jsonb_build_object('id',p_list_id));
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 40 then return private.error('VALIDATION','name'); end if;
  if p_action='create' then
    insert into public.task_lists(id,pair_id,name,created_by) values(p_list_id,pair,btrim(p_name),v_actor) returning * into result;
  else
    update public.task_lists set name=btrim(p_name),version=version+1,updated_at=now() where id=p_list_id returning * into result;
  end if;
  return private.save_receipt(v_actor,p_command_id,'list_'||p_action,pair,request,to_jsonb(result));
exception
  when sqlstate 'P0001' then return private.error(sqlerrm);
  when unique_violation then return private.error('CONFLICT','name');
  when invalid_text_representation or check_violation or not_null_violation then return private.error('VALIDATION');
end;
$$;
create function public.create_task(p_input jsonb,p_command_id uuid) returns jsonb language sql security invoker set search_path=''
as $$select private.task_command('create',null,p_input,null,null,p_command_id);$$;
create function public.update_task(p_task_id uuid,p_input jsonb,p_expected_version integer,p_command_id uuid) returns jsonb language sql security invoker set search_path=''
as $$select private.task_command('update',p_task_id,p_input,null,p_expected_version,p_command_id);$$;
create function public.set_task_completed(p_task_id uuid,p_completed boolean,p_expected_version integer,p_command_id uuid) returns jsonb language sql security invoker set search_path=''
as $$select private.task_command('complete',p_task_id,null,p_completed,p_expected_version,p_command_id);$$;
create function public.delete_task(p_task_id uuid,p_expected_version integer,p_command_id uuid) returns jsonb language sql security invoker set search_path=''
as $$select private.task_command('delete',p_task_id,null,null,p_expected_version,p_command_id);$$;
create function public.create_list(p_pair_id uuid,p_name text,p_command_id uuid) returns jsonb language sql security invoker set search_path=''
as $$select private.list_command('create',null,p_pair_id,p_name,null,p_command_id);$$;
create function public.rename_list(p_list_id uuid,p_name text,p_expected_version integer,p_command_id uuid) returns jsonb language sql security invoker set search_path=''
as $$select private.list_command('rename',p_list_id,null,p_name,p_expected_version,p_command_id);$$;
create function public.move_list_tasks_to_general(p_list_id uuid,p_command_id uuid) returns jsonb language sql security invoker set search_path=''
as $$select private.list_command('move',p_list_id,null,null,null,p_command_id);$$;
create function public.delete_empty_list(p_list_id uuid,p_command_id uuid) returns jsonb language sql security invoker set search_path=''
as $$select private.list_command('delete',p_list_id,null,null,null,p_command_id);$$;
revoke all on function private.create_general_list(),private.task_identity(),private.check_task_assignee(),private.protect_general_list(),private.task_change_signal(),
private.task_command(text,uuid,jsonb,boolean,integer,uuid),private.list_command(text,uuid,uuid,text,integer,uuid) from public,anon,authenticated;
grant execute on function private.task_command(text,uuid,jsonb,boolean,integer,uuid),private.list_command(text,uuid,uuid,text,integer,uuid) to authenticated;
revoke all on function public.create_task(jsonb,uuid),public.update_task(uuid,jsonb,integer,uuid),public.set_task_completed(uuid,boolean,integer,uuid),public.delete_task(uuid,integer,uuid),
public.create_list(uuid,text,uuid),public.rename_list(uuid,text,integer,uuid),public.move_list_tasks_to_general(uuid,uuid),public.delete_empty_list(uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_task(jsonb,uuid),public.update_task(uuid,jsonb,integer,uuid),public.set_task_completed(uuid,boolean,integer,uuid),public.delete_task(uuid,integer,uuid),
public.create_list(uuid,text,uuid),public.rename_list(uuid,text,integer,uuid),public.move_list_tasks_to_general(uuid,uuid),public.delete_empty_list(uuid,uuid) to authenticated;

-- ========== dates-and-ideas ==========
-- Yearly dates remain events. Query expansion returns occurrences of one stored series.
alter table public.events add constraint events_important_fields check(not important_date or starts_at is null);
create index events_yearly_pair on public.events(pair_id,id) where repeat='yearly';

-- Check a bounded HTTPS authority. PostgreSQL validates bracketed address literals.
create function private.valid_idea_link(p_link text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare authority text[];
begin
  if p_link is null then return true; end if;
  if char_length(p_link)>2048 then return false; end if;
  authority:=regexp_match(p_link,
    '^https://(?:[^/?#@[:space:]]*@)?((?:[[:alnum:]_-]+[.])*[[:alnum:]_-]+[.]?|\[[0-9a-f:.]+\])(?::([0-9]{1,5}))?(?:[/?#][^[:space:]]*)?$','i');
  if authority is null then return false; end if;
  if authority[2] is not null and authority[2]::integer>65535 then return false; end if;
  if left(authority[1],1)='[' then
    return family(substring(authority[1] from 2 for char_length(authority[1])-2)::inet)=6;
  end if;
  return true;
exception when invalid_text_representation then return false;
end;
$$;
revoke all on function private.valid_idea_link(text) from public,anon,authenticated;
grant execute on function private.valid_idea_link(text) to authenticated,service_role;

create table public.date_ideas (
  id uuid primary key,
  pair_id uuid not null references public.pairs(id) on delete cascade,
  created_by uuid not null,
  title text not null check(char_length(title) between 1 and 120 and title=btrim(title)),
  note text check(char_length(note)<=1000),
  link text check(private.valid_idea_link(link)),
  state text not null default 'saved' check(state in('saved','planned','archived')),
  linked_event_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check(version>0),
  unique(pair_id,id),
  unique(linked_event_id),
  foreign key(pair_id,created_by) references public.pair_members(pair_id,user_id),
  foreign key(pair_id,linked_event_id) references public.events(pair_id,id),
  check(state<>'saved' or linked_event_id is null)
);
create index date_ideas_pair_state on public.date_ideas(pair_id,state,created_at desc,id desc);
alter table public.date_ideas enable row level security;
revoke all on public.date_ideas from public,anon,authenticated;
grant select on public.date_ideas to authenticated;
grant all on public.date_ideas to service_role;
create policy date_ideas_visible on public.date_ideas for select to authenticated using(pair_id=(select private.actor_pair()));
create trigger date_ideas_identity before update on public.date_ideas for each row execute function private.event_identity();

-- Derive only dates. February 29 uses the month's last day in non-leap years.


create function private.idea_command(p_action text,p_idea_id uuid,p_input jsonb,p_expected_version integer,p_command_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid; pair uuid; previous public.date_ideas; result public.date_ideas; replay jsonb;
  request jsonb:=jsonb_build_object('id',p_idea_id,'input',p_input,'version',p_expected_version);
  v_title text; v_note text; v_link text;
begin
  actor:=private.require_actor();
  if p_action not in('create','update','archive') or p_command_id is null then return private.error('VALIDATION'); end if;
  if p_action='create' then
    p_idea_id:=(p_input->>'id')::uuid; pair:=(p_input->>'pair_id')::uuid;
    if p_idea_id is null or pair is null then return private.error('VALIDATION'); end if;
  else
    select pair_id into pair from public.date_ideas where id=p_idea_id;
    if pair is null then return private.error('FORBIDDEN'); end if;
  end if;
  perform private.lock_pair(pair,actor);
  if not private.is_member(pair) then return private.error('FORBIDDEN'); end if;
  select * into previous from public.date_ideas where id=p_idea_id for update;
  if previous.id is not null and previous.pair_id<>pair then return private.error('CONFLICT'); end if;
  replay:=private.receipt(actor,p_command_id,'idea_'||p_action,request);
  if replay is not null then return replay; end if;
  if p_action='create' and previous.id is not null then
    if previous.created_by<>actor then return private.error('CONFLICT'); end if;
    return private.save_receipt(actor,p_command_id,'idea_create',pair,request,to_jsonb(previous));
  end if;
  if p_action<>'create' and (previous.id is null or p_expected_version is null or previous.version<>p_expected_version) then
    return private.error('CONFLICT'); end if;
  if p_action='archive' then
    update public.date_ideas set state='archived',version=version+1,updated_at=now() where id=p_idea_id returning * into result;
  else
    if (p_input->>'id')::uuid is distinct from p_idea_id or (p_input->>'pair_id')::uuid is distinct from pair then return private.error('VALIDATION','id'); end if;
    v_title:=btrim(p_input->>'title'); v_note:=nullif(btrim(p_input->>'note'),''); v_link:=nullif(btrim(p_input->>'link'),'');
    if v_title is null or char_length(v_title) not between 1 and 120 then return private.error('VALIDATION','title'); end if;
    if char_length(v_note)>1000 then return private.error('VALIDATION','note'); end if;
    if not private.valid_idea_link(v_link) then return private.error('VALIDATION','link'); end if;
    if p_action='create' then
      insert into public.date_ideas(id,pair_id,created_by,title,note,link) values(p_idea_id,pair,actor,v_title,v_note,v_link) returning * into result;
    else
      update public.date_ideas set title=v_title,note=v_note,link=v_link,version=version+1,updated_at=now()
      where id=p_idea_id returning * into result;
    end if;
  end if;
  return private.save_receipt(actor,p_command_id,'idea_'||p_action,pair,request,to_jsonb(result));
exception
  when sqlstate 'P0001' then return private.error(sqlerrm);
  when invalid_text_representation or check_violation or not_null_violation then return private.error('VALIDATION');
  when unique_violation then return private.error('CONFLICT');
end;
$$;

create function private.plan_date_idea(p_idea_id uuid,p_event_input jsonb,p_expected_version integer,p_command_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid; pair uuid; idea public.date_ideas; replay jsonb; event_result jsonb; event_id uuid;
  request jsonb:=jsonb_build_object('id',p_idea_id,'input',p_event_input,'version',p_expected_version);
begin
  actor:=private.require_actor();
  select pair_id into pair from public.date_ideas where id=p_idea_id;
  if pair is null then return private.error('FORBIDDEN'); end if;
  perform private.lock_pair(pair,actor);
  if not private.is_member(pair) then return private.error('FORBIDDEN'); end if;
  select * into idea from public.date_ideas where id=p_idea_id for update;
  if p_command_id is null then return private.error('VALIDATION','commandId'); end if;
  event_id:=(p_event_input->>'id')::uuid;
  if (p_event_input->>'pair_id')::uuid is distinct from pair then return private.error('FORBIDDEN'); end if;
  replay:=private.receipt(actor,p_command_id,'idea_plan',request);
  if replay is not null then
    if replay->>'ok'='true' and not exists(select 1 from public.events where id=event_id and pair_id=pair and who<>'private') then
      return private.error('FORBIDDEN'); end if;
    return replay;
  end if;
  if p_expected_version is null or idea.version<>p_expected_version or idea.state<>'saved' then return private.error('CONFLICT'); end if;
  if coalesce(p_event_input->>'who','private')='private' or coalesce(p_event_input->>'repeat','none')<>'none' then return private.error('VALIDATION','who'); end if;
  if event_id is null then return private.error('VALIDATION','id'); end if;
  if exists(select 1 from public.events where id=event_id) then return private.error('CONFLICT'); end if;
  event_result:=private.event_command('create',null,p_event_input,null,p_command_id);
  if event_result->>'ok'<>'true' then return event_result; end if;
  update public.date_ideas set state='planned',linked_event_id=event_id,version=version+1,updated_at=now() where id=p_idea_id;
  return private.save_receipt(actor,p_command_id,'idea_plan',pair,request,event_result->'data');
exception
  when sqlstate 'P0001' then return private.error(sqlerrm);
  when invalid_text_representation or check_violation or not_null_violation or foreign_key_violation then return private.error('VALIDATION');
  when unique_violation then return private.error('CONFLICT');
end;
$$;

create function private.idea_event_lifecycle() returns trigger language plpgsql security definer set search_path = '' as $$
declare future boolean;
begin
  if tg_op='UPDATE' then
    if new.who='private' and exists(select 1 from public.date_ideas where linked_event_id=new.id) then
      raise exception using message='FORBIDDEN',errcode='P0001'; end if;
    return new;
  end if;
  future:=case when old.starts_at is not null then old.starts_at>now()
    else old.start_date>(now() at time zone coalesce((select timezone from public.profiles where user_id=old.created_by),'UTC'))::date end;
  update public.date_ideas set linked_event_id=null,state=case when state='planned' and future then 'saved' else state end,
    version=version+1,updated_at=now() where linked_event_id=old.id;
  return old;
end;
$$;
create trigger idea_event_lifecycle before update of who or delete on public.events for each row execute function private.idea_event_lifecycle();

-- Send no row, ID, title, note, or link. Only current members can join this topic.
create function private.idea_signal() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send('{}'::jsonb,'changed','calendar:'||coalesce(new.pair_id,old.pair_id)::text,true);
  return null;
end;
$$;
create trigger date_ideas_signal after insert or update or delete on public.date_ideas for each row execute function private.idea_signal();
create policy calendar_broadcast_read on realtime.messages for select to authenticated
using(extension='broadcast' and case when realtime.topic() ~ '^calendar:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then private.is_member((substring(realtime.topic() from 10))::uuid) else false end);

create function public.create_date_idea(p_input jsonb,p_command_id uuid) returns jsonb language sql security invoker set search_path = ''
as $$ select private.idea_command('create',null,p_input,null,p_command_id); $$;
create function public.update_date_idea(p_idea_id uuid,p_input jsonb,p_expected_version integer,p_command_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select private.idea_command('update',p_idea_id,p_input,p_expected_version,p_command_id); $$;
create function public.archive_date_idea(p_idea_id uuid,p_expected_version integer,p_command_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select private.idea_command('archive',p_idea_id,null,p_expected_version,p_command_id); $$;
create function public.plan_date_idea(p_idea_id uuid,p_event_input jsonb,p_expected_version integer,p_command_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select private.plan_date_idea(p_idea_id,p_event_input,p_expected_version,p_command_id); $$;

revoke all on function private.idea_command(text,uuid,jsonb,integer,uuid),private.plan_date_idea(uuid,jsonb,integer,uuid),
  private.idea_event_lifecycle(),private.idea_signal() from public,anon,authenticated;
grant execute on function private.idea_command(text,uuid,jsonb,integer,uuid),private.plan_date_idea(uuid,jsonb,integer,uuid) to authenticated;
revoke all on function public.create_date_idea(jsonb,uuid),public.update_date_idea(uuid,jsonb,integer,uuid),
  public.archive_date_idea(uuid,integer,uuid),public.plan_date_idea(uuid,jsonb,integer,uuid) from public,anon,authenticated;
grant execute on function public.create_date_idea(jsonb,uuid),public.update_date_idea(uuid,jsonb,integer,uuid),
  public.archive_date_idea(uuid,integer,uuid),public.plan_date_idea(uuid,jsonb,integer,uuid) to authenticated;

-- ========== notification-preferences ==========
create table public.notification_preferences (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  message_alerts boolean not null default false,
  default_event_reminder_minutes integer check(default_event_reminder_minutes in(15,60,1440)),
  quiet_start time, quiet_end time,
  timezone text not null,
  version integer not null default 1 check(version>0),
  check((quiet_start is null and quiet_end is null) or
    (quiet_start is not null and quiet_end is not null and quiet_start<>quiet_end))
);
create trigger notification_preferences_timezone before insert or update on public.notification_preferences
for each row execute function private.check_timezone();

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  installation_id uuid not null unique,
  session_id uuid not null,
  expo_token text unique,
  platform text not null check(platform in('ios','android')),
  permission text not null check(permission in('allowed','denied','not_requested')),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  version integer not null default 1,
  check(expo_token is null or (char_length(expo_token)<=256 and expo_token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$')),
  check(permission='allowed' or expo_token is null)
);
create index devices_account on public.devices(user_id) where revoked_at is null;

create table public.reminders (
  id uuid primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  pair_id uuid not null references public.pairs(id) on delete cascade,
  event_id uuid, task_id uuid,
  minutes_before integer,
  remind_at timestamptz,
  active boolean not null,
  version integer not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  foreign key(pair_id,event_id) references public.events(pair_id,id) on delete cascade,
  foreign key(pair_id,task_id) references public.tasks(pair_id,id) on delete cascade,
  foreign key(pair_id,user_id) references public.pair_members(pair_id,user_id),
  check((event_id is not null and task_id is null and (not active or minutes_before is not null)
      and (minutes_before is null or minutes_before in(15,60,1440)) and remind_at is null)
    or (task_id is not null and event_id is null and minutes_before is null and (not active or remind_at is not null))),
  unique(user_id,event_id), unique(user_id,task_id)
);
create index reminders_pair on public.reminders(pair_id);
create index reminders_event on public.reminders(event_id) where event_id is not null;
create index reminders_task on public.reminders(task_id) where task_id is not null;
alter table public.notification_preferences enable row level security;
alter table public.devices enable row level security;
alter table public.reminders enable row level security;
revoke all on public.notification_preferences,public.devices,public.reminders from public,anon,authenticated;
grant select on public.notification_preferences,public.reminders to authenticated;
grant select(id,user_id,installation_id,platform,permission,last_seen_at,revoked_at,version) on public.devices to authenticated;
grant all on public.notification_preferences,public.devices,public.reminders to service_role;
create policy own_preferences on public.notification_preferences for select to authenticated using(user_id=(select private.active_actor()));
create policy own_devices on public.devices for select to authenticated using(user_id=(select private.active_actor()));
create policy own_reminders on public.reminders for select to authenticated
using(user_id=(select private.active_actor()) and pair_id=(select private.actor_pair()) and
  (event_id is null or exists(select 1 from public.events e where e.id=event_id)));

create function private.preferences_json(p public.notification_preferences) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('messageAlerts',p.message_alerts,'defaultEventReminderMinutes',p.default_event_reminder_minutes,
 'quietStart',left(p.quiet_start::text,5),'quietEnd',left(p.quiet_end::text,5),'timezone',p.timezone,'version',p.version);
$$;
create function private.get_notification_preferences() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor(); p public.notification_preferences;
begin
 select * into p from public.notification_preferences where user_id=actor;
 if not found then
   return jsonb_build_object('ok',true,'data',jsonb_build_object('messageAlerts',false,'defaultEventReminderMinutes',null,
     'quietStart',null,'quietEnd',null,'timezone',(select timezone from public.profiles where user_id=actor),'version',0));
 end if;
 return jsonb_build_object('ok',true,'data',private.preferences_json(p));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end; $$;
create function private.save_notification_preferences(p_input jsonb,p_expected_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor(); p public.notification_preferences; current_version integer;
begin
 perform 1 from public.profiles where user_id=actor for update;
 perform private.require_actor();
 select * into p from public.notification_preferences where user_id=actor for update;
 current_version:=coalesce(p.version,0);
 if p_expected_version is distinct from current_version then return private.error('CONFLICT'); end if;
 if jsonb_typeof(p_input->'messageAlerts') is distinct from 'boolean'
   or coalesce(p_input->>'timezone','')='' then return private.error('VALIDATION'); end if;
 if (p_input->>'quietStart') is not null and (p_input->>'quietStart') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
   or (p_input->>'quietEnd') is not null and (p_input->>'quietEnd') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return private.error('VALIDATION'); end if;
 insert into public.notification_preferences(user_id,message_alerts,default_event_reminder_minutes,quiet_start,quiet_end,timezone,version)
 values(actor,(p_input->>'messageAlerts')::boolean,(p_input->>'defaultEventReminderMinutes')::integer,
 (p_input->>'quietStart')::time,(p_input->>'quietEnd')::time,p_input->>'timezone',current_version+1)
 on conflict(user_id) do update set message_alerts=excluded.message_alerts,
 default_event_reminder_minutes=excluded.default_event_reminder_minutes,quiet_start=excluded.quiet_start,
 quiet_end=excluded.quiet_end,timezone=excluded.timezone,version=excluded.version returning * into p;
 return jsonb_build_object('ok',true,'data',private.preferences_json(p));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
 when invalid_text_representation or check_violation or not_null_violation or datetime_field_overflow then return private.error('VALIDATION');
end; $$;

create function private.register_device(p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor(); installation uuid:=(p_input->>'installationId')::uuid;
 token text:=p_input->>'token'; permission_state text:=p_input->>'permission'; device_id uuid;
begin
 if installation is null or permission_state not in('allowed','denied','not_requested')
   or coalesce(p_input->>'platform','') not in('ios','android')
   or permission_state='allowed' and token is null
   or permission_state<>'allowed' and token is not null then return private.error('VALIDATION'); end if;
 -- Serialize token transfers before locking affected accounts in stable order.
 perform pg_advisory_xact_lock(57005,8);
 perform 1 from public.profiles where user_id=actor or user_id in
   (select user_id from public.devices where installation_id=installation or expo_token=token) order by user_id for update;
 perform private.require_actor();
 update public.devices set revoked_at=now(),expo_token=null,version=version+1
 where expo_token=token and installation_id<>installation;
 insert into public.devices(user_id,installation_id,session_id,expo_token,platform,permission)
 values(actor,installation,(auth.jwt()->>'session_id')::uuid,token,p_input->>'platform',permission_state)
 on conflict(installation_id) do update set user_id=excluded.user_id,session_id=excluded.session_id,
 expo_token=excluded.expo_token,platform=excluded.platform,permission=excluded.permission,last_seen_at=now(),
 revoked_at=null,version=public.devices.version+case when
 (public.devices.user_id,public.devices.session_id,public.devices.expo_token,public.devices.permission,public.devices.revoked_at)
 is distinct from (excluded.user_id,excluded.session_id,excluded.expo_token,excluded.permission,null::timestamptz) then 1 else 0 end
 returning id into device_id;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('deviceId',device_id));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
 when invalid_text_representation or check_violation or not_null_violation then return private.error('VALIDATION');
end; $$;
create function private.revoke_device(p_installation_id uuid,p_all boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor();
begin
 perform 1 from public.profiles where user_id=actor for update;
 perform private.require_actor();
 update public.devices set revoked_at=now(),expo_token=null,version=version+1
 where user_id=actor and revoked_at is null and (p_all or installation_id=p_installation_id);
 return jsonb_build_object('ok',true,'data',jsonb_build_object('revoked',true));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end; $$;

create function private.reminder_json(r public.reminders) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare next_due timestamptz; e public.events; occurrence date; local_today date; year integer;
 tz text:=(select timezone from public.profiles where user_id=r.user_id);
begin
 if r.task_id is not null then next_due:=r.remind_at;
 else
   select * into e from public.events where id=r.event_id;
   if e.repeat='yearly' then
     local_today:=(now() at time zone tz)::date;
     year:=greatest(extract(year from local_today),extract(year from e.start_date))::integer;
     occurrence:=private.yearly_date(year,e.repeat_month,e.repeat_day);
     next_due:=(occurrence+time '09:00') at time zone tz-make_interval(mins=>r.minutes_before);
     if next_due<=now() then
       occurrence:=private.yearly_date(year+1,e.repeat_month,e.repeat_day);
       next_due:=(occurrence+time '09:00') at time zone tz-make_interval(mins=>r.minutes_before);
     end if;
   else
     next_due:=coalesce(e.starts_at,(e.start_date+time '09:00') at time zone tz)-make_interval(mins=>r.minutes_before);
   end if;
 end if;
 return jsonb_build_object('id',r.id,'pairId',r.pair_id,'eventId',r.event_id,'taskId',r.task_id,
   'minutesBefore',r.minutes_before,'remindAt',r.remind_at,'active',r.active,'version',r.version,
   'state',case when not r.active then 'off' when next_due<=now() then 'past' else 'scheduled' end,
   'nextDueAt',case when r.active and next_due>now() then next_due else null end);
end; $$;
create function private.set_reminder(p_input jsonb,p_command_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor(); pair uuid:=(p_input->>'pairId')::uuid; r public.reminders;
 event uuid:=(p_input->>'eventId')::uuid; task uuid:=(p_input->>'taskId')::uuid; reminder_id uuid:=(p_input->>'id')::uuid; replay jsonb;
begin
 perform private.lock_pair(pair,actor);
 if not private.is_member(pair) then return private.error('FORBIDDEN'); end if;
 if (event is null)=(task is null) or reminder_id is null or jsonb_typeof(p_input->'active') is distinct from 'boolean'
 then return private.error('VALIDATION'); end if;
 if event is not null and not exists(select 1 from public.events where id=event and pair_id=pair
   and (who<>'private' or created_by=actor)) then return private.error('FORBIDDEN'); end if;
 if task is not null and not exists(select 1 from public.tasks where id=task and pair_id=pair
   and (completed_at is null or (p_input->>'active')::boolean=false))
 then return private.error('FORBIDDEN'); end if;
 select * into r from public.reminders where id=reminder_id for update;
 if found and (r.user_id<>actor or r.pair_id<>pair or r.event_id is distinct from event or r.task_id is distinct from task)
 then return private.error('FORBIDDEN'); end if;
 replay:=private.receipt(actor,p_command_id,'set_reminder',p_input);
 if replay is not null then return replay; end if;
 if r.id is not null and r.version is distinct from (p_input->>'expectedVersion')::integer then return private.error('CONFLICT'); end if;
 if r.id is null and p_input->>'expectedVersion' is not null then return private.error('CONFLICT'); end if;
 insert into public.reminders(id,user_id,pair_id,event_id,task_id,minutes_before,remind_at,active,version)
 values(reminder_id,actor,pair,event,task,(p_input->>'minutesBefore')::integer,(p_input->>'remindAt')::timestamptz,
 (p_input->>'active')::boolean,coalesce(r.version,0)+1)
 on conflict(id) do update set minutes_before=excluded.minutes_before,remind_at=excluded.remind_at,
 active=excluded.active,version=excluded.version returning * into r;
 return private.save_receipt(actor,p_command_id,'set_reminder',pair,p_input,private.reminder_json(r));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
 when unique_violation then return private.error('CONFLICT');
 when invalid_text_representation or check_violation or not_null_violation or datetime_field_overflow then return private.error('VALIDATION');
end; $$;
create function private.get_reminder(p_event_id uuid,p_task_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_actor(); r public.reminders;
begin
 if (p_event_id is null)=(p_task_id is null) then return private.error('VALIDATION'); end if;
 select * into r from public.reminders where user_id=actor and
 (event_id=p_event_id or task_id=p_task_id) and private.is_member(pair_id)
 and (event_id is null or exists(select 1 from public.events e where e.id=event_id and (e.who<>'private' or e.created_by=actor)));
 return jsonb_build_object('ok',true,'data',case when r.id is null then null else private.reminder_json(r) end);
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end; $$;

create function public.get_notification_preferences() returns jsonb language sql security invoker set search_path='' as $$select private.get_notification_preferences();$$;
create function public.save_notification_preferences(p_input jsonb,p_expected_version integer) returns jsonb language sql security invoker set search_path='' as $$select private.save_notification_preferences(p_input,p_expected_version);$$;
create function public.register_device(p_input jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.register_device(p_input);$$;
create function public.revoke_device(p_installation_id uuid,p_all boolean default false) returns jsonb language sql security invoker set search_path='' as $$select private.revoke_device(p_installation_id,p_all);$$;
create function public.set_reminder(p_input jsonb,p_command_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.set_reminder(p_input,p_command_id);$$;
create function public.get_reminder(p_event_id uuid,p_task_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.get_reminder(p_event_id,p_task_id);$$;
revoke all on function private.preferences_json(public.notification_preferences),private.reminder_json(public.reminders) from public,anon,authenticated;
revoke all on function private.get_notification_preferences(),public.get_notification_preferences(),
 private.save_notification_preferences(jsonb,integer),public.save_notification_preferences(jsonb,integer),
 private.register_device(jsonb),public.register_device(jsonb),private.revoke_device(uuid,boolean),public.revoke_device(uuid,boolean),
 private.set_reminder(jsonb,uuid),public.set_reminder(jsonb,uuid),private.get_reminder(uuid,uuid),public.get_reminder(uuid,uuid)
 from public,anon,authenticated;
grant execute on function private.get_notification_preferences(),public.get_notification_preferences(),
 private.save_notification_preferences(jsonb,integer),public.save_notification_preferences(jsonb,integer),
 private.register_device(jsonb),public.register_device(jsonb),private.revoke_device(uuid,boolean),public.revoke_device(uuid,boolean),
 private.set_reminder(jsonb,uuid),public.set_reminder(jsonb,uuid),private.get_reminder(uuid,uuid),public.get_reminder(uuid,uuid)
 to authenticated;

-- ========== notification-jobs ==========
create table public.notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(user_id) on delete cascade,
 pair_id uuid not null references public.pairs(id) on delete cascade,
 kind text not null check(kind in('event','task','message')),
 source_id uuid not null,
 occurrence text not null,
 source_version integer not null,
 reminder_id uuid references public.reminders(id) on delete cascade,
 created_at timestamptz not null default now(),
 available_at timestamptz not null,
 read_at timestamptz,
 unique(user_id,kind,source_id,occurrence)
);
create index notifications_feed on public.notifications(user_id,available_at desc,id desc);
create index notifications_pair on public.notifications(pair_id);
create index notifications_reminder on public.notifications(reminder_id);
alter table public.notifications enable row level security;
revoke all on public.notifications from public,anon,authenticated;
grant select(id,user_id,pair_id,kind,created_at,read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;
create policy own_notifications on public.notifications for select to authenticated
using(user_id=(select private.active_actor()) and pair_id=(select private.actor_pair()) and available_at<=now());

create table private.notification_jobs (
 id uuid primary key default gen_random_uuid(),
 notification_id uuid not null references public.notifications(id) on delete cascade,
 device_id uuid not null references public.devices(id) on delete cascade,
 source_version integer not null,
 reminder_version integer not null,
 device_version integer not null,
 preference_version integer not null,
 due_at timestamptz not null,
 expires_at timestamptz not null,
 state text not null default 'queued' check(state in('queued','submitted','provider_accepted','failed','expired','canceled')),
 attempt integer not null default 0,
 lease_id uuid, lease_until timestamptz,
 provider_ticket text unique,
 submitted_at timestamptz,
 receipt_due_at timestamptz,
 receipt_attempt integer not null default 0,
 error_code text,
 unique(notification_id,source_version,device_id)
);
create index notification_jobs_due on private.notification_jobs(due_at) where state='queued';
create index notification_jobs_receipts on private.notification_jobs(receipt_due_at) where state='submitted';
create index notification_jobs_device on private.notification_jobs(device_id);
alter table private.notification_jobs enable row level security;
revoke all on private.notification_jobs from public,anon,authenticated;
grant all on private.notification_jobs to service_role;

-- This lock order matches content and pair commands. Workers cannot use require_actor.
create function private.lock_notification_pair(p_pair uuid,p_recipient uuid) returns void
language plpgsql set search_path='' as $$
begin
 perform 1 from public.profiles where user_id=p_recipient or user_id in
   (select user_id from public.pair_members where pair_id=p_pair and left_at is null) order by user_id for update;
 perform 1 from public.pairs where id=p_pair for update;
end; $$;
create function private.notification_member(p_user uuid,p_pair uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.pair_members m on m.user_id=p.user_id
 join public.pairs pair on pair.id=m.pair_id
 where p.user_id=p_user and p.account_status='active' and m.pair_id=p_pair and m.left_at is null and pair.state='active');
$$;
create function private.notification_source_allowed(n public.notifications,p_check_version boolean default true) returns boolean
language sql stable security definer set search_path='' as $$
 select private.notification_member(n.user_id,n.pair_id) and case n.kind
 when 'event' then exists(select 1 from public.events e where e.id=n.source_id and e.pair_id=n.pair_id
   and (not p_check_version or e.version=n.source_version) and (e.who<>'private' or e.created_by=n.user_id))
 when 'task' then exists(select 1 from public.tasks t where t.id=n.source_id and t.pair_id=n.pair_id
   and (not p_check_version or (t.version=n.source_version and t.completed_at is null)))
 when 'message' then exists(select 1 from public.messages m where m.id=n.source_id and m.pair_id=n.pair_id
   and m.deleted_at is null and m.author_id<>n.user_id)
 else false end;
$$;
create function private.quiet_hours_end(p_at timestamptz,p_start time,p_end time,p_timezone text) returns timestamptz
language plpgsql stable set search_path='' as $$
declare local_at timestamp:=p_at at time zone p_timezone; until_local timestamp;
begin
 if p_start is null or p_end is null then return p_at; end if;
 if p_start<p_end and local_at::time>=p_start and local_at::time<p_end then
   until_local:=local_at::date+p_end;
 elsif p_start>p_end and local_at::time>=p_start then
   until_local:=local_at::date+1+p_end;
 elsif p_start>p_end and local_at::time<p_end then
   until_local:=local_at::date+p_end;
 else return p_at; end if;
 -- PostgreSQL resolves a repeated end time to standard time and moves a gap forward.
 return greatest(p_at,until_local at time zone p_timezone);
end; $$;

create function private.enqueue_notification(p_user uuid,p_pair uuid,p_kind text,p_source uuid,p_occurrence text,
 p_source_version integer,p_reminder uuid,p_reminder_version integer,p_due timestamptz,p_expiry timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare v_notification_id uuid; pref_version integer;
begin
 if p_expiry<now() or not private.notification_member(p_user,p_pair) then return; end if;
 if p_due<now() then
   -- A settings change may replace a quiet-hour deferral after its original due time.
   -- Only an existing unsent occurrence can resume. New past choices stay skipped.
   if not exists(select 1 from public.notifications n join private.notification_jobs j on j.notification_id=n.id
     where n.user_id=p_user and n.kind=p_kind and n.source_id=p_source and n.occurrence=p_occurrence
       and j.source_version=p_source_version and j.reminder_version=p_reminder_version
       and j.state='canceled' and j.provider_ticket is null and j.expires_at>now()) then return; end if;
   p_due:=now();
 end if;
 select version into pref_version from public.notification_preferences where user_id=p_user;
 insert into public.notifications(user_id,pair_id,kind,source_id,occurrence,source_version,reminder_id,available_at)
 values(p_user,p_pair,p_kind,p_source,p_occurrence,p_source_version,p_reminder,p_due)
 on conflict(user_id,kind,source_id,occurrence) do update set source_version=excluded.source_version,available_at=excluded.available_at
 returning id into v_notification_id;
 insert into private.notification_jobs(notification_id,device_id,source_version,reminder_version,device_version,
 preference_version,due_at,expires_at)
 select v_notification_id,d.id,p_source_version,p_reminder_version,d.version,coalesce(pref_version,0),p_due,p_expiry
 from public.devices d join auth.sessions s on s.id=d.session_id and s.user_id=d.user_id
 where d.user_id=p_user and d.permission='allowed' and d.revoked_at is null and d.expo_token is not null
 and (s.not_after is null or s.not_after>now())
 on conflict(notification_id,source_version,device_id)
 do update set due_at=excluded.due_at,expires_at=excluded.expires_at,state='queued',error_code=null,
 reminder_version=excluded.reminder_version,device_version=excluded.device_version,preference_version=excluded.preference_version,
 lease_id=null,lease_until=null
 where notification_jobs.state in('queued','canceled') and notification_jobs.provider_ticket is null
 and (notification_jobs.state='canceled' or
 (notification_jobs.reminder_version,notification_jobs.device_version,notification_jobs.preference_version,notification_jobs.due_at,notification_jobs.expires_at)
 is distinct from (excluded.reminder_version,excluded.device_version,excluded.preference_version,excluded.due_at,excluded.expires_at));
end; $$;
create function private.refresh_reminder(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.reminders; e public.events; t public.tasks; occurrence date; starts timestamptz;
 local_today date; year integer; candidate date; tz text;
begin
 select * into r from public.reminders where id=p_id;
 if not found then return; end if;
 tz:=(select timezone from public.profiles where user_id=r.user_id);
 if not r.active or not private.notification_member(r.user_id,r.pair_id) then return; end if;
 if r.task_id is not null then
   select * into t from public.tasks where id=r.task_id and pair_id=r.pair_id and completed_at is null;
   if not found then return; end if;
   perform private.enqueue_notification(r.user_id,r.pair_id,'task',t.id,(r.remind_at at time zone tz)::date::text,t.version,r.id,r.version,r.remind_at,r.remind_at+interval '1 day');
 else
   select * into e from public.events where id=r.event_id and pair_id=r.pair_id and (who<>'private' or created_by=r.user_id);
   if not found then return; end if;
   if e.repeat='yearly' then
     local_today:=(now() at time zone tz)::date;
     for year in extract(year from local_today)::integer..extract(year from local_today+90)::integer loop
       candidate:=private.yearly_date(year,e.repeat_month,e.repeat_day);
       if candidate>=greatest(local_today,e.start_date) and candidate<=local_today+90 then
         starts:=(candidate+time '09:00') at time zone tz;
         perform private.enqueue_notification(r.user_id,r.pair_id,'event',e.id,candidate::text,e.version,r.id,r.version,
           starts-make_interval(mins=>r.minutes_before),starts);
       end if;
     end loop;
   else
     starts:=coalesce(e.starts_at,(e.start_date+time '09:00') at time zone tz);
     occurrence:=coalesce(e.start_date,(e.starts_at at time zone tz)::date);
     perform private.enqueue_notification(r.user_id,r.pair_id,'event',e.id,occurrence::text,e.version,r.id,r.version,
       starts-make_interval(mins=>r.minutes_before),starts);
   end if;
 end if;
end; $$;

create function private.cancel_source_jobs(p_kind text,p_source uuid) returns void
language sql security definer set search_path='' as $$
 update private.notification_jobs j set state='canceled',error_code='SOURCE_CHANGED'
 from public.notifications n where n.id=j.notification_id and n.kind=p_kind and n.source_id=p_source and j.state='queued';
$$;
create function private.notification_source_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare source_id uuid; source_kind text; r record; recipient uuid;
begin
 source_id:=case when tg_op='DELETE' then old.id else new.id end;
 source_kind:=case tg_table_name when 'events' then 'event' when 'tasks' then 'task' else 'message' end;
 -- Pin changes do not send the same message again.
 if tg_table_name='messages' then
   if tg_op='UPDATE' then
     if new.deleted_at is not distinct from old.deleted_at then return new; end if;
   end if;
 end if;
 perform private.cancel_source_jobs(source_kind,source_id);
 if tg_op='DELETE' then return old; end if;
 if tg_table_name='messages' then
   if tg_op='INSERT' and new.deleted_at is null then
     for recipient in select m.user_id from public.pair_members m join public.notification_preferences p on p.user_id=m.user_id
       where m.pair_id=new.pair_id and m.left_at is null and m.user_id<>new.author_id and p.message_alerts loop
       perform private.enqueue_notification(recipient,new.pair_id,'message',new.id,new.id::text,new.version,null,0,now(),now()+interval '1 day');
     end loop;
   end if;
 else
   if tg_table_name='events' then
     if new.who='private' then
       update public.reminders set active=false,version=version+1 where event_id=new.id and user_id<>new.created_by and active;
     end if;
   end if;
   if tg_table_name='tasks' then
     if new.completed_at is not null then
       update public.reminders set active=false,version=version+1 where task_id=new.id and active;
     end if;
   end if;
   for r in select id from public.reminders where event_id=source_id or task_id=source_id loop perform private.refresh_reminder(r.id); end loop;
 end if;
 return new;
end; $$;
create trigger events_notification_jobs after insert or update or delete on public.events for each row execute function private.notification_source_change();
create trigger tasks_notification_jobs after insert or update or delete on public.tasks for each row execute function private.notification_source_change();
create trigger messages_notification_jobs after insert or update or delete on public.messages for each row execute function private.notification_source_change();

create function private.notification_reminder_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update private.notification_jobs j set state='canceled',error_code='REMINDER_CHANGED' from public.notifications n
 where n.id=j.notification_id and n.reminder_id=new.id and j.state='queued';
 perform private.refresh_reminder(new.id);
 return new;
end; $$;
create trigger reminders_notification_jobs after insert or update on public.reminders for each row execute function private.notification_reminder_change();

create function private.notification_account_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient uuid:=new.user_id; r record; refresh_messages boolean:=true;
begin
 if tg_table_name='profiles' then
   if (new.account_status,new.timezone) is not distinct from (old.account_status,old.timezone) then return new; end if;
   if new.timezone is distinct from old.timezone then
     update public.notification_preferences set timezone=new.timezone,version=version+1 where user_id=recipient;
   end if;
 end if;
 if tg_table_name='devices' and tg_op='UPDATE' then
   if new.version=old.version then return new; end if;
 end if;
 if tg_table_name='devices' then
   update private.notification_jobs set state='canceled',error_code='DEVICE_CHANGED' where device_id=new.id and state='queued';
 else
   update private.notification_jobs j set state='canceled',error_code='PREFERENCES_CHANGED' from public.notifications n
   where n.id=j.notification_id and n.user_id=recipient and j.state='queued';
 end if;
 for r in select id from public.reminders where user_id=recipient and active loop perform private.refresh_reminder(r.id); end loop;
 -- Rebuild pending messages after token or timezone changes. Never replay accepted tickets.
 if tg_table_name='notification_preferences' then
   if tg_op='INSERT' then refresh_messages:=false;
   elsif not old.message_alerts then refresh_messages:=false; end if;
 end if;
 if refresh_messages and exists(select 1 from public.notification_preferences where user_id=recipient and message_alerts) then
   for r in select n.*,m.created_at as message_time from public.notifications n join public.messages m on m.id=n.source_id
     where n.user_id=recipient and n.kind='message' and m.deleted_at is null and m.created_at>now()-interval '1 day'
     and exists(select 1 from private.notification_jobs j where j.notification_id=n.id and j.state='canceled' and j.provider_ticket is null) loop
     perform private.enqueue_notification(recipient,r.pair_id,'message',r.source_id,r.occurrence,r.source_version,null,0,now(),r.message_time+interval '1 day');
   end loop;
 end if;
 return new;
end; $$;
create trigger preferences_notification_jobs after insert or update on public.notification_preferences for each row execute function private.notification_account_change();
create trigger devices_notification_jobs after insert or update on public.devices for each row execute function private.notification_account_change();
create trigger profiles_notification_jobs after update on public.profiles for each row execute function private.notification_account_change();

create function private.notification_pair_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare pair uuid; r record;
begin
 if tg_table_name='pairs' then
   pair:=new.id;
   if new.state is not distinct from old.state then return new; end if;
 else
   pair:=new.pair_id;
   if new.left_at is not distinct from old.left_at then return new; end if;
 end if;
 update private.notification_jobs j set state='canceled',error_code='PAIR_CHANGED' from public.notifications n
 where n.id=j.notification_id and n.pair_id=pair and j.state='queued';
 for r in select id from public.reminders where pair_id=pair and active loop perform private.refresh_reminder(r.id); end loop;
 return new;
end; $$;
create trigger pairs_notification_jobs after update on public.pairs for each row execute function private.notification_pair_change();
create trigger members_notification_jobs after update on public.pair_members for each row execute function private.notification_pair_change();

create function private.refresh_notification_horizon() returns jsonb
language plpgsql security definer set search_path='' as $$
declare r record; total integer:=0;
begin
 for r in select id,pair_id,user_id from public.reminders where active order by pair_id,user_id,id loop
   perform private.lock_notification_pair(r.pair_id,r.user_id);
   perform private.refresh_reminder(r.id); total:=total+1;
 end loop;
 delete from public.notifications where available_at<now()-interval '30 days';
 return jsonb_build_object('refreshed',total);
end; $$;

create function private.checked_notification_job(p_id uuid,p_lease_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.notification_jobs; n public.notifications; d public.devices; pref public.notification_preferences;
 r public.reminders; permitted boolean; quiet_until timestamptz;
begin
 select n0.* into n from public.notifications n0 join private.notification_jobs j0 on j0.notification_id=n0.id where j0.id=p_id;
 if not found then return null; end if;
 perform private.lock_notification_pair(n.pair_id,n.user_id);
 select * into d from public.devices where id=(select device_id from private.notification_jobs where id=p_id) for update;
 select * into j from private.notification_jobs where id=p_id for update;
 if not found or j.state<>'queued' or j.lease_id is distinct from p_lease_id or j.lease_until<=now() or j.provider_ticket is not null then return null; end if;
 select * into n from public.notifications where id=j.notification_id;
 select * into pref from public.notification_preferences where user_id=n.user_id;
 -- Serialize this authorization check with session deletion and Auth account changes.
 perform 1 from auth.users where id=n.user_id for share;
 perform 1 from auth.sessions where id=d.session_id and user_id=n.user_id for share;
 if j.expires_at<now() then update private.notification_jobs set state='expired' where id=j.id; return null; end if;
 permitted:=private.notification_source_allowed(n) and n.source_version=j.source_version
   and d.user_id=n.user_id and d.permission='allowed' and d.revoked_at is null and d.expo_token is not null
   and d.version=j.device_version and coalesce(pref.version,0)=j.preference_version
   and exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
     where s.id=d.session_id and s.user_id=n.user_id and (s.not_after is null or s.not_after>now())
     and u.deleted_at is null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now()));
 if n.kind='message' then permitted:=permitted and coalesce(pref.message_alerts,false);
 else
   select * into r from public.reminders where id=n.reminder_id;
   permitted:=permitted and r.id is not null and r.active and r.user_id=n.user_id and r.version=j.reminder_version;
 end if;
 if not coalesce(permitted,false) then update private.notification_jobs set state='canceled',error_code='ACCESS_CHANGED' where id=j.id; return null; end if;
 quiet_until:=private.quiet_hours_end(now(),pref.quiet_start,pref.quiet_end,coalesce(pref.timezone,'UTC'));
 if quiet_until>now() then
   update private.notification_jobs set state=case when quiet_until>=expires_at then 'expired' else 'queued' end,
     due_at=quiet_until,attempt=greatest(attempt-1,0),lease_id=null,lease_until=null where id=j.id;
   return null;
 end if;
 return jsonb_build_object('id',j.id,'leaseId',j.lease_id,'notificationId',n.id,'token',d.expo_token,'attempt',j.attempt,'expiresAt',j.expires_at);
end; $$;
create function private.claim_due_jobs(p_limit integer,p_lease_seconds integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare candidate record; j private.notification_jobs; result jsonb:='[]'; payload jsonb;
begin
 if p_limit not between 1 and 100 or p_lease_seconds not between 30 and 300 then raise exception 'VALIDATION'; end if;
 for candidate in select j0.id,n.pair_id,n.user_id,j0.device_id from private.notification_jobs j0
   join public.notifications n on n.id=j0.notification_id where j0.state='queued' and j0.due_at<=now()
   and (j0.lease_until is null or j0.lease_until<=now()) order by j0.due_at,j0.id limit p_limit*5 loop
   perform private.lock_notification_pair(candidate.pair_id,candidate.user_id);
   perform 1 from public.devices where id=candidate.device_id for update;
   select * into j from private.notification_jobs where id=candidate.id and state='queued' and due_at<=now()
     and (lease_until is null or lease_until<=now()) for update skip locked;
   if not found then continue; end if;
   if j.attempt>=4 then update private.notification_jobs set state='failed',error_code='ATTEMPTS_EXHAUSTED' where id=j.id; continue; end if;
   update private.notification_jobs set lease_id=gen_random_uuid(),lease_until=now()+make_interval(secs=>p_lease_seconds),attempt=attempt+1
   where id=j.id returning * into j;
   payload:=private.checked_notification_job(j.id,j.lease_id);
   if payload is not null then result:=result||jsonb_build_array(payload); end if;
   exit when jsonb_array_length(result)>=p_limit;
 end loop;
 return result;
end; $$;
create function private.complete_job(p_id uuid,p_lease_id uuid,p_outcome jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.notification_jobs; n public.notifications; status text:=p_outcome->>'status'; next_due timestamptz;
begin
 select n0.* into n from public.notifications n0 join private.notification_jobs j0 on j0.notification_id=n0.id where j0.id=p_id;
 if not found then return jsonb_build_object('ok',false); end if;
 perform private.lock_notification_pair(n.pair_id,n.user_id);
 perform 1 from public.devices where id=(select device_id from private.notification_jobs where id=p_id) for update;
 select * into j from private.notification_jobs where id=p_id for update;
 if not found or j.lease_id is distinct from p_lease_id or j.provider_ticket is not null then return jsonb_build_object('ok',false); end if;
 if status='submitted' then
   if coalesce(p_outcome->>'ticket','')='' or char_length(p_outcome->>'ticket')>256 then raise exception 'VALIDATION'; end if;
   -- Preserve a late known ticket even after cancellation. Never send it again.
   update private.notification_jobs set provider_ticket=p_outcome->>'ticket',submitted_at=now(),receipt_due_at=now()+interval '15 minutes',
     state=case when state='canceled' then 'canceled' else 'submitted' end,lease_id=null,lease_until=null where id=j.id;
 elsif j.state='queued' and j.lease_until>now() then
   if status='device_not_registered' then
     update public.devices set revoked_at=now(),expo_token=null,version=version+1 where id=j.device_id and version=j.device_version;
     update private.notification_jobs set state='failed',error_code='DeviceNotRegistered',lease_id=null,lease_until=null where id=j.id;
   elsif status='retry' then
     next_due:=now()+case j.attempt when 1 then interval '1 minute' when 2 then interval '5 minutes' else interval '15 minutes' end;
     update private.notification_jobs set state=case when j.attempt>=4 then 'failed' when next_due>=expires_at then 'expired' else 'queued' end,
       due_at=next_due,error_code=left(p_outcome->>'code',100),lease_id=null,lease_until=null where id=j.id;
   elsif status='failed' then
     update private.notification_jobs set state=case when expires_at<now() or p_outcome->>'code'='SOURCE_EXPIRED' then 'expired' else 'failed' end,
       error_code=left(p_outcome->>'code',100),lease_id=null,lease_until=null where id=j.id;
   else raise exception 'VALIDATION'; end if;
 else return jsonb_build_object('ok',false); end if;
 return jsonb_build_object('ok',true);
end; $$;
create function private.claim_push_receipts(p_limit integer,p_lease_seconds integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.notification_jobs; result jsonb:='[]';
begin
 if p_limit not between 1 and 1000 or p_lease_seconds not between 30 and 300 then raise exception 'VALIDATION'; end if;
 for j in select * from private.notification_jobs where state='submitted' and provider_ticket is not null and receipt_due_at<=now()
   and (lease_until is null or lease_until<=now()) order by receipt_due_at,id limit p_limit for update skip locked loop
   if j.submitted_at<now()-interval '24 hours' then
     update private.notification_jobs set state='failed',error_code='RECEIPT_UNAVAILABLE' where id=j.id; continue;
   end if;
   update private.notification_jobs set lease_id=gen_random_uuid(),lease_until=now()+make_interval(secs=>p_lease_seconds),receipt_attempt=receipt_attempt+1
     where id=j.id returning * into j;
   result:=result||jsonb_build_array(jsonb_build_object('id',j.id,'leaseId',j.lease_id,'ticket',j.provider_ticket,
     'attempt',j.receipt_attempt,'expiresAt',j.submitted_at+interval '24 hours'));
 end loop;
 return result;
end; $$;
create function private.complete_push_receipt(p_id uuid,p_lease_id uuid,p_outcome jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.notification_jobs; n public.notifications; status text:=p_outcome->>'status';
begin
 select n0.* into n from public.notifications n0 join private.notification_jobs j0 on j0.notification_id=n0.id where j0.id=p_id;
 if not found then return jsonb_build_object('ok',false); end if;
 perform private.lock_notification_pair(n.pair_id,n.user_id);
 perform 1 from public.devices where id=(select device_id from private.notification_jobs where id=p_id) for update;
 select * into j from private.notification_jobs where id=p_id for update;
 if not found or j.state<>'submitted' or j.lease_id is distinct from p_lease_id or j.lease_until<=now() then return jsonb_build_object('ok',false); end if;
 if status='device_not_registered' then
   update public.devices set revoked_at=now(),expo_token=null,version=version+1 where id=j.device_id and version=j.device_version;
   update private.notification_jobs set state='failed',error_code='DeviceNotRegistered' where id=j.id;
 elsif status='accepted' then update private.notification_jobs set state='provider_accepted',error_code=null where id=j.id;
 elsif status='pending' then update private.notification_jobs set receipt_due_at=now()+interval '15 minutes' where id=j.id;
 elsif status='failed' then update private.notification_jobs set state='failed',error_code=left(p_outcome->>'code',100) where id=j.id;
 else raise exception 'VALIDATION'; end if;
 update private.notification_jobs set lease_id=null,lease_until=null where id=j.id;
 return jsonb_build_object('ok',true);
end; $$;

create function private.notification_state(p_id uuid) returns text
language sql stable security definer set search_path='' as $$
 select coalesce((select j.state from private.notification_jobs j join public.notifications n on n.id=j.notification_id
 where n.id=p_id and j.source_version=n.source_version order by
 case j.state when 'provider_accepted' then 0 when 'submitted' then 1 when 'queued' then 2 when 'failed' then 3 when 'expired' then 4 else 5 end limit 1),'canceled');
$$;
create function private.list_notifications(p_cursor text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_actor(); cursor_time timestamptz; cursor_id uuid; rows jsonb; next_cursor text;
begin
 if p_cursor is not null then
   cursor_time:=split_part(p_cursor,'|',1)::timestamptz; cursor_id:=split_part(p_cursor,'|',2)::uuid;
 end if;
 with page as (select n.* from public.notifications n where n.user_id=actor and private.is_member(n.pair_id)
   and available_at<=now() and available_at>now()-interval '30 days'
   and (p_cursor is null or (n.available_at,n.id)<(cursor_time,cursor_id)) order by n.available_at desc,n.id desc limit 51),
 items as (select * from page order by available_at desc,id desc limit 50)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'pairId',pair_id,'kind',kind,'createdAt',available_at,'readAt',read_at,
   'state',private.notification_state(id)) order by available_at desc,id desc),'[]'),
 case when (select count(*) from page)>50 then (select available_at::text||'|'||id::text from items order by available_at,id limit 1) else null end
 into rows,next_cursor from items;
 return jsonb_build_object('items',rows,'nextCursor',next_cursor);
end; $$;
create function private.mark_notification_read(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor();
begin
 update public.notifications set read_at=coalesce(read_at,now()) where id=p_id and user_id=actor and private.is_member(pair_id) and available_at<=now();
 if not found then return private.error('FORBIDDEN'); end if;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('id',p_id));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end; $$;
create function private.resolve_notification(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor(); n public.notifications;
begin
 select * into n from public.notifications where id=p_id and user_id=actor and available_at<=now() and available_at>now()-interval '30 days';
 if not found then return private.error('FORBIDDEN'); end if;
 perform private.lock_pair(n.pair_id,actor);
 -- Navigation checks current access. A source edit does not make its route unsafe.
 if not coalesce(private.notification_source_allowed(n,false),false) then return private.error('FORBIDDEN'); end if;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('kind',case n.kind when 'message' then 'messages' else n.kind end,
   'id',n.source_id,'pairId',n.pair_id));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end; $$;

create function public.list_notifications(p_cursor text default null) returns jsonb language sql security invoker set search_path='' as $$select private.list_notifications(p_cursor);$$;
create function public.mark_notification_read(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.mark_notification_read(p_id);$$;
create function public.resolve_notification(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.resolve_notification(p_id);$$;
create function public.claim_due_jobs(p_limit integer default 20,p_lease_seconds integer default 120) returns jsonb language sql security invoker set search_path='' as $$select private.claim_due_jobs(p_limit,p_lease_seconds);$$;
create function public.revalidate_notification_job(p_id uuid,p_lease_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.checked_notification_job(p_id,p_lease_id);$$;
create function public.complete_job(p_id uuid,p_lease_id uuid,p_outcome jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.complete_job(p_id,p_lease_id,p_outcome);$$;
create function public.claim_push_receipts(p_limit integer default 100,p_lease_seconds integer default 120) returns jsonb language sql security invoker set search_path='' as $$select private.claim_push_receipts(p_limit,p_lease_seconds);$$;
create function public.complete_push_receipt(p_id uuid,p_lease_id uuid,p_outcome jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.complete_push_receipt(p_id,p_lease_id,p_outcome);$$;
create function public.refresh_notification_horizon() returns jsonb language sql security invoker set search_path='' as $$select private.refresh_notification_horizon();$$;

-- Explicit grants include only these new entrypoints. Internal helpers stay inaccessible.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in('private','public') and p.proname=any(array[
 'lock_notification_pair','notification_member','notification_source_allowed','quiet_hours_end','enqueue_notification','refresh_reminder',
 'cancel_source_jobs','notification_source_change','notification_reminder_change','notification_account_change','notification_pair_change',
 'refresh_notification_horizon','checked_notification_job','claim_due_jobs','complete_job','claim_push_receipts','complete_push_receipt',
 'notification_state','list_notifications','mark_notification_read','resolve_notification','revalidate_notification_job']) loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 if f.proname in('list_notifications','mark_notification_read','resolve_notification') then
   execute format('grant execute on function %s to authenticated',f.signature);
 elsif f.proname in('refresh_notification_horizon','checked_notification_job','claim_due_jobs','complete_job',
   'claim_push_receipts','complete_push_receipt','revalidate_notification_job') then
   execute format('grant execute on function %s to service_role',f.signature);
 end if;
 end loop;
end; $$;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create function private.invoke_notification_worker(p_function text,p_body jsonb default '{}') returns bigint
language plpgsql security definer set search_path='' as $$
declare base_url text; worker_secret text; request_id bigint;
begin
 if p_function not in('dispatch-notifications','check-push-receipts') then raise exception 'VALIDATION'; end if;
 select decrypted_secret into base_url from vault.decrypted_secrets where name='notification_function_url';
 select decrypted_secret into worker_secret from vault.decrypted_secrets where name='notification_worker_secret';
 if base_url is null or worker_secret is null then raise exception 'Notification worker Vault settings are missing'; end if;
 select net.http_post(url:=rtrim(base_url,'/')||'/'||p_function,
   headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||worker_secret),body:=p_body,
   timeout_milliseconds:=10000) into request_id;
 return request_id;
end; $$;
revoke all on function private.invoke_notification_worker(text,jsonb) from public,anon,authenticated;
select cron.schedule('deseo-dispatch-notifications','* * * * *',$job$select private.invoke_notification_worker('dispatch-notifications');$job$);
select cron.schedule('deseo-check-push-receipts','* * * * *',$job$select private.invoke_notification_worker('check-push-receipts');$job$);
select cron.schedule('deseo-notification-horizon','7 0 * * *',$job$select private.invoke_notification_worker('dispatch-notifications','{"action":"refresh_horizon"}'::jsonb);$job$);

-- ========== retention ==========
-- Remove expired internal rows in small batches.
create function private.expire_records() returns void language plpgsql security definer set search_path='' as $$
begin
 delete from private.memory_cleanup_jobs where id in(select id from private.memory_cleanup_jobs where state='completed' and completed_at<=now()-interval '30 days' and cardinality(paths)=0 order by completed_at limit 50);
 delete from private.pair_invites where id in(select id from private.pair_invites where expires_at<=now() order by expires_at limit 50);
 delete from private.command_receipts where ctid in(select ctid from private.command_receipts where expires_at<=now() order by expires_at limit 50);
 delete from public.devices where id in(select d.id from public.devices d where d.revoked_at<now()-interval '30 days' and not exists(select 1 from private.notification_jobs j where j.device_id=d.id) order by d.revoked_at limit 50);
 delete from private.notification_jobs where id in(select id from private.notification_jobs where state in('provider_accepted','failed','expired','canceled') and due_at<now()-interval '30 days' order by due_at limit 50);
 delete from public.notifications where id in(select n.id from public.notifications n where n.created_at<now()-interval '30 days' and not exists(select 1 from private.notification_jobs j where j.notification_id=n.id) order by n.created_at limit 50);
end;$$;
create function private.invoke_cleanup_worker() returns void language plpgsql security definer set search_path='' as $$
declare v_url text;v_secret text;
begin
 select decrypted_secret into v_url from vault.decrypted_secrets where name='cleanup_function_url';
 select decrypted_secret into v_secret from vault.decrypted_secrets where name='memory_cleanup_secret';
 if v_url is null or v_secret is null or char_length(v_secret)<32 then return;end if;
 perform net.http_post(url:=v_url,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_secret),body:='{}'::jsonb);
end;$$;
revoke all on function private.expire_records(),private.invoke_cleanup_worker() from public,anon,authenticated;
select cron.schedule('deseo-expire-records','* * * * *',$job$select private.expire_records();$job$);
select cron.schedule('deseo-cleanup','* * * * *',$job$select private.invoke_cleanup_worker();$job$);

-- ========== today ==========
-- One read returns Today's shared content. Each part uses the rows, order, and limits of its feature read.
-- RLS applies to every part.
create function public.get_today(p_pair_id uuid,p_date date) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare week jsonb; important jsonb;
begin
  if private.active_actor() is null then return private.error('UNAUTHENTICATED'); end if;
  if p_date is null then return private.error('VALIDATION','date'); end if;
  if not private.is_member(p_pair_id) then return private.error('FORBIDDEN'); end if;
  week:=private.list_agenda(p_pair_id,p_date,p_date+7,false);
  if week->>'ok'<>'true' then return week; end if;
  important:=private.list_agenda(p_pair_id,p_date,p_date+366,true);
  if important->>'ok'<>'true' then return important; end if;
  return jsonb_build_object('ok',true,'data',jsonb_build_object(
    'agenda',week->'data',
    'important_dates',important->'data',
    'due_tasks',(select coalesce(jsonb_agg(to_jsonb(t) order by t.due_date,t.id),'[]'::jsonb) from (
      select * from public.tasks where pair_id=p_pair_id and completed_at is null and due_date<=p_date
      order by due_date,id limit 3) t),
    'notes',(select coalesce(jsonb_agg(to_jsonb(m) order by m.pinned_at desc,m.id desc),'[]'::jsonb) from (
      select id,pair_id,author_id,client_id,body,created_at,pinned_at,version from public.messages
      where pair_id=p_pair_id and pinned_at is not null order by pinned_at desc,id desc limit 2) m)));
end;
$$;
revoke all on function public.get_today(uuid,date) from public,anon;
grant execute on function public.get_today(uuid,date) to authenticated;
