-- Yearly reminders counted years before the Event start date. Reminder state and reminder jobs now start at start_date.
-- private.list_agenda in 20261114150000 applies the same rule to the agenda.

create or replace function private.reminder_json(r public.reminders) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare next_due timestamptz; e public.events; occurrence date; local_today date; year integer;
begin
 if r.task_id is not null then next_due:=r.remind_at;
 else
   select * into e from public.events where id=r.event_id;
   if e.repeat='yearly' then
     local_today:=(now() at time zone e.timezone)::date;
     year:=greatest(extract(year from local_today),extract(year from e.start_date))::integer;
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

create or replace function private.refresh_reminder(p_id uuid) returns void
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
       if candidate>=greatest(local_today,e.start_date) and candidate<=local_today+90 then
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

