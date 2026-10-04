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
using(user_id=(select private.active_actor()) and private.is_member(pair_id) and available_at<=now());

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
   and (not p_check_version or e.version=n.source_version) and (e.visibility='shared' or e.created_by=n.user_id))
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
 local_today date; year integer; candidate date;
begin
 select * into r from public.reminders where id=p_id;
 if not found then return; end if;
 if not r.active or not private.notification_member(r.user_id,r.pair_id) then return; end if;
 if r.task_id is not null then
   select * into t from public.tasks where id=r.task_id and pair_id=r.pair_id and completed_at is null;
   if not found then return; end if;
   perform private.enqueue_notification(r.user_id,r.pair_id,'task',t.id,(r.remind_at at time zone
     (select timezone from public.pairs where id=r.pair_id))::date::text,t.version,r.id,r.version,r.remind_at,r.remind_at+interval '1 day');
 else
   select * into e from public.events where id=r.event_id and pair_id=r.pair_id and (visibility='shared' or created_by=r.user_id);
   if not found then return; end if;
   if e.repeat='yearly' then
     local_today:=(now() at time zone e.timezone)::date;
     for year in extract(year from local_today)::integer..extract(year from local_today+90)::integer loop
       candidate:=private.yearly_date(year,e.repeat_month,e.repeat_day);
       if candidate>=local_today and candidate<=local_today+90 then
         starts:=(candidate+time '09:00') at time zone e.timezone;
         perform private.enqueue_notification(r.user_id,r.pair_id,'event',e.id,candidate::text,e.version,r.id,r.version,
           starts-make_interval(mins=>r.minutes_before),starts);
       end if;
     end loop;
   else
     starts:=coalesce(e.starts_at,(e.start_date+time '09:00') at time zone e.timezone);
     occurrence:=coalesce(e.start_date,(e.starts_at at time zone e.timezone)::date);
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
     if new.visibility='private' then
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
