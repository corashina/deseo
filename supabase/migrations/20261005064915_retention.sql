-- Remove expired internal rows in small batches.
create function private.expire_records() returns void language plpgsql security definer set search_path='' as $$
begin
 delete from private.memory_cleanup_jobs where id in(select id from private.memory_cleanup_jobs where state='completed' and completed_at<=now()-interval '30 days' and cardinality(paths)=0 order by completed_at limit 50);
 delete from private.verification_proofs where proof_hash in(select proof_hash from private.verification_proofs where expires_at<=now() order by expires_at limit 50);
 delete from private.pair_invites where id in(select id from private.pair_invites where expires_at<=now() order by expires_at limit 50);
 delete from private.command_receipts where ctid in(select ctid from private.command_receipts where expires_at<=now() order by expires_at limit 50);
 delete from public.devices where id in(select d.id from public.devices d where d.revoked_at<now()-interval '30 days' and not exists(select 1 from private.notification_jobs j where j.device_id=d.id) order by d.revoked_at limit 50);
 delete from private.notification_jobs where id in(select id from private.notification_jobs where state in('provider_accepted','failed','expired','canceled') and due_at<now()-interval '30 days' order by due_at limit 50);
 delete from public.notifications where id in(select n.id from public.notifications n where n.created_at<now()-interval '30 days' and not exists(select 1 from private.notification_jobs j where j.notification_id=n.id) order by n.created_at limit 50);
end;$$;
create function private.invoke_cleanup_worker() returns void language plpgsql security definer set search_path='' as $$
declare v_url text;v_secret text;
begin
 select decrypted_secret into v_url from vault.decrypted_secrets where name='cleanup_function_url';
 select decrypted_secret into v_secret from vault.decrypted_secrets where name='memory_cleanup_secret';
 if v_url is null or v_secret is null or char_length(v_secret)<32 then return;end if;
 perform net.http_post(url:=v_url,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_secret),body:='{}'::jsonb);
end;$$;
revoke all on function private.expire_records(),private.invoke_cleanup_worker() from public,anon,authenticated;
select cron.schedule('deseo-expire-records','* * * * *',$job$select private.expire_records();$job$);
select cron.schedule('deseo-cleanup','* * * * *',$job$select private.invoke_cleanup_worker();$job$);
