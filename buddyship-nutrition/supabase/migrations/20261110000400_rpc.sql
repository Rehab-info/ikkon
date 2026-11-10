-- Sprint 1 / 04: RPC(利用者・スタッフ・管理者)と AI 利用量の上限
-- 設計: docs/API.md §3 / docs/DATABASE.md §4.3
--
-- 返り値の形(すべての RPC で共通):
--   成功 {"ok": true, "data": ...}   失敗 {"ok": false, "error": "<code>"}
-- 拒否を例外にすると同じトランザクションの監査ログも取り消されるため(DECISIONS R-07)、
-- 認可の拒否は「監査ログを書いてからエラー結果を返す」。
-- エラーコードは packages/shared/src/errors.ts と一致させる。

create function private.ok(p_data jsonb default null) returns jsonb
language sql immutable
set search_path = ''
as $$ select jsonb_build_object('ok', true, 'data', p_data); $$;

create function private.err(p_code text) returns jsonb
language sql immutable
set search_path = ''
as $$ select jsonb_build_object('ok', false, 'error', p_code); $$;

-- 拒否の記録とエラー結果
create function private.deny(p_action text, p_subject uuid default null, p_reason text default 'forbidden')
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  perform audit.log(p_action, 'denied', p_subject, null, null, jsonb_build_object('reason', p_reason));
  return private.err(case when p_reason in ('unauthenticated', 'quota_exceeded', 'rate_limited', 'ai_disabled')
                          then p_reason else 'forbidden' end);
end;
$$;

-- 同意文書の各種類の最新版
create function private.latest_documents() returns setof public.consent_documents
language sql stable
set search_path = ''
as $$
  select distinct on (d.kind) d.* from public.consent_documents d
  order by d.kind, d.published_at desc, d.id;
$$;

-- ===========================================================================
-- 共通
-- ===========================================================================

-- ログイン中の利用者の状態(画面の振り分け用)
create function public.my_context() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_roles text[];
  v_required text[];
begin
  if v_uid is null then
    return private.err('unauthenticated');
  end if;
  select * into v_profile from public.profiles where user_id = v_uid;
  if not found then
    return private.ok(jsonb_build_object('registered', false));
  end if;
  select coalesce(array_agg(role::text order by role), '{}') into v_roles
    from public.user_roles where user_id = v_uid and revoked_at is null;
  v_required := case when 'member' = any (v_roles) then array['terms', 'privacy', 'ai_processing']
                     else array['terms', 'privacy'] end;
  return private.ok(jsonb_build_object(
    'registered', true,
    'user_id', v_uid,
    'display_name', v_profile.display_name,
    'font_scale', v_profile.font_scale,
    'organization_id', v_profile.organization_id,
    'facility_id', v_profile.facility_id,
    'roles', to_jsonb(v_roles),
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1'),
    'pending_documents', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'kind', d.kind, 'version', d.version, 'title', d.title, 'body', d.body)
                       order by array_position(v_required, d.kind))
      from private.latest_documents() d
      where d.kind = any (v_required)
        and not exists (select 1 from public.user_agreements a where a.user_id = v_uid and a.document_id = d.id)
    ), '[]'::jsonb)
  ));
end;
$$;

-- 規約・プライバシーポリシー等への同意(最新版のみ受け付ける)
create function public.accept_documents(p_document_ids uuid[]) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return private.err('unauthenticated'); end if;
  if not exists (select 1 from public.profiles where user_id = v_uid) then
    return private.err('forbidden');
  end if;
  if p_document_ids is null or cardinality(p_document_ids) = 0 or cardinality(p_document_ids) > 10 then
    return private.err('invalid_request');
  end if;
  if exists (
    select 1 from unnest(p_document_ids) as x(id)
    where x.id not in (select d.id from private.latest_documents() d)
  ) then
    return private.err('invalid_request');
  end if;
  insert into public.user_agreements(user_id, document_id)
  select v_uid, x.id from unnest(p_document_ids) as x(id)
  on conflict do nothing;
  return private.ok();
end;
$$;

-- ===========================================================================
-- 利用者
-- ===========================================================================

-- 自分の担当スタッフと、付与中のスコープ
create function public.list_my_staff() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return private.err('unauthenticated'); end if;
  if not authz.has_role('member') then return private.err('forbidden'); end if;
  return private.ok(coalesce((
    select jsonb_agg(jsonb_build_object(
      'staff_id', a.staff_id,
      'display_name', p.display_name,
      'assigned_at', a.started_at,
      'scopes', coalesce((
        select jsonb_agg(c.scope::text order by c.scope)
        from public.staff_access_consents c
        where c.member_id = v_uid and c.staff_id = a.staff_id and c.revoked_at is null
      ), '[]'::jsonb)
    ) order by p.display_name)
    from public.staff_assignments a
    join public.profiles p on p.user_id = a.staff_id
    where a.member_id = v_uid and a.ended_at is null
  ), '[]'::jsonb));
