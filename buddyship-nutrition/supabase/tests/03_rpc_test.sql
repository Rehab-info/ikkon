-- RPC:同意・規約同意・管理者操作・スタッフ一覧・拒否の監査(TEST_PLAN §3 追加ケース)
begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/setup.psql
select no_plan();

insert into tests.users values
  ('admin',       tests.new_user('管理者', tests.org_a(), '{admin}')),
  ('admin2',      tests.new_user('管理者2', tests.org_a(), '{admin}')),
  ('staff1',      tests.new_user('スタッフ1', tests.org_a(), '{staff}')),
  ('staff2',      tests.new_user('スタッフ2', tests.org_a(), '{staff}')),
  ('m1',          tests.new_user('利用者1', tests.org_a(), '{member}')),
  ('m2',          tests.new_user('利用者2', tests.org_a(), '{member}')),
  ('b_member',    tests.new_user('他組織利用者', tests.org_b(), '{member}'));
create temp table v(k text primary key, val uuid);
grant all on v to authenticated;
insert into v values ('doc', (select id from public.consent_documents where kind = 'staff_sharing'));

-- ===========================================================================
-- 規約同意(my_context / accept_documents)
-- ===========================================================================
select tests.login('m1', 'aal1');
select is(jsonb_array_length(public.my_context() -> 'data' -> 'pending_documents'), 3,
          'member has 3 pending documents (terms, privacy, ai_processing)');
select is(tests.err(public.accept_documents(array[gen_random_uuid()])), 'invalid_request', 'unknown document is rejected');
select is(tests.err(public.accept_documents('{}')), 'invalid_request', 'empty list is rejected');
select is(tests.err(public.accept_documents(array(
  select (d ->> 'id')::uuid from jsonb_array_elements(public.my_context() -> 'data' -> 'pending_documents') d))),
  null, 'member accepts pending documents');
select is(jsonb_array_length(public.my_context() -> 'data' -> 'pending_documents'), 0, 'no pending documents after accepting');
select is(public.my_context() -> 'data' -> 'roles', '["member"]'::jsonb, 'roles are reported');

select tests.login('staff1', 'aal1');
select is(jsonb_array_length(public.my_context() -> 'data' -> 'pending_documents'), 2, 'staff has 2 pending documents');
select is(public.my_context() -> 'data' ->> 'aal', 'aal1', 'aal is reported');

-- ===========================================================================
-- 管理者:担当割当
-- ===========================================================================
select tests.login('admin', 'aal1');
select is(tests.err(public.admin_assign_staff(tests.u('staff1'), tests.u('m1'))), 'forbidden', 'admin without MFA is denied');

select tests.login('admin');
select is(tests.err(public.admin_assign_staff(tests.u('staff1'), tests.u('m1'))), null, 'admin assigns staff1 -> m1');
select is(tests.err(public.admin_assign_staff(tests.u('staff1'), tests.u('m1'))), 'conflict', 'duplicate assignment is rejected');
select is(tests.err(public.admin_assign_staff(tests.u('staff2'), tests.u('b_member'))), 'not_found', 'cross-organization assignment is rejected');
select is(tests.err(public.admin_assign_staff(tests.u('m2'), tests.u('m1'))), 'invalid_request', 'non-staff cannot be assigned');
select is(tests.err(public.admin_assign_staff(tests.u('staff1'), tests.u('staff2'))), 'invalid_request', 'only members can be assigned to');
select is(tests.err(public.admin_set_role(tests.u('admin'), 'staff', true)), 'forbidden', 'admin cannot change own roles');
select is(tests.err(public.admin_set_role(tests.u('b_member'), 'staff', true)), 'not_found', 'admin cannot change other org roles');

-- admin2 を管理者兼スタッフにしても、自分自身を割り当てることはできない
select is(tests.err(public.admin_set_role(tests.u('admin2'), 'staff', true)), null, 'admin grants staff role to admin2');
select tests.login('admin2');
select is(tests.err(public.admin_assign_staff(tests.u('admin2'), tests.u('m2'))), 'forbidden', 'admin cannot assign self as staff');

select tests.login('staff1');
select is(tests.err(public.admin_assign_staff(tests.u('staff1'), tests.u('m2'))), 'forbidden', 'staff cannot call admin RPC');
select tests.login('m1');
select is(tests.err(public.admin_list_users()), 'forbidden', 'member cannot list users');

