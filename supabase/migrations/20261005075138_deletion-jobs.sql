-- Content-free receipts survive Auth deletion. Private jobs keep scope until completion.
create table private.deletion_receipts (
 receipt_hash bytea primary key,request_hash bytea not null,state text not null default 'queued' check(state in('queued','processing','completed')),
 requested_at timestamptz not null default now(),completed_at timestamptz,
 operation_window timestamptz not null default now(),operations integer not null default 0
);
create index deletion_receipts_expiry on private.deletion_receipts(requested_at);
create table private.deletion_jobs (
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in('account','ended_pair')),
 actor_id uuid,pair_id uuid,pair_ids uuid[] not null default '{}',command_id uuid,session_id uuid,receipt_hash bytea,
 phase integer not null default -2,state text not null default 'queued' check(state in('queued','processing','completed')),
 requested_at timestamptz not null default now(),completed_at timestamptz,due_at timestamptz not null default now(),
 attempts integer not null default 0,retry_count integer not null default 0,error_code text,lease_token uuid,lease_until timestamptz,
 check((lease_token is null)=(lease_until is null)),check(kind<>'account' or state='completed' or actor_id is not null)
);
create unique index deletion_account_pending on private.deletion_jobs(actor_id) where kind='account' and state<>'completed';
create unique index deletion_pair_pending on private.deletion_jobs(pair_id) where kind='ended_pair' and state<>'completed';
create unique index deletion_command on private.deletion_jobs(actor_id,command_id) where command_id is not null;
create index deletion_jobs_due on private.deletion_jobs(due_at,id) where state<>'completed';
create index deletion_jobs_pair_scope on private.deletion_jobs using gin(pair_ids);
-- Freeze only partner exports whose own task or idea fields need a purge mutation.
create table private.deletion_export_scopes(
 job_id uuid not null references private.deletion_jobs(id) on delete cascade,pair_id uuid not null,requester_id uuid not null,
 primary key(job_id,pair_id,requester_id)
);
create index deletion_export_scope_owner on private.deletion_export_scopes(requester_id,pair_id);
create table private.deletion_attempts (
 user_id uuid primary key references public.profiles(user_id) on delete cascade,
 window_start timestamptz not null default now(),attempts integer not null default 0
);
alter table private.deletion_receipts enable row level security;
alter table private.deletion_jobs enable row level security;
alter table private.deletion_attempts enable row level security;
alter table private.deletion_export_scopes enable row level security;
revoke all on private.deletion_receipts,private.deletion_jobs,private.deletion_attempts from public,anon,authenticated;
grant all on private.deletion_receipts,private.deletion_jobs,private.deletion_attempts to service_role;
revoke all on private.deletion_export_scopes from public,anon,authenticated;
grant all on private.deletion_export_scopes to service_role;

create function private.deletion_request_hash(p_command uuid,p_proof text,p_receipt text) returns bytea
language sql immutable set search_path='' as $$
 select extensions.digest(jsonb_build_object('commandId',p_command,'proof',p_proof,'receipt',p_receipt)::text,'sha256');
$$;
create function private.deletion_rate_error(p_retry timestamptz) returns jsonb language sql set search_path='' as $$
 select jsonb_build_object('ok',false,'error',jsonb_build_object('code','RATE_LIMITED','retryAt',p_retry));
$$;
create function private.deletion_receipt_operation(p_hash bytea) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.deletion_receipts;
begin
 select * into r from private.deletion_receipts where receipt_hash=p_hash for update;
 if not found or r.requested_at+interval '7 days'<=now() then return private.error('FORBIDDEN'); end if;
 if r.operation_window+interval '1 minute'<=now() then r.operation_window:=now();r.operations:=0;end if;
 if r.operations>=60 then return private.deletion_rate_error(r.operation_window+interval '1 minute');end if;
 update private.deletion_receipts set operations=r.operations+1,operation_window=r.operation_window where receipt_hash=p_hash;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('state',r.state,'requestedAt',r.requested_at,'completedAt',r.completed_at));
end;$$;
create function private.replay_account_deletion(p_command_id uuid,p_verification_proof text,p_receipt text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.deletion_receipts;result jsonb;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then return private.error('FORBIDDEN');end if;
 select * into r from private.deletion_receipts where receipt_hash=extensions.digest(p_receipt,'sha256');
 if not found then return jsonb_build_object('ok',true,'data',jsonb_build_object('matched',false));end if;
 if r.requested_at+interval '7 days'<=now() then return private.error('FORBIDDEN');end if;
 if r.request_hash is distinct from private.deletion_request_hash(p_command_id,p_verification_proof,p_receipt) then return private.error('CONFLICT');end if;
 result:=private.deletion_receipt_operation(r.receipt_hash);if result->>'ok'<>'true' then return result;end if;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('matched',true));
