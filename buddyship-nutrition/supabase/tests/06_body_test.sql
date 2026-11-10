-- InBody(体組成):権限(本人・担当スタッフ・同意撤回・担当外)、検証、変更履歴、監査、ダッシュボード(Sprint 3)
begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/setup.psql
select no_plan();

insert into tests.users values
  ('admin',    tests.new_user('管理者', tests.org_a(), '{admin}')),
  ('s_write',  tests.new_user('体の代理入力スタッフ', tests.org_a(), '{staff}')),
  ('s_read',   tests.new_user('体の閲覧スタッフ', tests.org_a(), '{staff}')),
  ('s_meals',  tests.new_user('食事だけのスタッフ', tests.org_a(), '{staff}')),
  ('s_unasg',  tests.new_user('担当外スタッフ', tests.org_a(), '{staff}')),
  ('m1',       tests.new_user('利用者1', tests.org_a(), '{member}')),
  ('m2',       tests.new_user('利用者2', tests.org_a(), '{member}'));
insert into public.staff_assignments(organization_id, staff_id, member_id) values
  (tests.org_a(), tests.u('s_write'), tests.u('m1')), (tests.org_a(), tests.u('s_read'), tests.u('m1')),
  (tests.org_a(), tests.u('s_meals'), tests.u('m1')), (tests.org_a(), tests.u('s_write'), tests.u('m2'));
insert into public.staff_access_consents(member_id, staff_id, scope, document_id)
select tests.u('m1'), s.staff, s.scope::public.consent_scope, (select id from public.consent_documents where kind = 'staff_sharing')
from (values (tests.u('s_write'), 'body:write'), (tests.u('s_read'), 'body:read'), (tests.u('s_meals'), 'meals:read')) s(staff, scope);

create function tests.body(p_w numeric default 55.0, p_m numeric default 22.0, p_f numeric default 15.0,
                           p_pct numeric default 27.3, p_at timestamptz default now() - interval '1 hour') returns jsonb
language sql stable as $$
  select jsonb_build_object('measured_at', p_at, 'weight_kg', p_w, 'skeletal_muscle_kg', p_m, 'body_fat_kg', p_f,
                            'body_fat_pct', p_pct, 'device_model', 'InBody(架空の機種)', 'condition', 'before_meal') $$;
grant execute on function tests.body(numeric, numeric, numeric, numeric, timestamptz) to authenticated;
create temp table v(k text primary key, val uuid);
grant all on v to authenticated;

-- ===========================================================================
-- 本人
-- ===========================================================================
select tests.login('m1', 'aal1');
select throws_ok($$ select * from public.body_compositions $$, '42501', null, 'no direct table access to body_compositions');
select throws_ok($$ select * from public.body_composition_history $$, '42501', null, 'no direct table access to history');
insert into v select 'own', (public.save_body_composition(tests.u('m1'), tests.body()) -> 'data' ->> 'id')::uuid;
select isnt((select val from v where k = 'own'), null, 'member saves own body composition');
select is(public.save_body_composition(tests.u('m1'), tests.body()) -> 'data' -> 'warnings', '[]'::jsonb,
          'consistent values give no warning (15.0 / 55.0 = 27.3%)');
select is(public.save_body_composition(tests.u('m1'), tests.body(p_pct := 32.0)) -> 'data' -> 'warnings',
          '["fat_pct_mismatch"]'::jsonb, 'percentage that does not match fat mass / weight is a warning, still saved');
select is(tests.err(public.save_body_composition(tests.u('m2'), tests.body())), 'forbidden', 'member cannot write for another member');

-- 検証
select is(tests.err(public.save_body_composition(tests.u('m1'), tests.body(p_w := 19.9))), 'out_of_range', 'weight below range');
select is(tests.err(public.save_body_composition(tests.u('m1'), tests.body(p_w := 300.1))), 'out_of_range', 'weight above range');
select is(tests.err(public.save_body_composition(tests.u('m1'), tests.body(p_m := 4.9))), 'out_of_range', 'skeletal muscle below range');
select is(tests.err(public.save_body_composition(tests.u('m1'), tests.body(p_f := 0.4))), 'out_of_range', 'fat mass below range');
select is(tests.err(public.save_body_composition(tests.u('m1'), tests.body(p_pct := 75.1))), 'out_of_range', 'fat % above range');
select is(tests.err(public.save_body_composition(tests.u('m1'), tests.body(p_w := 40.0, p_m := 25.0, p_f := 15.0, p_pct := 37.5))),
          'inconsistent', 'skeletal muscle + fat mass must be less than weight');
