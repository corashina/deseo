create table public.events (
  id uuid primary key,
  pair_id uuid not null references public.pairs(id) on delete cascade,
  created_by uuid not null,
  owner text not null check(owner in('a','b','together')),
  visibility text not null check(visibility in('shared','private')),
  title text not null check(char_length(title) between 1 and 120 and title=btrim(title)),
  timezone text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  start_date date,
  end_date_exclusive date,
  repeat text not null default 'none' check(repeat='none'),
  location text check(char_length(location)<=200),
  description text check(char_length(description)<=2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check(version>0),
  unique(pair_id,id),
  foreign key(pair_id,created_by) references public.pair_members(pair_id,user_id),
  check((starts_at is not null and ends_at is not null and ends_at>starts_at and start_date is null and end_date_exclusive is null)
    or (start_date is not null and end_date_exclusive is not null and end_date_exclusive>start_date and starts_at is null and ends_at is null)),
  check(visibility<>'private' or owner<>'together')
);
create index events_pair_start on public.events(pair_id,starts_at,id) where starts_at is not null;
create index events_pair_date on public.events(pair_id,start_date,id) where start_date is not null;
create index events_author on public.events(created_by);
alter table public.events enable row level security;
revoke all on public.events from public,anon,authenticated;
grant select on public.events to authenticated;
grant all on public.events to service_role;
create policy events_visible on public.events for select to authenticated
using(private.is_member(pair_id) and (visibility='shared' or created_by=(select private.active_actor())));
create trigger events_timezone before insert or update on public.events for each row execute function private.check_timezone();

-- Keep only opaque IDs for former readers. This also removes drafts after an offline visibility change.
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
declare v_actor uuid; v_pair uuid; actor_slot text; previous public.events; result public.events; replay jsonb;
  request jsonb := jsonb_build_object('id',p_event_id,'input',p_input,'version',p_expected_version);
  v_title text; v_owner text; v_visibility text; v_timezone text; starts timestamptz; ends timestamptz; first_date date; last_date date;
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
  if previous.id is not null and previous.visibility='private' and previous.created_by<>v_actor then
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
    if previous.id is null or previous.pair_id<>v_pair or (previous.visibility='private' and previous.created_by<>v_actor)
      then return private.error('FORBIDDEN'); end if;
    if p_expected_version is null or p_expected_version<>previous.version then return private.error('CONFLICT'); end if;
  end if;
  if p_action='delete' then
    delete from public.events where id=p_event_id;
    return private.save_receipt(v_actor,p_command_id,'event_delete',v_pair,request,jsonb_build_object('id',p_event_id));
  end if;
  if (p_input->>'id')::uuid is distinct from p_event_id or (p_input->>'pair_id')::uuid is distinct from v_pair then return private.error('VALIDATION','id'); end if;
  v_title := btrim(p_input->>'title'); v_owner := p_input->>'owner'; v_visibility := p_input->>'visibility'; v_timezone := p_input->>'timezone';
  if v_title is null or char_length(v_title) not between 1 and 120 then return private.error('VALIDATION','title'); end if;
  if v_owner is null or v_owner not in('a','b','together') then return private.error('VALIDATION','owner'); end if;
  if v_visibility is null or v_visibility not in('shared','private') then return private.error('VALIDATION','visibility'); end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=v_timezone) then return private.error('VALIDATION','timezone'); end if;
  if char_length(p_input->>'location')>200 then return private.error('VALIDATION','location'); end if;
  if char_length(p_input->>'description')>2000 then return private.error('VALIDATION','description'); end if;
  if p_input->>'repeat' is not null and p_input->>'repeat'<>'none' then return private.error('VALIDATION','repeat'); end if;
  select slot into actor_slot from public.pair_members where pair_id=v_pair and user_id=v_actor and left_at is null;
  if v_visibility='private' and v_owner<>actor_slot then return private.error('VALIDATION','owner'); end if;
  if p_action='update' and previous.visibility<>v_visibility then
    if previous.created_by<>v_actor then return private.error('FORBIDDEN'); end if;
    if v_visibility='shared' and (p_input->>'confirm_shared')::boolean is distinct from true then return private.error('VALIDATION','confirm_shared'); end if;
  end if;
  starts := (p_input->>'starts_at')::timestamptz; ends := (p_input->>'ends_at')::timestamptz;
  first_date := (p_input->>'start_date')::date; last_date := (p_input->>'end_date_exclusive')::date;
  if not ((starts is not null and ends is not null and ends>starts and first_date is null and last_date is null)
    or (first_date is not null and last_date is not null and last_date>first_date and starts is null and ends is null))
    then return private.error('VALIDATION','time'); end if;
  if p_action='create' then
    insert into public.events(id,pair_id,created_by,owner,visibility,title,timezone,starts_at,ends_at,start_date,end_date_exclusive,location,description)
    values(p_event_id,v_pair,v_actor,v_owner,v_visibility,v_title,v_timezone,starts,ends,first_date,last_date,p_input->>'location',p_input->>'description') returning * into result;
  else
    update public.events set owner=v_owner,visibility=v_visibility,title=v_title,timezone=v_timezone,starts_at=starts,ends_at=ends,
      start_date=first_date,end_date_exclusive=last_date,location=p_input->>'location',description=p_input->>'description',
      version=version+1,updated_at=now() where id=p_event_id returning * into result;
    if previous.visibility='shared' and v_visibility='private' then
      insert into public.event_access_revocations(user_id,pair_id,event_id)
      select user_id,v_pair,p_event_id from public.pair_members where pair_id=v_pair and left_at is null and user_id<>v_actor
      on conflict(user_id,event_id) do update set revoked_at=now();
      -- The updated event is hidden by RLS. Notify the former reader through their own profile.
      update public.profiles set updated_at=now(),version=version+1
      where user_id in(select user_id from public.pair_members where pair_id=v_pair and left_at is null and user_id<>v_actor);
    elsif previous.visibility='private' and v_visibility='shared' then
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

create function public.list_agenda(p_pair_id uuid,p_from date,p_to date) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare timezone text; items jsonb;
begin
  if private.active_actor() is null then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','UNAUTHENTICATED')); end if;
  if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>366 then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','VALIDATION','field','range')); end if;
  select p.timezone into timezone from public.pairs p where id=p_pair_id and state='active';
  if timezone is null then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','FORBIDDEN')); end if;
  select coalesce(jsonb_agg(to_jsonb(e) order by coalesce(e.starts_at,e.start_date::timestamp at time zone timezone),e.id),'[]'::jsonb)
    into items from public.events e where e.pair_id=p_pair_id and
    ((e.starts_at < (p_to::timestamp at time zone timezone) and e.ends_at > (p_from::timestamp at time zone timezone))
      or (e.start_date < p_to and e.end_date_exclusive > p_from));
  return jsonb_build_object('ok',true,'data',items);
end;
$$;
revoke all on function private.event_identity(),private.event_command(text,uuid,jsonb,integer,uuid) from public,anon,authenticated;
grant execute on function private.event_command(text,uuid,jsonb,integer,uuid) to authenticated;
revoke all on function public.create_event(jsonb,uuid),public.update_event(uuid,jsonb,integer,uuid),
public.delete_event(uuid,integer,uuid),public.list_agenda(uuid,date,date) from public,anon,authenticated;
grant execute on function public.create_event(jsonb,uuid),public.update_event(uuid,jsonb,integer,uuid),
public.delete_event(uuid,integer,uuid),public.list_agenda(uuid,date,date) to authenticated;
alter publication supabase_realtime add table public.events;
