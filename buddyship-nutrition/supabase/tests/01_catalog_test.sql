-- カタログ検査:RLS の付け忘れ・定義者関数の search_path・権限の漏れを機械的に検出する
-- (新しいテーブル・関数を追加したときの付け忘れ防止。TEST_PLAN §4)
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- 1. public / audit / private の全テーブルで RLS が有効
select is(
  (select coalesce(array_agg(n.nspname || '.' || c.relname order by 1), '{}')
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p') and n.nspname in ('public', 'audit', 'private')
      and not c.relrowsecurity),
  '{}'::text[],
  'all tables in public/audit/private have RLS enabled'
);

-- 2. SECURITY DEFINER 関数はすべて search_path を固定している
select is(
  (select coalesce(array_agg(n.nspname || '.' || p.proname order by 1), '{}')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'authz', 'audit', 'private') and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')),
  '{}'::text[],
  'all SECURITY DEFINER functions pin search_path'
);

-- 3. 関数に PUBLIC / anon の EXECUTE がない
select is(
  (select coalesce(array_agg(n.nspname || '.' || p.proname order by 1), '{}')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'authz', 'audit', 'private')
      and (has_function_privilege('anon', p.oid, 'EXECUTE')
           or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                      where a.grantee = 0 and a.privilege_type = 'EXECUTE'))),
  '{}'::text[],
  'no function is executable by PUBLIC or anon'
);

-- 4. private / audit の関数は authenticated から直接呼べない
select is(
  (select coalesce(array_agg(n.nspname || '.' || p.proname order by 1), '{}')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('audit', 'private') and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  '{}'::text[],
  'audit/private functions are not executable by authenticated'
);

-- 5. anon は public のテーブルに何の権限も持たない
select is(
  (select coalesce(array_agg(c.relname::text order by 1), '{}')
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
      and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'INSERT')
           or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE'))),
  '{}'::text[],
  'anon has no privileges on public tables'
);

-- 6. authenticated は public のテーブルに INSERT / DELETE を持たない(書き込みは RPC 経由)
select is(
  (select coalesce(array_agg(c.relname::text order by 1), '{}')
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and (has_table_privilege('authenticated', c.oid, 'INSERT') or has_table_privilege('authenticated', c.oid, 'DELETE')
           or has_table_privilege('authenticated', c.oid, 'TRUNCATE'))),
  '{}'::text[],
  'authenticated cannot insert/delete/truncate public tables directly'
);

-- 7. UPDATE できる列は profiles の表示名・文字サイズだけ
select is(
  (select coalesce(array_agg((table_name || '.' || column_name)::text order by (table_name || '.' || column_name) collate "C"), '{}')
     from information_schema.column_privileges
    where grantee = 'authenticated' and privilege_type = 'UPDATE' and table_schema = 'public'),
  array['profiles.display_name', 'profiles.font_scale']::text[],
  'only profiles.display_name and profiles.font_scale are directly updatable'
);

-- 8. ビューは security_invoker(RLS のすり抜け防止)
select is(
  (select coalesce(array_agg(c.relname::text order by 1), '{}')
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
      and not coalesce('security_invoker=true' = any (c.reloptions), false)),
  '{}'::text[],
  'all public views use security_invoker'
);

-- 9. authenticated は audit / private スキーマを使えない
select ok(not has_schema_privilege('authenticated', 'audit', 'USAGE'), 'authenticated has no USAGE on audit');
select ok(not has_schema_privilege('authenticated', 'private', 'USAGE'), 'authenticated has no USAGE on private');

-- 10. 監査ログは追記専用(postgres でも UPDATE / DELETE / TRUNCATE できない)
insert into audit.logs(action, result) values ('test.catalog', 'allowed');
select throws_ok($$ update audit.logs set result = 'denied' $$, '42501', null, 'audit.logs cannot be updated');
select throws_ok($$ delete from audit.logs $$, '42501', null, 'audit.logs cannot be deleted');
select throws_ok($$ truncate audit.logs $$, '42501', null, 'audit.logs cannot be truncated');

-- 11. 同意文書は版の書き換え不可、本文とハッシュが一致しないものは入らない
select throws_ok($$ update public.consent_documents set title = 'x' $$, '42501', null, 'consent documents are append-only');
select throws_ok(
  $$ insert into public.consent_documents(kind, version, title, body, content_sha256)
     values ('terms', 'bad', 't', 'body', repeat('0', 64)) $$,
  '23514', null, 'consent document hash must match body');

select * from finish();
rollback;
