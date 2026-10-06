-- Importance: 100. RPCs and constraints must leave a delivery window for timed and all-day event reminders.
begin;
\ir fixtures/setup.sql.inc
select plan(20);
select pg_temp.as_user(1);
set local role authenticated;
select is(public.save_notification_preferences('{"messageAlerts":false,"defaultEventReminderMinutes":0,"timezone":"Europe/Warsaw"}',0)->'error'->>'code','VALIDATION','Default offset zero rejected');
select ok((public.save_notification_preferences('{"messageAlerts":false,"defaultEventReminderMinutes":null,"timezone":"Europe/Warsaw"}',0)->>'ok')::boolean,'No default reminder accepted');
select ok((public.save_notification_preferences('{"messageAlerts":false,"defaultEventReminderMinutes":15,"timezone":"Europe/Warsaw"}',1)->>'ok')::boolean,'Default 15 minutes accepted');
select ok((public.save_notification_preferences('{"messageAlerts":false,"defaultEventReminderMinutes":60,"timezone":"Europe/Warsaw"}',2)->>'ok')::boolean,'Default 60 minutes accepted');
select ok((public.save_notification_preferences('{"messageAlerts":false,"defaultEventReminderMinutes":1440,"timezone":"Europe/Warsaw"}',3)->>'ok')::boolean,'Default 1440 minutes accepted');
select public.register_device('{"installationId":"90000000-0000-4000-8000-000000000101","token":"ExpoPushToken[offset-fixture]","platform":"android","permission":"allowed"}');
reset role;
select throws_ok($$update public.notification_preferences set default_event_reminder_minutes=0 where user_id='10000000-0000-4000-8000-000000000001'$$,'23514',null,'Direct zero default violates constraint');
insert into public.events(id,pair_id,created_by,owner,visibility,title,timezone,starts_at,ends_at) values
 ('91000000-0000-4000-8000-000000000101','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','a','private','Timed','Europe/Warsaw',now()+interval '3 days',now()+interval '3 days 1 hour');
insert into public.events(id,pair_id,created_by,owner,visibility,title,timezone,start_date,end_date_exclusive) values
 ('91000000-0000-4000-8000-000000000102','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','a','private','All day','Europe/Warsaw',current_date+3,current_date+4);
create temporary table offset_sources as select jsonb_build_object('id','92000000-0000-4000-8000-'||lpad(n::text,12,'0'),
 'pairId','30000000-0000-4000-8000-000000000001','eventId','91000000-0000-4000-8000-'||lpad(n::text,12,'0'),'active',true) input,
 case n when 101 then 'Timed' else 'All-day' end kind from generate_series(101,102) n;
grant select on offset_sources to authenticated;
set local role authenticated;
select is(public.set_reminder(input||'{"minutesBefore":0}',gen_random_uuid())->'error'->>'code','VALIDATION',kind||' zero offset rejected') from offset_sources;
select ok((public.set_reminder(input||'{"minutesBefore":15}',gen_random_uuid())->>'ok')::boolean,kind||' 15-minute reminder accepted') from offset_sources;
select ok((public.set_reminder(input||'{"minutesBefore":60,"expectedVersion":1}',gen_random_uuid())->>'ok')::boolean,kind||' 60-minute reminder accepted') from offset_sources;
select ok((public.set_reminder(input||'{"minutesBefore":1440,"expectedVersion":2}',gen_random_uuid())->>'ok')::boolean,kind||' 1440-minute reminder accepted') from offset_sources;
reset role;
select throws_ok($$update public.reminders set minutes_before=0 where event_id='91000000-0000-4000-8000-000000000101'$$,'23514',null,'Direct timed zero offset violates constraint');
select throws_ok($$update public.reminders set minutes_before=0 where event_id='91000000-0000-4000-8000-000000000102'$$,'23514',null,'Direct all-day zero offset violates constraint');
select is((select j.due_at from private.notification_jobs j join public.notifications n on n.id=j.notification_id
 where n.source_id='91000000-0000-4000-8000-000000000101' and j.state='queued'),
 (select starts_at-interval '1 day' from public.events where id='91000000-0000-4000-8000-000000000101'),'Timed reminder precedes event start');
select is((select j.expires_at from private.notification_jobs j join public.notifications n on n.id=j.notification_id
 where n.source_id='91000000-0000-4000-8000-000000000101' and j.state='queued'),
 (select starts_at from public.events where id='91000000-0000-4000-8000-000000000101'),'Timed reminder expires at event start');
select is((select j.due_at from private.notification_jobs j join public.notifications n on n.id=j.notification_id
 where n.source_id='91000000-0000-4000-8000-000000000102' and j.state='queued'),
 (select (start_date+time '09:00') at time zone timezone-interval '1 day' from public.events where id='91000000-0000-4000-8000-000000000102'),'All-day reminder precedes local 09:00');
select is((select j.expires_at from private.notification_jobs j join public.notifications n on n.id=j.notification_id
 where n.source_id='91000000-0000-4000-8000-000000000102' and j.state='queued'),
 (select (start_date+time '09:00') at time zone timezone from public.events where id='91000000-0000-4000-8000-000000000102'),'All-day reminder expires at local 09:00');
select * from finish();
rollback;
