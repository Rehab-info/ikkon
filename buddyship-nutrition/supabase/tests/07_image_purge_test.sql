-- 食事画像の削除キュー:30 日経過・食事に保存されなかった画像、再試行、失敗の監査、権限(Sprint 3)
begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/setup.psql
select no_plan();

insert into tests.users values
  ('m1', tests.new_user('利用者1', tests.org_a(), '{member}'));

-- 画像のパス(実ファイルは作らない。Storage のメタデータだけ)
create function tests.img(p_tag text) returns text language sql stable as $$
  select tests.u('m1') || '/2026/' || (md5(p_tag)::uuid)::text || '.webp' $$;
create function tests.obj(p_tag text, p_age interval) returns void language sql as $$
  insert into storage.objects(bucket_id, name, owner_id, created_at)
  values ('meal-images', tests.img(p_tag), tests.u('m1')::text, now() - p_age) $$;
-- 写真付きの食事(画像の期限を指定)
create function tests.meal(p_tag text, p_expires timestamptz) returns uuid language sql as $$
  insert into public.meals(member_id, organization_id, slot, eaten_on, eaten_at_precision, entry_source, entered_by,
                           info_source, image_path, image_expires_at, total_energy_kcal, total_protein_g, total_fat_g,
                           total_carbohydrate_g, nutrition_rules_version)
  values (tests.u('m1'), tests.org_a(), 'dinner', current_date, 'slot_only', 'self', tests.u('m1'), 'photo',
          tests.img(p_tag), p_expires, 0, 0, 0, 0, 'sfct8-standard-v2')
  returning id $$;

select tests.obj('expired', interval '31 days');
select tests.obj('fresh', interval '2 days');
select tests.obj('orphan_old', interval '25 hours');
select tests.obj('orphan_new', interval '1 hour');
select tests.meal('expired', now() - interval '1 day');
select tests.meal('fresh', now() + interval '28 days');

grant usage on schema tests to service_role;
grant execute on all functions in schema tests to service_role;
grant select on tests.users to service_role;
create temp table claimed as select null::jsonb as j;
grant all on claimed to service_role;

-- ===========================================================================
-- 権限:service_role だけ
-- ===========================================================================
select tests.login('m1', 'aal1');
select throws_ok($$ select public.claim_image_purge(10) $$, '42501', null, 'members cannot claim purge jobs');
select throws_ok($$ select public.report_image_purge('[]') $$, '42501', null, 'members cannot report purge results');
select tests.anon();
select throws_ok($$ select public.claim_image_purge(10) $$, '42501', null, 'anon cannot claim purge jobs');
reset role;

-- ===========================================================================
-- 取り出し
-- ===========================================================================
set local role service_role;
update claimed set j = public.claim_image_purge(50);
reset role;
select is((select array_agg(e ->> 'name' order by e ->> 'name') from claimed, jsonb_array_elements(j -> 'data' -> 'items') e),
          (select array_agg(n order by n) from unnest(array[tests.img('expired'), tests.img('orphan_old')]) n),
          'claims the expired image and the old orphan only (not the fresh one, not the orphan within 24 h)');
select is((select (e ->> 'reason') from claimed, jsonb_array_elements(j -> 'data' -> 'items') e where e ->> 'name' = tests.img('expired')),
          'expired', 'reason: expired');
select is((select (e ->> 'reason') from claimed, jsonb_array_elements(j -> 'data' -> 'items') e where e ->> 'name' = tests.img('orphan_old')),
          'orphan', 'reason: orphan');
set local role service_role;
select is(jsonb_array_length(public.claim_image_purge(50) -> 'data' -> 'items'), 0, 'claimed jobs are not handed out again until the backoff passes');
reset role;

-- ===========================================================================
-- 結果:成功 → 食事の参照を外す、失敗 → 再試行、上限で failed
-- ===========================================================================
set local role service_role;
select is((public.report_image_purge(jsonb_build_array(
             jsonb_build_object('name', tests.img('expired'), 'ok', true),
             jsonb_build_object('name', tests.img('orphan_old'), 'ok', false, 'error', 'storage_error')))
          -> 'data'), '{"done": 1, "retry": 1, "failed": 0}'::jsonb, 'report: one done, one retry');
