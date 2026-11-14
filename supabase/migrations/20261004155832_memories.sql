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
using(private.is_member(pair_id) and (state='published' or (state='pending' and created_by=(select private.active_actor()))));
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
using(private.is_member(pair_id));

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

-- INSERT takes the same locks as publication, closure, and cleanup. No client SELECT, UPDATE, or DELETE policy exists.
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
create function public.get_memory_media(p_photo_id uuid,p_variant text default 'full') returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare ph public.memory_photos;
begin
 if private.active_actor() is null then return private.error('UNAUTHENTICATED'); end if;
 if p_variant is null or p_variant not in('full','thumb') then return private.error('VALIDATION','variant'); end if;
 select ph0.* into ph from public.memory_photos ph0 join public.memories m on m.id=ph0.memory_id
 where ph0.id=p_photo_id and m.state='published' and ph0.validated;
 if not found then return private.error('FORBIDDEN'); end if;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('bucket','memory-photos','path',case when p_variant='full' then ph.full_path else ph.thumb_path end,'expiresIn',60,'photoId',ph.id));
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
 private.reserve_memory(jsonb,uuid),private.memory_upload_allowed(text),private.memory_command(text,uuid,jsonb,integer,uuid),private.schedule_memory_cleanup(),private.close_pending_memories(),
 private.memory_service_lock(uuid,uuid,uuid),private.verify_memory_reservation(uuid,uuid,uuid),private.validate_memory_photo(uuid,uuid,uuid,uuid,jsonb),private.publish_memory(uuid,uuid,uuid,uuid),
 private.claim_memory_cleanup(integer),private.complete_memory_cleanup(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.reserve_memory(jsonb,uuid),public.update_memory(uuid,jsonb,integer,uuid),public.delete_memory(uuid,integer,uuid),
 public.verify_memory_reservation(uuid,uuid,uuid),public.validate_memory_photo(uuid,uuid,uuid,uuid,jsonb),public.publish_memory(uuid,uuid,uuid,uuid),
 public.get_memory(uuid),public.list_memories(uuid,jsonb,integer),public.latest_memory(uuid),public.get_memory_media(uuid,text),
 public.claim_memory_cleanup(integer),public.complete_memory_cleanup(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.error(text,text),private.memory_json(public.memories),private.memory_photo_json(public.memory_photos),private.reserve_memory(jsonb,uuid),
 private.memory_command(text,uuid,jsonb,integer,uuid),private.memory_upload_allowed(text),public.reserve_memory(jsonb,uuid),public.update_memory(uuid,jsonb,integer,uuid),
 public.delete_memory(uuid,integer,uuid),public.get_memory(uuid),public.list_memories(uuid,jsonb,integer),public.latest_memory(uuid),public.get_memory_media(uuid,text) to authenticated;
grant execute on function private.verify_memory_reservation(uuid,uuid,uuid),private.validate_memory_photo(uuid,uuid,uuid,uuid,jsonb),private.publish_memory(uuid,uuid,uuid,uuid),
 private.claim_memory_cleanup(integer),private.complete_memory_cleanup(uuid,uuid,text),
 public.verify_memory_reservation(uuid,uuid,uuid),public.validate_memory_photo(uuid,uuid,uuid,uuid,jsonb),public.publish_memory(uuid,uuid,uuid,uuid),
 public.claim_memory_cleanup(integer),public.complete_memory_cleanup(uuid,uuid,text) to service_role;
alter publication supabase_realtime add table public.memories,public.memory_access_revocations;
