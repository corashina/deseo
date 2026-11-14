create function private.get_account_settings() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid; profile public.profiles; email text; pending text;
begin
 actor:=private.require_actor(); select * into profile from public.profiles where user_id=actor;
 select u.email,nullif(u.email_change,'') into email,pending from auth.users u where id=actor;
 return jsonb_build_object('ok',true,'data',private.account_json(profile)||jsonb_build_object('email',email,'pendingEmail',pending,'avatarPath',profile.avatar_path));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end; $$;
create function private.update_pair_timezone(p_pair_id uuid,p_timezone text,p_expected_timezone text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; current_timezone text;
begin
 actor:=private.require_actor(); perform private.lock_pair(p_pair_id,actor);
 if not private.is_member(p_pair_id) then return private.error('FORBIDDEN'); end if;
 if p_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then return private.error('VALIDATION','timezone'); end if;
 select timezone into current_timezone from public.pairs where id=p_pair_id;
 if current_timezone is distinct from p_expected_timezone then return private.error('CONFLICT'); end if;
 update public.pairs set timezone=p_timezone where id=p_pair_id;
 -- Existing events and reminder instants retain their original temporal fields.
 return jsonb_build_object('ok',true,'data',jsonb_build_object('timezone',p_timezone));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end; $$;

-- Retain paths after Auth deletion until the worker confirms storage removal.
create table private.avatar_uploads(
 id uuid primary key,user_id uuid not null,path text not null unique,
 bytes integer not null check(bytes between 1 and 5242880),width integer not null check(width between 1 and 512),height integer not null check(height between 1 and 512),
 expected_version integer not null,state text not null default 'pending' check(state in('pending','current','cleanup')),
 created_at timestamptz not null default now(),due_at timestamptz not null default(now()+interval '1 hour'),
 lease_token uuid,lease_until timestamptz,attempts integer not null default 0,error_code text,
 check(path=user_id::text||'/'||id::text||'/avatar.jpg'));
create unique index avatar_one_pending on private.avatar_uploads(user_id) where state='pending';
create index avatar_cleanup_due on private.avatar_uploads(due_at,id) where state in('pending','cleanup');
alter table private.avatar_uploads enable row level security;
revoke all on private.avatar_uploads from public,anon,authenticated;
grant all on private.avatar_uploads to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('avatars','avatars',false,5242880,array['image/jpeg']);
create function private.reserve_avatar(p_id uuid,p_bytes integer,p_width integer,p_height integer,p_expected_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; profile public.profiles; path text;
begin
 actor:=private.require_actor(); select * into profile from public.profiles where user_id=actor for update; actor:=private.require_actor();
 if profile.version is distinct from p_expected_version then return private.error('CONFLICT'); end if;
 if p_id is null or p_bytes is null or p_bytes not between 1 and 5242880 or p_width is null or p_width not between 1 and 512 or p_height is null or p_height not between 1 and 512 then return private.error('VALIDATION'); end if;
 path:=actor::text||'/'||p_id::text||'/avatar.jpg';
 update private.avatar_uploads set state='cleanup',due_at=now() where user_id=actor and state='pending';
 insert into private.avatar_uploads(id,user_id,path,bytes,width,height,expected_version) values(p_id,actor,path,p_bytes,p_width,p_height,p_expected_version);
 return jsonb_build_object('ok',true,'data',jsonb_build_object('id',p_id,'path',path));
exception when sqlstate 'P0001' then return private.error(sqlerrm); when unique_violation then return private.error('CONFLICT');
end; $$;
create function private.avatar_service_lock(p_actor uuid,p_session uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then return false; end if;
 perform 1 from public.profiles where user_id=p_actor and account_status='active' for update;
 return found and exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.id=p_session and s.user_id=p_actor
 and (s.not_after is null or s.not_after>now()) and u.deleted_at is null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now()));
end; $$;
create function private.avatar_upload_allowed(p_path text) returns boolean language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=private.active_actor();
begin
 if actor is null then return false; end if;
 perform 1 from public.profiles where user_id=actor for update;
 return private.active_actor() is not null and exists(select 1 from private.avatar_uploads where path=p_path and user_id=actor and state='pending' and due_at>now());
end; $$;
create policy avatar_upload_reserved on storage.objects for insert to authenticated with check(bucket_id='avatars' and private.avatar_upload_allowed(name));
create or replace function private.avatar_object_size() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid; session uuid; upload private.avatar_uploads;
begin
 if tg_op='UPDATE' and old.bucket_id='avatars' then raise exception using message='FORBIDDEN',errcode='P0001'; end if;
 if new.bucket_id<>'avatars' then return new; end if;
 if tg_op='UPDATE' or new.owner_id is null or new.owner_id !~* '^[0-9a-f-]{36}$' or coalesce(new.user_metadata->>'sessionId','') !~* '^[0-9a-f-]{36}$' then raise exception using message='FORBIDDEN',errcode='P0001'; end if;
 actor:=new.owner_id::uuid; session:=(new.user_metadata->>'sessionId')::uuid;
 if auth.jwt()->>'role'='service_role' then
  if not private.avatar_service_lock(actor,session) then raise exception using message='FORBIDDEN',errcode='P0001'; end if;
 else
  if actor is distinct from private.active_actor() or session::text is distinct from auth.jwt()->>'session_id' or not private.avatar_upload_allowed(new.name) then raise exception using message='FORBIDDEN',errcode='P0001'; end if;
 end if;
 select * into upload from private.avatar_uploads where path=new.name and user_id=actor for update;
 if not found or upload.state<>'pending' or upload.due_at<=now() then raise exception using message='FORBIDDEN',errcode='P0001'; end if;
 -- Storage rolls this version='1' permission check back before streaming bytes.
 if new.version='1' and new.metadata->>'size' is null then return new; end if;
 if new.metadata->>'mimetype' is distinct from 'image/jpeg' or coalesce(new.metadata->>'size','') !~ '^[0-9]{1,8}$' or (new.metadata->>'size')::integer is distinct from upload.bytes then raise exception using message='VALIDATION',errcode='P0001'; end if;
 return new;
end; $$;
create trigger avatar_size before insert or update on storage.objects for each row execute function private.avatar_object_size();
create function private.verify_avatar(p_id uuid,p_actor uuid,p_session uuid,p_evidence jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare upload private.avatar_uploads; profile public.profiles;
begin
 if not private.avatar_service_lock(p_actor,p_session) then return private.error('FORBIDDEN'); end if;
 select * into upload from private.avatar_uploads where id=p_id and user_id=p_actor for update;
 if not found or upload.state not in('pending','current') or (upload.state='pending' and upload.due_at<=now()) then return private.error('FORBIDDEN'); end if;
 select * into profile from public.profiles where user_id=p_actor;
 if upload.state='current' and profile.avatar_path=upload.path then return jsonb_build_object('ok',true,'data',jsonb_build_object('path',upload.path,'bytes',upload.bytes,'width',upload.width,'height',upload.height,'version',profile.version)); end if;
 if profile.version<>upload.expected_version then update private.avatar_uploads set state='cleanup',due_at=now() where id=p_id; return private.error('CONFLICT'); end if;
 if p_evidence is not null then
  if p_evidence is distinct from jsonb_build_object('bytes',upload.bytes,'width',upload.width,'height',upload.height) or not exists(select 1 from storage.objects where bucket_id='avatars' and name=upload.path) then return private.error('VALIDATION'); end if;
  update private.avatar_uploads set state='cleanup',due_at=now() where user_id=p_actor and state='current';
  update private.avatar_uploads set state='current',due_at='infinity' where id=p_id;
  update public.profiles set avatar_path=upload.path,version=version+1,updated_at=now() where user_id=p_actor returning * into profile;
 end if;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('path',upload.path,'bytes',upload.bytes,'width',upload.width,'height',upload.height,'version',profile.version));
end; $$;
create function private.get_avatar_media(p_user_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid; path text;
begin
 actor:=private.require_actor();
 if p_user_id<>actor and not private.is_partner(p_user_id) then return private.error('FORBIDDEN'); end if;
 select avatar_path into path from public.profiles where user_id=p_user_id and account_status='active';
 if path is null then return private.error('FORBIDDEN'); end if;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('path',path,'bucket','avatars','expiresIn',60));
exception when sqlstate 'P0001' then return private.error(sqlerrm);
end; $$;
create function private.claim_avatar_cleanup(p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare candidate record; upload private.avatar_uploads; jobs jsonb:='[]'; token uuid;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then return private.error('FORBIDDEN'); end if;
 if p_limit is null or p_limit not between 1 and 20 then return private.error('VALIDATION'); end if;
 for candidate in select id,user_id from private.avatar_uploads where state in('pending','cleanup') and due_at<=now() and (lease_until is null or lease_until<=now()) order by due_at,id limit 1 loop
  perform 1 from public.profiles where user_id=candidate.user_id for update;
  select * into upload from private.avatar_uploads where id=candidate.id and state in('pending','cleanup') and due_at<=now() and (lease_until is null or lease_until<=now()) for update skip locked;
  if not found then continue; end if;
  token:=gen_random_uuid(); update private.avatar_uploads set state='cleanup',lease_token=token,lease_until=now()+interval '5 minutes',attempts=attempts+1 where id=upload.id;
  jobs:=jobs||jsonb_build_array(jsonb_build_object('id',upload.id,'userId',upload.user_id,'path',upload.path,'bucket','avatars','leaseToken',token));
 end loop;
 return jsonb_build_object('ok',true,'data',jobs);
end; $$;
create or replace function private.complete_avatar_cleanup(p_id uuid,p_lease_token uuid,p_error_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare upload private.avatar_uploads;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then return private.error('FORBIDDEN'); end if;
 select * into upload from private.avatar_uploads where id=p_id and state='cleanup' and lease_token=p_lease_token and lease_until>now() for update;
 if not found then return private.error('CONFLICT'); end if;
 if p_error_code is null and exists(select 1 from storage.objects where bucket_id='avatars' and name=upload.path) then return private.error('RETRYABLE'); end if;
 if p_error_code is null then delete from private.avatar_uploads where id=p_id;
 else update private.avatar_uploads set lease_token=null,lease_until=null,due_at=now()+interval '5 minutes',error_code=p_error_code where id=p_id; end if;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('id',p_id));
end; $$;
create function private.queue_account_avatars() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update private.avatar_uploads set state='cleanup',due_at=now() where user_id=old.user_id;
 return old;
end; $$;
create trigger profiles_avatar_cleanup before delete on public.profiles for each row execute function private.queue_account_avatars();

create function public.get_account_settings() returns jsonb language sql security invoker set search_path='' as $$select private.get_account_settings();$$;
create function public.update_pair_timezone(p_pair_id uuid,p_timezone text,p_expected_timezone text) returns jsonb language sql security invoker set search_path='' as $$select private.update_pair_timezone(p_pair_id,p_timezone,p_expected_timezone);$$;
create function public.reserve_avatar(p_id uuid,p_bytes integer,p_width integer,p_height integer,p_expected_version integer) returns jsonb language sql security invoker set search_path='' as $$select private.reserve_avatar(p_id,p_bytes,p_width,p_height,p_expected_version);$$;
create function public.get_avatar_media(p_user_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.get_avatar_media(p_user_id);$$;
create function public.verify_avatar(p_id uuid,p_actor uuid,p_session uuid,p_evidence jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.verify_avatar(p_id,p_actor,p_session,p_evidence);$$;
create function public.claim_avatar_cleanup(p_limit integer default 2) returns jsonb language sql security invoker set search_path='' as $$select private.claim_avatar_cleanup(p_limit);$$;
create function public.complete_avatar_cleanup(p_id uuid,p_lease_token uuid,p_error_code text default null) returns jsonb language sql security invoker set search_path='' as $$select private.complete_avatar_cleanup(p_id,p_lease_token,p_error_code);$$;
revoke all on function private.avatar_service_lock(uuid,uuid),private.avatar_object_size(),private.queue_account_avatars() from public,anon,authenticated;
revoke all on function private.get_account_settings(),public.get_account_settings(),private.update_pair_timezone(uuid,text,text),public.update_pair_timezone(uuid,text,text),private.reserve_avatar(uuid,integer,integer,integer,integer),public.reserve_avatar(uuid,integer,integer,integer,integer),private.get_avatar_media(uuid),public.get_avatar_media(uuid),private.avatar_upload_allowed(text),private.verify_avatar(uuid,uuid,uuid,jsonb),public.verify_avatar(uuid,uuid,uuid,jsonb),private.claim_avatar_cleanup(integer),public.claim_avatar_cleanup(integer),private.complete_avatar_cleanup(uuid,uuid,text),public.complete_avatar_cleanup(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.get_account_settings(),public.get_account_settings(),private.update_pair_timezone(uuid,text,text),public.update_pair_timezone(uuid,text,text),private.reserve_avatar(uuid,integer,integer,integer,integer),public.reserve_avatar(uuid,integer,integer,integer,integer),private.get_avatar_media(uuid),public.get_avatar_media(uuid),private.avatar_upload_allowed(text) to authenticated;
grant execute on function private.verify_avatar(uuid,uuid,uuid,jsonb),public.verify_avatar(uuid,uuid,uuid,jsonb),private.claim_avatar_cleanup(integer),public.claim_avatar_cleanup(integer),private.complete_avatar_cleanup(uuid,uuid,text),public.complete_avatar_cleanup(uuid,uuid,text) to service_role;
