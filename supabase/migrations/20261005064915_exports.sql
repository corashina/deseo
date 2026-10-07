-- Private, session-bound exports. Paths survive account and pair deletion until cleanup succeeds.
create table private.export_jobs (
 id uuid primary key default gen_random_uuid(), requester_id uuid not null, session_id uuid not null,
 pair_id uuid, mode text not null check(mode in('current','ended_author','personal')),
 command_id uuid not null, state text not null default 'queued' check(state in('queued','building','ready','failed','canceled','expired')),
 created_at timestamptz not null default now(), expires_at timestamptz not null default(now()+interval '24 hours'),
 stage text not null default 'records' check(stage in('records','media','manifest','done')),
 record_index integer not null default 1, row_cursor uuid, media_cursor text, manifest_cursor integer not null default 0,
 next_ordinal integer not null default 1, counts jsonb not null default '{}',
 record_count bigint not null default 0, part_count bigint not null default 0,
 lease_token uuid, lease_until timestamptz, due_at timestamptz not null default now(), attempts integer not null default 0,
 error_code text check(char_length(error_code)<=80), unique(requester_id,command_id),
 check(expires_at=created_at+interval '24 hours'), check((mode='personal')=(pair_id is null)),
 check((lease_token is null)=(lease_until is null))
);
create index export_jobs_owner on private.export_jobs(requester_id,session_id,created_at desc,id desc);
create index export_jobs_pair on private.export_jobs(pair_id) where pair_id is not null;
create index export_jobs_due on private.export_jobs(due_at,id) where state in('queued','building','failed');
create index export_jobs_expiry on private.export_jobs(expires_at);
create table private.export_parts (
 id uuid primary key default gen_random_uuid(), job_id uuid not null references private.export_jobs(id),
 ordinal integer not null, path text not null unique, filename text not null,
 kind text not null check(kind in('json','media','manifest')), mime_type text not null check(mime_type in('application/json','image/jpeg')),
 record_type text, record_count integer not null default 0 check(record_count between 0 and 50),
 state text not null default 'reserved' check(state in('reserved','ready','cleanup')),
 bytes bigint check(bytes between 1 and 104857600), sha256 text check(sha256 ~ '^[0-9a-f]{64}$'),
 payload jsonb, source jsonb, next_progress jsonb not null, created_at timestamptz not null default now(),
 cleanup_lease uuid, cleanup_until timestamptz, cleanup_due timestamptz not null default now(), error_code text,
 unique(job_id,ordinal), unique(job_id,filename), check((cleanup_lease is null)=(cleanup_until is null))
);
create index export_parts_cleanup on private.export_parts(cleanup_due,id) where state='cleanup';
alter table private.export_jobs enable row level security;
alter table private.export_parts enable row level security;
revoke all on private.export_jobs,private.export_parts from public,anon,authenticated;
grant all on private.export_jobs,private.export_parts to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('exports','exports',false,104857600,array['application/json','image/jpeg']);

create function private.export_valid(j private.export_jobs) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join auth.sessions s on s.user_id=p.user_id join auth.users u on u.id=p.user_id
 where p.user_id=j.requester_id and p.account_status='active' and s.id=j.session_id and (s.not_after is null or s.not_after>now())
 and u.deleted_at is null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now()))
 and (j.mode='personal' or exists(select 1 from public.pairs p join public.pair_members m on m.pair_id=p.id
 where p.id=j.pair_id and m.user_id=j.requester_id and
 ((j.mode='current' and p.state='active' and m.left_at is null) or
 (j.mode='ended_author' and p.state='ended' and m.left_at is not null and p.purge_after>now()))));
$$;
create function private.cancel_pair_exports(p_pair_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update private.export_jobs j set state='canceled',error_code='ACCESS_REVOKED',lease_token=null,lease_until=null
 where j.pair_id=p_pair_id and j.mode='current' and j.state not in('canceled','expired');
 update private.export_parts p set state='cleanup',payload=null,source=null,cleanup_due=case when state='cleanup' then cleanup_due else now() end
 where p.job_id in(select j.id from private.export_jobs j where j.pair_id=p_pair_id and j.state in('canceled','expired'));
end; $$;
create function private.cancel_account_exports(p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update private.export_jobs j set state='canceled',error_code='ACCESS_REVOKED',lease_token=null,lease_until=null
 where j.requester_id=p_user_id and j.state not in('canceled','expired');
 update private.export_parts p set state='cleanup',payload=null,source=null,cleanup_due=case when state='cleanup' then cleanup_due else now() end
 where p.job_id in(select j.id from private.export_jobs j where j.requester_id=p_user_id and j.state in('canceled','expired'));
end; $$;
create function private.export_lock(p_job_id uuid) returns private.export_jobs language plpgsql security definer set search_path='' as $$
declare j private.export_jobs;
begin
 select * into j from private.export_jobs where id=p_job_id;
 if not found then return j; end if;
 perform 1 from public.profiles p where p.user_id=j.requester_id or p.user_id in(select m.user_id from public.pair_members m where m.pair_id=j.pair_id) order by p.user_id for update;
 perform 1 from public.pairs p where p.id=j.pair_id for update;
 select * into j from private.export_jobs where id=p_job_id for update;
 if j.expires_at<=now() and j.state<>'expired' then
  update private.export_jobs set state='expired',lease_token=null,lease_until=null,error_code='EXPIRED' where id=j.id returning * into j;
 elsif not private.export_valid(j) and j.state not in('canceled','expired') then
  update private.export_jobs set state='canceled',lease_token=null,lease_until=null,error_code='ACCESS_REVOKED' where id=j.id returning * into j;
 end if;
 if j.state in('canceled','expired') then update private.export_parts set state='cleanup',payload=null,source=null,cleanup_due=case when state='cleanup' then cleanup_due else now() end where job_id=j.id; end if;
 return j;
end; $$;
create function private.export_part_json(p private.export_parts) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',p.id,'filename',p.filename,'kind',p.kind,'mimeType',p.mime_type,'bytes',p.bytes,'sha256',p.sha256,'recordType',p.record_type,'recordCount',p.record_count);
$$;
create function private.export_summary(j private.export_jobs) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',j.id,'pairId',j.pair_id,'mode',j.mode,'state',j.state,'createdAt',j.created_at,'expiresAt',j.expires_at,
 'progress',jsonb_build_object('stage',j.stage,'records',j.record_count,'parts',j.part_count),'errorCode',j.error_code,
 'retryAt',case when j.state='failed' then j.due_at else null end);
$$;
create function private.export_part_page(j private.export_jobs,p_cursor text) returns jsonb language plpgsql set search_path='' as $$
declare v_after integer:=0; v_items jsonb; v_last integer; v_more boolean;
begin
 if p_cursor is not null then
  if p_cursor !~ '^[0-9]{1,9}$' then return private.error('VALIDATION','cursor'); end if;
  v_after:=p_cursor::integer;
 end if;
 if j.state<>'ready' then return jsonb_build_object('ok',true,'data',jsonb_build_object('items','[]'::jsonb,'nextCursor',null)); end if;
 select coalesce(jsonb_agg(private.export_part_json(q) order by q.ordinal),'[]'),max(q.ordinal) into v_items,v_last
 from(select p.* from private.export_parts p where p.job_id=j.id and p.state='ready' and p.ordinal>v_after order by p.ordinal limit 50) q;
 select exists(select 1 from private.export_parts p where p.job_id=j.id and p.state='ready' and p.ordinal>v_last) into v_more;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('items',v_items,'nextCursor',case when v_more then v_last::text else null end));