end;$$;
create function private.get_deletion_status(p_receipt text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then return private.error('FORBIDDEN');end if;
 if p_receipt is null or p_receipt !~ '^[0-9a-f]{64}$' then return private.error('FORBIDDEN');end if;
 return private.deletion_receipt_operation(extensions.digest(p_receipt,'sha256'));
end;$$;
create function private.request_account_deletion(p_actor_id uuid,p_session_id uuid,p_verification_proof text,p_command_id uuid,p_receipt text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_pairs uuid[];v_closing uuid[];v_hash bytea;v_replay jsonb;v_attempt private.deletion_attempts;j private.deletion_jobs;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then return private.error('FORBIDDEN');end if;
 if p_actor_id is null or p_session_id is null or p_command_id is null or p_verification_proof is null or p_verification_proof !~ '^[0-9a-f]{64}$' or p_receipt is null or p_receipt !~ '^[0-9a-f]{64}$' then return private.error('VALIDATION');end if;
 select coalesce(array_agg(m.pair_id order by m.pair_id),'{}') into v_pairs from public.pair_members m where m.user_id=p_actor_id;
 perform 1 from public.profiles p where p.user_id=p_actor_id or p.user_id in(select m.user_id from public.pair_members m where m.pair_id=any(v_pairs)) order by p.user_id for update;
 perform 1 from public.pairs p where p.id=any(v_pairs) order by p.id for update;
 if exists(select 1 from public.pair_members m where m.user_id=p_actor_id and not(m.pair_id=any(v_pairs))) then return private.error('RETRYABLE');end if;
 v_replay:=private.replay_account_deletion(p_command_id,p_verification_proof,p_receipt);
 if v_replay->>'ok'<>'true' then return v_replay;end if;
 if v_replay->'data'->>'matched'='true' then return jsonb_build_object('ok',true,'data',jsonb_build_object('receipt',p_receipt));end if;
 select * into j from private.deletion_jobs where actor_id=p_actor_id and command_id=p_command_id for update;
 if found then return private.error('CONFLICT');end if;
 if not exists(select 1 from public.profiles where user_id=p_actor_id and account_status='active') then return private.error('FORBIDDEN');end if;
 if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.id=p_session_id and s.user_id=p_actor_id and (s.not_after is null or s.not_after>now()) and u.deleted_at is null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now())) then return private.error('UNAUTHENTICATED');end if;
 insert into private.deletion_attempts(user_id) values(p_actor_id) on conflict do nothing;
 select * into v_attempt from private.deletion_attempts where user_id=p_actor_id for update;
 if v_attempt.window_start+interval '15 minutes'<=now() then v_attempt.window_start:=now();v_attempt.attempts:=0;end if;
 if v_attempt.attempts>=5 then return private.deletion_rate_error(v_attempt.window_start+interval '15 minutes');end if;
 update private.deletion_attempts set attempts=v_attempt.attempts+1,window_start=v_attempt.window_start where user_id=p_actor_id;
 if not private.consume_verification_proof(p_actor_id,'delete_account',p_verification_proof) then return private.error('FORBIDDEN');end if;
 v_hash:=extensions.digest(p_receipt,'sha256');
 insert into private.deletion_receipts(receipt_hash,request_hash) values(v_hash,private.deletion_request_hash(p_command_id,p_verification_proof,p_receipt));
 insert into private.deletion_jobs(kind,actor_id,pair_ids,command_id,session_id,receipt_hash) values('account',p_actor_id,v_pairs,p_command_id,p_session_id,v_hash) returning * into j;
 insert into private.deletion_export_scopes(job_id,pair_id,requester_id)
 select j.id,q.pair_id,q.created_by from(
  select t.pair_id,t.created_by from public.tasks t where t.created_by<>p_actor_id and (t.assignee_id=p_actor_id or t.completed_by=p_actor_id or t.list_id in(select l.id from public.task_lists l where l.created_by=p_actor_id))
  union select i.pair_id,i.created_by from public.date_ideas i join public.events e on e.id=i.linked_event_id where i.created_by<>p_actor_id and e.created_by=p_actor_id
 ) q;
 -- The durable job permits trigger deferral. Authorization denial still commits atomically.
 select coalesce(array_agg(id),'{}') into v_closing from public.pairs where id=any(v_pairs) and state in('active','pending');
 update public.profiles set account_status='disabled',avatar_path=null,version=version+1,updated_at=now() where user_id=p_actor_id;
 update public.pairs p set state='ended',ended_at=now(),purge_after=now()+interval '30 days' where p.id=any(v_pairs) and p.state in('active','pending');
 update public.pair_members m set left_at=now() where m.pair_id=any(v_pairs) and m.left_at is null;
 update private.pair_invites i set revoked_at=now() where i.pair_id=any(v_pairs) and i.accepted_at is null and i.revoked_at is null;
 perform private.cancel_account_exports(p_actor_id);
 perform private.cancel_pair_exports(p.id) from public.pairs p where p.id=any(v_pairs);
 update public.profiles set version=version+1,updated_at=now() where user_id<>p_actor_id and account_status='active' and user_id in(select m.user_id from public.pair_members m where m.pair_id=any(v_closing));
 update private.avatar_uploads set state='cleanup',due_at=now() where user_id=p_actor_id;
 delete from auth.sessions where user_id=p_actor_id;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('receipt',p_receipt));
