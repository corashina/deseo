create unique index messages_one_pin_per_author on public.messages(pair_id,author_id)
  where pinned_at is not null and deleted_at is null;

create function private.message_pin(p_message_id uuid,p_command_id uuid,p_pin boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid; pair uuid; saved public.messages; replay jsonb;
  command_type text := case when p_pin then 'message_pin' else 'message_unpin' end;
  request jsonb := jsonb_build_object('id',p_message_id);
begin
  actor := private.require_actor();
  if p_pin is null then return private.error('VALIDATION'); end if;
  select pair_id into pair from public.messages where id=p_message_id;
  if pair is null then return private.error('FORBIDDEN'); end if;
  perform private.lock_pair(pair,actor);
  if not private.is_member(pair) then return private.error('FORBIDDEN'); end if;
  select * into saved from public.messages where id=p_message_id for update;
  if saved.author_id is distinct from actor or saved.deleted_at is not null then return private.error('FORBIDDEN'); end if;
  replay := private.receipt(actor,p_command_id,command_type,request);
  if replay is not null then return replay; end if;
  if p_pin then
    update public.messages set pinned_at=null,version=version+1
      where pair_id=pair and author_id=actor and id<>p_message_id and pinned_at is not null;
    update public.messages set pinned_at=clock_timestamp(),version=version+1
      where id=p_message_id and pinned_at is null;
  else
    update public.messages set pinned_at=null,version=version+1 where id=p_message_id and pinned_at is not null;
  end if;
  return private.save_receipt(actor,p_command_id,command_type,pair,request,jsonb_build_object('id',p_message_id));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end;
$$;

create function public.pin_message(p_message_id uuid,p_command_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select private.message_pin(p_message_id,p_command_id,true); $$;
create function public.unpin_message(p_message_id uuid,p_command_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select private.message_pin(p_message_id,p_command_id,false); $$;
revoke all on function private.message_pin(uuid,uuid,boolean),public.pin_message(uuid,uuid),public.unpin_message(uuid,uuid)
  from public,anon,authenticated;
grant execute on function private.message_pin(uuid,uuid,boolean),public.pin_message(uuid,uuid),public.unpin_message(uuid,uuid) to authenticated;