reset role;
-- 実際の削除は Edge Function が Storage API で行う(ここではメタデータを消して再現)
set local storage.allow_delete_query = 'true';
delete from storage.objects where bucket_id = 'meal-images' and name = tests.img('expired');
set local storage.allow_delete_query = 'false';
select is((select (image_path, image_expires_at)::text from public.meals where member_id = tests.u('m1') and total_energy_kcal = 0
            and info_source = 'photo' and image_path is null), '(,)', 'expired meal no longer references the image');
select is((select count(*)::int from public.meals where image_path = tests.img('fresh')), 1, 'meal within 30 days keeps its image');
select ok(exists (select 1 from audit.logs where action = 'meal_image.purge' and result = 'allowed'
                  and subject_member_id = tests.u('m1') and metadata ->> 'reason' = 'expired'), 'successful purge is audited');
select ok(exists (select 1 from audit.logs where action = 'meal_image.purge' and result = 'error'
                  and metadata ->> 'status' = 'retry' and metadata ->> 'error' = 'storage_error'), 'failed attempt is audited');
select is((select status from private.image_purge_queue where object_name = tests.img('orphan_old')), 'pending', 'failed job stays pending');
select ok((select next_attempt_at > now() from private.image_purge_queue where object_name = tests.img('orphan_old')), 'with a backoff');

-- 上限まで失敗させる
update private.image_purge_queue set attempts = 4, next_attempt_at = now() - interval '1 second' where object_name = tests.img('orphan_old');
set local role service_role;
select is(jsonb_array_length(public.claim_image_purge(50) -> 'data' -> 'items'), 1, 'retry is claimed after the backoff');
select is((public.report_image_purge(jsonb_build_array(jsonb_build_object('name', tests.img('orphan_old'), 'ok', false, 'error', 'storage_error')))
          -> 'data' ->> 'failed'), '1', 'fifth failure marks the job failed');
reset role;
select ok(exists (select 1 from audit.logs where action = 'meal_image.purge' and result = 'error' and metadata ->> 'status' = 'failed'),
          'final failure is audited');
set local role service_role;
select is(jsonb_array_length(public.claim_image_purge(50) -> 'data' -> 'items'), 0, 'failed jobs are not retried automatically');
reset role;

-- ===========================================================================
-- 取り出した後に条件を満たさなくなったもの・不正な報告
-- ===========================================================================
select tests.obj('late_saved', interval '30 hours');
set local role service_role;
select is(jsonb_array_length(public.claim_image_purge(50) -> 'data' -> 'items'), 1, 'new orphan is claimed');
reset role;
-- 取り出しの後、別の経路で食事から参照された(例:時計のずれ)→ 次の取り出しで取り消す
select tests.meal('late_saved', now() + interval '1 day');
update private.image_purge_queue set next_attempt_at = now() - interval '1 second' where object_name = tests.img('late_saved');
set local role service_role;
select is(jsonb_array_length(public.claim_image_purge(50) -> 'data' -> 'items'), 0, 'referenced image is no longer purged');
select is(tests.err(public.report_image_purge('{"name": "x"}')), 'invalid_request', 'report must be an array');
select is((public.report_image_purge(jsonb_build_array(jsonb_build_object('name', tests.img('late_saved'), 'ok', true))) -> 'data' ->> 'done'),
          '0', 'reporting a cancelled job does nothing');
reset role;
select is((select count(*)::int from public.meals where image_path = tests.img('late_saved')), 1, 'meal keeps its image');
select ok(not exists (select 1 from audit.logs where action = 'meal_image.purge' and metadata::text like '%' || tests.u('m1') || '%'),
          'audit metadata does not contain the object path');

-- 解析の記録は 90 日で消える
insert into public.meal_analyses(member_id, image_path, status, provider, model, created_at)
values (tests.u('m1'), tests.img('a_old'), 'succeeded', 'mock', 'mock', now() - interval '91 days'),
       (tests.u('m1'), tests.img('a_new'), 'succeeded', 'mock', 'mock', now() - interval '89 days');
set local role service_role;
select public.claim_image_purge(1);
reset role;
select is((select count(*)::int from public.meal_analyses where member_id = tests.u('m1')), 1, 'analysis records older than 90 days are deleted');

select * from finish();
rollback;
