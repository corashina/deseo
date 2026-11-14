-- get_today expanded all Events in 366 days and then kept the Important dates. At 3,000 Events this built 1.2 MB.
-- The agenda read moves to a private function. Its flag removes other Events before row conversion and sort.
-- Yearly Events are always important (events_yearly_fields), so the flag only filters nonrepeating Events.
create function private.list_agenda(p_pair_id uuid,p_from date,p_to date,p_important_only boolean) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare pair_timezone text; items jsonb;
begin
  if private.active_actor() is null then return private.error('UNAUTHENTICATED'); end if;
  if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>366 then return private.error('VALIDATION','range'); end if;
  select p.timezone into pair_timezone from public.pairs p where id=p_pair_id and state='active';
  if pair_timezone is null then return private.error('FORBIDDEN'); end if;
  with occurrences as (
    select to_jsonb(e) item,coalesce(e.starts_at,e.start_date::timestamp at time zone pair_timezone) sort_time,e.id
    from public.events e where e.pair_id=p_pair_id and e.repeat='none' and (e.important_date or not p_important_only) and
      ((e.starts_at < (p_to::timestamp at time zone pair_timezone) and e.ends_at > (p_from::timestamp at time zone pair_timezone))
        or (e.start_date < p_to and e.end_date_exclusive > p_from))
    union all
    select to_jsonb(e)||jsonb_build_object('occurrence_date',d.occurrence_day),d.occurrence_day::timestamp at time zone pair_timezone,e.id
    from public.events e
    cross join lateral generate_series(extract(year from p_from)::integer,extract(year from p_to-1)::integer) y(year)
    cross join lateral (select private.yearly_date(y.year,e.repeat_month,e.repeat_day) as occurrence_day) d
    where e.pair_id=p_pair_id and e.repeat='yearly' and d.occurrence_day>=greatest(p_from,e.start_date) and d.occurrence_day<p_to
  ) select coalesce(jsonb_agg(item order by sort_time,id),'[]'::jsonb) into items from occurrences;
  return jsonb_build_object('ok',true,'data',items);
end;
$$;
revoke all on function private.list_agenda(uuid,date,date,boolean) from public,anon,authenticated;
grant execute on function private.list_agenda(uuid,date,date,boolean) to authenticated;

create or replace function public.list_agenda(p_pair_id uuid,p_from date,p_to date) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.list_agenda(p_pair_id,p_from,p_to,false); $$;

create or replace function public.get_today(p_pair_id uuid,p_date date) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare week jsonb; important jsonb;
begin
  if private.active_actor() is null then return private.error('UNAUTHENTICATED'); end if;
  if p_date is null then return private.error('VALIDATION','date'); end if;
  if not private.is_member(p_pair_id) then return private.error('FORBIDDEN'); end if;
  week:=private.list_agenda(p_pair_id,p_date,p_date+7,false);
  if week->>'ok'<>'true' then return week; end if;
  important:=private.list_agenda(p_pair_id,p_date,p_date+366,true);
  if important->>'ok'<>'true' then return important; end if;
  return jsonb_build_object('ok',true,'data',jsonb_build_object(
    'agenda',week->'data',
    'important_dates',important->'data',
    'due_tasks',(select coalesce(jsonb_agg(to_jsonb(t) order by t.due_date,t.id),'[]'::jsonb) from (
      select * from public.tasks where pair_id=p_pair_id and completed_at is null and due_date<=p_date
      order by due_date,id limit 3) t),
    'notes',(select coalesce(jsonb_agg(to_jsonb(m) order by m.pinned_at desc,m.id desc),'[]'::jsonb) from (
      select id,pair_id,author_id,client_id,body,created_at,pinned_at,version from public.messages
      where pair_id=p_pair_id and pinned_at is not null order by pinned_at desc,id desc limit 2) m)));
end;
$$;
