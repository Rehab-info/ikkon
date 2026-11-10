-- 食事記録:権限(本人・担当スタッフ・同意撤回)、検証、計算、要確認、記録状況、画像、監査(Sprint 2)
begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/setup.psql
select no_plan();

insert into tests.users values
  ('admin',   tests.new_user('管理者', tests.org_a(), '{admin}')),
  ('s_write', tests.new_user('代理入力スタッフ', tests.org_a(), '{staff}')),
  ('s_read',  tests.new_user('閲覧スタッフ', tests.org_a(), '{staff}')),
  ('s_none',  tests.new_user('同意なしスタッフ', tests.org_a(), '{staff}')),
  ('m1',      tests.new_user('利用者1', tests.org_a(), '{member}')),
  ('m2',      tests.new_user('利用者2', tests.org_a(), '{member}'));
insert into public.staff_assignments(organization_id, staff_id, member_id) values
  (tests.org_a(), tests.u('s_write'), tests.u('m1')), (tests.org_a(), tests.u('s_read'), tests.u('m1')),
  (tests.org_a(), tests.u('s_none'), tests.u('m1'));
insert into public.staff_access_consents(member_id, staff_id, scope, document_id)
select tests.u('m1'), s.staff, s.scope::public.consent_scope, (select id from public.consent_documents where kind = 'staff_sharing')
from (values (tests.u('s_write'), 'meals:write'), (tests.u('s_read'), 'meals:read')) s(staff, scope);

create function tests.food(p_code text) returns uuid language sql stable as $$ select id from public.foods where source_food_code = p_code $$;
grant execute on function tests.food(text) to authenticated;
create function tests.today() returns date language sql stable as $$ select (now() at time zone 'Asia/Tokyo')::date $$;
grant execute on function tests.today() to authenticated;
-- 手入力の 1 品だけの食事
create function tests.payload(p_items jsonb, p_slot text default 'breakfast', p_date date default null) returns jsonb
language sql stable as $$
  select jsonb_build_object('slot', p_slot, 'location', 'home', 'eaten_on', coalesce(p_date, tests.today()),
                            'eaten_at', null, 'eaten_at_precision', 'slot_only', 'info_source', 'manual',
                            'analysis_id', null, 'image_path', null, 'items', p_items) $$;
grant execute on function tests.payload(jsonb, text, date) to authenticated;
create function tests.item(p_code text, p_g numeric, p_pct int) returns jsonb language sql stable as $$
  select jsonb_build_object('role', 'food', 'match_status', 'confirmed', 'food_id', tests.food(p_code),
                            'origin', 'manual', 'served_g', p_g, 'intake_percent', p_pct) $$;
grant execute on function tests.item(text, numeric, int) to authenticated;
create temp table v(k text primary key, val uuid);
grant all on v to authenticated;

-- ===========================================================================
-- 食品マスター
-- ===========================================================================
select is((select count(*) from public.foods), 2538::bigint, 'all 2,538 foods are loaded');
select is((select raw_values ->> 'PROT-' from public.foods where source_food_code = '09059'), '-', 'original notation is kept');
select ok((select protein_g is null from public.foods where source_food_code = '09059'), 'not determined is null, not 0');
select tests.login('m1', 'aal1');
select is((public.match_foods(array['豚肉']) -> 'data' -> 0 -> 'candidates' -> 0 ->> 'exact_match'), 'true', 'alias exact match');
select is(jsonb_array_length(public.match_foods(array['豚肉']) -> 'data' -> 0 -> 'candidates'), 2, 'ambiguous alias returns 2 candidates');
select ok(jsonb_array_length(public.search_foods('にんじん') -> 'data') >= 1, 'search foods');
select throws_ok($$ select * from public.meals $$, '42501', null, 'no direct table access to meals');

-- ===========================================================================
-- 本人の保存と計算(packages/nutrition と同じ規則)
-- ===========================================================================
-- ごはん(01088:156 kcal, 2.5, 0.3, 37.1 / 100 g)150 g を 100%
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload(jsonb_build_array(tests.item('01088', 150, 100))))), null, 'member saves own meal');
reset role;
select is((select (total_energy_kcal, total_protein_g, total_fat_g, total_carbohydrate_g)::text from public.meals where member_id = tests.u('m1')),
          '(234.00,3.75,0.45,55.65)', 'energy is the published value × g / 100 (not recomputed from PFC)');
