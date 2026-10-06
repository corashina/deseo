-- Importance: 100. Leases, access rechecks, cancellation, expiry, and receipts guard private delivery.
begin;
\ir fixtures/setup.sql.inc
select plan(81);
select has_table('public','notifications','public.notifications exists');
select has_table('private','notification_jobs','private.notification_jobs exists');
select ok(not has_table_privilege('authenticated','private.notification_jobs','SELECT'),'No client job access');
select ok(not has_function_privilege('authenticated','public.complete_job(uuid,uuid,jsonb)','EXECUTE'),'No client completion');
select ok(has_function_privilege('service_role','public.claim_due_jobs(integer,integer)','EXECUTE'),'Worker can claim');
select is(private.quiet_hours_end('2026-10-04 21:00Z','22:00','07:00','Europe/Warsaw'),'2026-10-05 05:00Z'::timestamptz,'Overnight quiet hours use recipient zone');
select is(private.quiet_hours_end('2026-10-04 10:00Z','22:00','07:00','Europe/Warsaw'),'2026-10-04 10:00Z'::timestamptz,'Outside quiet hours unchanged');
select is(private.quiet_hours_end('2026-03-29 00:30Z','01:00','02:30','Europe/Warsaw'),'2026-03-29 01:30Z'::timestamptz,'DST gap moves quiet end forward');
select is(private.quiet_hours_end('2026-10-25 00:15Z','01:00','02:30','Europe/Warsaw'),'2026-10-25 01:30Z'::timestamptz,'DST repeated quiet end uses standard time');
select pg_temp.as_user(1);
set local role authenticated;
select public.register_device('{"installationId":"90000000-0000-4000-8000-000000000001","token":"ExpoPushToken[jobs-one]","platform":"android","permission":"allowed"}');
select public.save_notification_preferences('{"messageAlerts":true,"timezone":"UTC"}',0);
reset role;
insert into public.events(id,pair_id,created_by,owner,visibility,title,timezone,starts_at,ends_at) values
 ('91000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','together','shared','Soon','UTC',now()+interval '15 minutes',now()+interval '1 hour');
