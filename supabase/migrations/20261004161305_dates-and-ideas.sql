-- Yearly dates remain events. Query expansion returns occurrences of one stored series.
alter table public.events drop constraint events_repeat_check;
alter table public.events add column repeat_month integer, add column repeat_day integer, add column important_date boolean not null default false;
alter table public.events add constraint events_repeat_check check(repeat in('none','yearly'));
alter table public.events add constraint events_yearly_fields check(
  (repeat='none' and repeat_month is null and repeat_day is null) or
  (repeat='yearly' and important_date and repeat_month is not null and repeat_day is not null and starts_at is null and start_date is not null and end_date_exclusive=start_date+1
    and repeat_month=extract(month from start_date) and repeat_day=extract(day from start_date)));
alter table public.events add constraint events_important_fields check(not important_date or starts_at is null);
create index events_yearly_pair on public.events(pair_id,id) where repeat='yearly';

create table public.date_ideas (
  id uuid primary key,
  pair_id uuid not null references public.pairs(id) on delete cascade,
  created_by uuid not null,
  title text not null check(char_length(title) between 1 and 120 and title=btrim(title)),
  note text check(char_length(note)<=1000),
  link text check(char_length(link)<=2048 and link ~ '^https://[^[:space:]/?#]+[^[:space:]]*$'),
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
create policy date_ideas_visible on public.date_ideas for select to authenticated using(private.is_member(pair_id));
create trigger date_ideas_identity before update on public.date_ideas for each row execute function private.event_identity();

-- Derive only dates. February 29 uses the month's last day in non-leap years.
create function private.yearly_date(p_year integer,p_month integer,p_day integer) returns date
language sql immutable set search_path = '' as $$
  select make_date(p_year,p_month,least(p_day,extract(day from
    (make_date(p_year,p_month,1)+interval '1 month - 1 day'))::integer));
$$;
revoke all on function private.yearly_date(integer,integer,integer) from public,anon,authenticated;
grant execute on function private.yearly_date(integer,integer,integer) to authenticated;

create or replace function public.list_agenda(p_pair_id uuid,p_from date,p_to date) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare pair_timezone text; items jsonb;
begin
  if private.active_actor() is null then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','UNAUTHENTICATED')); end if;
  if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>366 then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','VALIDATION','field','range')); end if;
  select p.timezone into pair_timezone from public.pairs p where id=p_pair_id and state='active';
  if pair_timezone is null then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','FORBIDDEN')); end if;
  with occurrences as (
    select to_jsonb(e) item,coalesce(e.starts_at,e.start_date::timestamp at time zone pair_timezone) sort_time,e.id
    from public.events e where e.pair_id=p_pair_id and e.repeat='none' and
      ((e.starts_at < (p_to::timestamp at time zone pair_timezone) and e.ends_at > (p_from::timestamp at time zone pair_timezone))
        or (e.start_date < p_to and e.end_date_exclusive > p_from))
    union all
    select to_jsonb(e)||jsonb_build_object('occurrence_date',d.occurrence_day),d.occurrence_day::timestamp at time zone pair_timezone,e.id
    from public.events e
    cross join lateral generate_series(extract(year from p_from)::integer,extract(year from p_to-1)::integer) y(year)
    cross join lateral (select private.yearly_date(y.year,e.repeat_month,e.repeat_day) as occurrence_day) d
    where e.pair_id=p_pair_id and e.repeat='yearly' and d.occurrence_day>=p_from and d.occurrence_day<p_to
  ) select coalesce(jsonb_agg(item order by sort_time,id),'[]'::jsonb) into items from occurrences;
  return jsonb_build_object('ok',true,'data',items);
end;
$$;

create function private.idea_command(p_action text,p_idea_id uuid,p_input jsonb,p_expected_version integer,p_command_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid; pair uuid; previous public.date_ideas; result public.date_ideas; replay jsonb;
  request jsonb:=jsonb_build_object('id',p_idea_id,'input',p_input,'version',p_expected_version);
  title text; note text; link text;
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
    title:=btrim(p_input->>'title'); note:=nullif(btrim(p_input->>'note'),''); link:=nullif(btrim(p_input->>'link'),'');
    if title is null or char_length(title) not between 1 and 120 then return private.error('VALIDATION','title'); end if;
    if char_length(note)>1000 then return private.error('VALIDATION','note'); end if;
    if char_length(link)>2048 or link !~ '^https://[^[:space:]/?#]+[^[:space:]]*$' then return private.error('VALIDATION','link'); end if;
    if p_action='create' then
      insert into public.date_ideas(id,pair_id,created_by,title,note,link) values(p_idea_id,pair,actor,title,note,link) returning * into result;
    else
      update public.date_ideas set title=idea_command.title,note=idea_command.note,link=idea_command.link,version=version+1,updated_at=now()
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
    if replay->>'ok'='true' and not exists(select 1 from public.events where id=event_id and pair_id=pair and visibility='shared') then
      return private.error('FORBIDDEN'); end if;
    return replay;
  end if;
  if p_expected_version is null or idea.version<>p_expected_version or idea.state<>'saved' then return private.error('CONFLICT'); end if;
  if p_event_input->>'visibility' is distinct from 'shared' or coalesce(p_event_input->>'repeat','none')<>'none' then return private.error('VALIDATION','visibility'); end if;
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
    if new.visibility='private' and exists(select 1 from public.date_ideas where linked_event_id=new.id) then
      raise exception using message='FORBIDDEN',errcode='P0001'; end if;
    return new;
  end if;
  future:=case when old.starts_at is not null then old.starts_at>now()
    else old.start_date>(now() at time zone (select timezone from public.pairs where id=old.pair_id))::date end;
  update public.date_ideas set linked_event_id=null,state=case when state='planned' and future then 'saved' else state end,
    version=version+1,updated_at=now() where linked_event_id=old.id;
  return old;
end;
$$;
create trigger idea_event_lifecycle before update of visibility or delete on public.events for each row execute function private.idea_event_lifecycle();

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

create or replace function private.event_command(p_action text,p_event_id uuid,p_input jsonb,p_expected_version integer,p_command_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_pair uuid; actor_slot text; previous public.events; result public.events; replay jsonb;
  request jsonb := jsonb_build_object('id',p_event_id,'input',p_input,'version',p_expected_version);
  v_important boolean; v_repeat text; v_month integer; v_day integer; v_title text; v_owner text; v_visibility text; v_timezone text; starts timestamptz; ends timestamptz; first_date date; last_date date;
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
  v_repeat := coalesce(p_input->>'repeat','none');
  v_important := coalesce((p_input->>'important_date')::boolean,false) or v_repeat='yearly';
  if v_repeat not in('none','yearly') then return private.error('VALIDATION','repeat'); end if;
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
  if v_important and first_date is null then return private.error('VALIDATION','importantDate'); end if;
  if v_repeat='yearly' then
    if first_date is null or last_date<>first_date+1 or starts is not null then return private.error('VALIDATION','repeat'); end if;
    v_month := extract(month from first_date)::integer; v_day := extract(day from first_date)::integer;
  end if;
  if p_action='create' then
    insert into public.events(id,pair_id,created_by,owner,visibility,title,timezone,starts_at,ends_at,start_date,end_date_exclusive,location,description,repeat,repeat_month,repeat_day,important_date)
    values(p_event_id,v_pair,v_actor,v_owner,v_visibility,v_title,v_timezone,starts,ends,first_date,last_date,p_input->>'location',p_input->>'description',v_repeat,v_month,v_day,v_important) returning * into result;
  else
    update public.events set owner=v_owner,visibility=v_visibility,title=v_title,timezone=v_timezone,starts_at=starts,ends_at=ends,
      start_date=first_date,end_date_exclusive=last_date,location=p_input->>'location',description=p_input->>'description',
      important_date=v_important,repeat=v_repeat,repeat_month=v_month,repeat_day=v_day,version=version+1,updated_at=now() where id=p_event_id returning * into result;
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

