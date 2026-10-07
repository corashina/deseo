-- Row policies called private.is_member(pair_id) once per row. Each call repeats the session, profile, and pair lookups.
-- An account has at most one current membership (pair_members_one_current). Policies compare pair_id with that pair.
-- The wrapping select makes PostgreSQL evaluate the lookup once per statement and use the pair_id indexes.
create function private.actor_pair(p_active_only boolean default true) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.pair_id from public.pair_members m join public.pairs p on p.id=m.pair_id
  where m.user_id=private.active_actor() and m.left_at is null
    and p.state = any(case when p_active_only then array['active'] else array['pending','active'] end);
$$;
revoke all on function private.actor_pair(boolean) from public,anon,authenticated;
grant execute on function private.actor_pair(boolean) to authenticated;

drop policy pairs_current on public.pairs;
create policy pairs_current on public.pairs for select to authenticated using(id=(select private.actor_pair(false)));
drop policy members_current on public.pair_members;
create policy members_current on public.pair_members for select to authenticated
using(user_id=(select private.active_actor()) or pair_id=(select private.actor_pair()));
drop policy events_visible on public.events;
create policy events_visible on public.events for select to authenticated
using(pair_id=(select private.actor_pair()) and (visibility='shared' or created_by=(select private.active_actor())));
drop policy messages_visible on public.messages;
create policy messages_visible on public.messages for select to authenticated
using(deleted_at is null and pair_id=(select private.actor_pair()));
drop policy conversation_reads_self on private.conversation_reads;
create policy conversation_reads_self on private.conversation_reads for select to authenticated
using(user_id=(select private.active_actor()) and pair_id=(select private.actor_pair()));
drop policy memories_visible on public.memories;
create policy memories_visible on public.memories for select to authenticated
using(pair_id=(select private.actor_pair()) and (state='published' or (state='pending' and created_by=(select private.active_actor()))));
drop policy memory_revocations_current on public.memory_access_revocations;
create policy memory_revocations_current on public.memory_access_revocations for select to authenticated
using(pair_id=(select private.actor_pair()));
drop policy task_lists_visible on public.task_lists;
create policy task_lists_visible on public.task_lists for select to authenticated using(pair_id=(select private.actor_pair()));
drop policy tasks_visible on public.tasks;
create policy tasks_visible on public.tasks for select to authenticated using(pair_id=(select private.actor_pair()));
drop policy date_ideas_visible on public.date_ideas;
create policy date_ideas_visible on public.date_ideas for select to authenticated using(pair_id=(select private.actor_pair()));
drop policy own_reminders on public.reminders;
create policy own_reminders on public.reminders for select to authenticated
using(user_id=(select private.active_actor()) and pair_id=(select private.actor_pair()) and
  (event_id is null or exists(select 1 from public.events e where e.id=event_id)));
drop policy own_notifications on public.notifications;
create policy own_notifications on public.notifications for select to authenticated
using(user_id=(select private.active_actor()) and pair_id=(select private.actor_pair()) and available_at<=now());

-- The old policy built 'tasks:'||id for every pair row on each Realtime authorization check.
drop policy task_signals_read on realtime.messages;
create policy task_signals_read on realtime.messages for select to authenticated
using(extension='broadcast' and case when realtime.topic() ~ '^tasks:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then private.is_member((substring(realtime.topic() from 7))::uuid) else false end);
