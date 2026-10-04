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
create policy task_lists_visible on public.task_lists for select to authenticated using(private.is_member(pair_id));
create policy tasks_visible on public.tasks for select to authenticated using(private.is_member(pair_id));

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
using(extension='broadcast' and exists(select 1 from public.pairs p
  where realtime.topic()='tasks:'||p.id::text and private.is_member(p.id)));
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
declare actor uuid; pair uuid; previous public.tasks; result public.tasks; replay jsonb;
  request jsonb:=jsonb_build_object('id',p_task_id,'input',p_input,'completed',p_completed,'version',p_expected_version);
  task_list uuid; assignee uuid; title text; due date;
begin
  actor:=private.require_actor();
  if p_action not in('create','update','complete','delete') then return private.error('VALIDATION'); end if;
  if p_action='create' then
    p_task_id:=(p_input->>'id')::uuid; pair:=(p_input->>'pair_id')::uuid;
    if p_task_id is null or pair is null then return private.error('VALIDATION'); end if;
  else
    select pair_id into pair from public.tasks where id=p_task_id;
    if pair is null then select r.pair_id into pair from private.command_receipts r where r.actor=actor and r.command_id=p_command_id
      and r.command_type='task_'||p_action and r.expires_at>now(); end if;
    if pair is null then return private.error('FORBIDDEN'); end if;
  end if;
  perform private.lock_pair(pair,actor);
  if not private.is_member(pair) then return private.error('FORBIDDEN'); end if;
  select * into previous from public.tasks where id=p_task_id for update;
  if previous.id is not null and previous.pair_id<>pair then return private.error('FORBIDDEN'); end if;
  replay:=private.receipt(actor,p_command_id,'task_'||p_action,request);
  if replay is not null then
    if p_action<>'delete' and previous.id is null then return private.error('FORBIDDEN'); end if;
    return replay;
  end if;
  if p_action='create' and previous.id is not null then
    if previous.created_by<>actor then return private.error('CONFLICT'); end if;
    return private.save_receipt(actor,p_command_id,'task_create',pair,request,to_jsonb(previous));
  end if;
  if p_action<>'create' then
    if previous.id is null then return private.error('FORBIDDEN'); end if;
    if p_expected_version is null or p_expected_version<>previous.version then return private.error('CONFLICT'); end if;
  end if;
  if p_action='delete' then
    delete from public.tasks where id=p_task_id;
    return private.save_receipt(actor,p_command_id,'task_delete',pair,request,jsonb_build_object('id',p_task_id));
  end if;
  if p_action='complete' then
    if p_completed is null then return private.error('VALIDATION','completed'); end if;
    if p_completed=(previous.completed_at is not null) then result:=previous;
    else
      update public.tasks set completed_at=case when p_completed then now() end,completed_by=case when p_completed then actor end,
        updated_at=now(),version=version+1 where id=p_task_id returning * into result;
    end if;
    return private.save_receipt(actor,p_command_id,'task_complete',pair,request,to_jsonb(result));
  end if;
  if (p_input->>'id')::uuid is distinct from p_task_id or (p_input->>'pair_id')::uuid is distinct from pair then return private.error('VALIDATION','id'); end if;
  title:=btrim(p_input->>'title'); task_list:=(p_input->>'list_id')::uuid; assignee:=(p_input->>'assignee_id')::uuid;
  if title is null or char_length(title) not between 1 and 200 then return private.error('VALIDATION','title'); end if;
  if not exists(select 1 from public.task_lists where id=task_list and pair_id=pair) then return private.error('VALIDATION','listId'); end if;
  if assignee is not null and not exists(select 1 from public.pair_members m join public.profiles p on p.user_id=m.user_id
    where m.pair_id=pair and m.user_id=assignee and m.left_at is null and p.account_status='active') then return private.error('VALIDATION','assigneeId'); end if;
  if p_input->>'due_date' is not null then
    if p_input->>'due_date' !~ '^\d{4}-\d{2}-\d{2}$' then return private.error('VALIDATION','dueDate'); end if;
    due:=(p_input->>'due_date')::date;
  end if;
  if p_action='create' then
    insert into public.tasks(id,pair_id,list_id,title,assignee_id,due_date,created_by)
    values(p_task_id,pair,task_list,title,assignee,due,actor) returning * into result;
  else
    update public.tasks set list_id=task_list,title=task_command.title,assignee_id=assignee,due_date=due,updated_at=now(),version=version+1
    where id=p_task_id returning * into result;
  end if;
  return private.save_receipt(actor,p_command_id,'task_'||p_action,pair,request,to_jsonb(result));
