\ir worker-backlog-pair.sql.inc
insert into public.memories(id,pair_id,created_by,memory_date,state)
select ('40000000-0000-4000-8003-'||lpad(n::text,12,'0'))::uuid,
 '30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000005',current_date,
 case when n<=120 then 'pending' else 'deleting' end from generate_series(1,240) n;
insert into private.memory_reservations(memory_id,pair_id,bytes,expires_at)
select id,pair_id,1,case when state='pending' then now()-interval '2 days' else now()+interval '1 day' end
from public.memories where pair_id='30000000-0000-4000-8000-000000000003';
insert into private.memory_cleanup_jobs(memory_id,pair_id,paths,due_at)
select id,pair_id,'{}'::text[],now()-interval '1 day' from public.memories
where pair_id='30000000-0000-4000-8000-000000000003' and state='deleting';

-- Change only eligible fixtures. Worker limits, leases, errors, and authority checks remain real.
create function pg_temp.claim_fixture_memory(p_limit integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; owned jsonb;
begin
 update private.memory_reservations r set expires_at='-infinity'
 from public.memories m where m.id=r.memory_id and m.state='pending' and r.released_at is null and r.expires_at<=now()
 and m.pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002');
 update private.memory_cleanup_jobs set due_at='-infinity'
 where pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')
 and ((state='queued' and due_at<=now()) or (state='leased' and lease_until<=now()));
 result:=public.claim_memory_cleanup(p_limit);
 if result->>'ok' is distinct from 'true' then return result; end if;
 select coalesce(jsonb_agg(item),'[]'::jsonb) into owned from jsonb_array_elements(result->'data') item
 join private.memory_cleanup_jobs j on j.id=(item->>'id')::uuid
 where j.pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002');
 -- Expiry discovery may create a due job behind an existing backlog. Prioritize that owned job after discovery.
 if owned='[]'::jsonb and exists(select 1 from private.memory_cleanup_jobs
 where pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')
 and state='queued' and due_at<=now()) then
  update private.memory_cleanup_jobs set due_at='-infinity'
  where pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')
  and state='queued' and due_at<=now();
  result:=public.claim_memory_cleanup(p_limit);
  if result->>'ok' is distinct from 'true' then return result; end if;
  select coalesce(jsonb_agg(item),'[]'::jsonb) into owned from jsonb_array_elements(result->'data') item
  join private.memory_cleanup_jobs j on j.id=(item->>'id')::uuid
  where j.pair_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002');
 end if;
 return jsonb_set(result,'{data}',owned);
end; $$;