exception when unique_violation then return private.error('CONFLICT');
end;$$;
create function public.replay_account_deletion(p_command_id uuid,p_verification_proof text,p_receipt text) returns jsonb language sql security invoker set search_path='' as $$select private.replay_account_deletion(p_command_id,p_verification_proof,p_receipt);$$;
create function public.request_account_deletion(p_actor_id uuid,p_session_id uuid,p_verification_proof text,p_command_id uuid,p_receipt text) returns jsonb language sql security invoker set search_path='' as $$select private.request_account_deletion(p_actor_id,p_session_id,p_verification_proof,p_command_id,p_receipt);$$;
create function public.get_deletion_status(p_receipt text) returns jsonb language sql security invoker set search_path='' as $$select private.get_deletion_status(p_receipt);$$;
revoke all on function private.deletion_request_hash(uuid,text,text),private.deletion_rate_error(timestamptz),private.deletion_receipt_operation(bytea),private.replay_account_deletion(uuid,text,text),private.request_account_deletion(uuid,uuid,text,uuid,text),private.get_deletion_status(text),public.replay_account_deletion(uuid,text,text),public.request_account_deletion(uuid,uuid,text,uuid,text),public.get_deletion_status(text) from public,anon,authenticated;
grant execute on function private.replay_account_deletion(uuid,text,text),private.request_account_deletion(uuid,uuid,text,uuid,text),private.get_deletion_status(text),public.replay_account_deletion(uuid,text,text),public.request_account_deletion(uuid,uuid,text,uuid,text),public.get_deletion_status(text) to service_role;
create or replace function private.notification_account_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient uuid:=new.user_id; r record; refresh_messages boolean:=true;
begin

 if tg_table_name='profiles' then
  if new.account_status='disabled' and exists(select 1 from private.deletion_jobs where kind='account' and actor_id=new.user_id and state<>'completed') then return new;end if;
 end if;
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
create or replace function private.notification_pair_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare pair uuid; r record;
begin

 if exists(select 1 from private.deletion_jobs where kind='account' and pair_ids @> array[case when tg_table_name='pairs' then (to_jsonb(new)->>'id')::uuid else (to_jsonb(new)->>'pair_id')::uuid end] and state<>'completed') then return new;end if;
 if tg_table_name='pairs' then
   pair:=new.id;
   if (new.state,new.timezone) is not distinct from (old.state,old.timezone) then return new; end if;
 else
   pair:=new.pair_id;
   if new.left_at is not distinct from old.left_at then return new; end if;
 end if;
 update private.notification_jobs j set state='canceled',error_code='PAIR_CHANGED' from public.notifications n
 where n.id=j.notification_id and n.pair_id=pair and j.state='queued';
 for r in select id from public.reminders where pair_id=pair and active loop perform private.refresh_reminder(r.id); end loop;
 return new;
end; $$;
create or replace function private.close_pending_memories() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.deletion_jobs where kind='account' and pair_ids @> array[new.id] and state<>'completed') then return new;end if;
 if new.state='ended' and old.state<>'ended' then
  update public.memories set state='deleting',updated_at=now(),version=version+1 where pair_id=new.id and state='pending';
 end if;
 return new;