set local role authenticated;
select public.set_reminder('{"id":"92000000-0000-4000-8000-000000000001","pairId":"30000000-0000-4000-8000-000000000001","eventId":"91000000-0000-4000-8000-000000000001","minutesBefore":15,"active":true}','93000000-0000-4000-8000-000000000001');
reset role;
select is((select count(*)::integer from public.notifications where pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')),1,'One app notification per source occurrence');
select is((select count(*)::integer from private.notification_jobs where notification_id in (select id from public.notifications where pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002'))),1,'One job per active device');
select public.refresh_notification_horizon();
select public.refresh_notification_horizon();
select is((select count(*)::integer from private.notification_jobs where notification_id in (select id from public.notifications where pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002'))),1,'Horizon refresh is idempotent');
create temporary table first_claim as select public.claim_due_jobs(5,120)->0 job;
select ok((select job->>'leaseId' is not null from first_claim),'Claim returns lease');
select is(jsonb_array_length(public.claim_due_jobs(5,120)),0,'Second worker cannot claim active lease');
select ok((select public.revalidate_notification_job((job->>'id')::uuid,(job->>'leaseId')::uuid) is not null from first_claim),'Claim rechecks source and account');
select is(public.complete_job((select (job->>'id')::uuid from first_claim),gen_random_uuid(),'{"status":"submitted","ticket":"forged"}')->>'ok','false','Wrong lease cannot complete');
select is((select public.complete_job((job->>'id')::uuid,(job->>'leaseId')::uuid,'{"status":"retry","code":"TIMEOUT"}')->>'ok' from first_claim),'true','Unknown provider outcome may retry');
select is((select due_at from private.notification_jobs where notification_id in (select id from public.notifications where pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')) limit 1),now()+interval '1 minute','First retry waits one minute');
update private.notification_jobs set due_at=now() where notification_id in (select id from public.notifications where pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002'));
create temporary table second_claim as select public.claim_due_jobs(5,120)->0 job;
select is((select job->>'attempt' from second_claim),'2','Retry increments attempt');
select public.complete_job((select (job->>'id')::uuid from second_claim),(select (job->>'leaseId')::uuid from second_claim),'{"status":"submitted","ticket":"fixture-ticket"}');
select is((select state from private.notification_jobs where notification_id in (select id from public.notifications where pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')) limit 1),'submitted','Ticket persisted as submitted');
select is(jsonb_array_length(public.claim_due_jobs(5,120)),0,'Known ticket is never sent again');
update private.notification_jobs set receipt_due_at=now() where notification_id in (select id from public.notifications where pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002'));
create temporary table receipt_claim as select public.claim_push_receipts(100,120)->0 job;
select is((select job->>'ticket' from receipt_claim),'fixture-ticket','Receipt claims the known ticket');
select is(jsonb_array_length(public.claim_push_receipts(100,120)),0,'Receipt lease excludes another worker');
select public.complete_push_receipt((select (job->>'id')::uuid from receipt_claim),(select (job->>'leaseId')::uuid from receipt_claim),'{"status":"accepted"}');
select is((select state from private.notification_jobs where notification_id in (select id from public.notifications where pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')) limit 1),'provider_accepted','Receipt acceptance is distinct from device display');
set local role authenticated;
select is(public.list_notifications()->'items'->0->>'state','provider_accepted','List reports provider state');
select is(public.resolve_notification((select id from public.notifications where pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002') limit 1))->'data'->>'kind','event','Authorized opaque ID resolves');
select is(public.resolve_notification(gen_random_uuid())->'error'->>'code','FORBIDDEN','Forged notification ID denied');
select pg_temp.as_user(3);
select is(jsonb_array_length(public.list_notifications()->'items'),0,'Other pair has no notification list');
reset role;
select pg_temp.as_user(1);
update public.events set starts_at=now()+interval '15 minutes',ends_at=now()+interval '2 hours',version=version+1 where id='91000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from private.notification_jobs where notification_id in (select id from public.notifications where pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')) and state='queued'),1,'Source edit creates a new source version job');
select is((select count(*)::integer from private.notification_jobs where notification_id in (select id from public.notifications where pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')) and state='provider_accepted'),1,'Source edit preserves known accepted ticket');
create temporary table edited_claim as select public.claim_due_jobs(5,120)->0 job;
update public.profiles set account_status='disabled' where user_id='10000000-0000-4000-8000-000000000001';
select ok((select public.revalidate_notification_job((job->>'id')::uuid,(job->>'leaseId')::uuid) is null from edited_claim),'Disabled account cannot send');
update public.profiles set account_status='active' where user_id='10000000-0000-4000-8000-000000000001';
update private.notification_jobs set due_at=now(),lease_id=null,lease_until=null where notification_id in (select id from public.notifications where pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')) and state='queued';
create temporary table session_claim as select public.claim_due_jobs(5,120)->0 job;
delete from auth.sessions where user_id='10000000-0000-4000-8000-000000000001';
select ok((select public.revalidate_notification_job((job->>'id')::uuid,(job->>'leaseId')::uuid) is null from session_claim),'Global signout blocks delivery even without device revoke');
insert into auth.sessions(id,user_id,created_at,updated_at) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',now(),now());
select public.refresh_notification_horizon();
update private.notification_jobs set due_at=now(),lease_id=null,lease_until=null where notification_id in (select id from public.notifications where pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')) and state='queued';
create temporary table revoked_claim as select public.claim_due_jobs(5,120)->0 job;
update public.pairs set state='ended',ended_at=now(),purge_after=now()+interval '30 days' where id='30000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from private.notification_jobs where notification_id in (select id from public.notifications where pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')) and state='queued'),0,'Pair closure cancels queued jobs in the transaction');
select ok((select public.revalidate_notification_job((job->>'id')::uuid,(job->>'leaseId')::uuid) is null from revoked_claim),'Claim cannot survive pair closure');
set local role authenticated;
select is(jsonb_array_length(public.list_notifications()->'items'),0,'Ended pair list is empty');
reset role;
-- A separate active pair proves leap-day horizon and private visibility cancellation.
select pg_temp.as_user(3);
set local role authenticated;
select public.register_device('{"installationId":"90000000-0000-4000-8000-000000000003","token":"ExpoPushToken[jobs-three]","platform":"ios","permission":"allowed"}');
reset role;
select is(private.yearly_date(2027,2,29),'2027-02-28'::date,'Leap day follows February 28 rule');
insert into public.events(id,pair_id,created_by,owner,visibility,title,timezone,start_date,end_date_exclusive,repeat,repeat_month,repeat_day,important_date)
 values('91000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','together','shared','Annual','Europe/Warsaw',current_date+10,current_date+11,'yearly',extract(month from current_date+10),extract(day from current_date+10),true);
set local role authenticated;
select public.set_reminder('{"id":"92000000-0000-4000-8000-000000000003","pairId":"30000000-0000-4000-8000-000000000002","eventId":"91000000-0000-4000-8000-000000000003","minutesBefore":60,"active":true}','93000000-0000-4000-8000-000000000003');
reset role;
select is((select count(*)::integer from public.notifications where source_id='91000000-0000-4000-8000-000000000003'),1,'Yearly occurrence materialized inside 90 days');
select is((select occurrence from public.notifications where source_id='91000000-0000-4000-8000-000000000003'),(current_date+10)::text,'Yearly key uses local occurrence date');
select is((select j.due_at at time zone 'Europe/Warsaw' from private.notification_jobs j join public.notifications n on n.id=j.notification_id where n.source_id='91000000-0000-4000-8000-000000000003'),(current_date+10)+time '08:00','All-day reminder derives from local 09:00');
select public.refresh_notification_horizon();
select is((select count(*)::integer from public.notifications where source_id='91000000-0000-4000-8000-000000000003'),1,'Rolling renewal does not duplicate occurrence');
update public.events set visibility='private',owner='b',version=version+1 where id='91000000-0000-4000-8000-000000000003';
select ok((select not active from public.reminders where id='92000000-0000-4000-8000-000000000003'),'Private source disables partner reminder');
select is((select count(*)::integer from private.notification_jobs j join public.notifications n on n.id=j.notification_id where n.source_id='91000000-0000-4000-8000-000000000003' and j.state='queued'),0,'Private source leaves no queued partner job');
-- Simulate elapsed time by moving the fixture's original due instant into the past.
insert into public.events(id,pair_id,created_by,owner,visibility,title,timezone,starts_at,ends_at) values
 ('91000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','a','private','Deferred reminder','UTC',now()+interval '15 minutes',now()+interval '1 hour'),
 ('91000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','a','private','New past reminder','UTC',now()+interval '10 minutes',now()+interval '1 hour');
set local role authenticated;
select public.save_notification_preferences(jsonb_build_object('messageAlerts',true,'timezone','UTC',
 'quietStart',to_char((now() at time zone 'UTC')-interval '1 hour','HH24:MI'),
 'quietEnd',to_char((now() at time zone 'UTC')+interval '3 minutes','HH24:MI')),0);
select public.set_reminder('{"id":"92000000-0000-4000-8000-000000000006","pairId":"30000000-0000-4000-8000-000000000002","eventId":"91000000-0000-4000-8000-000000000006","minutesBefore":15,"active":true}','93000000-0000-4000-8000-000000000006');
reset role;
select is(jsonb_array_length(public.claim_due_jobs(5,120)),0,'Quiet hours defer a due event reminder');
update public.events set starts_at=now()+interval '10 minutes' where id='91000000-0000-4000-8000-000000000006';
set local role authenticated;
select public.register_device('{"installationId":"90000000-0000-4000-8000-000000000003","token":"ExpoPushToken[reminder-rotated]","platform":"ios","permission":"allowed"}');
reset role;
select is((select state from private.notification_jobs j join public.notifications n on n.id=j.notification_id where n.source_id='91000000-0000-4000-8000-000000000006'),'queued','Token rotation preserves overdue but unexpired reminder');
select is((select count(*)::integer from private.notification_jobs j join public.notifications n on n.id=j.notification_id where n.source_id='91000000-0000-4000-8000-000000000006'),1,'Deferred reminder keeps the same delivery key');
set local role authenticated;
select public.save_notification_preferences(jsonb_build_object('messageAlerts',true,'timezone','UTC',
 'quietStart',to_char((now() at time zone 'UTC')-interval '1 hour','HH24:MI'),
 'quietEnd',to_char((now() at time zone 'UTC')+interval '2 minutes','HH24:MI')),1);
reset role;
select is((select state from private.notification_jobs j join public.notifications n on n.id=j.notification_id where n.source_id='91000000-0000-4000-8000-000000000006'),'queued','Quiet-hour edit preserves the overdue reminder');
select is(jsonb_array_length(public.claim_due_jobs(5,120)),0,'Changed quiet window is rechecked before send');
set local role authenticated;
select is(public.set_reminder('{"id":"92000000-0000-4000-8000-000000000007","pairId":"30000000-0000-4000-8000-000000000002","eventId":"91000000-0000-4000-8000-000000000007","minutesBefore":15,"active":true}','93000000-0000-4000-8000-000000000007')->'data'->>'state','past','A new past reminder remains past');
reset role;
select is((select count(*)::integer from public.notifications where source_id='91000000-0000-4000-8000-000000000007'),0,'A new past reminder creates no delivery');
set local role authenticated;
select public.set_reminder('{"id":"92000000-0000-4000-8000-000000000006","pairId":"30000000-0000-4000-8000-000000000002","eventId":"91000000-0000-4000-8000-000000000006","minutesBefore":null,"active":false,"expectedVersion":1}','93000000-0000-4000-8000-000000000016');
select public.save_notification_preferences('{"messageAlerts":true,"timezone":"UTC"}',2);
reset role;
select is((select count(*)::integer from private.notification_jobs where notification_id in (select id from public.notifications where pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')) and state='queued'),0,'Disabled deferral cannot regenerate');
insert into public.tasks(id,pair_id,list_id,title,created_by,due_date)
select '94000000-0000-4000-8000-000000000003',pair_id,id,'Task reminder','10000000-0000-4000-8000-000000000003',current_date+1
from public.task_lists where pair_id='30000000-0000-4000-8000-000000000002' and is_general;
set local role authenticated;
select public.set_reminder(jsonb_build_object('id','92000000-0000-4000-8000-000000000004','pairId','30000000-0000-4000-8000-000000000002',
 'taskId','94000000-0000-4000-8000-000000000003','remindAt',now(),'active',true),'93000000-0000-4000-8000-000000000004');
reset role;
create temporary table crash_claim as select public.claim_due_jobs(5,120)->0 job;
select ok((select job is not null from crash_claim),'Task reminder can be claimed');
update private.notification_jobs set lease_until=now()-interval '1 second' where id=(select (job->>'id')::uuid from crash_claim);
create temporary table reclaimed as select public.claim_due_jobs(5,120)->0 job;
select isnt((select job->>'leaseId' from reclaimed),(select job->>'leaseId' from crash_claim),'Expired crash lease is replaced');
select is((select job->>'attempt' from reclaimed),'2','Reclaim counts an uncertain submission attempt');
select is(public.complete_job((select (job->>'id')::uuid from crash_claim),(select (job->>'leaseId')::uuid from crash_claim),'{"status":"failed","code":"OLD"}')->>'ok','false','Old worker cannot complete reclaimed lease');
select public.complete_job((select (job->>'id')::uuid from reclaimed),(select (job->>'leaseId')::uuid from reclaimed),'{"status":"retry","code":"HTTP_503"}');
select is((select due_at from private.notification_jobs where id=(select (job->>'id')::uuid from reclaimed)),now()+interval '5 minutes','Second attempt waits five minutes');
update private.notification_jobs set due_at=now() where id=(select (job->>'id')::uuid from reclaimed);
create temporary table third_claim as select public.claim_due_jobs(5,120)->0 job;
select public.complete_job((select (job->>'id')::uuid from third_claim),(select (job->>'leaseId')::uuid from third_claim),'{"status":"retry","code":"HTTP_503"}');
select is((select due_at from private.notification_jobs where id=(select (job->>'id')::uuid from third_claim)),now()+interval '15 minutes','Third attempt waits fifteen minutes');
update private.notification_jobs set due_at=now() where id=(select (job->>'id')::uuid from reclaimed);
create temporary table fourth_claim as select public.claim_due_jobs(5,120)->0 job;
select public.complete_job((select (job->>'id')::uuid from fourth_claim),(select (job->>'leaseId')::uuid from fourth_claim),'{"status":"retry","code":"TIMEOUT"}');
select is((select state from private.notification_jobs where id=(select (job->>'id')::uuid from fourth_claim)),'failed','Fourth failed attempt terminates retries');
update public.tasks set title='Changed',version=version+1 where id='94000000-0000-4000-8000-000000000003';
select is((select count(*)::integer from private.notification_jobs where notification_id in (select id from public.notifications where pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')) and state='queued'),1,'Task edit refreshes its version job');
update public.tasks set completed_at=now(),completed_by=created_by,version=version+1 where id='94000000-0000-4000-8000-000000000003';
select is((select count(*)::integer from private.notification_jobs where notification_id in (select id from public.notifications where pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')) and state='queued'),0,'Completion cancels unsent task jobs');
set local role authenticated;
select is(public.set_reminder('{"id":"92000000-0000-4000-8000-000000000004","pairId":"30000000-0000-4000-8000-000000000002","taskId":"94000000-0000-4000-8000-000000000003","active":false,"remindAt":null,"expectedVersion":2}',
 '93000000-0000-4000-8000-000000000005')->'data'->>'state','off','Completed task accepts explicit off with no schedule');
select public.save_notification_preferences(jsonb_build_object('messageAlerts',true,'timezone','UTC',
 'quietStart',to_char((now() at time zone 'UTC')-interval '1 hour','HH24:MI'),
 'quietEnd',to_char((now() at time zone 'UTC')+interval '1 hour','HH24:MI')),(public.get_notification_preferences()->'data'->>'version')::integer);
reset role;
insert into public.messages(id,pair_id,author_id,client_id,body,payload_hash,created_at) values
 ('95000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004',
 '96000000-0000-4000-8000-000000000003','Private text',extensions.digest('Private text','sha256'),now());
select is((select count(*)::integer from public.notifications where pair_id='30000000-0000-4000-8000-000000000002' and kind='message'),1,'Opted-in partner receives one message notification');
select is(jsonb_array_length(public.claim_due_jobs(5,120)),0,'Quiet hours defer the pending message');
select is((select attempt from private.notification_jobs j join public.notifications n on n.id=j.notification_id where n.pair_id='30000000-0000-4000-8000-000000000002' and n.kind='message'),0,'Quiet deferral consumes no provider attempt');
set local role authenticated;
select public.register_device('{"installationId":"90000000-0000-4000-8000-000000000003","token":"ExpoPushToken[jobs-three-rotated]","platform":"ios","permission":"allowed"}');
reset role;
select is((select count(*)::integer from public.notifications where pair_id='30000000-0000-4000-8000-000000000002' and kind='message'),1,'Token rotation preserves the app notification');
select is((select count(*)::integer from private.notification_jobs j join public.notifications n on n.id=j.notification_id where n.pair_id='30000000-0000-4000-8000-000000000002' and n.kind='message'),1,'Token rotation updates the existing delivery key');
select is((select state from private.notification_jobs j join public.notifications n on n.id=j.notification_id where n.pair_id='30000000-0000-4000-8000-000000000002' and n.kind='message'),'queued','Token rotation keeps the deferred message deliverable');
update public.profiles set timezone='Europe/Warsaw' where user_id='10000000-0000-4000-8000-000000000003';
select is((select state from private.notification_jobs j join public.notifications n on n.id=j.notification_id where n.pair_id='30000000-0000-4000-8000-000000000002' and n.kind='message'),'queued','Profile timezone change preserves the pending message');
set local role authenticated;
select public.save_notification_preferences('{"messageAlerts":true,"timezone":"UTC"}',(public.get_notification_preferences()->'data'->>'version')::integer);
reset role;
create temporary table message_claim as select public.claim_due_jobs(5,120)->0 job;
select is((select job->>'token' from message_claim),'ExpoPushToken[jobs-three-rotated]','Claim uses the replacement token');
select ok((select not (job ? 'body') and not (job ? 'sourceId') from message_claim),'Worker payload exposes no message body or source ID');
select public.complete_job((select (job->>'id')::uuid from message_claim),(select (job->>'leaseId')::uuid from message_claim),'{"status":"submitted","ticket":"message-ticket"}');
update public.profiles set timezone='America/New_York' where user_id='10000000-0000-4000-8000-000000000003';
select is((select count(*)::integer from private.notification_jobs j join public.notifications n on n.id=j.notification_id where n.pair_id='30000000-0000-4000-8000-000000000002' and n.kind='message' and j.state='queued'),0,'Timezone change never resubmits a known ticket');
update private.notification_jobs set receipt_due_at=now() where provider_ticket='message-ticket';
create temporary table invalid_receipt as select public.claim_push_receipts(100,120)->0 job;
select public.complete_push_receipt((select (job->>'id')::uuid from invalid_receipt),(select (job->>'leaseId')::uuid from invalid_receipt),'{"status":"device_not_registered"}');
select ok((select revoked_at is not null and expo_token is null from public.devices where installation_id='90000000-0000-4000-8000-000000000003'),'Invalid provider token is revoked');
select is((select state from private.notification_jobs where provider_ticket='message-ticket'),'failed','Invalid token receipt is terminal');
update public.messages set body=null,deleted_at=now(),pinned_at=null,version=version+1 where id='95000000-0000-4000-8000-000000000003';
set local role authenticated;
select is(public.resolve_notification((select id from public.notifications where pair_id='30000000-0000-4000-8000-000000000002' and kind='message'))->'error'->>'code','FORBIDDEN','Deleted message has no allowed destination');
reset role;
insert into public.events(id,pair_id,created_by,owner,visibility,title,timezone,start_date,end_date_exclusive,repeat,repeat_month,repeat_day,important_date)
 values('91000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','a','private','Outside horizon','Europe/Warsaw',current_date+100,current_date+101,'yearly',extract(month from current_date+100),extract(day from current_date+100),true);
insert into public.reminders(id,user_id,pair_id,event_id,minutes_before,active) values
 ('92000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000005',60,true);
select is((select count(*)::integer from public.notifications where source_id='91000000-0000-4000-8000-000000000005'),0,'Yearly horizon excludes day 100');
select ok(not has_function_privilege('authenticated','public.refresh_notification_horizon()','EXECUTE'),'Client cannot run horizon worker');
select ok(not has_function_privilege('anon','public.complete_push_receipt(uuid,uuid,jsonb)','EXECUTE'),'Anon cannot forge receipt');
select ok(not has_table_privilege('anon','public.notifications','SELECT'),'Anon cannot read notifications');
select ok(not has_table_privilege('authenticated','public.notifications','UPDATE'),'Client cannot forge delivery or read state');
select ok(not has_function_privilege('anon','public.resolve_notification(uuid)','EXECUTE'),'Anon cannot resolve opaque IDs');
select ok(not has_function_privilege('authenticated','private.checked_notification_job(uuid,uuid)','EXECUTE'),'Private worker helper is restricted');
select is((select count(*)::integer from cron.job where jobname in('deseo-dispatch-notifications','deseo-check-push-receipts','deseo-notification-horizon')),3,'Minute workers and daily horizon are scheduled');
select * from finish();
rollback;