-- 管理者の一覧に健康データ・同意の中身は含まれない
select tests.login('admin');
select is((select array_agg(distinct k order by k) from jsonb_array_elements(public.admin_list_users() -> 'data') e,
                 jsonb_object_keys(e) k),
          array['display_name', 'facility_id', 'roles', 'user_id'], 'admin user list contains only account fields');
select is(jsonb_array_length(public.admin_list_users() -> 'data'),
          (select count(*)::int from public.profiles where organization_id = tests.org_a()),
          'admin lists own organization only');
select is((select count(*)::int from jsonb_array_elements(public.admin_list_users() -> 'data') e
           where (e ->> 'user_id')::uuid = tests.u('b_member')), 0, 'other organization users are not listed');

-- ===========================================================================
-- 利用者:同意の付与・撤回
-- ===========================================================================
select tests.login('m1', 'aal1');
select is(jsonb_array_length(public.list_my_staff() -> 'data'), 1, 'm1 sees one assigned staff');
select is(tests.err(public.grant_staff_consent(tests.u('staff1'), 'meals:write', (select val from v where k = 'doc'))), null,
          'm1 grants meals:write to staff1');
select is(tests.err(public.grant_staff_consent(tests.u('staff1'), 'meals:write', (select val from v where k = 'doc'))), null,
          'granting twice is idempotent');
select is(tests.err(public.grant_staff_consent(tests.u('staff2'), 'meals:read', (select val from v where k = 'doc'))), 'forbidden',
          'cannot grant to unassigned staff');
select is(tests.err(public.grant_staff_consent(tests.u('staff1'), 'meals:read',
          (select id from public.consent_documents where kind = 'terms'))), 'invalid_request',
          'consent must reference the staff_sharing document');
select is(public.list_my_staff() -> 'data' -> 0 -> 'scopes', '["meals:write"]'::jsonb, 'list_my_staff shows granted scopes');

select tests.login('staff1');
select is(tests.err(public.grant_staff_consent(tests.u('staff1'), 'meals:read', (select val from v where k = 'doc'))), 'forbidden',
          'staff cannot grant consent (not a member)');
select tests.login('admin');
select is(tests.err(public.grant_staff_consent(tests.u('staff1'), 'meals:read', (select val from v where k = 'doc'))), 'forbidden',
          'admin cannot grant consent');

-- ===========================================================================
-- スタッフ:担当利用者一覧
-- ===========================================================================
select tests.login('staff1');
select is(jsonb_array_length(public.staff_dashboard() -> 'data'), 1, 'staff1 dashboard lists m1');
select is(public.staff_dashboard() -> 'data' -> 0 -> 'scopes', '["meals:write"]'::jsonb, 'dashboard shows scopes');
select tests.login('staff1', 'aal1');
select is(tests.err(public.staff_dashboard()), 'forbidden', 'dashboard requires MFA');
select tests.login('m1');
select is(tests.err(public.staff_dashboard()), 'forbidden', 'member cannot open staff dashboard');
select tests.login('staff2');
select is(jsonb_array_length(public.staff_dashboard() -> 'data'), 0, 'staff2 has no assigned members');

-- 撤回 → 同じセッションのまま拒否
select tests.login('m1', 'aal1');
select is(tests.err(public.revoke_staff_consent(tests.u('staff1'), 'meals:write')), null, 'm1 revokes meals:write');
select tests.login('staff1');
select ok(not authz.staff_can(tests.u('m1'), 'meals:write'), 'revoked scope is denied immediately');
select is(public.staff_dashboard() -> 'data' -> 0 -> 'scopes', '[]'::jsonb, 'dashboard shows no scopes after revoke');

-- 再付与 → 担当解除で自動撤回(D-07)
select tests.login('m1', 'aal1');
select is(tests.err(public.grant_staff_consent(tests.u('staff1'), 'body:read', (select val from v where k = 'doc'))), null, 're-grant');
select tests.login('admin');
select is(tests.err(public.admin_end_assignment(
  (select (e ->> 'assignment_id')::uuid from jsonb_array_elements(public.admin_list_assignments() -> 'data') e
    where (e ->> 'staff_id')::uuid = tests.u('staff1')))), null, 'admin ends assignment');
reset role;
select is((select revoke_reason from public.staff_access_consents
            where member_id = tests.u('m1') and staff_id = tests.u('staff1') and scope = 'body:read'),
          'assignment_ended', 'consents are revoked when the assignment ends');
