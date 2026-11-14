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
  avatar_path text,
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

create policy profiles_self on public.profiles for select to authenticated
using (user_id = (select private.active_actor()));

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