select is((select (entry_source, entered_by = tests.u('m1'), location)::text from public.meals where member_id = tests.u('m1')),
          '(self,t,home)', 'entry source, entered_by and location are set by the server');
select is((select status from public.meal_slot_status where member_id = tests.u('m1') and slot = 'breakfast'),
          'recorded'::public.slot_status, 'slot status becomes recorded');

-- 食べた割合 50%、端数、Tr、未測定
select tests.login('m1', 'aal1');
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload(jsonb_build_array(
  tests.item('01088', 80.5, 33), tests.item('02061', 100, 100), tests.item('09059', 200, 100)), 'lunch'))), null, 'save with fractions, Tr and not-determined');
reset role;
select is((select consumed_g from public.meal_items i join public.meals m on m.id = i.meal_id
           where m.member_id = tests.u('m1') and m.slot = 'lunch' and i.position = 0), 26.57::numeric, 'consumed = 80.5 × 33% = 26.565 → 26.57');
select is((select per100_notation -> 'protein_g' ->> 'raw' from public.meal_items i join public.meals m on m.id = i.meal_id
           where m.member_id = tests.u('m1') and m.slot = 'lunch' and i.position = 1), 'Tr', 'Tr notation is kept in the snapshot');
select is((select protein_g from public.meal_items i join public.meals m on m.id = i.meal_id
           where m.member_id = tests.u('m1') and m.slot = 'lunch' and i.position = 2), null, 'not-determined amount is null');
select is((select total_flags -> 'protein_g' ->> 'incomplete' from public.meals where member_id = tests.u('m1') and slot = 'lunch'),
          'true', 'total is flagged incomplete');

-- ===========================================================================
-- 要確認の食品(D-19):合計に入れない
-- ===========================================================================
select tests.login('m1', 'aal1');
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload(jsonb_build_array(
  tests.item('01088', 100, 100),
  jsonb_build_object('role', 'ingredient', 'dish_group_id', '00000000-0000-4000-8000-0000000000d1', 'dish_label', '肉じゃが',
                     'dish_composition_known', true, 'match_status', 'needs_review', 'food_id', null,
                     'candidate_food_ids', jsonb_build_array(tests.food('11123'), tests.food('11129')),
                     'origin', 'manual', 'label', '豚肉', 'served_g', 60, 'intake_percent', 100)), 'dinner'))), null,
  'save with a needs-review ingredient');
reset role;
select is((select (total_energy_kcal, needs_review_count)::text from public.meals where member_id = tests.u('m1') and slot = 'dinner'),
          '(156.00,1)', 'needs-review item is excluded from totals and counted');
select tests.login('m1', 'aal1');
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload(jsonb_build_array(
  jsonb_build_object('role', 'food', 'match_status', 'needs_review', 'food_id', tests.food('11123'), 'origin', 'manual',
                     'label', 'x', 'served_g', 10, 'intake_percent', 100)), 'snack'))), 'invalid_request',
  'needs-review item cannot carry a food_id');