select tests.login('staff1');
select is(jsonb_array_length(public.staff_dashboard() -> 'data'), 0, 'ended assignment disappears from dashboard');

-- 緊急停止
select tests.login('admin');
select is(tests.err(public.admin_assign_staff(tests.u('staff2'), tests.u('m2'))), null, 'assign staff2 -> m2');
select tests.login('m2', 'aal1');
select is(tests.err(public.grant_staff_consent(tests.u('staff2'), 'meals:read', (select val from v where k = 'doc'))), null, 'm2 grants');
select tests.login('admin');
select is(tests.err(public.admin_emergency_suspend_staff(tests.u('staff2'))), null, 'emergency suspend staff2');
select tests.login('staff2');
select is(tests.err(public.staff_dashboard()), 'forbidden', 'suspended staff is denied');
reset role;
select is((select revoke_reason from public.staff_access_consents where staff_id = tests.u('staff2')), 'admin_emergency',
          'consents revoked by emergency suspend');

-- ===========================================================================
-- 拒否は監査ログに残る(例外でロールバックされない)
-- ===========================================================================
select ok(exists (select 1 from audit.logs where action = 'consent.grant' and result = 'denied'
                  and actor_id = tests.u('staff1') and metadata ->> 'reason' = 'not_member'),
          'denied consent grant by staff is audited');
select ok(exists (select 1 from audit.logs where action = 'admin.assign_staff' and result = 'denied'
                  and actor_id = tests.u('admin2') and metadata ->> 'reason' = 'self_assignment'),
          'self assignment attempt is audited');
select ok(exists (select 1 from audit.logs where action = 'staff.dashboard.view' and result = 'denied'
                  and actor_id = tests.u('staff1') and metadata ->> 'reason' = 'mfa_required'),
          'MFA-less staff access is audited');
select ok(exists (select 1 from audit.logs where action = 'staff_access_consents.insert' and actor_id = tests.u('m1')),
          'consent grant is audited by trigger');

-- 監査ログの閲覧(管理者のみ・閲覧も記録)
select tests.login('admin');
select ok(jsonb_array_length(public.admin_list_audit_logs(now() - interval '1 day', now() + interval '1 day', 'consent.', 50) -> 'data') >= 1,
          'admin can read audit logs filtered by action');
select is(tests.err(public.admin_list_audit_logs(now() - interval '200 days', now(), null, 50)), 'invalid_request',
          'audit log range is limited');
reset role;
select ok(exists (select 1 from audit.logs where action = 'admin.list_audit_logs' and actor_id = tests.u('admin')),
          'audit log access is itself audited');
select tests.login('staff1');
select is(tests.err(public.admin_list_audit_logs(now() - interval '1 day', now(), null, 50)), 'forbidden',
          'staff cannot read audit logs');

-- 設定
select tests.login('admin');
select is(tests.err(public.admin_set_setting('ai_enabled', 'false')), null, 'admin can disable AI');
select is(tests.err(public.admin_set_setting('ai_member_day_limit', '"10"')), 'invalid_request', 'limit must be a number');
select is(tests.err(public.admin_set_setting('ai_member_day_limit', '1.5')), 'invalid_request', 'limit must be an integer');
select is(tests.err(public.admin_set_setting('unknown_key', '1')), 'invalid_request', 'unknown settings are rejected');

-- プロフィール登録(Auth 側のユーザーは Edge Function が作る。ここでは直接作成)
reset role;
insert into auth.users(id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-00000000aaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'new@example.invalid');
select tests.login('admin');
select is(tests.err(public.admin_register_profile('00000000-0000-4000-8000-00000000aaaa', '新しい利用者', 'admin')),
          'invalid_request', 'admin role cannot be granted at registration');
select is(tests.err(public.admin_register_profile('00000000-0000-4000-8000-00000000aaaa', '新しい利用者', 'member',
          '00000000-0000-4000-8000-000000000201')), 'invalid_request', 'facility of another organization is rejected');
select is(tests.err(public.admin_register_profile('00000000-0000-4000-8000-00000000aaaa', '新しい利用者', 'member',
          '00000000-0000-4000-8000-000000000101')), null, 'admin registers a member profile');
select is(tests.err(public.admin_register_profile('00000000-0000-4000-8000-00000000aaaa', '二重', 'member')), 'conflict',
          'duplicate registration is rejected');
select is(tests.err(public.admin_register_profile(gen_random_uuid(), '存在しない', 'member')), 'not_found',
          'unknown auth user is rejected');

select * from finish();
rollback;
