create table public.pairs (
  id uuid primary key default gen_random_uuid(),
  state text not null default 'pending' check (state in ('pending','active','ended')),
  timezone text not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  purge_after timestamptz,
  check ((state='ended' and ended_at is not null and purge_after=ended_at+interval '30 days')
    or (state<>'ended' and ended_at is null and purge_after is null))
);
create trigger pairs_timezone before insert or update on public.pairs for each row execute function private.check_timezone();
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
create function private.is_partner(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.pair_members mine join public.pair_members theirs on theirs.pair_id=mine.pair_id
    join public.pairs p on p.id=mine.pair_id join public.profiles target on target.user_id=theirs.user_id
    where mine.user_id=private.active_actor() and theirs.user_id=p_user
      and mine.left_at is null and theirs.left_at is null and p.state='active' and target.account_status='active');
$$;
drop policy profiles_self on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
using(user_id=(select private.active_actor()) or private.is_partner(user_id));
create policy pairs_current on public.pairs for select to authenticated using(private.is_member(id,false));
-- A member can read their own content-free closure row for Realtime revocation.
create policy members_current on public.pair_members for select to authenticated
using(user_id=(select private.active_actor()) or private.is_member(pair_id));

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

create function private.create_pair(p_timezone text,p_command_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid; result jsonb; pair uuid; request jsonb := jsonb_build_object('timezone',p_timezone);
begin
  actor := private.require_actor();
  perform 1 from public.profiles where user_id=actor for update;
  perform private.require_actor();
  result := private.receipt(actor,p_command_id,'create_pair',request);
  if result is not null then return result; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then return private.error('VALIDATION','timezone'); end if;
  if exists(select 1 from public.pair_members where user_id=actor and left_at is null) then return private.error('ALREADY_PAIRED'); end if;
  insert into public.pairs(timezone) values(p_timezone) returning id into pair;
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
  select jsonb_build_object('pairId',p.id,'inviterName',profile.display_name,'timezone',p.timezone,'expiresAt',invitation.expires_at)
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
    return jsonb_build_object('ok',true,'data',jsonb_build_object('status','active','pairId',pair.id,'timezone',pair.timezone,'members',members));
  end if;
  select jsonb_build_object('expiresAt',expires_at) into invite from private.pair_invites
    where pair_id=pair.id and accepted_at is null and revoked_at is null and expires_at>now();
  member := members->0;
  return jsonb_build_object('ok',true,'data',jsonb_build_object('status','pending','pairId',pair.id,'timezone',pair.timezone,'member',member,'invite',invite));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end;
$$;

create function public.create_pair(p_timezone text,p_command_id uuid) returns jsonb language sql security invoker set search_path = ''
as $$ select private.create_pair(p_timezone,p_command_id); $$;
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
private.invite_limited(uuid),private.invite_failed(uuid),private.token_hash(text),private.create_pair(text,uuid),
private.create_invite(uuid,uuid),private.preview_invite(text),private.accept_invite(text,uuid),private.cancel_pending_pair(uuid,uuid),
private.get_pair_context() from public,anon,authenticated;
grant execute on function private.is_member(uuid,boolean),private.is_partner(uuid),private.create_pair(text,uuid),
private.create_invite(uuid,uuid),private.preview_invite(text),private.accept_invite(text,uuid),private.cancel_pending_pair(uuid,uuid),
private.get_pair_context() to authenticated;
revoke all on function public.create_pair(text,uuid),public.create_invite(uuid,uuid),public.preview_invite(text),
public.accept_invite(text,uuid),public.cancel_pending_pair(uuid,uuid),public.get_pair_context() from public,anon,authenticated;
grant execute on function public.create_pair(text,uuid),public.create_invite(uuid,uuid),public.preview_invite(text),
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