end;
$$;

-- 担当スタッフにスコープを付与する(本人だけ。スタッフ・管理者は付与できない)
create function public.grant_staff_consent(p_staff_id uuid, p_scope public.consent_scope, p_document_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return private.err('unauthenticated'); end if;
  if not authz.has_role('member') then
    return private.deny('consent.grant', null, 'not_member');
  end if;
  if p_staff_id is null or p_scope is null or p_document_id is null then
    return private.err('invalid_request');
  end if;
  -- 有効な担当割当がある、有効なスタッフにだけ付与できる
  if not exists (
    select 1 from public.staff_assignments a
    join public.user_roles r on r.user_id = a.staff_id and r.role = 'staff' and r.revoked_at is null
    where a.member_id = v_uid and a.staff_id = p_staff_id and a.ended_at is null
  ) then
    return private.deny('consent.grant', v_uid, 'not_assigned');
  end if;
  -- スタッフ共有の同意文書の最新版であること
  if not exists (
    select 1 from private.latest_documents() d where d.id = p_document_id and d.kind = 'staff_sharing'
  ) then
    return private.err('invalid_request');
  end if;
  insert into public.staff_access_consents(member_id, staff_id, scope, document_id)
  values (v_uid, p_staff_id, p_scope, p_document_id)
  on conflict (member_id, staff_id, scope) where revoked_at is null do nothing;
  return private.ok();
end;
$$;

-- 付与したスコープを撤回する(即時。次のリクエストから拒否される)
create function public.revoke_staff_consent(p_staff_id uuid, p_scope public.consent_scope) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return private.err('unauthenticated'); end if;
  if p_staff_id is null or p_scope is null then return private.err('invalid_request'); end if;
  update public.staff_access_consents
     set revoked_at = now(), revoked_by = v_uid, revoke_reason = 'member'
   where member_id = v_uid and staff_id = p_staff_id and scope = p_scope and revoked_at is null;
  return private.ok();
end;
$$;

-- ===========================================================================
-- スタッフ
-- ===========================================================================

-- 担当利用者の一覧。Sprint 1 は表示名と付与スコープのみ(食事・InBody の列は Sprint 2・3 で追加)
create function public.staff_dashboard() returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then return private.err('unauthenticated'); end if;
  if not authz.is_active_staff() then
    return private.deny('staff.dashboard.view', null,
                        case when authz.has_role('staff') then 'mfa_required' else 'not_staff' end);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'member_id', a.member_id,
      'display_name', p.display_name,
      'scopes', coalesce((
        select jsonb_agg(c.scope::text order by c.scope)
        from public.staff_access_consents c
        where c.staff_id = v_uid and c.member_id = a.member_id and c.revoked_at is null
      ), '[]'::jsonb)
    ) order by p.display_name), '[]'::jsonb)
    into v_result
    from public.staff_assignments a
    join public.profiles p on p.user_id = a.member_id
   where a.staff_id = v_uid and a.ended_at is null
     and p.organization_id = authz.my_org();
  perform audit.log('staff.dashboard.view', 'allowed', null, null, null,
                    jsonb_build_object('count', jsonb_array_length(v_result)));
  return private.ok(v_result);
end;
$$;

-- ===========================================================================
-- 管理者(admin かつ aal2)。健康データを返す管理者 RPC は作らない
-- ===========================================================================

create function private.require_admin(p_action text) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return private.err('unauthenticated'); end if;
  if not authz.is_admin() then
    return private.deny(p_action, null, case when authz.has_role('admin') then 'mfa_required' else 'not_admin' end);
  end if;
  return null;
end;
$$;

-- 管理者かどうかの確認(admin-invite-user が service role を使う前に、呼出者の JWT で確認する)
create function public.admin_check() returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_denied jsonb := private.require_admin('admin.invite_user');
begin
  if v_denied is not null then return v_denied; end if;
  return private.ok(jsonb_build_object('organization_id', authz.my_org()));
end;
$$;