end; $$;
alter table private.memory_cleanup_jobs drop constraint memory_cleanup_jobs_attempts_check;
alter table private.memory_cleanup_jobs add constraint memory_cleanup_jobs_attempts_check check(attempts>=0);
update private.memory_cleanup_jobs set state='queued',due_at=now() where state='failed';
drop function public.retry_memory_cleanup(uuid);
drop function private.retry_memory_cleanup(uuid);
create or replace function private.claim_memory_cleanup(p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
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
create or replace function private.complete_memory_cleanup(p_job_id uuid,p_lease_token uuid,p_error_code text) returns jsonb
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
alter table public.tasks drop constraint tasks_check;
alter table public.tasks add constraint tasks_check check(completed_at is not null or completed_by is null);

alter table private.deletion_jobs add column memory_ids uuid[] not null default '{}';
alter table private.deletion_jobs add column external_action text;
create function private.lock_deletion_job(p_id uuid) returns private.deletion_jobs language plpgsql security definer set search_path='' as $$
declare j private.deletion_jobs;
begin
 select * into j from private.deletion_jobs where id=p_id;
 if not found then return j;end if;
 perform 1 from public.profiles p where p.user_id=j.actor_id or p.user_id in(select m.user_id from public.pair_members m where m.pair_id=any(j.pair_ids)) order by p.user_id for update;
 perform 1 from public.pairs p where p.id=any(j.pair_ids) order by p.id for update;
 select * into j from private.deletion_jobs where id=p_id for update;
 return j;
end;$$;
create function private.enqueue_pair_deletions() returns integer language plpgsql security definer set search_path='' as $$
declare v_pair uuid;v_count integer:=0;
begin
 for v_pair in select p.id from public.pairs p where p.state='ended' and p.purge_after<=now() and not exists(select 1 from private.deletion_jobs j where j.kind='ended_pair' and j.pair_id=p.id and j.state<>'completed') order by p.purge_after,p.id limit 2 loop
  insert into private.deletion_jobs(kind,pair_id,pair_ids) values('ended_pair',v_pair,array[v_pair]) on conflict do nothing;
  if found then v_count:=v_count+1;end if;
 end loop;
 return v_count;
end;$$;
create function private.claim_deletion_jobs(p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid;j private.deletion_jobs;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then return private.error('FORBIDDEN');end if;
 if p_limit is null or p_limit not between 1 and 2 then return private.error('VALIDATION');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('deseo.deletion_claim',0)) then return jsonb_build_object('ok',true,'data','[]'::jsonb);end if;
 perform private.enqueue_pair_deletions();
 -- One candidate per transaction prevents retained profile locks crossing pair scopes.
 select id into v_id from private.deletion_jobs where state<>'completed' and due_at<=now() and (lease_until is null or lease_until<=now()) order by due_at,id limit 1;
 if not found then return jsonb_build_object('ok',true,'data','[]'::jsonb);end if;
 j:=private.lock_deletion_job(v_id);
 if j.state='completed' or j.due_at>now() or j.lease_until>now() then return jsonb_build_object('ok',true,'data','[]'::jsonb);end if;
 update private.deletion_jobs set state='processing',lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=attempts+1 where id=j.id returning * into j;
 update private.deletion_receipts set state='processing' where receipt_hash=j.receipt_hash;
 return jsonb_build_object('ok',true,'data',jsonb_build_array(jsonb_build_object('id',j.id,'kind',j.kind,'leaseToken',j.lease_token,'attempt',j.attempts)));
end;$$;
create function private.process_deletion_step(p_job_id uuid,p_lease_token uuid,p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.deletion_jobs;v_table text;v_filter text;v_set text;v_count integer;v_memories uuid[];v_pair boolean;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then return private.error('FORBIDDEN');end if;
 if p_limit is null or p_limit not between 1 and 50 then return private.error('VALIDATION');end if;
 j:=private.lock_deletion_job(p_job_id);
 if j.id is null or j.state<>'processing' or j.lease_token is distinct from p_lease_token or j.lease_until<=now() then return private.error('CONFLICT');end if;
 v_pair:=j.kind='ended_pair';
 if v_pair and j.external_action='finished' and not exists(select 1 from public.pairs where id=j.pair_id) then return jsonb_build_object('ok',true,'data',jsonb_build_object('action','finished'));end if;
 if v_pair and not exists(select 1 from public.pairs where id=j.pair_id and state='ended' and purge_after<=now()) then return private.error('FORBIDDEN');end if;
 if j.phase=-2 then
  v_table:='private.export_jobs';v_filter:='state not in(''canceled'',''expired'') and (requester_id=$2 or (pair_id=any($1) and ($3 or mode=''current'')) or exists(select 1 from private.deletion_export_scopes s where s.job_id=$6 and s.pair_id=t.pair_id and s.requester_id=t.requester_id))';v_set:='state=''canceled'',error_code=''ACCESS_REVOKED'',lease_token=null,lease_until=null';
 elsif j.phase=-1 then
  v_table:='private.export_parts';v_filter:='state<>''cleanup'' and job_id in(select e.id from private.export_jobs e where e.requester_id=$2 or (e.pair_id=any($1) and ($3 or e.mode=''current'')) or exists(select 1 from private.deletion_export_scopes s where s.job_id=$6 and s.pair_id=e.pair_id and s.requester_id=e.requester_id))';v_set:='state=''cleanup'',payload=null,source=null,cleanup_due=now()';
 elsif j.phase=0 then
  v_table:='private.notification_jobs';v_filter:='notification_id in(select id from public.notifications where pair_id=any($1) or user_id=$2)';
 elsif j.phase=1 then
  select coalesce(array_agg(id),'{}') into v_memories from(select m.id from public.memories m join public.pairs p on p.id=m.pair_id where m.pair_id=any(j.pair_ids) and (m.state<>'deleting' or not(m.id=any(j.memory_ids))) and (v_pair or m.created_by=j.actor_id or (m.state='pending' and p.state='ended')) order by m.id limit p_limit) q;
  update private.deletion_jobs set memory_ids=memory_ids||v_memories where id=j.id;
  update public.memories set state='deleting',version=version+1,updated_at=now() where id=any(v_memories);
  v_count:=cardinality(v_memories);
 elsif j.phase=2 then
  if exists(select 1 from private.memory_cleanup_jobs where state<>'completed' and (memory_id=any(j.memory_ids) or (v_pair and pair_id=j.pair_id)))
   or exists(select 1 from public.memories where created_by=j.actor_id or (v_pair and pair_id=j.pair_id))
   or exists(select 1 from private.avatar_uploads where user_id=j.actor_id)
   or exists(select 1 from private.export_parts p join private.export_jobs e on e.id=p.job_id where e.requester_id=j.actor_id or (e.pair_id=any(j.pair_ids) and (v_pair or e.mode='current')) or exists(select 1 from private.deletion_export_scopes s where s.job_id=j.id and s.pair_id=e.pair_id and s.requester_id=e.requester_id)) then
   return jsonb_build_object('ok',true,'data',jsonb_build_object('action','wait_storage'));
  end if;
  v_count:=0;
 elsif j.phase=3 then
  v_table:='private.command_receipts';v_filter:='actor=$2 or (pair_id=any($1) and ($3 or command_type ~ ''^(event_|task_|list_|idea_|memory_)''))';
 elsif j.phase=4 then
  v_table:='public.notifications';v_filter:='user_id=$2 or (pair_id=any($1) and ($3 or (kind=''event'' and source_id in(select id from public.events where created_by=$2)) or (kind=''task'' and source_id in(select id from public.tasks where created_by=$2)) or (kind=''message'' and source_id in(select id from public.messages where author_id=$2))))';
 elsif j.phase=5 then
  v_table:='public.reminders';v_filter:='user_id=$2 or (pair_id=any($1) and ($3 or event_id in(select id from public.events where created_by=$2) or task_id in(select id from public.tasks where created_by=$2)))';
 elsif j.phase=6 then v_table:='public.tasks';v_filter:='pair_id=any($1) and ($3 or created_by=$2)';
 elsif j.phase=7 then v_table:='public.tasks';v_filter:='assignee_id=$2';v_set:='assignee_id=null';
 elsif j.phase=8 then v_table:='public.tasks';v_filter:='completed_by=$2';v_set:='completed_by=null';
 elsif j.phase=9 then
  v_table:='public.tasks';v_filter:='list_id in(select id from public.task_lists where created_by=$2)';v_set:='list_id=(select id from public.task_lists l where l.pair_id=t.pair_id and l.is_general)';
 elsif j.phase=10 then v_table:='public.task_lists';v_filter:='pair_id=any($1) and not is_general and ($3 or created_by=$2)';
 elsif j.phase=11 then v_table:='public.date_ideas';v_filter:='pair_id=any($1) and ($3 or created_by=$2)';
 elsif j.phase=12 then
  v_table:='public.date_ideas';v_filter:='linked_event_id in(select id from public.events where created_by=$2)';v_set:='state=case when state=''planned'' and exists(select 1 from public.events e join public.pairs p on p.id=e.pair_id where e.id=t.linked_event_id and case when e.starts_at is not null then e.starts_at>now() else e.start_date>(now() at time zone p.timezone)::date end) then ''saved'' else state end,linked_event_id=null,version=version+1,updated_at=now()';
 elsif j.phase=13 then v_table:='public.events';v_filter:='pair_id=any($1) and ($3 or created_by=$2)';
 elsif j.phase=14 then v_table:='public.messages';v_filter:='pair_id=any($1) and ($3 or author_id=$2)';
 elsif j.phase=15 then v_table:='private.conversation_reads';v_filter:='user_id=$2 or ($3 and pair_id=any($1))';
 elsif j.phase=16 then v_table:='private.memory_tombstones';v_filter:='created_by=$2 or ($3 and pair_id=any($1))';
 elsif j.phase=17 then v_table:='private.pair_invites';v_filter:='created_by=$2 or ($3 and pair_id=any($1))';
 elsif j.phase=18 then v_table:='public.devices';v_filter:='user_id=$2';
 elsif j.phase=19 then v_table:='public.notification_preferences';v_filter:='user_id=$2';
 elsif j.phase=20 then v_table:='private.verification_proofs';v_filter:='user_id=$2';
 elsif j.phase=21 then v_table:='private.memory_cleanup_jobs';v_filter:='state=''completed'' and (memory_id=any($4) or ($3 and pair_id=any($1)))';
 elsif j.phase=22 then v_table:='public.memory_access_revocations';v_filter:='$3 and pair_id=any($1)';
 elsif j.phase=23 then v_table:='public.pair_members';v_filter:='user_id=$2 or ($3 and pair_id=any($1))';
 elsif j.phase=24 then v_table:='private.export_jobs';v_filter:='(requester_id=$2 or ($3 and pair_id=any($1))) and not exists(select 1 from private.export_parts p where p.job_id=t.id)';
 else
  if v_pair then
   update private.deletion_jobs set external_action='finished' where id=j.id;
   delete from public.pairs where id=j.pair_id and state='ended' and purge_after<=now();
   return jsonb_build_object('ok',true,'data',jsonb_build_object('action','finished'));
  end if;
  delete from auth.sessions s where s.id in(select id from auth.sessions where user_id=j.actor_id limit p_limit);
  get diagnostics v_count=row_count;
  if v_count>0 then return jsonb_build_object('ok',true,'data',jsonb_build_object('action','continue'));end if;
  if exists(select 1 from public.pair_members where user_id=j.actor_id)
   or exists(select 1 from private.pair_invites where created_by=j.actor_id)
   or exists(select 1 from private.memory_tombstones where created_by=j.actor_id)
   or exists(select 1 from private.avatar_uploads where user_id=j.actor_id)
   or exists(select 1 from private.memory_cleanup_jobs where state<>'completed' and memory_id=any(j.memory_ids))
   or exists(select 1 from private.export_parts p join private.export_jobs e on e.id=p.job_id where e.requester_id=j.actor_id)
   or exists(select 1 from auth.sessions where user_id=j.actor_id) then return private.error('RETRYABLE');end if;
  update private.deletion_jobs set external_action='delete_auth' where id=j.id;
  return jsonb_build_object('ok',true,'data',jsonb_build_object('action','delete_auth','actorId',j.actor_id));
 end if;
 if v_table is not null then
  if v_set is null then execute format('delete from %s t where t.ctid in(select t.ctid from %s t where %s limit $5)',v_table,v_table,v_filter) using j.pair_ids,j.actor_id,v_pair,j.memory_ids,p_limit,j.id;
  else execute format('update %s t set %s where t.ctid in(select t.ctid from %s t where %s limit $5)',v_table,v_set,v_table,v_filter) using j.pair_ids,j.actor_id,v_pair,j.memory_ids,p_limit,j.id;end if;
  get diagnostics v_count=row_count;
 end if;
 if v_count=0 then update private.deletion_jobs set phase=phase+1 where id=j.id;end if;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('action','continue'));
end;$$;
create function private.complete_deletion_step(p_job_id uuid,p_lease_token uuid,p_error_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.deletion_jobs;v_done boolean:=false;v_error text:=p_error_code;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then return private.error('FORBIDDEN');end if;
 if v_error is not null and v_error not in('AUTH_DELETE_FAILED','STORAGE_PENDING','LEASE_EXPIRED','STEP_FAILED') then return private.error('VALIDATION');end if;
 j:=private.lock_deletion_job(p_job_id);
 if j.id is null or j.state<>'processing' or j.lease_token is distinct from p_lease_token or j.lease_until<=now() then return private.error('CONFLICT');end if;
 if j.external_action is not null then
  v_done:=case when j.kind='account' then not exists(select 1 from auth.users where id=j.actor_id) else not exists(select 1 from public.pairs where id=j.pair_id) end;
  if not v_done and v_error is null then v_error:='AUTH_DELETE_FAILED';end if;
 end if;
 if v_done then
  delete from private.deletion_export_scopes where job_id=j.id;
  update private.deletion_receipts set state='completed',completed_at=now() where receipt_hash=j.receipt_hash;
  update private.deletion_jobs set state='completed',completed_at=now(),actor_id=null,pair_id=null,pair_ids='{}',memory_ids='{}',command_id=null,session_id=null,external_action=null,error_code=null,lease_token=null,lease_until=null where id=j.id;
 else
  update private.deletion_jobs set lease_token=null,lease_until=null,error_code=v_error,retry_count=case when v_error is null then 0 else retry_count+1 end,due_at=now()+case when v_error is null then interval '0 seconds' when retry_count=0 then interval '1 minute' when retry_count=1 then interval '5 minutes' else interval '15 minutes' end where id=j.id;
 end if;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('state',case when v_done then 'completed' else 'processing' end));
end;$$;
create function private.get_deletion_monitoring() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then return private.error('FORBIDDEN');end if;
 return jsonb_build_object('ok',true,'data',jsonb_build_object(
 'pendingAccounts',(select count(*) from private.deletion_jobs where kind='account' and state<>'completed'),
 'pendingPairs',(select count(*) from private.deletion_jobs where kind='ended_pair' and state<>'completed'),
 'overdueAccounts',(select count(*) from private.deletion_jobs where kind='account' and state<>'completed' and requested_at<now()-interval '24 hours'),
 'oldestAccountRequestedAt',(select min(requested_at) from private.deletion_jobs where kind='account' and state<>'completed'),
 'pendingStorageJobs',(select count(*) from private.memory_cleanup_jobs where state<>'completed')+(select count(*) from private.avatar_uploads where state='cleanup')+(select count(*) from private.export_parts where state='cleanup'),
 'failedStorageJobs',(select count(*) from private.memory_cleanup_jobs where state<>'completed' and error_code is not null)+(select count(*) from private.avatar_uploads where error_code is not null)+(select count(*) from private.export_parts where state='cleanup' and error_code is not null)));
end;$$;
create function public.claim_deletion_jobs(p_limit integer default 2) returns jsonb language sql security invoker set search_path='' as $$select private.claim_deletion_jobs(p_limit);$$;
create function public.process_deletion_step(p_job_id uuid,p_lease_token uuid,p_limit integer default 50) returns jsonb language sql security invoker set search_path='' as $$select private.process_deletion_step(p_job_id,p_lease_token,p_limit);$$;
create function public.complete_deletion_step(p_job_id uuid,p_lease_token uuid,p_error_code text default null) returns jsonb language sql security invoker set search_path='' as $$select private.complete_deletion_step(p_job_id,p_lease_token,p_error_code);$$;
create function public.get_deletion_monitoring() returns jsonb language sql security invoker set search_path='' as $$select private.get_deletion_monitoring();$$;
revoke all on function private.lock_deletion_job(uuid),private.enqueue_pair_deletions(),private.claim_deletion_jobs(integer),private.process_deletion_step(uuid,uuid,integer),private.complete_deletion_step(uuid,uuid,text),private.get_deletion_monitoring(),public.claim_deletion_jobs(integer),public.process_deletion_step(uuid,uuid,integer),public.complete_deletion_step(uuid,uuid,text),public.get_deletion_monitoring() from public,anon,authenticated;
grant execute on function private.claim_deletion_jobs(integer),private.process_deletion_step(uuid,uuid,integer),private.complete_deletion_step(uuid,uuid,text),private.get_deletion_monitoring(),public.claim_deletion_jobs(integer),public.process_deletion_step(uuid,uuid,integer),public.complete_deletion_step(uuid,uuid,text),public.get_deletion_monitoring() to service_role;

create function private.expire_deletion_records() returns void language plpgsql security definer set search_path='' as $$
begin
 delete from private.deletion_receipts where receipt_hash in(select receipt_hash from private.deletion_receipts where requested_at<=now()-interval '7 days' order by requested_at limit 50);
 delete from private.deletion_jobs where id in(select id from private.deletion_jobs where state='completed' and completed_at<=now()-interval '30 days' order by completed_at limit 50);
 delete from private.memory_cleanup_jobs where id in(select id from private.memory_cleanup_jobs where state='completed' and completed_at<=now()-interval '30 days' and cardinality(paths)=0 order by completed_at limit 50);
 delete from private.export_jobs where id in(select e.id from private.export_jobs e where e.state in('canceled','expired') and e.expires_at<=now()-interval '30 days' and e.lease_token is null and not exists(select 1 from private.export_parts p where p.job_id=e.id) order by e.expires_at limit 50);
 delete from private.verification_proofs where proof_hash in(select proof_hash from private.verification_proofs where expires_at<=now() order by expires_at limit 50);
 delete from private.pair_invites where id in(select id from private.pair_invites where expires_at<=now() order by expires_at limit 50);
 delete from private.command_receipts where ctid in(select ctid from private.command_receipts where expires_at<=now() order by expires_at limit 50);
 delete from public.devices where id in(select d.id from public.devices d where d.revoked_at<now()-interval '30 days' and not exists(select 1 from private.notification_jobs j where j.device_id=d.id) order by d.revoked_at limit 50);
 delete from private.notification_jobs where id in(select id from private.notification_jobs where state in('provider_accepted','failed','expired','canceled') and due_at<now()-interval '30 days' order by due_at limit 50);
 delete from public.notifications where id in(select n.id from public.notifications n where n.created_at<now()-interval '30 days' and not exists(select 1 from private.notification_jobs j where j.notification_id=n.id) order by n.created_at limit 50);
end;$$;
create function private.invoke_deletion_worker() returns void language plpgsql security definer set search_path='' as $$
declare v_url text;v_secret text;
begin
 perform private.expire_deletion_records();
 perform private.enqueue_pair_deletions();
 select decrypted_secret into v_url from vault.decrypted_secrets where name='deletion_function_url';
 select decrypted_secret into v_secret from vault.decrypted_secrets where name='deletion_worker_secret';
 if v_url is null or v_secret is null or char_length(v_secret)<32 then return;end if;
 perform net.http_post(url:=v_url,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_secret),body:='{}'::jsonb);
