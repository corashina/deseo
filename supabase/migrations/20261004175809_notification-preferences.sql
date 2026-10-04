create table public.notification_preferences (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  message_alerts boolean not null default false,
  default_event_reminder_minutes integer check(default_event_reminder_minutes in(0,15,60,1440)),
  quiet_start time, quiet_end time,
  timezone text not null,
  version integer not null default 1 check(version>0),
  check((quiet_start is null and quiet_end is null) or
    (quiet_start is not null and quiet_end is not null and quiet_start<>quiet_end))
);
create trigger notification_preferences_timezone before insert or update on public.notification_preferences
for each row execute function private.check_timezone();

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  installation_id uuid not null unique,
  session_id uuid not null,
  expo_token text unique,
  platform text not null check(platform in('ios','android')),
  permission text not null check(permission in('allowed','denied','not_requested')),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  version integer not null default 1,
  check(expo_token is null or (char_length(expo_token)<=256 and expo_token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$')),
  check(permission='allowed' or expo_token is null)
);
create index devices_account on public.devices(user_id) where revoked_at is null;

create table public.reminders (
  id uuid primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  pair_id uuid not null references public.pairs(id) on delete cascade,
  event_id uuid, task_id uuid,
  minutes_before integer,
  remind_at timestamptz,
  active boolean not null,
  version integer not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  foreign key(pair_id,event_id) references public.events(pair_id,id) on delete cascade,
  foreign key(pair_id,task_id) references public.tasks(pair_id,id) on delete cascade,
  foreign key(pair_id,user_id) references public.pair_members(pair_id,user_id),
  check((event_id is not null and task_id is null and (not active or minutes_before is not null)
      and (minutes_before is null or minutes_before in(0,15,60,1440)) and remind_at is null)
    or (task_id is not null and event_id is null and minutes_before is null and (not active or remind_at is not null))),
  unique(user_id,event_id), unique(user_id,task_id)
);
create index reminders_pair on public.reminders(pair_id);
create index reminders_event on public.reminders(event_id) where event_id is not null;
create index reminders_task on public.reminders(task_id) where task_id is not null;
alter table public.notification_preferences enable row level security;
alter table public.devices enable row level security;
alter table public.reminders enable row level security;
revoke all on public.notification_preferences,public.devices,public.reminders from public,anon,authenticated;
grant select on public.notification_preferences,public.reminders to authenticated;
grant select(id,user_id,installation_id,platform,permission,last_seen_at,revoked_at,version) on public.devices to authenticated;
grant all on public.notification_preferences,public.devices,public.reminders to service_role;
create policy own_preferences on public.notification_preferences for select to authenticated using(user_id=(select private.active_actor()));
create policy own_devices on public.devices for select to authenticated using(user_id=(select private.active_actor()));
create policy own_reminders on public.reminders for select to authenticated
using(user_id=(select private.active_actor()) and private.is_member(pair_id) and
  (event_id is null or exists(select 1 from public.events e where e.id=event_id)));

create function private.preferences_json(p public.notification_preferences) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('messageAlerts',p.message_alerts,'defaultEventReminderMinutes',p.default_event_reminder_minutes,
 'quietStart',left(p.quiet_start::text,5),'quietEnd',left(p.quiet_end::text,5),'timezone',p.timezone,'version',p.version);
$$;
create function private.get_notification_preferences() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor(); p public.notification_preferences;
begin
 select * into p from public.notification_preferences where user_id=actor;
 if not found then
   return jsonb_build_object('ok',true,'data',jsonb_build_object('messageAlerts',false,'defaultEventReminderMinutes',null,
     'quietStart',null,'quietEnd',null,'timezone',(select timezone from public.profiles where user_id=actor),'version',0));
 end if;
 return jsonb_build_object('ok',true,'data',private.preferences_json(p));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end; $$;
create function private.save_notification_preferences(p_input jsonb,p_expected_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor(); p public.notification_preferences; current_version integer;
begin
 perform 1 from public.profiles where user_id=actor for update;
 perform private.require_actor();
 select * into p from public.notification_preferences where user_id=actor for update;
 current_version:=coalesce(p.version,0);
 if p_expected_version is distinct from current_version then return private.error('CONFLICT'); end if;
 if jsonb_typeof(p_input->'messageAlerts') is distinct from 'boolean'
   or coalesce(p_input->>'timezone','')='' then return private.error('VALIDATION'); end if;
 if (p_input->>'quietStart') is not null and (p_input->>'quietStart') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
   or (p_input->>'quietEnd') is not null and (p_input->>'quietEnd') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return private.error('VALIDATION'); end if;
 insert into public.notification_preferences(user_id,message_alerts,default_event_reminder_minutes,quiet_start,quiet_end,timezone,version)
 values(actor,(p_input->>'messageAlerts')::boolean,(p_input->>'defaultEventReminderMinutes')::integer,
 (p_input->>'quietStart')::time,(p_input->>'quietEnd')::time,p_input->>'timezone',current_version+1)
 on conflict(user_id) do update set message_alerts=excluded.message_alerts,
 default_event_reminder_minutes=excluded.default_event_reminder_minutes,quiet_start=excluded.quiet_start,
 quiet_end=excluded.quiet_end,timezone=excluded.timezone,version=excluded.version returning * into p;
 return jsonb_build_object('ok',true,'data',private.preferences_json(p));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
 when invalid_text_representation or check_violation or not_null_violation or datetime_field_overflow then return private.error('VALIDATION');
end; $$;

create function private.register_device(p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor(); installation uuid:=(p_input->>'installationId')::uuid;
 token text:=p_input->>'token'; permission_state text:=p_input->>'permission'; device_id uuid;
begin
 if installation is null or permission_state not in('allowed','denied','not_requested')
   or coalesce(p_input->>'platform','') not in('ios','android')
   or permission_state='allowed' and token is null
   or permission_state<>'allowed' and token is not null then return private.error('VALIDATION'); end if;
 -- Serialize token transfers before locking affected accounts in stable order.
 perform pg_advisory_xact_lock(57005,8);
 perform 1 from public.profiles where user_id=actor or user_id in
   (select user_id from public.devices where installation_id=installation or expo_token=token) order by user_id for update;
 perform private.require_actor();
 update public.devices set revoked_at=now(),expo_token=null,version=version+1
 where expo_token=token and installation_id<>installation;
 insert into public.devices(user_id,installation_id,session_id,expo_token,platform,permission)
 values(actor,installation,(auth.jwt()->>'session_id')::uuid,token,p_input->>'platform',permission_state)
 on conflict(installation_id) do update set user_id=excluded.user_id,session_id=excluded.session_id,
 expo_token=excluded.expo_token,platform=excluded.platform,permission=excluded.permission,last_seen_at=now(),
 revoked_at=null,version=public.devices.version+case when
 (public.devices.user_id,public.devices.session_id,public.devices.expo_token,public.devices.permission,public.devices.revoked_at)
 is distinct from (excluded.user_id,excluded.session_id,excluded.expo_token,excluded.permission,null::timestamptz) then 1 else 0 end
 returning id into device_id;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('deviceId',device_id));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
 when invalid_text_representation or check_violation or not_null_violation then return private.error('VALIDATION');
end; $$;
create function private.revoke_device(p_installation_id uuid,p_all boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor();
begin
 perform 1 from public.profiles where user_id=actor for update;
 perform private.require_actor();
 update public.devices set revoked_at=now(),expo_token=null,version=version+1
 where user_id=actor and revoked_at is null and (p_all or installation_id=p_installation_id);
 return jsonb_build_object('ok',true,'data',jsonb_build_object('revoked',true));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end; $$;

create function private.reminder_json(r public.reminders) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare next_due timestamptz; e public.events; occurrence date; local_today date; year integer;
begin
 if r.task_id is not null then next_due:=r.remind_at;
 else
   select * into e from public.events where id=r.event_id;
   if e.repeat='yearly' then
     local_today:=(now() at time zone e.timezone)::date;
     year:=extract(year from local_today)::integer;
     occurrence:=private.yearly_date(year,e.repeat_month,e.repeat_day);
     next_due:=(occurrence+time '09:00') at time zone e.timezone-make_interval(mins=>r.minutes_before);
     if next_due<=now() then
       occurrence:=private.yearly_date(year+1,e.repeat_month,e.repeat_day);
       next_due:=(occurrence+time '09:00') at time zone e.timezone-make_interval(mins=>r.minutes_before);
     end if;
   else
     next_due:=coalesce(e.starts_at,(e.start_date+time '09:00') at time zone e.timezone)-make_interval(mins=>r.minutes_before);
   end if;
 end if;
 return jsonb_build_object('id',r.id,'pairId',r.pair_id,'eventId',r.event_id,'taskId',r.task_id,
   'minutesBefore',r.minutes_before,'remindAt',r.remind_at,'active',r.active,'version',r.version,
   'state',case when not r.active then 'off' when next_due<=now() then 'past' else 'scheduled' end,
   'nextDueAt',case when r.active and next_due>now() then next_due else null end);
end; $$;
create function private.set_reminder(p_input jsonb,p_command_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor(); pair uuid:=(p_input->>'pairId')::uuid; r public.reminders;
 event uuid:=(p_input->>'eventId')::uuid; task uuid:=(p_input->>'taskId')::uuid; reminder_id uuid:=(p_input->>'id')::uuid; replay jsonb;
begin
 perform private.lock_pair(pair,actor);
 if not private.is_member(pair) then return private.error('FORBIDDEN'); end if;
 if (event is null)=(task is null) or reminder_id is null or jsonb_typeof(p_input->'active') is distinct from 'boolean'
 then return private.error('VALIDATION'); end if;
 if event is not null and not exists(select 1 from public.events where id=event and pair_id=pair
   and (visibility='shared' or created_by=actor)) then return private.error('FORBIDDEN'); end if;
 if task is not null and not exists(select 1 from public.tasks where id=task and pair_id=pair
   and (completed_at is null or (p_input->>'active')::boolean=false))
 then return private.error('FORBIDDEN'); end if;
 select * into r from public.reminders where id=reminder_id for update;
 if found and (r.user_id<>actor or r.pair_id<>pair or r.event_id is distinct from event or r.task_id is distinct from task)
 then return private.error('FORBIDDEN'); end if;
 replay:=private.receipt(actor,p_command_id,'set_reminder',p_input);
 if replay is not null then return replay; end if;
 if r.id is not null and r.version is distinct from (p_input->>'expectedVersion')::integer then return private.error('CONFLICT'); end if;
 if r.id is null and p_input->>'expectedVersion' is not null then return private.error('CONFLICT'); end if;
 insert into public.reminders(id,user_id,pair_id,event_id,task_id,minutes_before,remind_at,active,version)
 values(reminder_id,actor,pair,event,task,(p_input->>'minutesBefore')::integer,(p_input->>'remindAt')::timestamptz,
 (p_input->>'active')::boolean,coalesce(r.version,0)+1)
 on conflict(id) do update set minutes_before=excluded.minutes_before,remind_at=excluded.remind_at,
 active=excluded.active,version=excluded.version returning * into r;
 return private.save_receipt(actor,p_command_id,'set_reminder',pair,p_input,private.reminder_json(r));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
 when unique_violation then return private.error('CONFLICT');
 when invalid_text_representation or check_violation or not_null_violation or datetime_field_overflow then return private.error('VALIDATION');
end; $$;
create function private.get_reminder(p_event_id uuid,p_task_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_actor(); r public.reminders;
begin
 if (p_event_id is null)=(p_task_id is null) then return private.error('VALIDATION'); end if;
 select * into r from public.reminders where user_id=actor and
 (event_id=p_event_id or task_id=p_task_id) and private.is_member(pair_id)
 and (event_id is null or exists(select 1 from public.events e where e.id=event_id and (e.visibility='shared' or e.created_by=actor)));
 return jsonb_build_object('ok',true,'data',case when r.id is null then null else private.reminder_json(r) end);
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end; $$;

create function public.get_notification_preferences() returns jsonb language sql security invoker set search_path='' as $$select private.get_notification_preferences();$$;
create function public.save_notification_preferences(p_input jsonb,p_expected_version integer) returns jsonb language sql security invoker set search_path='' as $$select private.save_notification_preferences(p_input,p_expected_version);$$;
create function public.register_device(p_input jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.register_device(p_input);$$;
create function public.revoke_device(p_installation_id uuid,p_all boolean default false) returns jsonb language sql security invoker set search_path='' as $$select private.revoke_device(p_installation_id,p_all);$$;
create function public.set_reminder(p_input jsonb,p_command_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.set_reminder(p_input,p_command_id);$$;
create function public.get_reminder(p_event_id uuid,p_task_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.get_reminder(p_event_id,p_task_id);$$;
revoke all on function private.preferences_json(public.notification_preferences),private.reminder_json(public.reminders) from public,anon,authenticated;
revoke all on function private.get_notification_preferences(),public.get_notification_preferences(),
 private.save_notification_preferences(jsonb,integer),public.save_notification_preferences(jsonb,integer),
 private.register_device(jsonb),public.register_device(jsonb),private.revoke_device(uuid,boolean),public.revoke_device(uuid,boolean),
 private.set_reminder(jsonb,uuid),public.set_reminder(jsonb,uuid),private.get_reminder(uuid,uuid),public.get_reminder(uuid,uuid)
 from public,anon,authenticated;
grant execute on function private.get_notification_preferences(),public.get_notification_preferences(),
 private.save_notification_preferences(jsonb,integer),public.save_notification_preferences(jsonb,integer),
 private.register_device(jsonb),public.register_device(jsonb),private.revoke_device(uuid,boolean),public.revoke_device(uuid,boolean),
 private.set_reminder(jsonb,uuid),public.set_reminder(jsonb,uuid),private.get_reminder(uuid,uuid),public.get_reminder(uuid,uuid)
 to authenticated;