-- Auth 側で作成済み(招待済み)のユーザーにプロフィールとロールを付ける
create function public.admin_register_profile(p_user_id uuid, p_display_name text, p_role public.app_role,
                                              p_facility_id uuid default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_denied jsonb := private.require_admin('admin.register_profile');
  v_org uuid := authz.my_org();
begin
  if v_denied is not null then return v_denied; end if;
  if p_user_id is null or p_role is null or p_role = 'admin'
     or p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 50 then
    return private.err('invalid_request');
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    return private.err('not_found');
  end if;
  if exists (select 1 from public.profiles where user_id = p_user_id) then
    return private.err('conflict');
  end if;
  if p_facility_id is not null and not exists (
    select 1 from public.facilities f where f.id = p_facility_id and f.organization_id = v_org
  ) then
    return private.err('invalid_request');
  end if;
  insert into public.profiles(user_id, organization_id, facility_id, display_name)
  values (p_user_id, v_org, p_facility_id, btrim(p_display_name));
  insert into public.user_roles(user_id, organization_id, role, granted_by)
  values (p_user_id, v_org, p_role, auth.uid());
  return private.ok(jsonb_build_object('user_id', p_user_id));
end;
$$;

-- ロールの付与・停止。自分自身のロールは変更できない(管理者が自分をスタッフにすることを防ぐ)
create function public.admin_set_role(p_user_id uuid, p_role public.app_role, p_active boolean) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_denied jsonb := private.require_admin('admin.set_role');
  v_uid uuid := auth.uid();
begin
  if v_denied is not null then return v_denied; end if;
  if p_user_id is null or p_role is null or p_active is null then return private.err('invalid_request'); end if;
  if p_user_id = v_uid then
    return private.deny('admin.set_role', null, 'self_change');
  end if;
  if not authz.same_org(p_user_id) then return private.err('not_found'); end if;

  if p_active then
    insert into public.user_roles(user_id, organization_id, role, granted_by)
    values (p_user_id, authz.my_org(), p_role, v_uid)
    on conflict (user_id, role) where revoked_at is null do nothing;
  else
    update public.user_roles set revoked_at = now(), revoked_by = v_uid
     where user_id = p_user_id and role = p_role and revoked_at is null;
    if p_role = 'staff' then
      -- スタッフ停止時は担当割当を終了し、同意も撤回する
      perform private.end_assignments_for_staff(p_user_id, v_uid, 'admin_emergency');
    end if;
  end if;
  return private.ok();
end;
$$;

-- 担当割当の終了と同意の自動撤回(D-07)
create function private.end_assignment(p_assignment_id uuid, p_by uuid, p_reason text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_a public.staff_assignments;
begin
  update public.staff_assignments set ended_at = now(), ended_by = p_by
   where id = p_assignment_id and ended_at is null
  returning * into v_a;
  if found then
    update public.staff_access_consents
       set revoked_at = now(), revoked_by = p_by, revoke_reason = p_reason
     where staff_id = v_a.staff_id and member_id = v_a.member_id and revoked_at is null;
  end if;
end;
$$;

create function private.end_assignments_for_staff(p_staff_id uuid, p_by uuid, p_reason text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in select id from public.staff_assignments where staff_id = p_staff_id and ended_at is null loop
    perform private.end_assignment(v_id, p_by, p_reason);
  end loop;
end;
$$;

create function public.admin_assign_staff(p_staff_id uuid, p_member_id uuid) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_denied jsonb := private.require_admin('admin.assign_staff');
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_denied is not null then return v_denied; end if;
  if p_staff_id is null or p_member_id is null or p_staff_id = p_member_id then
    return private.err('invalid_request');
  end if;
  if p_staff_id = v_uid then
    return private.deny('admin.assign_staff', p_member_id, 'self_assignment');
  end if;
  if not (authz.same_org(p_staff_id) and authz.same_org(p_member_id)) then
    return private.err('not_found');
  end if;
  if not exists (select 1 from public.user_roles where user_id = p_staff_id and role = 'staff' and revoked_at is null)
     or not exists (select 1 from public.user_roles where user_id = p_member_id and role = 'member' and revoked_at is null) then
    return private.err('invalid_request');
  end if;
  insert into public.staff_assignments(organization_id, staff_id, member_id, created_by)
  values (authz.my_org(), p_staff_id, p_member_id, v_uid)
  on conflict (staff_id, member_id) where ended_at is null do nothing
  returning id into v_id;
  if v_id is null then return private.err('conflict'); end if;
  return private.ok(jsonb_build_object('assignment_id', v_id));
end;
$$;

create function public.admin_end_assignment(p_assignment_id uuid) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_denied jsonb := private.require_admin('admin.end_assignment');
begin
  if v_denied is not null then return v_denied; end if;
  if not exists (select 1 from public.staff_assignments
                 where id = p_assignment_id and organization_id = authz.my_org() and ended_at is null) then
    return private.err('not_found');
  end if;
  perform private.end_assignment(p_assignment_id, auth.uid(), 'assignment_ended');
  return private.ok();
end;
$$;

-- インシデント時:スタッフのロール停止・全割当終了・全同意撤回
create function public.admin_emergency_suspend_staff(p_staff_id uuid) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_denied jsonb := private.require_admin('admin.emergency_suspend_staff');
begin
  if v_denied is not null then return v_denied; end if;
  if p_staff_id is null or p_staff_id = auth.uid() then return private.err('invalid_request'); end if;
  if not authz.same_org(p_staff_id) then return private.err('not_found'); end if;
  update public.user_roles set revoked_at = now(), revoked_by = auth.uid()
   where user_id = p_staff_id and role = 'staff' and revoked_at is null;
  perform private.end_assignments_for_staff(p_staff_id, auth.uid(), 'admin_emergency');
  return private.ok();
end;
$$;

-- 利用者・スタッフの一覧(表示名・ロール・拠点だけ。健康データ・同意の中身は返さない)
create function public.admin_list_users() returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_denied jsonb := private.require_admin('admin.list_users');
begin
  if v_denied is not null then return v_denied; end if;
  return private.ok(coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', p.user_id, 'display_name', p.display_name, 'facility_id', p.facility_id,
      'roles', coalesce((select jsonb_agg(r.role::text order by r.role) from public.user_roles r
                         where r.user_id = p.user_id and r.revoked_at is null), '[]'::jsonb)
    ) order by p.display_name)
    from public.profiles p where p.organization_id = authz.my_org()
  ), '[]'::jsonb));