end;$$;
revoke all on function private.expire_deletion_records(),private.invoke_deletion_worker() from public,anon,authenticated;
select cron.schedule('deseo-process-deletions','* * * * *',$job$select private.invoke_deletion_worker();$job$);

create or replace function private.export_personal_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare v_pair uuid;v_actor uuid:=old.user_id;
begin
 if tg_table_name in('reminders','notifications','conversation_reads') then
  v_pair:=(to_jsonb(old)->>'pair_id')::uuid;
  if exists(select 1 from public.pairs p join private.deletion_jobs d on d.pair_ids @> array[p.id] where p.id=v_pair and p.state='ended' and d.state<>'completed') then return case when tg_op='DELETE' then old else new end;end if;
  update private.export_jobs j set state='canceled',error_code='SOURCE_CHANGED',lease_token=null,lease_until=null where j.requester_id=v_actor and j.pair_id=v_pair and j.state not in('canceled','expired');
  update private.export_parts p set state='cleanup',payload=null,source=null,cleanup_due=case when state='cleanup' then cleanup_due else now() end where p.job_id in(select j.id from private.export_jobs j where j.requester_id=v_actor and j.pair_id=v_pair and j.state in('canceled','expired'));
  return case when tg_op='DELETE' then old else new end;
 end if;
 if exists(select 1 from private.deletion_jobs where actor_id=v_actor and kind='account' and state<>'completed') then return case when tg_op='DELETE' then old else new end;end if;
 if tg_table_name='devices' and tg_op='UPDATE' then
  if (old.id,old.user_id,old.installation_id,old.platform,old.permission,old.revoked_at) is not distinct from (new.id,new.user_id,new.installation_id,new.platform,new.permission,new.revoked_at) then return new;end if;
 end if;
 perform private.cancel_account_exports(v_actor);
 if tg_table_name='profiles' then
  update private.export_jobs j set state='canceled',error_code='SOURCE_CHANGED',lease_token=null,lease_until=null where j.mode='current' and j.state not in('canceled','expired') and exists(select 1 from public.pair_members m where m.pair_id=j.pair_id and m.user_id=v_actor);
  update private.export_parts p set state='cleanup',payload=null,source=null,cleanup_due=case when state='cleanup' then cleanup_due else now() end where p.job_id in(select j.id from private.export_jobs j where j.state in('canceled','expired') and j.mode='current' and exists(select 1 from public.pair_members m where m.pair_id=j.pair_id and m.user_id=v_actor));
 end if;
 return case when tg_op='DELETE' then old else new end;
