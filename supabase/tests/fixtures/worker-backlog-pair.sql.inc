-- Owned synthetic backlog uses a third pair. The surrounding test rolls it back.
insert into public.pairs(id,state) values ('30000000-0000-4000-8000-000000000003','active');
insert into public.pair_members(pair_id,user_id,slot) values
 ('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000005','a'),
 ('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000006','b');