select is(tests.err(public.save_body_composition(tests.u('m1'), tests.body(p_w := 55.05))), 'invalid_request', 'one decimal place only');
select is(tests.err(public.save_body_composition(tests.u('m1'), tests.body(p_at := now() + interval '1 day'))), 'invalid_request', 'no future measurement');
select is(tests.err(public.save_body_composition(tests.u('m1'), tests.body(p_at := now() - interval '400 days'))), 'invalid_request', 'not older than one year');
select is(tests.err(public.save_body_composition(tests.u('m1'), tests.body() || '{"weight_kg": "55"}')), 'invalid_request', 'numbers must be JSON numbers');
select is(tests.err(public.save_body_composition(tests.u('m1'), tests.body() || '{"device_model": " "}')), 'invalid_request', 'device is required');
select is(tests.err(public.save_body_composition(tests.u('m1'), tests.body() || '{"bmi": 20}')), 'invalid_request', 'unknown keys are rejected');
select is(tests.err(public.save_body_composition(tests.u('m1'), tests.body() || '{"condition": "x"}')), 'invalid_request', 'condition is an enum');

-- 修正と履歴
select is(tests.err(public.update_body_composition((select val from v where k = 'own'), tests.body(p_w := 56.0, p_pct := 26.8))), null, 'member edits own record');
select is((public.get_body_composition_history((select val from v where k = 'own')) -> 'data' -> 0 -> 'snapshot' ->> 'weight_kg'), '55.0',
          'history keeps the original values');
select is((public.get_body_composition_history((select val from v where k = 'own')) -> 'data' -> 1 ->> 'op'), 'update', 'history records the update');
select is((public.get_body_composition_history((select val from v where k = 'own')) -> 'data' -> 1 -> 'snapshot' ->> 'weight_kg'), '56.0',
          'history keeps the new values');
select is((select (e ->> 'edited')::boolean
             from jsonb_array_elements(public.get_body_compositions(tests.u('m1'), current_date - 1, current_date + 1) -> 'data') e
            where (e ->> 'id')::uuid = (select val from v where k = 'own')), true, 'edited flag is shown');

-- ===========================================================================
-- 担当スタッフ(body:write)
-- ===========================================================================
select tests.login('s_write', 'aal1');
select is(tests.err(public.save_body_composition(tests.u('m1'), tests.body())), 'forbidden', 'staff without MFA (aal1) is denied');
select tests.login('s_write');
insert into v select 'proxy', (public.save_body_composition(tests.u('m1'), tests.body(60.0, 24.0, 18.0, 30.0)) -> 'data' ->> 'id')::uuid;
select isnt((select val from v where k = 'proxy'), null, 'staff with body:write saves a proxy record');
reset role;
select is((select (entry_source, entered_by = tests.u('s_write'))::text from public.body_compositions where id = (select val from v where k = 'proxy')),
          '(staff,t)', 'entry source and entered_by are set by the server');
select tests.login('s_write');
select is(tests.err(public.update_body_composition((select val from v where k = 'proxy'), tests.body(60.5, 24.0, 18.0, 29.8))), null,
          'staff edits own proxy record within 7 days');
select is(tests.err(public.update_body_composition((select val from v where k = 'own'), tests.body())), 'forbidden',
          'staff cannot edit the member''s own record');
select is(tests.err(public.delete_body_composition((select val from v where k = 'proxy'))), 'forbidden', 'staff cannot delete');
select is(jsonb_array_length(public.get_body_compositions(tests.u('m1'), current_date - 1, current_date + 1) -> 'data'), 1,
          'body:write-only staff sees only own entries');
select is(tests.err(public.get_body_composition_history((select val from v where k = 'own'))), 'forbidden',
          'body:write-only staff cannot read history of records they did not enter');
select is(tests.err(public.save_body_composition(tests.u('m2'), tests.body())), 'forbidden', 'assigned but no consent → denied');
reset role;
update public.body_compositions set recorded_at = now() - interval '8 days' where id = (select val from v where k = 'proxy');
select tests.login('s_write');
select is(tests.err(public.update_body_composition((select val from v where k = 'proxy'), tests.body(61.0, 24.0, 18.0, 29.5))), 'forbidden',
          'staff cannot edit proxy records older than 7 days');

-- ===========================================================================
-- 閲覧スタッフ・食事だけのスタッフ・担当外・管理者
-- ===========================================================================
select tests.login('s_read');
select is(jsonb_array_length(public.get_body_compositions(tests.u('m1'), current_date - 1, current_date + 1) -> 'data'), 4,
          'staff with body:read sees all records');
select is(tests.err(public.get_body_composition_history((select val from v where k = 'own'))), null, 'body:read staff reads history');
select is(tests.err(public.save_body_composition(tests.u('m1'), tests.body())), 'forbidden', 'body:read staff cannot write');
select ok(not (public.get_body_composition_history((select val from v where k = 'own'))::text like '%entered_by"%'),
          'history does not expose user ids');
select tests.login('s_meals');
select is(tests.err(public.get_body_compositions(tests.u('m1'), current_date - 1, current_date + 1)), 'forbidden',
          'meals consent does not give body access');
select tests.login('s_unasg');
select is(tests.err(public.get_body_compositions(tests.u('m1'), current_date - 1, current_date + 1)), 'forbidden', 'unassigned staff is denied');
select is(tests.err(public.save_body_composition(tests.u('m1'), tests.body())), 'forbidden', 'unassigned staff cannot write');
select tests.login('admin');
select is(tests.err(public.get_body_compositions(tests.u('m1'), current_date - 1, current_date + 1)), 'forbidden', 'admin cannot read body data');
select tests.anon();
select throws_ok($$ select public.get_body_compositions(tests.u('m1'), current_date, current_date) $$, '42501', null, 'anon cannot call');