end; $$;
create function private.export_status(j private.export_jobs) returns jsonb language plpgsql set search_path='' as $$
declare v_page jsonb:=private.export_part_page(j,null)->'data';
begin return private.export_summary(j)||jsonb_build_object('parts',v_page->'items','partsCursor',v_page->'nextCursor'); end; $$;
create function private.request_export(p_pair_id uuid,p_verification_proof text,p_command_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid; j private.export_jobs; v_mode text; v_session uuid;
begin
 v_actor:=private.require_actor();
 perform 1 from public.profiles p where p.user_id=v_actor or p.user_id in(select m.user_id from public.pair_members m where m.pair_id=p_pair_id) order by p.user_id for update;
 perform 1 from public.pairs p where p.id=p_pair_id for update;
 v_actor:=private.require_actor(); v_session:=(auth.jwt()->>'session_id')::uuid;
 if p_command_id is null then return private.error('VALIDATION','commandId'); end if;
 select * into j from private.export_jobs where requester_id=v_actor and command_id=p_command_id for update;
 if found then
  if j.pair_id is distinct from p_pair_id then return private.error('CONFLICT'); end if;
  if j.session_id<>v_session then return private.error('FORBIDDEN'); end if;
  j:=private.export_lock(j.id); return jsonb_build_object('ok',true,'data',private.export_status(j));
 end if;
 if p_pair_id is null then v_mode:='personal';
 elsif exists(select 1 from public.pairs p join public.pair_members m on m.pair_id=p.id where p.id=p_pair_id and p.state='active' and m.user_id=v_actor and m.left_at is null) then v_mode:='current';
 elsif exists(select 1 from public.pairs p join public.pair_members m on m.pair_id=p.id where p.id=p_pair_id and p.state='ended' and m.user_id=v_actor and m.left_at is not null and p.purge_after>now()) then v_mode:='ended_author';
 else return private.error('FORBIDDEN'); end if;
 if not private.consume_verification_proof(v_actor,'export',p_verification_proof) then return private.error('FORBIDDEN'); end if;
 insert into private.export_jobs(requester_id,session_id,pair_id,mode,command_id) values(v_actor,v_session,p_pair_id,v_mode,p_command_id) returning * into j;
 return jsonb_build_object('ok',true,'data',private.export_status(j));
exception when sqlstate 'P0001' then return private.error(sqlerrm); end; $$;
create function private.get_export(p_job_id uuid,p_retry boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid; j private.export_jobs;
begin
 v_actor:=private.require_actor();
 select * into j from private.export_jobs where id=p_job_id and requester_id=v_actor and session_id::text=auth.jwt()->>'session_id';
 if not found then return private.error('FORBIDDEN'); end if;
 j:=private.export_lock(j.id); perform private.require_actor();
 if p_retry and j.state='failed' then update private.export_jobs set state='queued',due_at=now(),error_code=null where id=j.id returning * into j; end if;
 return jsonb_build_object('ok',true,'data',private.export_status(j));
exception when sqlstate 'P0001' then return private.error(sqlerrm); end; $$;
create function private.get_export_parts(p_job_id uuid,p_cursor text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_status jsonb; j private.export_jobs;
begin
 v_status:=private.get_export(p_job_id); if not (v_status->>'ok')::boolean then return v_status; end if;
 select * into j from private.export_jobs where id=p_job_id;
 return private.export_part_page(j,p_cursor);
end; $$;
create function private.get_exports(p_cursor text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_cursor jsonb; v_time timestamptz; v_id uuid; v_items jsonb:='[]'; j private.export_jobs; v_more boolean;
begin
 v_actor:=private.require_actor();
 -- Summaries contain no source rows. Hold only the requester to avoid locks across historical pairs.
 perform 1 from public.profiles p where p.user_id=v_actor for update;
 v_actor:=private.require_actor();
 if p_cursor is not null then
  if char_length(p_cursor)>256 then return private.error('VALIDATION','cursor'); end if;
  v_cursor:=p_cursor::jsonb; v_time:=(v_cursor->>0)::timestamptz; v_id:=(v_cursor->>1)::uuid;
  if v_time is null or v_id is null then return private.error('VALIDATION','cursor'); end if;
 end if;
 for j in select * from private.export_jobs e where e.requester_id=v_actor and e.session_id::text=auth.jwt()->>'session_id' and (p_cursor is null or (e.created_at,e.id)<(v_time,v_id)) order by e.created_at desc,e.id desc limit 50 loop
  if j.expires_at<=now() then j.state:='expired'; j.error_code:='EXPIRED';
  elsif not private.export_valid(j) then j.state:='canceled'; j.error_code:='ACCESS_REVOKED'; end if;
  v_items:=v_items||jsonb_build_array(private.export_summary(j)); v_time:=j.created_at; v_id:=j.id;
 end loop;
 perform private.require_actor();
 select exists(select 1 from private.export_jobs e where e.requester_id=v_actor and e.session_id::text=auth.jwt()->>'session_id' and (e.created_at,e.id)<(v_time,v_id)) into v_more;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('items',v_items,'nextCursor',case when v_more then jsonb_build_array(v_time,v_id)::text else null end));
exception when sqlstate 'P0001' then return private.error(sqlerrm); when invalid_text_representation or datetime_field_overflow then return private.error('VALIDATION','cursor'); end; $$;
create function private.get_export_pairs(p_cursor text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_cursor jsonb; v_time timestamptz; v_id uuid; v_items jsonb; v_last jsonb; v_more boolean;
begin
 v_actor:=private.require_actor();
 if p_cursor is not null then
  if char_length(p_cursor)>256 then return private.error('VALIDATION','cursor'); end if;
  v_cursor:=p_cursor::jsonb; v_time:=(v_cursor->>0)::timestamptz; v_id:=(v_cursor->>1)::uuid;
  if v_time is null or v_id is null then return private.error('VALIDATION','cursor'); end if;
 end if;
 select coalesce(jsonb_agg(q.item order by q.joined_at desc,q.id desc),'[]') into v_items from
 (select p.id,m.joined_at,jsonb_build_object('pairId',p.id,'mode',case when p.state='active' then 'current' else 'ended_author' end,'timezone',p.timezone,'endedAt',p.ended_at,'availableUntil',p.purge_after) item
 from public.pairs p join public.pair_members m on m.pair_id=p.id where m.user_id=v_actor and
 ((p.state='active' and m.left_at is null) or (p.state='ended' and m.left_at is not null and p.purge_after>now()))
 and (p_cursor is null or (m.joined_at,p.id)<(v_time,v_id)) order by m.joined_at desc,p.id desc limit 51) q;
 v_more:=jsonb_array_length(v_items)>50;
 if v_more then v_items:=v_items-50; end if;
 if v_more then
  select m.joined_at,p.id into v_time,v_id from public.pairs p join public.pair_members m on m.pair_id=p.id where m.user_id=v_actor and p.id=(v_items->49->>'pairId')::uuid;
  v_last:=jsonb_build_array(v_time,v_id);
 end if;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('items',v_items,'nextCursor',case when v_more then v_last::text else null end));
exception when sqlstate 'P0001' then return private.error(sqlerrm); when invalid_text_representation or datetime_field_overflow then return private.error('VALIDATION','cursor'); end; $$;
create function private.authorize_export_part(p_job_id uuid,p_part_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_status jsonb; j private.export_jobs; p private.export_parts; v_seconds integer;
begin
 v_status:=private.get_export(p_job_id); if not (v_status->>'ok')::boolean then return v_status; end if;
 select * into j from private.export_jobs where id=p_job_id;
 if j.state<>'ready' or not private.export_valid(j) then return private.error('FORBIDDEN'); end if;
 select * into p from private.export_parts where id=p_part_id and job_id=j.id and state='ready';
 if not found then return private.error('FORBIDDEN'); end if;
 v_seconds:=least(60,floor(extract(epoch from j.expires_at-now()))::integer);
 if v_seconds<1 then return private.error('FORBIDDEN'); end if;
 return jsonb_build_object('ok',true,'data',private.export_part_json(p)||jsonb_build_object('path',p.path,'bucket','exports','expiresIn',v_seconds));
end; $$;

create function public.request_export(p_pair_id uuid,p_verification_proof text,p_command_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.request_export(p_pair_id,p_verification_proof,p_command_id);$$;
create function public.get_export(p_job_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.get_export(p_job_id);$$;
create function public.retry_export(p_job_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.get_export(p_job_id,true);$$;
create function public.get_exports(p_cursor text default null) returns jsonb language sql security invoker set search_path='' as $$select private.get_exports(p_cursor);$$;
create function public.get_export_pairs(p_cursor text default null) returns jsonb language sql security invoker set search_path='' as $$select private.get_export_pairs(p_cursor);$$;
create function public.get_export_parts(p_job_id uuid,p_cursor text default null) returns jsonb language sql security invoker set search_path='' as $$select private.get_export_parts(p_job_id,p_cursor);$$;
create function public.authorize_export_part(p_job_id uuid,p_part_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.authorize_export_part(p_job_id,p_part_id);$$;
revoke all on function private.export_valid(private.export_jobs),private.export_lock(uuid),private.export_part_json(private.export_parts),private.export_summary(private.export_jobs),private.export_part_page(private.export_jobs,text),private.export_status(private.export_jobs),private.cancel_pair_exports(uuid),private.cancel_account_exports(uuid) from public,anon,authenticated;
revoke all on function private.request_export(uuid,text,uuid),private.get_export(uuid,boolean),private.get_exports(text),private.get_export_pairs(text),private.get_export_parts(uuid,text),private.authorize_export_part(uuid,uuid),public.request_export(uuid,text,uuid),public.get_export(uuid),public.retry_export(uuid),public.get_exports(text),public.get_export_pairs(text),public.get_export_parts(uuid,text),public.authorize_export_part(uuid,uuid) from public,anon,authenticated;
grant execute on function private.request_export(uuid,text,uuid),private.get_export(uuid,boolean),private.get_exports(text),private.get_export_pairs(text),private.get_export_parts(uuid,text),private.authorize_export_part(uuid,uuid),public.request_export(uuid,text,uuid),public.get_export(uuid),public.retry_export(uuid),public.get_exports(text),public.get_export_pairs(text),public.get_export_parts(uuid,text),public.authorize_export_part(uuid,uuid) to authenticated;

create function private.export_source(j private.export_jobs,p_kind text,p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select case p_kind
 when 'event' then exists(select 1 from public.events e where e.pair_id=j.pair_id and e.id=p_id and ((j.mode='current' and (e.visibility='shared' or e.created_by=j.requester_id)) or (j.mode='ended_author' and e.created_by=j.requester_id)))
 when 'task' then exists(select 1 from public.tasks t where t.pair_id=j.pair_id and t.id=p_id and (j.mode='current' or (j.mode='ended_author' and t.created_by=j.requester_id)))
 when 'message' then exists(select 1 from public.messages m where m.pair_id=j.pair_id and m.id=p_id and m.deleted_at is null and (j.mode='current' or (j.mode='ended_author' and m.author_id=j.requester_id)))
 else false end;
$$;
create function private.export_rows(j private.export_jobs,p_kind text,p_after uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_schema text:='public'; v_key text:='id'; v_columns text[]; v_filter text; v_records jsonb:='[]'; v_row record; v_last uuid; v_more boolean:=false; v_data jsonb;
begin
 case p_kind
 when 'profiles' then v_key:='user_id'; v_columns:=array['user_id','display_name','timezone','locale','account_status','created_at','updated_at','version'];
  v_filter:='t.user_id=($1).requester_id or (($1).mode=''current'' and t.account_status=''active'' and exists(select 1 from public.pair_members m where m.pair_id=($1).pair_id and m.user_id=t.user_id and m.left_at is null))';
 when 'pairs' then v_columns:=array['id','state','timezone','created_at','ended_at','purge_after']; v_filter:='t.id=($1).pair_id';
 when 'pair_members' then v_key:='user_id'; v_columns:=array['pair_id','user_id','slot','joined_at','left_at']; v_filter:='t.pair_id=($1).pair_id and (($1).mode=''current'' or t.user_id=($1).requester_id)';
 when 'events' then v_columns:=array['id','pair_id','created_by','owner','visibility','title','timezone','starts_at','ends_at','start_date','end_date_exclusive','repeat','location','description','created_at','updated_at','version','repeat_month','repeat_day','important_date']; v_filter:='private.export_source($1,''event'',t.id)';
 when 'date_ideas' then v_columns:=array['id','pair_id','created_by','title','note','link','state','linked_event_id','created_at','updated_at','version']; v_filter:='t.pair_id=($1).pair_id and (($1).mode=''current'' or t.created_by=($1).requester_id)';
 when 'task_lists' then v_columns:=array['id','pair_id','name','is_general','created_by','created_at','updated_at','version']; v_filter:='t.pair_id=($1).pair_id and (($1).mode=''current'' or t.created_by=($1).requester_id)';
 when 'tasks' then v_columns:=array['id','pair_id','list_id','title','assignee_id','due_date','completed_at','completed_by','created_by','created_at','updated_at','version']; v_filter:='private.export_source($1,''task'',t.id)';
 when 'messages' then v_columns:=array['id','pair_id','author_id','client_id','body','created_at','pinned_at','version']; v_filter:='private.export_source($1,''message'',t.id)';
 when 'memories' then v_columns:=array['id','pair_id','created_by','memory_date','caption','state','created_at','updated_at','version']; v_filter:='t.pair_id=($1).pair_id and t.state<>''deleting'' and ((t.state=''published'' and ($1).mode=''current'') or t.created_by=($1).requester_id)';
 when 'memory_photos' then v_columns:=array['id','pair_id','memory_id','uploaded_by','photo_order','full_bytes','thumb_bytes','width','height','thumb_width','thumb_height','validated'];
  v_filter:='t.pair_id=($1).pair_id and exists(select 1 from public.memories m where m.id=t.memory_id and m.pair_id=t.pair_id and m.state<>''deleting'' and ((($1).mode=''current'' and (m.state=''published'' or m.created_by=($1).requester_id)) or (($1).mode=''ended_author'' and m.created_by=($1).requester_id and t.uploaded_by=($1).requester_id)))';
 when 'notification_preferences' then v_key:='user_id'; v_columns:=array['user_id','message_alerts','default_event_reminder_minutes','quiet_start','quiet_end','timezone','version']; v_filter:='t.user_id=($1).requester_id';
 when 'reminders' then v_columns:=array['id','user_id','pair_id','event_id','task_id','minutes_before','remind_at','active','version','created_at']; v_filter:='t.user_id=($1).requester_id and t.pair_id=($1).pair_id and (private.export_source($1,''event'',t.event_id) or private.export_source($1,''task'',t.task_id))';
 when 'notifications' then v_columns:=array['id','user_id','pair_id','kind','created_at','read_at']; v_filter:='t.user_id=($1).requester_id and t.pair_id=($1).pair_id and t.available_at<=now() and private.export_source($1,t.kind,t.source_id)';
 when 'devices' then v_columns:=array['id','user_id','installation_id','platform','permission','last_seen_at','revoked_at','version']; v_filter:='t.user_id=($1).requester_id';
 when 'conversation_reads' then v_schema:='private'; v_key:='user_id'; v_columns:=array['pair_id','user_id','last_read_created_at','last_read_message_id']; v_filter:='t.user_id=($1).requester_id and t.pair_id=($1).pair_id and private.export_source($1,''message'',t.last_read_message_id)';
 else raise exception using message='VALIDATION',errcode='P0001'; end case;
 for v_row in execute format('select t.%I row_id,(select jsonb_object_agg(e.k,e.v) from jsonb_each(to_jsonb(t)) e(k,v) where e.k=any($3)) data from %I.%I t where (%s) and ($2 is null or t.%I>$2) order by t.%I limit 51',v_key,v_schema,p_kind,v_filter,v_key,v_key) using j,p_after,v_columns loop
  if jsonb_array_length(v_records)=50 then v_more:=true; exit; end if;
  v_data:=v_row.data;
  if p_kind='profiles' then
   if v_row.row_id=j.requester_id then v_data:=v_data||jsonb_build_object('email',(select u.email from auth.users u where u.id=j.requester_id)); end if;
   v_data:=v_data||jsonb_build_object('avatar_file',case when exists(select 1 from public.profiles p join private.avatar_uploads a on a.path=p.avatar_path where p.user_id=v_row.row_id and a.state='current') then 'avatar-'||v_row.row_id||'.jpg' else null end);
  elsif p_kind='memory_photos' then
   v_data:=v_data||jsonb_build_object('full_file',case when (v_data->>'validated')::boolean and exists(select 1 from public.memories m where m.id=(v_data->>'memory_id')::uuid and m.state='published') then 'photo-'||v_row.row_id||'-full.jpg' else null end,
    'thumb_file',case when (v_data->>'validated')::boolean and exists(select 1 from public.memories m where m.id=(v_data->>'memory_id')::uuid and m.state='published') then 'photo-'||v_row.row_id||'-thumb.jpg' else null end);
  end if;
  v_records:=v_records||jsonb_build_array(v_data); v_last:=v_row.row_id;
 end loop;
 return jsonb_build_object('records',v_records,'nextCursor',case when v_more then v_last else null end);
end; $$;
create function private.export_next_media(j private.export_jobs,p_after text) returns jsonb language sql stable security definer set search_path='' as $$
 select q.data from (
 select 'photo/'||p.id||'/'||v.variant media_key,jsonb_build_object('sourceKind','photo','sourceId',p.id,'variant',v.variant,'bucket','memory-photos',
 'path',case when v.variant='full' then p.full_path else p.thumb_path end,'bytes',case when v.variant='full' then p.full_bytes else p.thumb_bytes end,
 'width',case when v.variant='full' then p.width else p.thumb_width end,'height',case when v.variant='full' then p.height else p.thumb_height end,
 'filename','photo-'||p.id||'-'||v.variant||'.jpg','cursor','photo/'||p.id||'/'||v.variant) data
 from public.memory_photos p join public.memories m on m.id=p.memory_id cross join (values('full'),('thumb')) v(variant)
 where p.pair_id=j.pair_id and p.validated and m.state='published' and (j.mode='current' or (j.mode='ended_author' and m.created_by=j.requester_id and p.uploaded_by=j.requester_id))
 union all
 select 'avatar/'||p.user_id,jsonb_build_object('sourceKind','avatar','sourceId',p.user_id,'variant','avatar','bucket','avatars','path',a.path,'bytes',a.bytes,'width',a.width,'height',a.height,
 'filename','avatar-'||p.user_id||'.jpg','cursor','avatar/'||p.user_id)
 from public.profiles p join private.avatar_uploads a on a.path=p.avatar_path and a.state='current'
 where p.user_id=j.requester_id or (j.mode='current' and p.account_status='active' and exists(select 1 from public.pair_members m where m.pair_id=j.pair_id and m.user_id=p.user_id and m.left_at is null))
 ) q where p_after is null or q.media_key>p_after order by q.media_key limit 1;
$$;
create function private.export_step_json(p private.export_parts,j private.export_jobs) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('jobId',j.id,'partId',p.id,'path',p.path,'filename',p.filename,'kind',p.kind,'mimeType',p.mime_type,'payload',p.payload,'source',p.source,'bytes',p.bytes,'sha256',p.sha256,'leaseToken',j.lease_token);
$$;
create function private.claim_export_jobs(p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_candidate record; j private.export_jobs; v_items jsonb:='[]';
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then return private.error('FORBIDDEN'); end if;
 if p_limit is null or p_limit not between 1 and 20 then return private.error('VALIDATION'); end if;
 if not pg_try_advisory_xact_lock(702616) then return jsonb_build_object('ok',true,'data','[]'::jsonb); end if;
 -- One candidate keeps each transaction's profile and pair locks within one scope.
 for v_candidate in select e.id from private.export_jobs e where e.state in('queued','building','failed') and e.due_at<=now() and (e.lease_until is null or e.lease_until<=now()) order by e.due_at,e.id limit 1 loop
  j:=private.export_lock(v_candidate.id);
  if j.state not in('queued','building','failed') or not private.export_valid(j) then continue; end if;
  update private.export_jobs set state='building',lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=attempts+1,error_code=null where id=j.id returning * into j;
  v_items:=v_items||jsonb_build_array(jsonb_build_object('id',j.id,'leaseToken',j.lease_token));
 end loop;
 return jsonb_build_object('ok',true,'data',v_items);
end; $$;
create function private.prepare_export_step(p_job_id uuid,p_lease_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.export_jobs; p private.export_parts; v_kind text; v_page jsonb; v_payload jsonb; v_source jsonb; v_next jsonb; v_filename text; v_count integer:=0;
 v_kinds text[]:=array['profiles','pairs','pair_members','events','date_ideas','task_lists','tasks','messages','memories','memory_photos','notification_preferences','reminders','notifications','devices','conversation_reads'];
 v_entries jsonb; v_last integer; v_more boolean; v_pages integer; v_total bigint;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then return private.error('FORBIDDEN'); end if;
 j:=private.export_lock(p_job_id);
 if j.id is null or j.state<>'building' or j.lease_token is distinct from p_lease_token or j.lease_until<=now() or not private.export_valid(j) then return private.error('FORBIDDEN'); end if;
 select * into p from private.export_parts e where e.job_id=j.id and e.state='reserved' order by e.ordinal limit 1 for update;
 if found then return jsonb_build_object('ok',true,'data',private.export_step_json(p,j)); end if;
 while j.stage='records' loop
  if j.record_index>array_length(v_kinds,1) then update private.export_jobs set stage='media' where id=j.id returning * into j; exit; end if;
  v_kind:=v_kinds[j.record_index]; v_page:=private.export_rows(j,v_kind,j.row_cursor); v_count:=jsonb_array_length(v_page->'records');
  if v_count=0 then update private.export_jobs set record_index=record_index+1,row_cursor=null where id=j.id returning * into j; continue; end if;
  v_payload:=jsonb_build_object('formatVersion',1,'recordType',v_kind,'records',v_page->'records');
  v_filename:=v_kind||'-'||j.next_ordinal||'.json';
  v_next:=jsonb_build_object('stage','records','recordIndex',case when v_page->>'nextCursor' is null then j.record_index+1 else j.record_index end,'rowCursor',v_page->'nextCursor');
  exit;
 end loop;
 if j.stage='media' then
  v_source:=private.export_next_media(j,j.media_cursor);
  if v_source is null then update private.export_jobs set stage='manifest' where id=j.id returning * into j;
  else v_kind:=null; v_count:=0; v_filename:=v_source->>'filename'; v_next:=jsonb_build_object('stage','media','mediaCursor',v_source->>'cursor'); end if;
 end if;
 if j.stage='manifest' then
  select coalesce(jsonb_agg(private.export_part_json(q)||coalesce(q.source-'path'-'bucket'-'width'-'height'-'bytes'-'filename'-'cursor','{}') order by q.ordinal),'[]'),max(q.ordinal)
  into v_entries,v_last from(select e.* from private.export_parts e where e.job_id=j.id and e.state='ready' and e.kind<>'manifest' and e.ordinal>j.manifest_cursor order by e.ordinal limit 50) q;
  v_kind:=null; v_count:=0;
  if jsonb_array_length(v_entries)>0 then
   select exists(select 1 from private.export_parts e where e.job_id=j.id and e.state='ready' and e.kind<>'manifest' and e.ordinal>v_last) into v_more;
   select count(*)::integer+1 into v_pages from private.export_parts e where e.job_id=j.id and e.kind='manifest';
   v_filename:='manifest-'||v_pages||'.json';
   v_payload:=jsonb_build_object('formatVersion',1,'jobId',j.id,'page',v_pages,'parts',v_entries,'nextPage',case when v_more then 'manifest-'||(v_pages+1)||'.json' else null end);
   v_next:=jsonb_build_object('stage','manifest','manifestCursor',v_last);
  else
   select count(*)::integer into v_pages from private.export_parts e where e.job_id=j.id and e.kind='manifest';
   select count(*) into v_total from private.export_parts e where e.job_id=j.id and e.kind<>'manifest';
   v_filename:='manifest.json';
   v_payload:=jsonb_build_object('formatVersion',1,'jobId',j.id,'requesterId',j.requester_id,'pairId',j.pair_id,'mode',j.mode,'createdAt',j.created_at,'expiresAt',j.expires_at,'counts',j.counts,
    'firstPage',case when v_pages>0 then 'manifest-1.json' else null end,'pageCount',v_pages,'dataPartCount',v_total);
   v_next:=jsonb_build_object('stage','done');
  end if;
 end if;
 insert into private.export_parts(job_id,ordinal,path,filename,kind,mime_type,record_type,record_count,payload,source,next_progress)
 values(j.id,j.next_ordinal,j.requester_id||'/'||j.id||'/'||v_filename,v_filename,case when j.stage='manifest' then 'manifest' when v_source is not null then 'media' else 'json' end,
 case when v_source is not null then 'image/jpeg' else 'application/json' end,v_kind,v_count,v_payload,v_source,v_next) returning * into p;
 return jsonb_build_object('ok',true,'data',private.export_step_json(p,j));
end; $$;
create function private.reserve_export_evidence(p_job_id uuid,p_part_id uuid,p_lease_token uuid,p_bytes bigint,p_sha256 text) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.export_jobs; p private.export_parts;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then return private.error('FORBIDDEN'); end if;
 j:=private.export_lock(p_job_id);
 if j.id is null or j.state<>'building' or j.lease_token is distinct from p_lease_token or j.lease_until<=now() or not private.export_valid(j) then return private.error('FORBIDDEN'); end if;
 if p_bytes is null or p_bytes not between 1 and 104857600 or p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then return private.error('VALIDATION'); end if;
 select * into p from private.export_parts where id=p_part_id and job_id=j.id and state='reserved' for update;
 if not found then return private.error('FORBIDDEN'); end if;
 if p.bytes is not null and (p.bytes<>p_bytes or p.sha256<>p_sha256) then return private.error('CONFLICT'); end if;
 update private.export_parts set bytes=p_bytes,sha256=p_sha256 where id=p.id returning * into p;
 return jsonb_build_object('ok',true,'data',private.export_step_json(p,j));
end; $$;
create function private.complete_export_step(p_job_id uuid,p_part_id uuid,p_lease_token uuid,p_bytes bigint,p_sha256 text,p_error_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.export_jobs; p private.export_parts; v_next jsonb;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then return private.error('FORBIDDEN'); end if;
 j:=private.export_lock(p_job_id);
 if j.id is null or j.state<>'building' or j.lease_token is distinct from p_lease_token or j.lease_until<=now() or not private.export_valid(j) then return private.error('FORBIDDEN'); end if;
 select * into p from private.export_parts where id=p_part_id and job_id=j.id and state='reserved' for update;
 if not found then return private.error('FORBIDDEN'); end if;
 if p_error_code is not null then
  if char_length(p_error_code)>80 then return private.error('VALIDATION'); end if;
  update private.export_jobs set state='failed',due_at=now()+interval '1 minute',error_code=p_error_code,lease_token=null,lease_until=null where id=j.id;
  return jsonb_build_object('ok',true,'data',jsonb_build_object('id',j.id));
 end if;
 if p.bytes is null or p.bytes is distinct from p_bytes or p.sha256 is distinct from p_sha256 then return private.error('VALIDATION'); end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='exports' and o.name=p.path and (o.metadata->>'size')::bigint=p.bytes and o.metadata->>'mimetype'=p.mime_type) then return private.error('RETRYABLE'); end if;
 v_next:=p.next_progress;
 update private.export_parts set state='ready',payload=null where id=p.id;
 update private.export_jobs set stage=v_next->>'stage',record_index=coalesce((v_next->>'recordIndex')::integer,record_index),row_cursor=(v_next->>'rowCursor')::uuid,
 media_cursor=coalesce(v_next->>'mediaCursor',media_cursor),manifest_cursor=coalesce((v_next->>'manifestCursor')::integer,manifest_cursor),
 counts=case when p.record_type is not null then jsonb_set(counts,array[p.record_type],to_jsonb(coalesce((counts->>p.record_type)::bigint,0)+p.record_count)) else counts end,
 record_count=record_count+p.record_count,part_count=part_count+1,next_ordinal=next_ordinal+1,
 state=case when v_next->>'stage'='done' then 'ready' else 'queued' end,lease_token=null,lease_until=null,due_at=now(),error_code=null where id=j.id;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('id',j.id));
end; $$;
create function private.export_storage_admission() returns trigger language plpgsql security definer set search_path='' as $$
declare j private.export_jobs; p private.export_parts;
begin
 if tg_op='UPDATE' and old.bucket_id='exports' then raise exception using message='FORBIDDEN',errcode='P0001'; end if;
 if new.bucket_id<>'exports' then return new; end if;
 if tg_op='UPDATE' or auth.jwt()->>'role' is distinct from 'service_role' then raise exception using message='FORBIDDEN',errcode='P0001'; end if;
 select * into p from private.export_parts where path=new.name;
 if not found then raise exception using message='FORBIDDEN',errcode='P0001'; end if;
 j:=private.export_lock(p.job_id);
 select * into p from private.export_parts where id=p.id for update;
 if j.state<>'building' or not private.export_valid(j) or j.lease_until<=now() or p.state<>'reserved' or p.bytes is null
 or new.user_metadata->>'leaseToken' is distinct from j.lease_token::text then raise exception using message='FORBIDDEN',errcode='P0001'; end if;
 if new.version='1' and new.metadata->>'size' is null then return new; end if;
 if coalesce(new.metadata->>'size','') !~ '^[0-9]{1,9}$' or (new.metadata->>'size')::bigint<>p.bytes or new.metadata->>'mimetype' is distinct from p.mime_type then raise exception using message='VALIDATION',errcode='P0001'; end if;
 return new;
end; $$;
create trigger exports_storage_admission before insert or update on storage.objects for each row execute function private.export_storage_admission();

create function public.claim_export_jobs(p_limit integer default 2) returns jsonb language sql security invoker set search_path='' as $$select private.claim_export_jobs(p_limit);$$;
create function public.prepare_export_step(p_job_id uuid,p_lease_token uuid) returns jsonb language sql security invoker set search_path='' as $$select private.prepare_export_step(p_job_id,p_lease_token);$$;
create function public.reserve_export_evidence(p_job_id uuid,p_part_id uuid,p_lease_token uuid,p_bytes bigint,p_sha256 text) returns jsonb language sql security invoker set search_path='' as $$select private.reserve_export_evidence(p_job_id,p_part_id,p_lease_token,p_bytes,p_sha256);$$;
create function public.complete_export_step(p_job_id uuid,p_part_id uuid,p_lease_token uuid,p_bytes bigint,p_sha256 text,p_error_code text default null) returns jsonb language sql security invoker set search_path='' as $$select private.complete_export_step(p_job_id,p_part_id,p_lease_token,p_bytes,p_sha256,p_error_code);$$;
revoke all on function private.export_source(private.export_jobs,text,uuid),private.export_rows(private.export_jobs,text,uuid),private.export_next_media(private.export_jobs,text),private.export_step_json(private.export_parts,private.export_jobs),private.export_storage_admission(),private.claim_export_jobs(integer),private.prepare_export_step(uuid,uuid),private.reserve_export_evidence(uuid,uuid,uuid,bigint,text),private.complete_export_step(uuid,uuid,uuid,bigint,text,text),public.claim_export_jobs(integer),public.prepare_export_step(uuid,uuid),public.reserve_export_evidence(uuid,uuid,uuid,bigint,text),public.complete_export_step(uuid,uuid,uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function private.claim_export_jobs(integer),private.prepare_export_step(uuid,uuid),private.reserve_export_evidence(uuid,uuid,uuid,bigint,text),private.complete_export_step(uuid,uuid,uuid,bigint,text,text),public.claim_export_jobs(integer),public.prepare_export_step(uuid,uuid),public.reserve_export_evidence(uuid,uuid,uuid,bigint,text),public.complete_export_step(uuid,uuid,uuid,bigint,text,text) to service_role;

create function private.export_content_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Existing content commands hold profiles and pair before reaching this trigger.
 update private.export_jobs j set state='canceled',error_code='SOURCE_CHANGED',lease_token=null,lease_until=null
 where j.pair_id=old.pair_id and j.state not in('canceled','expired');
 update private.export_parts p set state='cleanup',payload=null,source=null,cleanup_due=case when state='cleanup' then cleanup_due else now() end
 where p.job_id in(select j.id from private.export_jobs j where j.pair_id=old.pair_id and j.state in('canceled','expired'));
 return case when tg_op='DELETE' then old else new end;
end; $$;
create trigger events_exports after update or delete on public.events for each row execute function private.export_content_changed();
create trigger tasks_exports after update or delete on public.tasks for each row execute function private.export_content_changed();
create trigger task_lists_exports after update or delete on public.task_lists for each row execute function private.export_content_changed();
create trigger date_ideas_exports after update or delete on public.date_ideas for each row execute function private.export_content_changed();
create trigger messages_exports after update or delete on public.messages for each row execute function private.export_content_changed();
create trigger memories_exports after update or delete on public.memories for each row execute function private.export_content_changed();
create trigger memory_photos_exports after update or delete on public.memory_photos for each row execute function private.export_content_changed();
create function private.export_pair_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' or new.state='ended' then perform private.cancel_pair_exports(old.id); end if;
 return case when tg_op='DELETE' then old else new end;
end; $$;
create trigger pairs_exports after update of state or delete on public.pairs for each row execute function private.export_pair_changed();
create function private.export_personal_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='devices' and tg_op='UPDATE' then
  -- Foreground sync and private credential changes do not revoke exported account data.
  if (old.id,old.user_id,old.installation_id,old.platform,old.permission,old.revoked_at)
   is not distinct from (new.id,new.user_id,new.installation_id,new.platform,new.permission,new.revoked_at) then return new; end if;
 end if;
 perform private.cancel_account_exports(old.user_id);
 if tg_table_name='profiles' then
  update private.export_jobs j set state='canceled',error_code='SOURCE_CHANGED',lease_token=null,lease_until=null where j.mode='current' and j.state not in('canceled','expired')
  and exists(select 1 from public.pair_members m where m.pair_id=j.pair_id and m.user_id=old.user_id);
  update private.export_parts p set state='cleanup',payload=null,source=null,cleanup_due=case when state='cleanup' then cleanup_due else now() end where p.job_id in(select j.id from private.export_jobs j where j.state in('canceled','expired') and j.mode='current');
 end if;
 return case when tg_op='DELETE' then old else new end;
end; $$;
create trigger profiles_exports after update or delete on public.profiles for each row execute function private.export_personal_changed();
create trigger preferences_exports after update or delete on public.notification_preferences for each row execute function private.export_personal_changed();
create trigger devices_exports after update or delete on public.devices for each row execute function private.export_personal_changed();
create trigger reminders_exports after update or delete on public.reminders for each row execute function private.export_personal_changed();
create trigger notifications_exports after update or delete on public.notifications for each row execute function private.export_personal_changed();
create trigger conversation_reads_exports after update or delete on private.conversation_reads for each row execute function private.export_personal_changed();

create function private.claim_export_cleanup(p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_candidate record; j private.export_jobs; p private.export_parts; v_items jsonb:='[]';
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then return private.error('FORBIDDEN'); end if;
 if p_limit is null or p_limit not between 1 and 20 then return private.error('VALIDATION'); end if;
 if not pg_try_advisory_xact_lock(702617) then return jsonb_build_object('ok',true,'data','[]'::jsonb); end if;
 for v_candidate in select e.id,e.job_id from private.export_parts e join private.export_jobs q on q.id=e.job_id
 where (e.state='cleanup' or q.expires_at<=now() or q.state in('canceled','expired')) and e.cleanup_due<=now() and (e.cleanup_until is null or e.cleanup_until<=now()) order by e.cleanup_due,e.id limit 1 loop
  j:=private.export_lock(v_candidate.job_id);
  select * into p from private.export_parts where id=v_candidate.id for update skip locked;
  if not found or p.state<>'cleanup' or (p.cleanup_until is not null and p.cleanup_until>now()) then continue; end if;
  update private.export_parts set cleanup_lease=gen_random_uuid(),cleanup_until=now()+interval '5 minutes' where id=p.id returning * into p;
  v_items:=v_items||jsonb_build_array(jsonb_build_object('id',p.id,'jobId',p.job_id,'path',p.path,'bucket','exports','leaseToken',p.cleanup_lease));
 end loop;
 return jsonb_build_object('ok',true,'data',v_items);
end; $$;
create function private.complete_export_cleanup(p_part_id uuid,p_lease_token uuid,p_error_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p private.export_parts; j private.export_jobs;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then return private.error('FORBIDDEN'); end if;
 select * into p from private.export_parts where id=p_part_id;
 if not found then return private.error('CONFLICT'); end if;
 j:=private.export_lock(p.job_id);
 select * into p from private.export_parts where id=p_part_id for update;
 if p.state<>'cleanup' or p.cleanup_lease is distinct from p_lease_token or p.cleanup_until<=now() then return private.error('CONFLICT'); end if;
 if p_error_code is null and exists(select 1 from storage.objects o where o.bucket_id='exports' and o.name=p.path) then return private.error('RETRYABLE'); end if;
 if p_error_code is null then delete from private.export_parts where id=p.id;
 else update private.export_parts set cleanup_lease=null,cleanup_until=null,cleanup_due=now()+interval '1 minute',error_code=left(p_error_code,80) where id=p.id; end if;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('id',p.id));
end; $$;
create function public.claim_export_cleanup(p_limit integer default 2) returns jsonb language sql security invoker set search_path='' as $$select private.claim_export_cleanup(p_limit);$$;
create function public.complete_export_cleanup(p_part_id uuid,p_lease_token uuid,p_error_code text default null) returns jsonb language sql security invoker set search_path='' as $$select private.complete_export_cleanup(p_part_id,p_lease_token,p_error_code);$$;
create function private.invoke_export_worker() returns bigint language plpgsql security definer set search_path='' as $$
declare v_url text; v_secret text; v_request bigint;
begin
 select decrypted_secret into v_url from vault.decrypted_secrets where name='export_function_url';
 select decrypted_secret into v_secret from vault.decrypted_secrets where name='export_worker_secret';
 if v_url is null or v_secret is null or char_length(v_secret)<32 then return null; end if;
 select net.http_post(url:=rtrim(v_url,'/')||'/process-exports',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_secret),body:='{}'::jsonb,timeout_milliseconds:=10000) into v_request;
 return v_request;
end; $$;
select cron.schedule('deseo-process-exports','* * * * *',$job$select private.invoke_export_worker();$job$);
revoke all on function private.export_content_changed(),private.export_pair_changed(),private.export_personal_changed(),private.invoke_export_worker(),private.claim_export_cleanup(integer),private.complete_export_cleanup(uuid,uuid,text),public.claim_export_cleanup(integer),public.complete_export_cleanup(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.claim_export_cleanup(integer),private.complete_export_cleanup(uuid,uuid,text),public.claim_export_cleanup(integer),public.complete_export_cleanup(uuid,uuid,text) to service_role;