-- ===========================================================================
-- 入力の検証
-- ===========================================================================
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload(jsonb_build_array(tests.item('01088', 100, 100))) || '{"location":"dayservice"}')),
          'invalid_request', 'location other than home is rejected');
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload(jsonb_build_array(tests.item('01088', 100, 100))) - 'location')),
          'invalid_request', 'missing location is rejected');
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload(jsonb_build_array(tests.item('01088', 100, 100) || '{"energy_kcal": 1}')))),
          'invalid_request', 'client-supplied nutrient values are rejected');
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload(jsonb_build_array(tests.item('01088', 100, 100))) || '{"entered_by":"x"}')),
          'invalid_request', 'client-supplied entered_by is rejected');
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload(jsonb_build_array(tests.item('01088', 100, 50) || '{"intake_percent": 50.5}')))),
          'invalid_request', 'non-integer intake percent is rejected');
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload(jsonb_build_array(tests.item('01088', 2001, 100))))),
          'invalid_request', 'served grams over 2000 are rejected');
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload(jsonb_build_array(tests.item('01088', 100, 100)), 'snack', tests.today() + 1))),
          'invalid_request', 'future date is rejected');
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload(jsonb_build_array(tests.item('01088', 100, 100)), 'snack', tests.today() - 8))),
          'invalid_request', 'more than 7 days back is rejected');
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload(jsonb_build_array(tests.item('01088', 100, 100) || '{"origin":"ai","ai_estimated_served_g":100}')))),
          'invalid_request', 'AI-origin item without an analysis is rejected');
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload('[]'::jsonb))), 'invalid_request', 'empty item list is rejected');
reset role;
select is((select count(*) from public.meals where member_id = tests.u('m1')), 3::bigint, 'rejected saves left nothing behind');

-- AI 解析との照合(AI 推定値の改ざん防止)
select tests.login('m1', 'aal1');
insert into v select 'an', (public.record_meal_analysis(tests.u('m1'), tests.u('m1') || '/2026/00000000-0000-4000-8000-0000000000a1.webp',
  'succeeded', 'mock', 'mock-1', '{"items":[{"kind":"food","label":"ごはん","served_g":150,"confidence":"high"}]}') -> 'data' ->> 'analysis_id')::uuid;
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload(jsonb_build_array(
  tests.item('01088', 120, 100) || '{"origin":"ai_corrected","ai_estimated_served_g":150,"ai_label":"ごはん"}'), 'snack')
  || jsonb_build_object('analysis_id', (select val from v where k = 'an'), 'info_source', 'photo',
                        'image_path', tests.u('m1') || '/2026/00000000-0000-4000-8000-0000000000a1.webp'))),
  null, 'AI-corrected item matching the analysis is accepted');
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload(jsonb_build_array(
  tests.item('01088', 120, 100) || '{"origin":"ai","ai_estimated_served_g":999}'), 'snack')
  || jsonb_build_object('analysis_id', (select val from v where k = 'an')))),
  'invalid_request', 'AI estimate not in the analysis is rejected');
select is(tests.err(public.record_meal_analysis(tests.u('m1'), tests.u('m2') || '/2026/x.webp', 'succeeded', 'mock', 'm', '{}')),
          'invalid_request', 'analysis image must be in the member folder');

-- ===========================================================================
-- 記録状況
-- ===========================================================================
select is(tests.err(public.set_slot_status(tests.u('m1'), tests.today(), 'breakfast', 'skipped')), 'conflict',
          'cannot mark a recorded slot as skipped');
select is(tests.err(public.set_slot_status(tests.u('m1'), tests.today() - 1, 'lunch', 'dayservice')), null, 'mark dayservice');
select is(tests.err(public.set_slot_status(tests.u('m1'), tests.today() - 1, 'snack', 'skipped')), 'invalid_request', 'snack has no status');
select is(public.get_daily_summary(tests.u('m1'), tests.today() - 1, tests.today() - 1) -> 'data' -> 0 -> 'slots' ->> 'lunch',
          'dayservice', 'daily summary shows slot status');
select is((public.get_daily_summary(tests.u('m1'), tests.today(), tests.today()) -> 'data' -> 0 ->> 'needs_review_count')::int, 1,
          'daily summary counts needs-review items');

-- ===========================================================================
-- 担当スタッフ(代理入力・閲覧)と同意撤回
-- ===========================================================================
select tests.login('s_write');
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload(jsonb_build_array(tests.item('12004', 50, 100)), 'snack', tests.today() - 1))),
          null, 'staff with meals:write saves a proxy entry');
reset role;
select is((select entry_source::text from public.meals where member_id = tests.u('m1') and eaten_on = tests.today() - 1 and slot = 'snack'),
          'staff', 'proxy entry is marked as staff');
select ok(exists (select 1 from audit.logs where action = 'meal.save.proxy' and actor_id = tests.u('s_write')), 'proxy save is audited');