-- ===========================================================================
-- 同意の撤回・担当の終了で直ちに拒否
-- ===========================================================================
select tests.login('m1', 'aal1');
select is(tests.err(public.revoke_staff_consent(tests.u('s_read'), 'body:read')), null, 'member revokes body:read');
select tests.login('s_read');
select is(tests.err(public.get_body_compositions(tests.u('m1'), current_date - 1, current_date + 1)), 'forbidden', 'denied right after revoke');
select is(tests.err(public.get_body_composition_history((select val from v where k = 'own'))), 'forbidden', 'history denied after revoke');
reset role;
update public.staff_assignments set ended_at = now() where staff_id = tests.u('s_write') and member_id = tests.u('m1');
select tests.login('s_write');
select is(tests.err(public.save_body_composition(tests.u('m1'), tests.body())), 'forbidden', 'denied after the assignment ends');

-- ===========================================================================
-- 削除(本人のみ)と履歴
-- ===========================================================================
select tests.login('m1', 'aal1');
select is(tests.err(public.delete_body_composition((select val from v where k = 'own'))), null, 'member deletes own record');
select is((public.get_body_composition_history((select val from v where k = 'own')) -> 'data' -> -1 ->> 'op'), 'delete',
          'history keeps the deleted values for the member');
select tests.login('m2', 'aal1');
select is(tests.err(public.get_body_composition_history((select val from v where k = 'own'))), 'forbidden', 'other member cannot read history');

-- ===========================================================================
-- 監査
-- ===========================================================================
reset role;
select ok(exists (select 1 from audit.logs where action = 'body.save.proxy' and actor_id = tests.u('s_write')), 'proxy save audited');
select ok(exists (select 1 from audit.logs where action = 'body.read.staff' and actor_id = tests.u('s_read')), 'staff read audited');
select ok(exists (select 1 from audit.logs where action = 'body.read' and result = 'denied' and actor_id = tests.u('s_unasg')), 'denial audited');
select ok(exists (select 1 from audit.logs where action = 'body_compositions.delete' and subject_member_id = tests.u('m1')), 'delete audited by trigger');
select ok(not exists (select 1 from audit.logs where action like 'body%' and metadata::text ~ '5[56]\.0'), 'audit has no measured values');

-- ===========================================================================
-- スタッフのダッシュボード(同意のある列だけ。未記録は null)
-- ===========================================================================
reset role;
insert into public.staff_access_consents(member_id, staff_id, scope, document_id)
select tests.u('m2'), tests.u('s_write'), 'meals:read', (select id from public.consent_documents where kind = 'staff_sharing');
select tests.login('s_meals');
select is((public.staff_dashboard() -> 'data' -> 0 -> 'body'), 'null'::jsonb, 'no body:read → body column is null (同意なし)');
select is((public.staff_dashboard() -> 'data' -> 0 -> 'meals' -> 'last_meal_on'), 'null'::jsonb, 'meals:read but no meals → 未記録');
select is(jsonb_array_length(public.staff_dashboard() -> 'data' -> 0 -> 'meals' -> 'last_7_days'), 7, 'last 7 days of slot status');
select tests.login('m1', 'aal1');
select is(tests.err(public.grant_staff_consent(tests.u('s_meals'), 'body:read',
          (select id from public.consent_documents where kind = 'staff_sharing'))), null, 'member grants body:read');
select tests.login('s_meals');
select isnt((public.staff_dashboard() -> 'data' -> 0 -> 'body' ->> 'last_measured_at'), null, 'with body:read the latest measurement date is shown');
select ok(not ((public.staff_dashboard() -> 'data' -> 0 -> 'body') ? 'weight_kg'), 'dashboard does not list measured values');
select tests.login('s_write');
select is(jsonb_array_length(public.staff_dashboard() -> 'data'), 1, 'ended assignment disappears from the dashboard');
select is((public.staff_dashboard() -> 'data' -> 0 -> 'body'), 'null'::jsonb, 'm2: no body consent');
select isnt((public.staff_dashboard() -> 'data' -> 0 -> 'meals'), 'null'::jsonb, 'm2: meals:read column is present');

-- 警告の規則は packages/shared の bodyWarnings と同じ(境目の値で確かめる)
reset role;
select is(private.body_warnings(55.0, 15.0, 28.8), '[]'::jsonb, 'warning boundary: difference of exactly 1.5 is not a warning');
select is(private.body_warnings(55.0, 15.0, 28.9), '["fat_pct_mismatch"]'::jsonb, 'warning boundary: 1.6 is a warning');
select is(private.body_warnings(40.0, 0.5, 2.8), '[]'::jsonb, 'rounding half up (1.25 → 1.3) like the TypeScript rule');
select is(private.body_warnings(40.0, 0.5, 2.9), '["fat_pct_mismatch"]'::jsonb, 'rounding boundary + 1.6');

select * from finish();
rollback;
