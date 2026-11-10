-- 権限マトリクス(TEST_PLAN §3):認可判定関数と RLS
begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/setup.psql
select no_plan();

-- ---------------------------------------------------------------------------
-- 登場人物(すべて架空)
-- ---------------------------------------------------------------------------
insert into tests.users values
  ('admin',       tests.new_user('管理者', tests.org_a(), '{admin}')),
  ('admin_staff', tests.new_user('管理者兼スタッフ', tests.org_a(), '{admin,staff}')),
  ('staff1',      tests.new_user('スタッフ1', tests.org_a(), '{staff}')),
  ('staff2',      tests.new_user('スタッフ2', tests.org_a(), '{staff}')),
  ('m1',          tests.new_user('利用者1', tests.org_a(), '{member}')),
  ('m2',          tests.new_user('利用者2', tests.org_a(), '{member}')),
  ('b_staff',     tests.new_user('他組織スタッフ', tests.org_b(), '{staff}')),
  ('b_member',    tests.new_user('他組織利用者', tests.org_b(), '{member}'));

insert into public.staff_assignments(organization_id, staff_id, member_id, created_by) values
  (tests.org_a(), tests.u('staff1'), tests.u('m1'), tests.u('admin')),
  (tests.org_a(), tests.u('staff2'), tests.u('m2'), tests.u('admin')),
  (tests.org_a(), tests.u('admin_staff'), tests.u('m2'), tests.u('admin'));

insert into public.staff_access_consents(member_id, staff_id, scope, document_id)
select tests.u('m1'), tests.u('staff1'), s::public.consent_scope,
       (select id from public.consent_documents where kind = 'staff_sharing')
from unnest(array['meals:read', 'body:write']) s;
insert into public.staff_access_consents(member_id, staff_id, scope, document_id)
select tests.u('m2'), tests.u('admin_staff'), 'meals:read',
       (select id from public.consent_documents where kind = 'staff_sharing');

-- ===========================================================================
-- A. staff_can の真理値表
-- ===========================================================================
select tests.login('staff1');
select ok(authz.staff_can(tests.u('m1'), 'meals:read'), 'staff1 (aal2, assigned, consent) can read m1 meals');
select ok(authz.staff_can(tests.u('m1'), 'body:write'), 'staff1 can write m1 body (consented)');
select ok(not authz.staff_can(tests.u('m1'), 'meals:write'), 'read consent does not imply meals:write');
select ok(not authz.staff_can(tests.u('m1'), 'body:read'), 'body:write does not imply body:read (D-07)');
select ok(not authz.staff_can(tests.u('m2'), 'meals:read'), 'staff1 cannot access unassigned m2');
select ok(not authz.staff_can(tests.u('staff1'), 'meals:read'), 'staff_can is false for self');
select ok(not authz.staff_can(null, 'meals:read'), 'staff_can is false for null member');

select tests.login('staff1', 'aal1');
select ok(not authz.staff_can(tests.u('m1'), 'meals:read'), 'staff1 without MFA (aal1) is denied');

select tests.login('staff2');
select ok(not authz.staff_can(tests.u('m1'), 'meals:read'), 'staff2 (not assigned to m1) is denied');
select ok(not authz.staff_can(tests.u('m2'), 'meals:read'), 'staff2 assigned to m2 but without consent is denied');

select tests.login('admin');
select ok(not authz.staff_can(tests.u('m1'), 'meals:read'), 'admin is denied health data');
select ok(not authz.can_access(tests.u('m1'), 'meals:read'), 'admin can_access is false');

select tests.login('admin_staff');
select ok(authz.staff_can(tests.u('m2'), 'meals:read'), 'admin+staff acts only as staff with consent');
select ok(not authz.staff_can(tests.u('m1'), 'meals:read'), 'admin+staff gets nothing from admin role');

select tests.login('m1');
select ok(authz.can_access(tests.u('m1'), 'meals:write'), 'member can access own data');
select ok(not authz.can_access(tests.u('m2'), 'meals:read'), 'member cannot access other member');

-- 他組織:割当と同意を直接作っても、組織が違えば拒否
reset role;
insert into public.staff_assignments(organization_id, staff_id, member_id) values (tests.org_b(), tests.u('b_staff'), tests.u('m1'));
insert into public.staff_access_consents(member_id, staff_id, scope, document_id)
  values (tests.u('m1'), tests.u('b_staff'), 'meals:read', (select id from public.consent_documents where kind = 'staff_sharing'));
select tests.login('b_staff');
select ok(not authz.staff_can(tests.u('m1'), 'meals:read'), 'staff from another organization is denied');

-- 撤回は同じ JWT のまま次の判定から効く
select tests.login('staff1');
select ok(authz.staff_can(tests.u('m1'), 'meals:read'), 'before revoke: allowed');
reset role;
update public.staff_access_consents set revoked_at = now(), revoke_reason = 'member', revoked_by = tests.u('m1')
 where member_id = tests.u('m1') and staff_id = tests.u('staff1') and scope = 'meals:read' and revoked_at is null;
select tests.login('staff1');
select ok(not authz.staff_can(tests.u('m1'), 'meals:read'), 'after revoke: denied with the same session');
select ok(authz.staff_can(tests.u('m1'), 'body:write'), 'other scopes are unaffected by revoke');

-- 担当解除後は同意が残っていても拒否
reset role;
update public.staff_assignments set ended_at = now() where staff_id = tests.u('staff1') and member_id = tests.u('m1');
select tests.login('staff1');
select ok(not authz.staff_can(tests.u('m1'), 'body:write'), 'after assignment ended: denied even if consent row remains');