end;$$;
create or replace function private.export_valid(j private.export_jobs) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join auth.sessions s on s.user_id=p.user_id join auth.users u on u.id=p.user_id
 where p.user_id=j.requester_id and p.account_status='active' and s.id=j.session_id and (s.not_after is null or s.not_after>now())
 and u.deleted_at is null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now()))
 and not exists(select 1 from private.deletion_export_scopes s join private.deletion_jobs d on d.id=s.job_id where s.requester_id=j.requester_id and s.pair_id=j.pair_id and d.state<>'completed')
 and (j.mode='personal' or exists(select 1 from public.pairs p join public.pair_members m on m.pair_id=p.id
 where p.id=j.pair_id and m.user_id=j.requester_id and
 ((j.mode='current' and p.state='active' and m.left_at is null) or
 (j.mode='ended_author' and p.state='ended' and m.left_at is not null and p.purge_after>now()))));
$$;
create or replace function private.request_export(p_pair_id uuid,p_verification_proof text,p_command_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if exists(select 1 from private.deletion_export_scopes s join private.deletion_jobs d on d.id=s.job_id where s.requester_id=v_actor and s.pair_id=p_pair_id and d.state<>'completed') then return private.error('FORBIDDEN');end if;
 if not private.consume_verification_proof(v_actor,'export',p_verification_proof) then return private.error('FORBIDDEN'); end if;
 insert into private.export_jobs(requester_id,session_id,pair_id,mode,command_id) values(v_actor,v_session,p_pair_id,v_mode,p_command_id) returning * into j;
 return jsonb_build_object('ok',true,'data',private.export_status(j));
exception when sqlstate 'P0001' then return private.error(sqlerrm); end; $$;
create or replace function private.export_content_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.pairs p join private.deletion_jobs d on d.pair_ids @> array[p.id] where p.id=old.pair_id and p.state='ended' and d.state<>'completed') then return case when tg_op='DELETE' then old else new end;end if;
 -- Existing content commands hold profiles and pair before reaching this trigger.
 update private.export_jobs j set state='canceled',error_code='SOURCE_CHANGED',lease_token=null,lease_until=null
 where j.pair_id=old.pair_id and j.state not in('canceled','expired');
 update private.export_parts p set state='cleanup',payload=null,source=null,cleanup_due=case when state='cleanup' then cleanup_due else now() end
 where p.job_id in(select j.id from private.export_jobs j where j.pair_id=old.pair_id and j.state in('canceled','expired'));
 return case when tg_op='DELETE' then old else new end;
