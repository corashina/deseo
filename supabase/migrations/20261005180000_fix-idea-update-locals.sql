-- Preserve idea commands while removing invalid function-name qualification.
create or replace function private.idea_command(p_action text,p_idea_id uuid,p_input jsonb,p_expected_version integer,p_command_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid; pair uuid; previous public.date_ideas; result public.date_ideas; replay jsonb;
  request jsonb:=jsonb_build_object('id',p_idea_id,'input',p_input,'version',p_expected_version);
  v_title text; v_note text; v_link text;
begin
  actor:=private.require_actor();
  if p_action not in('create','update','archive') or p_command_id is null then return private.error('VALIDATION'); end if;
  if p_action='create' then
    p_idea_id:=(p_input->>'id')::uuid; pair:=(p_input->>'pair_id')::uuid;
    if p_idea_id is null or pair is null then return private.error('VALIDATION'); end if;
  else
    select pair_id into pair from public.date_ideas where id=p_idea_id;
    if pair is null then return private.error('FORBIDDEN'); end if;
  end if;
  perform private.lock_pair(pair,actor);
  if not private.is_member(pair) then return private.error('FORBIDDEN'); end if;
  select * into previous from public.date_ideas where id=p_idea_id for update;
  if previous.id is not null and previous.pair_id<>pair then return private.error('CONFLICT'); end if;
  replay:=private.receipt(actor,p_command_id,'idea_'||p_action,request);
  if replay is not null then return replay; end if;
  if p_action='create' and previous.id is not null then
    if previous.created_by<>actor then return private.error('CONFLICT'); end if;
    return private.save_receipt(actor,p_command_id,'idea_create',pair,request,to_jsonb(previous));
  end if;
  if p_action<>'create' and (previous.id is null or p_expected_version is null or previous.version<>p_expected_version) then
    return private.error('CONFLICT'); end if;
  if p_action='archive' then
    update public.date_ideas set state='archived',version=version+1,updated_at=now() where id=p_idea_id returning * into result;
  else
    if (p_input->>'id')::uuid is distinct from p_idea_id or (p_input->>'pair_id')::uuid is distinct from pair then return private.error('VALIDATION','id'); end if;
    v_title:=btrim(p_input->>'title'); v_note:=nullif(btrim(p_input->>'note'),''); v_link:=nullif(btrim(p_input->>'link'),'');
    if v_title is null or char_length(v_title) not between 1 and 120 then return private.error('VALIDATION','title'); end if;
    if char_length(v_note)>1000 then return private.error('VALIDATION','note'); end if;
    if not private.valid_idea_link(v_link) then return private.error('VALIDATION','link'); end if;
    if p_action='create' then
      insert into public.date_ideas(id,pair_id,created_by,title,note,link) values(p_idea_id,pair,actor,v_title,v_note,v_link) returning * into result;
    else
      update public.date_ideas set title=v_title,note=v_note,link=v_link,version=version+1,updated_at=now()
      where id=p_idea_id returning * into result;
    end if;
  end if;
  return private.save_receipt(actor,p_command_id,'idea_'||p_action,pair,request,to_jsonb(result));
exception
  when sqlstate 'P0001' then return private.error(sqlerrm);
  when invalid_text_representation or check_violation or not_null_violation then return private.error('VALIDATION');
  when unique_violation then return private.error('CONFLICT');
end;
$$;