-- ロール剥奪後は拒否
reset role;
update public.staff_assignments set ended_at = null where staff_id = tests.u('staff1') and member_id = tests.u('m1');
select tests.login('staff1');
select ok(authz.staff_can(tests.u('m1'), 'body:write'), 'assignment restored: allowed again');
reset role;
update public.user_roles set revoked_at = now() where user_id = tests.u('staff1') and role = 'staff';
select tests.login('staff1');
select ok(not authz.staff_can(tests.u('m1'), 'body:write'), 'after staff role revoked: denied');
reset role;
update public.user_roles set revoked_at = null where user_id = tests.u('staff1') and role = 'staff';

-- user_metadata にロールを書いても権限は変わらない
update auth.users set raw_user_meta_data = '{"role":"admin"}', raw_app_meta_data = '{"role":"admin"}' where id = tests.u('m1');
select tests.login('m1');
select ok(not authz.is_admin(), 'user metadata role does not grant admin');

-- ===========================================================================
-- B. RLS:読み取り
-- ===========================================================================
select tests.login('m1');
select is((select count(*) from public.profiles), 1::bigint, 'member sees only own profile');
select is((select count(*) from public.user_roles), 1::bigint, 'member sees only own roles');
select is((select count(*) from public.staff_access_consents where member_id <> tests.u('m1')), 0::bigint,
          'member cannot see other members consents');
select is((select count(*) from public.staff_assignments where member_id <> tests.u('m1')), 0::bigint,
          'member sees only own assignments');
select is((select count(*) from public.organizations), 1::bigint, 'member sees only own organization');

select tests.login('m2');
select is((select count(*) from public.staff_access_consents where member_id = tests.u('m1')), 0::bigint,
          'm2 cannot see m1 consents');

select tests.login('staff1');
select is((select count(*) from public.staff_access_consents where staff_id <> tests.u('staff1')), 0::bigint,
          'staff sees only consents given to self');
select is((select count(*) from public.profiles), 1::bigint, 'staff cannot read member profiles directly (RPC only)');

select tests.login('admin');
select is((select count(*) from public.profiles), 6::bigint, 'admin (aal2) sees profiles of own organization only');
select is((select count(*) from public.staff_access_consents), 0::bigint, 'admin cannot read consents');
select is((select count(*) from public.staff_assignments where organization_id = tests.org_b()), 0::bigint,
          'admin cannot see other organization assignments');

select tests.login('admin', 'aal1');
select is((select count(*) from public.profiles), 1::bigint, 'admin without MFA sees only self');

select tests.anon();
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select * from public.staff_access_consents $$, '42501', null, 'anon cannot read consents');
select throws_ok($$ select public.my_context() $$, '42501', null, 'anon cannot call RPC');

-- ===========================================================================
-- C. RLS:書き込み
-- ===========================================================================
select tests.login('m1');
select throws_ok(
  $$ insert into public.staff_access_consents(member_id, staff_id, scope, document_id)
     values (tests.u('m1'), tests.u('staff2'), 'meals:read', gen_random_uuid()) $$,
  '42501', null, 'member cannot insert consents directly');
select throws_ok(
  $$ insert into public.user_roles(user_id, organization_id, role) values (tests.u('m1'), tests.org_a(), 'admin') $$,
  '42501', null, 'member cannot grant self a role');
select throws_ok($$ update public.profiles set organization_id = tests.org_b() $$, '42501', null,
  'member cannot change organization');
select throws_ok($$ delete from public.profiles $$, '42501', null, 'member cannot delete profiles');
select lives_ok($$ update public.profiles set display_name = '新しい名前', font_scale = 2 $$, 'member can update own display settings');
update public.profiles set display_name = '乗っ取り' where user_id = tests.u('m2');
reset role;
select is((select display_name from public.profiles where user_id = tests.u('m2')), '利用者2', 'member cannot update another profile');
select is((select font_scale from public.profiles where user_id = tests.u('m1')), 2::smallint, 'own profile updated');

select tests.login('staff1');
select throws_ok($$ select * from audit.logs $$, '42501', null, 'staff cannot read audit logs');
select throws_ok($$ select audit.log('x.y', 'allowed') $$, '42501', null, 'staff cannot write audit logs directly');
select throws_ok($$ select * from private.settings $$, '42501', null, 'staff cannot read private settings');

-- ===========================================================================
-- D. 変更監査:値を残さず列名だけ残る
-- ===========================================================================
reset role;
select ok(exists (select 1 from audit.logs where action = 'profiles.update' and subject_member_id = tests.u('m1')
                  and metadata -> 'columns' @> '["display_name","font_scale"]'),
          'profile update is audited with column names');
select ok(not exists (select 1 from audit.logs where metadata::text like '%新しい名前%'),
          'audit logs do not contain values');
select throws_ok($$ select audit.log('x.y', 'allowed', null, null, null, '{"weight_kg": 60}') $$, '22023', null,
                 'audit metadata rejects keys outside the allow-list');
select throws_ok($$ select audit.log('x.y', 'allowed', null, null, null, jsonb_build_object('reason', repeat('a', 65))) $$,
                 '22023', null, 'audit metadata rejects long values');

-- テーブル制約
select throws_ok(
  $$ insert into public.staff_assignments(organization_id, staff_id, member_id, created_by)
     values (tests.org_a(), tests.u('admin_staff'), tests.u('m1'), tests.u('admin_staff')) $$,
  '23514', null, 'an admin cannot be the creator of their own assignment');
select throws_ok(
  $$ insert into public.user_roles(user_id, organization_id, role) values (tests.u('m1'), tests.org_b(), 'staff') $$,
  '23514', null, 'role organization must match profile organization');

select * from finish();
rollback;