select tests.login('s_write');
select is(jsonb_array_length(public.get_meals(tests.u('m1'), tests.today() - 7, tests.today()) -> 'data'), 1,
          'write-only staff sees only meals they entered (D-07)');
select is(tests.err(public.get_daily_summary(tests.u('m1'), tests.today(), tests.today())), 'forbidden', 'write-only staff cannot read daily summary');
insert into v select 'proxy', (public.get_meals(tests.u('m1'), tests.today() - 7, tests.today()) -> 'data' -> 0 ->> 'meal_id')::uuid;
select is(tests.err(public.update_meal((select val from v where k = 'proxy'),
          tests.payload(jsonb_build_array(tests.item('12004', 60, 100)), 'snack', tests.today() - 1))), null, 'staff updates own proxy entry');
select is(tests.err(public.delete_meal((select val from v where k = 'proxy'))), 'forbidden', 'staff cannot delete (D-07)');
select ok(public.get_meals(tests.u('m1'), tests.today() - 7, tests.today()) -> 'data' -> 0 ->> 'image_path' is null, 'staff never gets image paths');

select tests.login('s_read');
select is(jsonb_array_length(public.get_meals(tests.u('m1'), tests.today() - 7, tests.today()) -> 'data'), 5, 'read staff sees all meals');
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload(jsonb_build_array(tests.item('12004', 50, 100)), 'snack'))),
          'forbidden', 'read-only staff cannot write');
select is(tests.err(public.update_meal((select val from v where k = 'proxy'), tests.payload(jsonb_build_array(tests.item('12004', 1, 100)), 'snack', tests.today() - 1))),
          'forbidden', 'read-only staff cannot update');
select is(tests.err(public.set_slot_status(tests.u('m1'), tests.today(), 'dinner', 'skipped')), 'forbidden', 'read-only staff cannot set slot status');
reset role;
select ok(exists (select 1 from audit.logs where action = 'meal.read.staff' and actor_id = tests.u('s_read')), 'staff read is audited');

select tests.login('s_none');
select is(tests.err(public.get_meals(tests.u('m1'), tests.today(), tests.today())), 'forbidden', 'staff without consent cannot read');
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload(jsonb_build_array(tests.item('12004', 50, 100)), 'snack'))),
          'forbidden', 'staff without consent cannot write');
select tests.login('s_write', 'aal1');
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload(jsonb_build_array(tests.item('12004', 50, 100)), 'snack'))),
          'forbidden', 'staff without MFA cannot write');
select tests.login('admin');
select is(tests.err(public.get_meals(tests.u('m1'), tests.today(), tests.today())), 'forbidden', 'admin cannot read meals');
select tests.login('m2', 'aal1');
select is(tests.err(public.get_meals(tests.u('m1'), tests.today(), tests.today())), 'forbidden', 'other member cannot read');
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload(jsonb_build_array(tests.item('12004', 50, 100)), 'snack'))),
          'forbidden', 'other member cannot write');

-- 撤回後:同じセッションのまま拒否
select tests.login('m1', 'aal1');
select is(tests.err(public.revoke_staff_consent(tests.u('s_write'), 'meals:write')), null, 'member revokes meals:write');
select is(tests.err(public.revoke_staff_consent(tests.u('s_read'), 'meals:read')), null, 'member revokes meals:read');
select tests.login('s_write');
select is(tests.err(public.save_meal(tests.u('m1'), tests.payload(jsonb_build_array(tests.item('12004', 50, 100)), 'snack'))),
          'forbidden', 'after revoke: proxy entry is denied');
select is(tests.err(public.get_meals(tests.u('m1'), tests.today() - 7, tests.today())), 'forbidden', 'after revoke: own proxy entries are no longer visible');
select is(tests.err(public.update_meal((select val from v where k = 'proxy'), tests.payload(jsonb_build_array(tests.item('12004', 1, 100)), 'snack', tests.today() - 1))),
          'forbidden', 'after revoke: update is denied');