end; $$;

create function private.invoke_cleanup_worker() returns void language plpgsql security definer set search_path='' as $$
declare v_url text;v_secret text;
begin
 select decrypted_secret into v_url from vault.decrypted_secrets where name='cleanup_function_url';
 select decrypted_secret into v_secret from vault.decrypted_secrets where name='memory_cleanup_secret';
 if v_url is null or v_secret is null or char_length(v_secret)<32 then return;end if;
 perform net.http_post(url:=v_url,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_secret),body:='{}'::jsonb);
end;$$;
revoke all on function private.invoke_cleanup_worker() from public,anon,authenticated;
select cron.schedule('deseo-cleanup','* * * * *',$job$select private.invoke_cleanup_worker();$job$);
create or replace function private.claim_avatar_cleanup(p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare candidate record; upload private.avatar_uploads; jobs jsonb:='[]'; token uuid;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then return private.error('FORBIDDEN'); end if;
 if p_limit is null or p_limit not between 1 and 20 then return private.error('VALIDATION'); end if;
 for candidate in select id,user_id from private.avatar_uploads where state in('pending','cleanup') and due_at<=now() and (lease_until is null or lease_until<=now()) order by due_at,id limit 1 loop
  perform 1 from public.profiles where user_id=candidate.user_id for update;
  select * into upload from private.avatar_uploads where id=candidate.id and state in('pending','cleanup') and due_at<=now() and (lease_until is null or lease_until<=now()) for update skip locked;
  if not found then continue; end if;
  token:=gen_random_uuid(); update private.avatar_uploads set state='cleanup',lease_token=token,lease_until=now()+interval '5 minutes',attempts=attempts+1 where id=upload.id;
  jobs:=jobs||jsonb_build_array(jsonb_build_object('id',upload.id,'userId',upload.user_id,'path',upload.path,'bucket','avatars','leaseToken',token));
 end loop;
 return jsonb_build_object('ok',true,'data',jobs);
end; $$;
create or replace function public.claim_memory_cleanup(p_limit integer default 2) returns jsonb language sql security invoker set search_path='' as $$select private.claim_memory_cleanup(p_limit);$$;