end;
$$;

create function public.admin_list_assignments() returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_denied jsonb := private.require_admin('admin.list_assignments');
begin
  if v_denied is not null then return v_denied; end if;
  return private.ok(coalesce((
    select jsonb_agg(jsonb_build_object(
      'assignment_id', a.id, 'staff_id', a.staff_id, 'staff_name', s.display_name,
      'member_id', a.member_id, 'member_name', m.display_name, 'started_at', a.started_at
    ) order by m.display_name, s.display_name)
    from public.staff_assignments a
    join public.profiles s on s.user_id = a.staff_id
    join public.profiles m on m.user_id = a.member_id
    where a.organization_id = authz.my_org() and a.ended_at is null
  ), '[]'::jsonb));
end;
$$;

-- 監査ログの閲覧(閲覧したこと自体も記録)。健康データの値は監査ログに入っていない
create function public.admin_list_audit_logs(p_from timestamptz, p_to timestamptz,
                                             p_action_prefix text default null, p_limit integer default 100)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_denied jsonb := private.require_admin('admin.list_audit_logs');
  v_org uuid := authz.my_org();
  v_result jsonb;
begin
  if v_denied is not null then return v_denied; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > interval '93 days'
     or p_limit not between 1 and 500 or char_length(coalesce(p_action_prefix, '')) > 60 then
    return private.err('invalid_request');
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.occurred_at desc), '[]'::jsonb) into v_result
  from (
    select l.id, l.occurred_at, l.actor_id, l.actor_roles, l.action, l.subject_member_id,
           l.resource_type, l.resource_id, l.result, l.metadata
    from audit.logs l
    where l.occurred_at between p_from and p_to
      and (p_action_prefix is null or l.action like replace(replace(p_action_prefix, '%', ''), '_', '\_') || '%')
      and (l.actor_id in (select user_id from public.profiles where organization_id = v_org)
           or l.subject_member_id in (select user_id from public.profiles where organization_id = v_org))
    order by l.occurred_at desc
    limit p_limit
  ) x;
  perform audit.log('admin.list_audit_logs', 'allowed', null, null, null,
                    jsonb_build_object('count', jsonb_array_length(v_result)));
  return private.ok(v_result);
end;
$$;

-- 利用量の上限と AI の停止スイッチ
create function public.admin_get_settings() returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_denied jsonb := private.require_admin('admin.get_settings');
begin
  if v_denied is not null then return v_denied; end if;
  return private.ok((select jsonb_object_agg(key, value) from private.settings));
end;
$$;

