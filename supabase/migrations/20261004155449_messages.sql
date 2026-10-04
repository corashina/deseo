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
using(deleted_at is null and private.is_member(pair_id));

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
using(user_id=(select private.active_actor()) and private.is_member(pair_id));
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
