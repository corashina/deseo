\ir worker-backlog-pair.sql.inc
select pg_temp.as_user(5);
set local role authenticated;
select public.register_device('{"installationId":"90000000-0000-4000-8000-000000000005","token":"ExpoPushToken[backlog-five]","platform":"android","permission":"allowed"}');
select public.save_notification_preferences('{"messageAlerts":true,"timezone":"UTC"}',0);
reset role;
insert into public.events(id,pair_id,created_by,who,title,starts_at,ends_at)
select ('91000000-0000-4000-8003-'||lpad(n::text,12,'0'))::uuid,
 '30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000005','private','Backlog',
 now()+interval '15 minutes',now()+interval '1 hour' from generate_series(1,120) n;
insert into public.reminders(id,user_id,pair_id,event_id,minutes_before,active)
select ('92000000-0000-4000-8003-'||lpad(n::text,12,'0'))::uuid,
 '10000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000003',
 ('91000000-0000-4000-8003-'||lpad(n::text,12,'0'))::uuid,15,true from generate_series(1,120) n;
update private.notification_jobs j set due_at=now()-interval '1 hour',
 state=case when right(n.source_id::text,12)::integer>60 then 'submitted' else 'queued' end,
 provider_ticket=case when right(n.source_id::text,12)::integer>60 then 'backlog-'||j.id else null end,
 submitted_at=case when right(n.source_id::text,12)::integer>60 then now() else null end,
 receipt_due_at=case when right(n.source_id::text,12)::integer>60 then now()-interval '1 hour' else null end
from public.notifications n where n.id=j.notification_id and n.pair_id='30000000-0000-4000-8000-000000000003';

-- Priority applies only to already eligible owned fixtures. Future jobs and active leases keep their times.
create function pg_temp.claim_fixture_notifications(p_limit integer,p_lease_seconds integer,p_receipts boolean default false,p_prioritize boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_receipts then
  if p_prioritize then
  update private.notification_jobs j set receipt_due_at='-infinity' from public.notifications n
  where n.id=j.notification_id and n.pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')
  and j.state='submitted' and j.provider_ticket is not null and j.receipt_due_at<=now()
  and (j.lease_until is null or j.lease_until<=now());
  end if;
  result:=public.claim_push_receipts(p_limit,p_lease_seconds);
 else
  if p_prioritize then
  update private.notification_jobs j set due_at='-infinity' from public.notifications n, public.devices d, public.profiles profile
  where n.id=j.notification_id and d.id=j.device_id and profile.user_id=n.user_id
  and n.pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')
  and j.state='queued' and j.due_at<=now() and j.expires_at>now() and j.attempt<4
  and (j.lease_until is null or j.lease_until<=now()) and profile.account_status='active'
  and d.revoked_at is null and d.permission='allowed' and d.expo_token is not null
  and exists(select 1 from auth.sessions s where s.id=d.session_id and s.user_id=n.user_id)
  and private.notification_source_allowed(n);
  end if;
  result:=public.claim_due_jobs(p_limit,p_lease_seconds);
 end if;
 return (select coalesce(jsonb_agg(item),'[]'::jsonb) from jsonb_array_elements(result) item
 join private.notification_jobs j on j.id=(item->>'id')::uuid join public.notifications n on n.id=j.notification_id
 where n.pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002'));
end; $$;