create function public.admin_set_setting(p_key text, p_value jsonb) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_denied jsonb := private.require_admin('admin.set_setting');
begin
  if v_denied is not null then return v_denied; end if;
  if p_key = 'ai_enabled' then
    if jsonb_typeof(p_value) <> 'boolean' then return private.err('invalid_request'); end if;
  elsif p_key in ('ai_actor_minute_limit', 'ai_member_day_limit', 'ai_staff_day_limit',
                  'ai_org_month_limit', 'export_member_day_limit') then
    if jsonb_typeof(p_value) <> 'number' or (p_value #>> '{}')::numeric not between 0 and 100000
       or (p_value #>> '{}')::numeric <> trunc((p_value #>> '{}')::numeric) then
      return private.err('invalid_request');
    end if;
  else
    return private.err('invalid_request');
  end if;
  update private.settings set value = p_value, updated_at = now(), updated_by = auth.uid() where key = p_key;
  perform audit.log('admin.set_setting', 'allowed', null, null, null, jsonb_build_object('status', p_key));
  return private.ok();
end;
$$;

-- ===========================================================================
-- AI 解析の利用量(Sprint 2 の analyze-meal が呼出者の JWT で呼ぶ)
-- 呼出者の 1 分・利用者の 1 日・スタッフの 1 日・組織の 1 か月を原子的に加算する。
-- どれか 1 つでも上限なら、加算をすべて取り消して拒否する。
-- ===========================================================================
create function private.setting_int(p_key text) returns integer
language sql stable
set search_path = ''
as $$ select (value #>> '{}')::integer from private.settings where key = p_key; $$;

create function private.bump(p_counter text, p_subject uuid, p_period_start timestamp, p_limit integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into private.usage_counters as u(counter, subject_id, period_start, count)
  values (p_counter, p_subject, p_period_start, 1)
  on conflict (counter, subject_id, period_start)
  do update set count = u.count + 1 where u.count < p_limit
  returning u.count into v_count;
  return v_count is not null and v_count <= p_limit;
end;
$$;

create function public.consume_ai_quota(p_member_id uuid) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamp := now() at time zone 'Asia/Tokyo';
  v_exceeded text;
begin
  if v_uid is null then return private.err('unauthenticated'); end if;
  if p_member_id is null or not authz.can_access(p_member_id, 'meals:write') then
    return private.deny('ai.quota', p_member_id, 'forbidden');
  end if;
  if not coalesce((select (value #>> '{}')::boolean from private.settings where key = 'ai_enabled'), false) then
    return private.deny('ai.quota', p_member_id, 'ai_disabled');
  end if;

  begin
    if not private.bump('ai_actor_minute', v_uid, date_trunc('minute', v_now), private.setting_int('ai_actor_minute_limit')) then
      v_exceeded := 'ai_actor_minute';
    elsif not private.bump('ai_member_day', p_member_id, date_trunc('day', v_now), private.setting_int('ai_member_day_limit')) then
      v_exceeded := 'ai_member_day';
    elsif v_uid <> p_member_id
          and not private.bump('ai_staff_day', v_uid, date_trunc('day', v_now), private.setting_int('ai_staff_day_limit')) then
      v_exceeded := 'ai_staff_day';
    elsif not private.bump('ai_org_month', (select organization_id from public.profiles where user_id = p_member_id),
                           date_trunc('month', v_now), private.setting_int('ai_org_month_limit')) then
      v_exceeded := 'ai_org_month';
    end if;
    if v_exceeded is not null then
      raise exception using errcode = 'P0001', message = 'quota_exceeded';
    end if;
  exception when sqlstate 'P0001' then
    -- 加算をこのブロック内だけ取り消し、拒否は記録する
    perform audit.log('ai.quota', 'denied', p_member_id, null, null,
                      jsonb_build_object('reason', 'quota_exceeded', 'counter', v_exceeded));
    return private.err(case when v_exceeded = 'ai_actor_minute' then 'rate_limited' else 'quota_exceeded' end);
  end;
  return private.ok();
end;
$$;

-- ===========================================================================
-- 権限:RPC は authenticated のみ。private / audit の関数は誰にも直接呼ばせない
-- ===========================================================================
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.my_context(),
  public.accept_documents(uuid[]),
  public.list_my_staff(),
  public.grant_staff_consent(uuid, public.consent_scope, uuid),
  public.revoke_staff_consent(uuid, public.consent_scope),
  public.staff_dashboard(),
  public.admin_check(),
  public.admin_register_profile(uuid, text, public.app_role, uuid),
  public.admin_set_role(uuid, public.app_role, boolean),
  public.admin_assign_staff(uuid, uuid),
  public.admin_end_assignment(uuid),
  public.admin_emergency_suspend_staff(uuid),
  public.admin_list_users(),
  public.admin_list_assignments(),
  public.admin_list_audit_logs(timestamptz, timestamptz, text, integer),
  public.admin_get_settings(),
  public.admin_set_setting(text, jsonb),
  public.consume_ai_quota(uuid)
to authenticated;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on all functions in schema audit from public, anon, authenticated;
