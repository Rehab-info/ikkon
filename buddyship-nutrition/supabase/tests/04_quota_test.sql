-- AI 解析の利用量上限(TEST_PLAN §5)
begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/setup.psql
select no_plan();

insert into tests.users values
  ('staff1', tests.new_user('スタッフ1', tests.org_a(), '{staff}')),
  ('staff2', tests.new_user('スタッフ2', tests.org_a(), '{staff}')),
  ('m1',     tests.new_user('利用者1', tests.org_a(), '{member}')),
  ('m2',     tests.new_user('利用者2', tests.org_a(), '{member}'));
insert into public.staff_assignments(organization_id, staff_id, member_id) values
  (tests.org_a(), tests.u('staff1'), tests.u('m1')), (tests.org_a(), tests.u('staff2'), tests.u('m1'));
insert into public.staff_access_consents(member_id, staff_id, scope, document_id) values
  (tests.u('m1'), tests.u('staff1'), 'meals:write', (select id from public.consent_documents where kind = 'staff_sharing')),
  (tests.u('m1'), tests.u('staff2'), 'meals:read', (select id from public.consent_documents where kind = 'staff_sharing'));

update private.settings set value = '3' where key = 'ai_actor_minute_limit';
update private.settings set value = '5' where key = 'ai_member_day_limit';

-- 1 分あたりの上限
select tests.login('m1', 'aal1');
select is(tests.err(public.consume_ai_quota(tests.u('m1'))), null, 'call 1 ok');
select is(tests.err(public.consume_ai_quota(tests.u('m1'))), null, 'call 2 ok');
select is(tests.err(public.consume_ai_quota(tests.u('m1'))), null, 'call 3 ok');
select is(tests.err(public.consume_ai_quota(tests.u('m1'))), 'rate_limited', 'call 4 is rate limited');
reset role;
select is((select count from private.usage_counters where counter = 'ai_actor_minute' and subject_id = tests.u('m1')), 3,
          'minute counter does not exceed the limit');
select is((select count from private.usage_counters where counter = 'ai_member_day' and subject_id = tests.u('m1')), 3,
          'rejected call does not consume the daily quota (rolled back)');

-- 利用者の 1 日の上限は本人+代理入力の合計
update private.settings set value = '100' where key = 'ai_actor_minute_limit';
select tests.login('staff1');
select is(tests.err(public.consume_ai_quota(tests.u('m1'))), null, 'staff with meals:write: call 4 of day ok');
select is(tests.err(public.consume_ai_quota(tests.u('m1'))), null, 'call 5 of day ok');
select is(tests.err(public.consume_ai_quota(tests.u('m1'))), 'quota_exceeded', 'member daily quota includes proxy calls');
reset role;
select is((select count from private.usage_counters where counter = 'ai_staff_day' and subject_id = tests.u('staff1')), 2,
          'staff daily counter counts only successful calls');

-- 権限
select tests.login('staff2');
select is(tests.err(public.consume_ai_quota(tests.u('m1'))), 'forbidden', 'staff with only meals:read cannot use AI for member');
select tests.login('staff1', 'aal1');
select is(tests.err(public.consume_ai_quota(tests.u('m1'))), 'forbidden', 'staff without MFA cannot use AI');
select tests.login('m2', 'aal1');
select is(tests.err(public.consume_ai_quota(tests.u('m1'))), 'forbidden', 'member cannot use AI quota for another member');

-- AI 停止スイッチ
reset role;
update private.settings set value = 'false' where key = 'ai_enabled';
select tests.login('m2', 'aal1');
select is(tests.err(public.consume_ai_quota(tests.u('m2'))), 'ai_disabled', 'AI disabled switch');

-- 組織の月次上限
reset role;
update private.settings set value = 'true' where key = 'ai_enabled';
-- 今月すでに使った回数(結合テスト等の分を含む)+ 2 を上限にする
update private.settings set value = to_jsonb(coalesce((
  select count from private.usage_counters
  where counter = 'ai_org_month' and subject_id = tests.org_a()
    and period_start = date_trunc('month', now() at time zone 'Asia/Tokyo')), 0) + 2)
where key = 'ai_org_month_limit';
select tests.login('m2', 'aal1');
select is(tests.err(public.consume_ai_quota(tests.u('m2'))), null, 'org month: limit - 1 ok');
select is(tests.err(public.consume_ai_quota(tests.u('m2'))), null, 'org month: limit ok');
select is(tests.err(public.consume_ai_quota(tests.u('m2'))), 'quota_exceeded', 'organization monthly limit');

reset role;
select ok(exists (select 1 from audit.logs where action = 'ai.quota' and result = 'denied'
                  and metadata ->> 'counter' = 'ai_org_month'), 'quota denial is audited with counter name');

select * from finish();
rollback;
