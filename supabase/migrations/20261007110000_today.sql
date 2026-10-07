-- Today needed five requests, and two of them ran one after the other. This read returns its shared content at once.
-- Each part uses the same rows, order, and limits as the feature read it replaces. RLS applies to every part.
create function public.get_today(p_pair_id uuid,p_date date) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare week jsonb; year jsonb;
begin
  if private.active_actor() is null then return private.error('UNAUTHENTICATED'); end if;
  if p_date is null then return private.error('VALIDATION','date'); end if;
  if not private.is_member(p_pair_id) then return private.error('FORBIDDEN'); end if;
  week:=public.list_agenda(p_pair_id,p_date,p_date+7);
  if week->>'ok'<>'true' then return week; end if;
  year:=public.list_agenda(p_pair_id,p_date,p_date+366);
  if year->>'ok'<>'true' then return year; end if;
  return jsonb_build_object('ok',true,'data',jsonb_build_object(
    'agenda',week->'data',
    'important_dates',(select coalesce(jsonb_agg(e),'[]'::jsonb) from jsonb_array_elements(year->'data') e
      where (e->>'important_date')::boolean or e->>'repeat'='yearly'),
    'due_tasks',(select coalesce(jsonb_agg(to_jsonb(t) order by t.due_date,t.id),'[]'::jsonb) from (
      select * from public.tasks where pair_id=p_pair_id and completed_at is null and due_date<=p_date
      order by due_date,id limit 3) t),
    'notes',(select coalesce(jsonb_agg(to_jsonb(m) order by m.pinned_at desc,m.id desc),'[]'::jsonb) from (
      select id,pair_id,author_id,client_id,body,created_at,pinned_at,version from public.messages
      where pair_id=p_pair_id and pinned_at is not null order by pinned_at desc,id desc limit 2) m)));
end;
$$;
revoke all on function public.get_today(uuid,date) from public,anon;
grant execute on function public.get_today(uuid,date) to authenticated;
