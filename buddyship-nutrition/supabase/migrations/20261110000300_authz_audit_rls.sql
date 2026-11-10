-- Sprint 1 / 03: 認可判定関数・監査の書き込み・変更監査トリガー・RLS ポリシー・権限
-- 設計: docs/DATABASE.md §4, §5 / docs/SECURITY.md §3

-- ===========================================================================
-- 認可判定関数(authz)。毎回 DB の現在値で判定し、JWT にロールや同意を持たせない
-- ===========================================================================
create function authz.has_role(p_role public.app_role) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role = p_role and r.revoked_at is null
  );
$$;

-- MFA(TOTP)まで完了したセッションか
create function authz.is_aal2() returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;

create function authz.my_org() returns uuid
language sql stable security definer
set search_path = ''
as $$
  select p.organization_id from public.profiles p where p.user_id = (select auth.uid());
$$;

-- 管理者:ロールあり かつ MFA 済み。健康データの判定には一切使わない
create function authz.is_admin() returns boolean
language sql stable
set search_path = ''
as $$
  select authz.has_role('admin') and authz.is_aal2();
$$;

-- 有効なスタッフ:ロールあり かつ MFA 済み
create function authz.is_active_staff() returns boolean
language sql stable
set search_path = ''
as $$
  select authz.has_role('staff') and authz.is_aal2();
$$;

create function authz.same_org(p_user uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles me join public.profiles other on other.organization_id = me.organization_id
    where me.user_id = (select auth.uid()) and other.user_id = p_user
  );
$$;

create function authz.is_assigned(p_member uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_assignments a
    where a.staff_id = (select auth.uid()) and a.member_id = p_member
      and a.ended_at is null and a.started_at <= now()
  );
$$;

-- スタッフが担当利用者の特定スコープにアクセスできるか(すべて満たす場合のみ true)
--   有効なスタッフ(ロール+aal2) / 同一組織 / 有効な担当割当 / 該当スコープの有効な同意
create function authz.staff_can(p_member uuid, p_scope public.consent_scope) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_member is not null
    and (select auth.uid()) is not null
    and p_member <> (select auth.uid())
    and authz.is_active_staff()
    and authz.same_org(p_member)
    and authz.is_assigned(p_member)
    and exists (
      select 1 from public.staff_access_consents c
      where c.staff_id = (select auth.uid()) and c.member_id = p_member
        and c.scope = p_scope and c.revoked_at is null
    );
$$;

-- 本人 または 同意済み担当スタッフ
create function authz.can_access(p_member uuid, p_scope public.consent_scope) returns boolean
language sql stable
set search_path = ''
as $$
  select (p_member = (select auth.uid()) and authz.has_role('member'))
      or authz.staff_can(p_member, p_scope);
$$;

revoke all on all functions in schema authz from public;
grant execute on all functions in schema authz to authenticated;