select tests.login('s_read');
select is(tests.err(public.get_meals(tests.u('m1'), tests.today(), tests.today())), 'forbidden', 'after revoke: read is denied');
reset role;
select ok(exists (select 1 from audit.logs where action = 'meal.create' and result = 'denied' and actor_id = tests.u('s_write')),
          'denied proxy entry is audited');

-- 本人の更新・削除
select tests.login('m1', 'aal1');
select is(tests.err(public.update_meal((select val from v where k = 'proxy'),
          tests.payload(jsonb_build_array(tests.item('12004', 70, 50)), 'snack', tests.today() - 1))), null, 'member can update a proxy entry');
select is(tests.err(public.delete_meal((select val from v where k = 'proxy'))), null, 'member deletes the meal');
select is(tests.err(public.delete_meal(gen_random_uuid())), 'forbidden', 'unknown meal');

-- ===========================================================================
-- 画像(Storage のポリシー)
-- ===========================================================================
select tests.login('m1', 'aal1');
select lives_ok(format($$ insert into storage.objects(bucket_id, name, owner_id) values ('meal-images', '%s/2026/00000000-0000-4000-8000-0000000000b1.webp', '%s') $$,
                tests.u('m1'), tests.u('m1')), 'member uploads into own folder');
select throws_ok(format($$ insert into storage.objects(bucket_id, name, owner_id) values ('meal-images', '%s/2026/00000000-0000-4000-8000-0000000000b2.webp', '%s') $$,
                 tests.u('m2'), tests.u('m1')), '42501', null, 'member cannot upload into another member folder');
select throws_ok(format($$ insert into storage.objects(bucket_id, name, owner_id) values ('meal-images', '%s/x.png', '%s') $$,
                 tests.u('m1'), tests.u('m1')), '42501', null, 'unexpected path format is rejected');
select tests.login('m2', 'aal1');
select is((select count(*) from storage.objects where bucket_id = 'meal-images'), 0::bigint, 'other member sees no images');
reset role;
-- スタッフ:meals:write があればアップロードでき、自分のアップロードだけ見られる
insert into public.staff_access_consents(member_id, staff_id, scope, document_id)
values (tests.u('m1'), tests.u('s_write'), 'meals:write', (select id from public.consent_documents where kind = 'staff_sharing'));
select tests.login('s_write');
select lives_ok(format($$ insert into storage.objects(bucket_id, name, owner_id) values ('meal-images', '%s/2026/00000000-0000-4000-8000-0000000000b3.webp', '%s') $$,
                tests.u('m1'), tests.u('s_write')), 'staff with meals:write uploads a proxy photo');
select is((select count(*) from storage.objects where bucket_id = 'meal-images'), 1::bigint, 'staff sees only own uploads (not the member photos)');
select tests.login('s_read');
select throws_ok(format($$ insert into storage.objects(bucket_id, name, owner_id) values ('meal-images', '%s/2026/00000000-0000-4000-8000-0000000000b4.webp', '%s') $$,
                 tests.u('m1'), tests.u('s_read')), '42501', null, 'staff without meals:write cannot upload');
select is((select count(*) from storage.objects where bucket_id = 'meal-images'), 0::bigint, 'read-only staff sees no images');

-- 画像の閲覧の許可(本人だけ、監査あり)
reset role;
insert into v select 'img', (select id from public.meals where image_path is not null limit 1);
select tests.login('m1', 'aal1');
select is(public.authorize_meal_image((select val from v where k = 'img')) -> 'data' ->> 'image_path',
          tests.u('m1') || '/2026/00000000-0000-4000-8000-0000000000a1.webp', 'member may view own meal image');
select tests.login('s_write');
select is(tests.err(public.authorize_meal_image((select val from v where k = 'img'))), 'forbidden',
          'staff cannot view meal images (D-09: numbers only)');
reset role;
select ok(exists (select 1 from audit.logs where action = 'meal.image.view' and result = 'allowed' and actor_id = tests.u('m1')), 'image view is audited');
select ok(exists (select 1 from audit.logs where action = 'meal.image.view' and result = 'denied' and actor_id = tests.u('s_write')), 'denied image view is audited');

select * from finish();
rollback;