exception
  when sqlstate 'P0001' then return private.error(sqlerrm);
  when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or check_violation or not_null_violation then return private.error('VALIDATION');
  when unique_violation then return private.error('CONFLICT');
  when foreign_key_violation then return private.error('VALIDATION');
end;
$$;

create function private.list_command(p_action text,p_list_id uuid,p_pair_id uuid,p_name text,p_expected_version integer,p_command_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; pair uuid; previous public.task_lists; result public.task_lists; replay jsonb; general uuid; moved integer;
  request jsonb:=jsonb_build_object('id',p_list_id,'pair',p_pair_id,'name',p_name,'version',p_expected_version);
begin
  actor:=private.require_actor();
  if p_action not in('create','rename','move','delete') then return private.error('VALIDATION'); end if;
  if p_action='create' then pair:=p_pair_id; p_list_id:=p_command_id;
  else
    select pair_id into pair from public.task_lists where id=p_list_id;
    if pair is null then select r.pair_id into pair from private.command_receipts r where r.actor=actor and r.command_id=p_command_id
      and r.command_type='list_'||p_action and r.expires_at>now(); end if;
  end if;
  if pair is null then return private.error('FORBIDDEN'); end if;
  perform private.lock_pair(pair,actor);
  if not private.is_member(pair) then return private.error('FORBIDDEN'); end if;
  select * into previous from public.task_lists where id=p_list_id for update;
  if previous.id is not null and previous.pair_id<>pair then return private.error('FORBIDDEN'); end if;
  replay:=private.receipt(actor,p_command_id,'list_'||p_action,request);
  if replay is not null then
    if p_action<>'delete' and previous.id is null then return private.error('FORBIDDEN'); end if;
    return replay;
  end if;
  if p_action='create' and previous.id is not null then
    if previous.created_by<>actor then return private.error('CONFLICT'); end if;
    return private.save_receipt(actor,p_command_id,'list_create',pair,request,to_jsonb(previous));
  end if;
  if p_action<>'create' and (previous.id is null or previous.is_general) then return private.error('FORBIDDEN'); end if;
  if p_action='rename' and (p_expected_version is null or p_expected_version<>previous.version) then return private.error('CONFLICT'); end if;
  if p_action='move' then
    select id into general from public.task_lists where pair_id=pair and is_general;
    if general is null then return private.error('RETRYABLE'); end if;
    update public.tasks set list_id=general,version=version+1,updated_at=now() where list_id=p_list_id and pair_id=pair;
    get diagnostics moved=row_count;
    return private.save_receipt(actor,p_command_id,'list_move',pair,request,jsonb_build_object('id',p_list_id,'generalListId',general,'moved',moved));
  elsif p_action='delete' then
    if exists(select 1 from public.tasks where pair_id=pair and list_id=p_list_id) then return private.error('VALIDATION','listNotEmpty'); end if;
    delete from public.task_lists where id=p_list_id;
    return private.save_receipt(actor,p_command_id,'list_delete',pair,request,jsonb_build_object('id',p_list_id));
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 40 then return private.error('VALIDATION','name'); end if;
  if p_action='create' then
    insert into public.task_lists(id,pair_id,name,created_by) values(p_list_id,pair,btrim(p_name),actor) returning * into result;
  else
    update public.task_lists set name=btrim(p_name),version=version+1,updated_at=now() where id=p_list_id returning * into result;
  end if;
  return private.save_receipt(actor,p_command_id,'list_'||p_action,pair,request,to_jsonb(result));
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



