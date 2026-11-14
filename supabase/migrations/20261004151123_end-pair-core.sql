-- Fresh verification: this Auth session signed in during the last ten minutes.
-- Auth writes the sign-in time. Token refresh does not change it.
create function private.recently_signed_in() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.mfa_amr_claims c
    where c.session_id::text = auth.jwt()->>'session_id' and c.updated_at > now() - interval '10 minutes');
$$;

create function private.end_pair(p_pair_id uuid,p_command_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid; replay jsonb; ended timestamptz := now();
  request jsonb := jsonb_build_object('pairId',p_pair_id);
begin
  actor := private.require_actor();
  perform private.lock_pair(p_pair_id,actor);
  -- A retry returns its receipt even after closure, without a fresh sign-in.
  replay := private.receipt(actor,p_command_id,'end_pair',request);
  if replay is not null then return replay; end if;
  if not private.is_member(p_pair_id) or not private.recently_signed_in() then return private.error('FORBIDDEN'); end if;
  update public.pairs set state='ended',ended_at=ended,purge_after=ended+interval '30 days' where id=p_pair_id;
  update public.pair_members set left_at=ended where pair_id=p_pair_id and left_at is null;
  update private.pair_invites set revoked_at=ended where pair_id=p_pair_id and accepted_at is null and revoked_at is null;
  update public.profiles set version=version+1,updated_at=now()
    where user_id in(select user_id from public.pair_members where pair_id=p_pair_id);
  -- Later job migrations attach closure triggers in this same transaction.
  return private.save_receipt(actor,p_command_id,'end_pair',p_pair_id,request,jsonb_build_object('endedAt',ended));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end;
$$;
create function public.end_pair(p_pair_id uuid,p_command_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select private.end_pair(p_pair_id,p_command_id); $$;
revoke all on function private.recently_signed_in(),private.end_pair(uuid,uuid),public.end_pair(uuid,uuid) from public,anon,authenticated;
grant execute on function private.end_pair(uuid,uuid),public.end_pair(uuid,uuid) to authenticated;