-- ===========================================================================
-- 監査ログの書き込み(audit.log)。利用者からは直接呼べない
-- metadata は許可したキーだけ。値は短い文字列・数値・真偽値・文字列配列のみ(健康データを入れない)
-- ===========================================================================
create function audit.log(
  p_action text,
  p_result text,
  p_subject_member_id uuid default null,
  p_resource_type text default null,
  p_resource_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_allowed constant text[] := array['op', 'columns', 'scope', 'scopes', 'reason', 'role', 'status',
                                     'counter', 'limit', 'count', 'target_user_id', 'error', 'documents'];
  v_key text;
  v_val jsonb;
  v_actor uuid := auth.uid();
  v_headers json;
begin
  for v_key, v_val in select * from jsonb_each(coalesce(p_metadata, '{}'::jsonb)) loop
    if not (v_key = any (v_allowed)) then
      raise exception 'audit metadata key not allowed: %', v_key using errcode = '22023';
    end if;
    if jsonb_typeof(v_val) = 'string' and char_length(v_val #>> '{}') > 64 then
      raise exception 'audit metadata value too long' using errcode = '22023';
    end if;
    if jsonb_typeof(v_val) = 'object' then
      raise exception 'audit metadata value must be scalar or array' using errcode = '22023';
    end if;
  end loop;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_headers := null;
  end;

  insert into audit.logs(actor_id, actor_roles, action, subject_member_id, resource_type, resource_id,
                         result, request_id, metadata)
  values (
    v_actor,
    coalesce((select array_agg(r.role::text order by r.role)
              from public.user_roles r where r.user_id = v_actor and r.revoked_at is null), '{}'),
    p_action, p_subject_member_id, p_resource_type, p_resource_id, p_result,
    left(v_headers ->> 'x-request-id', 100),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;
revoke all on function audit.log(text, text, uuid, text, uuid, jsonb) from public, anon, authenticated;

-- 変更監査トリガー:どの経路(RPC・管理用 SQL)の変更も記録する。値は残さず、変わった列名だけ残す
-- TG_ARGV[0] = 利用者(健康データの持ち主)を表す列名、TG_ARGV[1] = 主キー列名
create function audit.on_change() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_cols text[];
begin
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(n.key order by n.key), '{}') into v_cols
    from jsonb_each(to_jsonb(new)) n
    where n.key <> 'updated_at' and n.value is distinct from (to_jsonb(old) -> n.key);
    if cardinality(v_cols) = 0 then
      return new;
    end if;
  end if;

  perform audit.log(
    tg_table_name || '.' || lower(tg_op),
    'allowed',
    nullif(v_row ->> tg_argv[0], '')::uuid,
    tg_table_name,
    nullif(v_row ->> tg_argv[1], '')::uuid,
    case when tg_op = 'UPDATE' then jsonb_build_object('columns', to_jsonb(v_cols))
         else jsonb_build_object('op', lower(tg_op)) end
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function audit.on_change() from public, anon, authenticated;

create trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function audit.on_change('user_id', 'user_id');
create trigger audit_user_roles after insert or update or delete on public.user_roles
  for each row execute function audit.on_change('user_id', 'id');
create trigger audit_staff_assignments after insert or update or delete on public.staff_assignments
  for each row execute function audit.on_change('member_id', 'id');
create trigger audit_staff_access_consents after insert or update or delete on public.staff_access_consents
  for each row execute function audit.on_change('member_id', 'id');
create trigger audit_user_agreements after insert or delete on public.user_agreements
  for each row execute function audit.on_change('user_id', 'document_id');

-- ===========================================================================
-- RLS ポリシー
--  - 利用者:自分の行だけ
--  - スタッフ:自分が当事者の割当・同意だけ(健康データは RPC 経由のみ。DATABASE §4.2 / D-08)
--  - 管理者:同一組織のアカウント・割当の管理情報だけ(健康データ・同意の中身は見ない)
-- ===========================================================================
create policy organizations_select on public.organizations for select to authenticated
  using (id = (select authz.my_org()));

create policy facilities_select on public.facilities for select to authenticated
  using (organization_id = (select authz.my_org()));

create policy profiles_select_self on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy profiles_select_admin on public.profiles for select to authenticated
  using ((select authz.is_admin()) and organization_id = (select authz.my_org()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy user_roles_select_self on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_roles_select_admin on public.user_roles for select to authenticated
  using ((select authz.is_admin()) and organization_id = (select authz.my_org()));

create policy staff_assignments_select_party on public.staff_assignments for select to authenticated
  using (staff_id = (select auth.uid()) or member_id = (select auth.uid()));
create policy staff_assignments_select_admin on public.staff_assignments for select to authenticated
  using ((select authz.is_admin()) and organization_id = (select authz.my_org()));

create policy consent_documents_select on public.consent_documents for select to authenticated
  using (true);

create policy user_agreements_select_self on public.user_agreements for select to authenticated
  using (user_id = (select auth.uid()));

create policy staff_access_consents_select_party on public.staff_access_consents for select to authenticated
  using (member_id = (select auth.uid()) or staff_id = (select auth.uid()));

-- ===========================================================================
-- テーブル権限(書き込みは RPC のみ。本人のプロフィールは表示名と文字サイズだけ直接更新できる)
-- ===========================================================================
revoke all on all tables in schema public from anon, authenticated;
grant select on public.organizations, public.facilities, public.profiles, public.user_roles,
  public.staff_assignments, public.consent_documents, public.user_agreements,
  public.staff_access_consents to authenticated;
grant update (display_name, font_scale) on public.profiles to authenticated;

revoke all on all tables in schema audit from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;
