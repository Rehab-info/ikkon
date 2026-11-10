-- Sprint 3:InBody(体組成)の記録・変更履歴、スタッフのダッシュボードの列、食事画像の削除キュー
-- 権限は既存の authz.staff_can / authz.can_access(担当割当 + 同意スコープ + aal2)を使う。
-- 指示の inbody.read / inbody.write は、既存の同意スコープ body:read / body:write に対応させる(DECISIONS D-35)

-- ===========================================================================
-- InBody
-- ===========================================================================
-- 測定の条件(時間帯・食事・運動で値が変わるため。グラフの注記に使う)。仮の区分 [D-12]
create type public.body_condition as enum ('before_meal', 'after_meal', 'unknown');

create table public.body_compositions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(user_id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  measured_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  -- 範囲は仮値。使用機種の測定範囲で見直す [D-12]
  weight_kg numeric(5,1) not null check (weight_kg between 20 and 300),
  skeletal_muscle_kg numeric(5,1) not null check (skeletal_muscle_kg between 5 and 100),
  body_fat_kg numeric(5,1) not null check (body_fat_kg between 0.5 and 200),
  body_fat_pct numeric(4,1) not null check (body_fat_pct between 1 and 75),
  device_model text not null check (char_length(btrim(device_model)) between 1 and 50),
  condition public.body_condition not null default 'unknown',
  entry_source public.entry_source not null,
  entered_by uuid references public.profiles(user_id) on delete set null,
  updated_at timestamptz not null default now(),
  -- 骨格筋量と体脂肪量は体重の一部(合計も体重未満)
  check (skeletal_muscle_kg < weight_kg and body_fat_kg < weight_kg and skeletal_muscle_kg + body_fat_kg < weight_kg)
);
create index body_compositions_member_idx on public.body_compositions(member_id, measured_at desc);
create trigger body_compositions_touch before update on public.body_compositions
  for each row execute function private.touch_updated_at();

-- 変更履歴(値のスナップショット)。追加・修正は変更後、削除は削除前の値を残す。
-- 記録が削除されても履歴は残る(利用者の削除・退会では profiles の削除でまとめて消える)
create table public.body_composition_history (
  id bigint generated always as identity primary key,
  body_composition_id uuid not null,
  member_id uuid not null references public.profiles(user_id) on delete cascade,
  op text not null check (op in ('insert', 'update', 'delete')),
  changed_by uuid references public.profiles(user_id) on delete set null,
  changed_at timestamptz not null default now(),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object')
);
create index body_composition_history_idx on public.body_composition_history(body_composition_id, changed_at);

alter table public.body_compositions enable row level security;
alter table public.body_composition_history enable row level security;
-- 直接のアクセスは誰にも許さない(すべて RPC 経由。RLS は有効にしてポリシーなし)
revoke all on public.body_compositions, public.body_composition_history from anon, authenticated;

create trigger audit_body_compositions after insert or update or delete on public.body_compositions
  for each row execute function audit.on_change('member_id', 'id');

create function private.body_snapshot(b public.body_compositions) returns jsonb
language sql immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'measured_at', b.measured_at, 'weight_kg', b.weight_kg, 'skeletal_muscle_kg', b.skeletal_muscle_kg,
    'body_fat_kg', b.body_fat_kg, 'body_fat_pct', b.body_fat_pct, 'device_model', b.device_model,
    'condition', b.condition, 'entry_source', b.entry_source, 'entered_by', b.entered_by);
$$;

-- 履歴はトリガーで残す(どの経路の変更も漏らさない)
create function private.body_history() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.body_compositions := case when tg_op = 'DELETE' then old else new end;
begin
  if tg_op = 'UPDATE' and private.body_snapshot(new) = private.body_snapshot(old) then
    return new;
  end if;
  insert into public.body_composition_history(body_composition_id, member_id, op, changed_by, snapshot)
  values (v_row.id, v_row.member_id, lower(tg_op), auth.uid(), private.body_snapshot(v_row));
  return v_row;
end;
$$;
create trigger body_compositions_history after insert or update or delete on public.body_compositions
  for each row execute function private.body_history();

-- 閲覧:本人、body:read のスタッフ(全件)、body:write だけのスタッフ(自分が入力した記録だけ。食事と同じ D-07 ①)
create function private.body_visible(p_member uuid, p_entered_by uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select authz.can_access(p_member, 'body:read')
      or (authz.staff_can(p_member, 'body:write') and p_entered_by = auth.uid());
$$;

-- 体脂肪量・体重から計算した体脂肪率と、入力された体脂肪率の差(ポイント)が大きいときの警告。保存は可
-- packages/shared の bodyWarnings と同じ規則(差が 1.5 ポイントを超える)
create function private.body_warnings(p_weight numeric, p_fat_kg numeric, p_fat_pct numeric) returns jsonb
language sql immutable
set search_path = ''
as $$
  select case when abs(round(p_fat_kg / p_weight * 100, 1) - p_fat_pct) > 1.5
              then '["fat_pct_mismatch"]'::jsonb else '[]'::jsonb end;
$$;

-- 入力の検証。エラーコードまたは null。範囲・小数 1 桁・測定日時(未来不可、1 年前まで)
create function private.check_body_payload(p jsonb) returns text
language plpgsql stable
set search_path = ''
as $$
declare
  v_keys constant text[] := array['measured_at', 'weight_kg', 'skeletal_muscle_kg', 'body_fat_kg', 'body_fat_pct',
                                  'device_model', 'condition'];
  v_k text;
  v_at timestamptz;
  v_w numeric; v_m numeric; v_f numeric; v_p numeric;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return 'invalid_request'; end if;
  for v_k in select jsonb_object_keys(p) loop
    if not (v_k = any (v_keys)) then return 'invalid_request'; end if;
  end loop;
  foreach v_k in array array['weight_kg', 'skeletal_muscle_kg', 'body_fat_kg', 'body_fat_pct'] loop
    if jsonb_typeof(p -> v_k) is distinct from 'number' then return 'invalid_request'; end if;
    if (p ->> v_k)::numeric <> round((p ->> v_k)::numeric, 1) then return 'invalid_request'; end if;
  end loop;
  if jsonb_typeof(p -> 'device_model') is distinct from 'string'
     or char_length(btrim(p ->> 'device_model')) not between 1 and 50 then
    return 'invalid_request';
  end if;
  if p ? 'condition' and (p ->> 'condition') not in ('before_meal', 'after_meal', 'unknown') then
    return 'invalid_request';
  end if;
  begin
    v_at := (p ->> 'measured_at')::timestamptz;
  exception when others then return 'invalid_request';
  end;
  if v_at is null or v_at > now() + interval '10 minutes' or v_at < now() - interval '365 days' then
    return 'invalid_request';
  end if;
  v_w := (p ->> 'weight_kg')::numeric; v_m := (p ->> 'skeletal_muscle_kg')::numeric;
  v_f := (p ->> 'body_fat_kg')::numeric; v_p := (p ->> 'body_fat_pct')::numeric;
  if v_w not between 20 and 300 or v_m not between 5 and 100 or v_f not between 0.5 and 200 or v_p not between 1 and 75 then
    return 'out_of_range';
  end if;
  if not (v_m < v_w and v_f < v_w and v_m + v_f < v_w) then
    return 'inconsistent';
  end if;
  return null;
end;
$$;

create function private.body_json(b public.body_compositions) returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', b.id, 'member_id', b.member_id, 'measured_at', b.measured_at, 'recorded_at', b.recorded_at,
    'updated_at', b.updated_at,
    'weight_kg', b.weight_kg, 'skeletal_muscle_kg', b.skeletal_muscle_kg, 'body_fat_kg', b.body_fat_kg,
    'body_fat_pct', b.body_fat_pct, 'device_model', b.device_model, 'condition', b.condition,
    'entry_source', b.entry_source,
    'entered_by_me', b.entered_by = auth.uid(),
    'entered_by_name', (select p.display_name from public.profiles p where p.user_id = b.entered_by),
    'edited', exists (select 1 from public.body_composition_history h where h.body_composition_id = b.id and h.op = 'update'),
    'warnings', private.body_warnings(b.weight_kg, b.body_fat_kg, b.body_fat_pct));
$$;

-- 追加:本人(member)または body:write の担当スタッフ
create function public.save_body_composition(p_member_id uuid, p_payload jsonb) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_err text;
  v_row public.body_compositions;
begin
  if v_uid is null then return private.err('unauthenticated'); end if;
  if p_member_id is null or not authz.can_access(p_member_id, 'body:write') then
    return private.deny('body.create', p_member_id, 'forbidden');
  end if;
  v_err := private.check_body_payload(p_payload);
  if v_err is not null then return private.err(v_err); end if;
  insert into public.body_compositions(member_id, organization_id, measured_at, weight_kg, skeletal_muscle_kg,
                                       body_fat_kg, body_fat_pct, device_model, condition, entry_source, entered_by)
  values (p_member_id, (select organization_id from public.profiles where user_id = p_member_id),
          (p_payload ->> 'measured_at')::timestamptz, (p_payload ->> 'weight_kg')::numeric,
          (p_payload ->> 'skeletal_muscle_kg')::numeric, (p_payload ->> 'body_fat_kg')::numeric,
          (p_payload ->> 'body_fat_pct')::numeric, btrim(p_payload ->> 'device_model'),
          coalesce(p_payload ->> 'condition', 'unknown')::public.body_condition,
          case when v_uid = p_member_id then 'self' else 'staff' end::public.entry_source, v_uid)
  returning * into v_row;
  perform audit.log(case when v_uid = p_member_id then 'body.save' else 'body.save.proxy' end, 'allowed',
                    p_member_id, 'body_compositions', v_row.id, '{}'::jsonb);
  return private.ok(jsonb_build_object('id', v_row.id,
                    'warnings', private.body_warnings(v_row.weight_kg, v_row.body_fat_kg, v_row.body_fat_pct)));
end;
$$;

-- 修正:本人は自分の全記録、スタッフは body:write かつ自分の代理入力かつ 7 日以内(食事と同じ D-07 ③)
create function public.update_body_composition(p_id uuid, p_payload jsonb) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.body_compositions;
  v_err text;
begin
  if v_uid is null then return private.err('unauthenticated'); end if;
  select * into v_row from public.body_compositions where id = p_id for update;
  if not found then return private.deny('body.update', null, 'not_found'); end if;
  if not ((v_uid = v_row.member_id and authz.has_role('member'))
          or (authz.staff_can(v_row.member_id, 'body:write') and v_row.entered_by = v_uid
              and v_row.recorded_at > now() - interval '7 days')) then
    return private.deny('body.update', v_row.member_id, 'forbidden');
  end if;
  v_err := private.check_body_payload(p_payload);
  if v_err is not null then return private.err(v_err); end if;
  update public.body_compositions set
         measured_at = (p_payload ->> 'measured_at')::timestamptz,
         weight_kg = (p_payload ->> 'weight_kg')::numeric,
         skeletal_muscle_kg = (p_payload ->> 'skeletal_muscle_kg')::numeric,
         body_fat_kg = (p_payload ->> 'body_fat_kg')::numeric,
         body_fat_pct = (p_payload ->> 'body_fat_pct')::numeric,
         device_model = btrim(p_payload ->> 'device_model'),
         condition = coalesce(p_payload ->> 'condition', 'unknown')::public.body_condition
   where id = p_id
  returning * into v_row;
  perform audit.log(case when v_uid = v_row.member_id then 'body.update' else 'body.update.proxy' end, 'allowed',
                    v_row.member_id, 'body_compositions', v_row.id, '{}'::jsonb);
  return private.ok(jsonb_build_object('id', v_row.id,
                    'warnings', private.body_warnings(v_row.weight_kg, v_row.body_fat_kg, v_row.body_fat_pct)));
end;
$$;

-- 削除は本人だけ(食事と同じ D-07 ④)。履歴には削除前の値が残る
create function public.delete_body_composition(p_id uuid) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.body_compositions;
begin
  if auth.uid() is null then return private.err('unauthenticated'); end if;
  select * into v_row from public.body_compositions where id = p_id;
  if not found or v_row.member_id <> auth.uid() or not authz.has_role('member') then
    return private.deny('body.delete', v_row.member_id, 'forbidden');
  end if;
  delete from public.body_compositions where id = p_id;
  return private.ok();
end;
$$;

-- 一覧(期間指定。最大 400 日)。スタッフの閲覧は監査に残す
create function public.get_body_compositions(p_member_id uuid, p_from date, p_to date) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_self boolean;
  v_result jsonb;
begin
  if v_uid is null then return private.err('unauthenticated'); end if;
  if p_member_id is null or p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    return private.err('invalid_request');
  end if;
  v_self := v_uid = p_member_id and authz.has_role('member');
  if not (v_self or authz.staff_can(p_member_id, 'body:read') or authz.staff_can(p_member_id, 'body:write')) then
    return private.deny('body.read', p_member_id, 'forbidden');
  end if;
  select coalesce(jsonb_agg(private.body_json(b) order by b.measured_at, b.recorded_at), '[]'::jsonb)
    into v_result
    from public.body_compositions b
   where b.member_id = p_member_id
     and (b.measured_at at time zone 'Asia/Tokyo')::date between p_from and p_to
     and (v_self or private.body_visible(b.member_id, b.entered_by));
  if not v_self then
    perform audit.log('body.read.staff', 'allowed', p_member_id, null, null,
                      jsonb_build_object('count', jsonb_array_length(v_result)));
  end if;
  return private.ok(v_result);
end;
$$;

-- 1 件の変更履歴(記録が見える人だけ。削除済みの記録の履歴は本人だけ)
create function public.get_body_composition_history(p_id uuid) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.body_compositions;
  v_member uuid;
  v_self boolean;
  v_result jsonb;
begin
  if v_uid is null then return private.err('unauthenticated'); end if;
  select * into v_row from public.body_compositions where id = p_id;
  if found then
    v_member := v_row.member_id;
  else
    select h.member_id into v_member from public.body_composition_history h where h.body_composition_id = p_id limit 1;
    if v_member is null then return private.deny('body.history', null, 'not_found'); end if;
  end if;
  v_self := v_uid = v_member and authz.has_role('member');
  if not (v_self or (v_row.id is not null and private.body_visible(v_row.member_id, v_row.entered_by))) then
    return private.deny('body.history', v_member, 'forbidden');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'op', h.op, 'changed_at', h.changed_at, 'snapshot', h.snapshot - 'entered_by',
           'changed_by_name', (select p.display_name from public.profiles p where p.user_id = h.changed_by),
           'changed_by_me', h.changed_by = v_uid) order by h.changed_at, h.id), '[]'::jsonb)
    into v_result
    from public.body_composition_history h where h.body_composition_id = p_id;
  if not v_self then
    perform audit.log('body.history.staff', 'allowed', v_member, 'body_compositions', p_id, '{}'::jsonb);
  end if;
  return private.ok(v_result);
end;
$$;

-- ===========================================================================
-- スタッフのダッシュボード(Sprint 3 で列を追加)
--   meals:null = 食事を見る同意なし(データを取得しない)、last_meal_on:null = 未記録
--   body:null  = 体の測定を見る同意なし、last_measured_at:null = 未記録
-- 体重などの値は一覧に出さない(評価・アラートに見えないように。D-15)
-- ===========================================================================
create or replace function public.staff_dashboard() returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
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
      ), '[]'::jsonb),
      'meals', case when authz.staff_can(a.member_id, 'meals:read') then jsonb_build_object(
          'last_meal_on', (select max(m.eaten_on) from public.meals m where m.member_id = a.member_id),
          'last_7_days', (
            select jsonb_agg(jsonb_build_object(
                     'date', d::date,
                     'breakfast', (select s.status from public.meal_slot_status s
                                    where s.member_id = a.member_id and s.eaten_on = d::date and s.slot = 'breakfast'),
                     'lunch', (select s.status from public.meal_slot_status s
                                where s.member_id = a.member_id and s.eaten_on = d::date and s.slot = 'lunch'),
                     'dinner', (select s.status from public.meal_slot_status s
                                 where s.member_id = a.member_id and s.eaten_on = d::date and s.slot = 'dinner'))
                   order by d desc)
              from generate_series(v_today - 6, v_today, interval '1 day') d))
        end,
      'body', case when authz.staff_can(a.member_id, 'body:read') then jsonb_build_object(
          'last_measured_at', (select max(b.measured_at) from public.body_compositions b where b.member_id = a.member_id))
        end
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
-- 食事画像の削除キュー(Edge Function purge-expired-images が service_role で処理)
--   expired:保存から 30 日を過ぎた食事の画像
--   orphan :食事に保存されなかった画像(アップロードから 24 時間以上たち、どの食事からも参照されない)
-- 失敗は再試行(1, 2, 4, 8 … 分後)。5 回失敗で failed にして監査に残す
-- ===========================================================================
create table private.image_purge_queue (
  object_name text primary key,
  reason text not null check (reason in ('expired', 'orphan')),
  meal_id uuid,
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  attempts smallint not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text check (char_length(last_error) <= 64),
  enqueued_at timestamptz not null default now(),
  done_at timestamptz
);
alter table private.image_purge_queue enable row level security;
revoke all on private.image_purge_queue from public, anon, authenticated;

insert into private.settings(key, value) values
  ('image_retention_days', '30'::jsonb),
  ('orphan_image_grace_hours', '24'::jsonb),
  ('image_purge_max_attempts', '5'::jsonb),
  ('analysis_retention_days', '90'::jsonb)
on conflict (key) do nothing;

create function private.setting_int(p_key text, p_default integer) returns integer
language sql stable security definer
set search_path = ''
as $$ select coalesce((select (value #>> '{}')::integer from private.settings where key = p_key), p_default); $$;

-- 削除の対象を積む(重複は積まない。done になった名前が再び現れたら積み直す)
create function private.enqueue_image_purge() returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_n integer := 0;
  v_c integer;
begin
  insert into private.image_purge_queue(object_name, reason, meal_id)
  select m.image_path, 'expired', m.id from public.meals m
   where m.image_path is not null and m.image_expires_at <= now()
  on conflict (object_name) do update set status = 'pending', reason = 'expired', meal_id = excluded.meal_id,
                                         attempts = 0, next_attempt_at = now(), last_error = null, done_at = null
    where private.image_purge_queue.status = 'done';
  get diagnostics v_c = row_count; v_n := v_n + v_c;

  insert into private.image_purge_queue(object_name, reason)
  select o.name, 'orphan' from storage.objects o
   where o.bucket_id = 'meal-images'
     and o.created_at < now() - make_interval(hours => private.setting_int('orphan_image_grace_hours', 24))
     and not exists (select 1 from public.meals m where m.image_path = o.name)
  on conflict (object_name) do update set status = 'pending', reason = 'orphan', meal_id = null,
                                         attempts = 0, next_attempt_at = now(), last_error = null, done_at = null
    where private.image_purge_queue.status = 'done';
  get diagnostics v_c = row_count; v_n := v_n + v_c;

  -- 解析の記録(食品名・量の候補のみ)は 90 日で消す。画像は上の規則で消える
  delete from public.meal_analyses a
   where a.created_at < now() - make_interval(days => private.setting_int('analysis_retention_days', 90));
  return v_n;
end;
$$;

-- 処理する画像を取り出す(service_role のみ)。取り出した時点で次の試行時刻を先に進め、
-- 処理中に止まっても後で再試行されるようにする。取り出す直前に条件を確かめ直す
create function public.claim_image_purge(p_limit integer default 50) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_enqueued integer;
  v_result jsonb;
begin
  v_enqueued := private.enqueue_image_purge();
  -- 条件を満たさなくなったもの(期限が延びた・食事から参照された)は取り消す
  update private.image_purge_queue q set status = 'done', done_at = now(), last_error = 'no_longer_eligible'
   where q.status = 'pending'
     and ((q.reason = 'expired' and not exists (
             select 1 from public.meals m where m.image_path = q.object_name and m.image_expires_at <= now()))
       or (q.reason = 'orphan' and exists (select 1 from public.meals m where m.image_path = q.object_name)));

  with picked as (
    select q.object_name from private.image_purge_queue q
     where q.status = 'pending' and q.next_attempt_at <= now()
     order by q.next_attempt_at, q.object_name
     limit greatest(1, least(coalesce(p_limit, 50), 200))
     for update skip locked
  ), upd as (
    update private.image_purge_queue q
       set attempts = q.attempts + 1,
           next_attempt_at = now() + make_interval(mins => power(2, q.attempts)::integer)
      from picked where q.object_name = picked.object_name
    returning q.object_name, q.reason, q.attempts
  )
  select coalesce(jsonb_agg(jsonb_build_object('name', u.object_name, 'reason', u.reason, 'attempt', u.attempts)
                            order by u.object_name), '[]'::jsonb)
    into v_result from upd u;
  return private.ok(jsonb_build_object('enqueued', v_enqueued, 'items', v_result));
end;
$$;

-- 処理結果を記録する(service_role のみ)。p_results = [{name, ok, error?}]
create function public.report_image_purge(p_results jsonb) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_q private.image_purge_queue;
  v_max integer := private.setting_int('image_purge_max_attempts', 5);
  v_member uuid;
  v_done integer := 0;
  v_retry integer := 0;
  v_failed integer := 0;
begin
  if p_results is null or jsonb_typeof(p_results) <> 'array' or jsonb_array_length(p_results) > 200 then
    return private.err('invalid_request');
  end if;
  for v_item in select * from jsonb_array_elements(p_results) loop
    select * into v_q from private.image_purge_queue where object_name = v_item ->> 'name' for update;
    if not found or v_q.status <> 'pending' then continue; end if;
    v_member := authz.try_uuid(split_part(v_q.object_name, '/', 1));
    if (v_item ->> 'ok')::boolean is true then
      update private.image_purge_queue set status = 'done', done_at = now(), last_error = null
       where object_name = v_q.object_name;
      -- 食事からの参照を外す(期限切れの画像だけ。孤立画像は参照がない)
      update public.meals set image_path = null, image_expires_at = null where image_path = v_q.object_name;
      perform audit.log('meal_image.purge', 'allowed', v_member, case when v_q.meal_id is null then null else 'meals' end,
                        v_q.meal_id, jsonb_build_object('reason', v_q.reason, 'count', v_q.attempts));
      v_done := v_done + 1;
    elsif v_q.attempts >= v_max then
      update private.image_purge_queue set status = 'failed', last_error = left(coalesce(v_item ->> 'error', 'unknown'), 64)
       where object_name = v_q.object_name;
      perform audit.log('meal_image.purge', 'error', v_member, case when v_q.meal_id is null then null else 'meals' end,
                        v_q.meal_id, jsonb_build_object('reason', v_q.reason, 'status', 'failed', 'count', v_q.attempts,
                                                        'error', left(coalesce(v_item ->> 'error', 'unknown'), 64)));
      v_failed := v_failed + 1;
    else
      update private.image_purge_queue set last_error = left(coalesce(v_item ->> 'error', 'unknown'), 64)
       where object_name = v_q.object_name;
      perform audit.log('meal_image.purge', 'error', v_member, case when v_q.meal_id is null then null else 'meals' end,
                        v_q.meal_id, jsonb_build_object('reason', v_q.reason, 'status', 'retry', 'count', v_q.attempts,
                                                        'error', left(coalesce(v_item ->> 'error', 'unknown'), 64)));
      v_retry := v_retry + 1;
    end if;
  end loop;
  return private.ok(jsonb_build_object('done', v_done, 'retry', v_retry, 'failed', v_failed));
end;
$$;

-- ===========================================================================
-- 権限
-- ===========================================================================
revoke all on all functions in schema public from public, anon;
grant execute on function
  public.save_body_composition(uuid, jsonb),
  public.update_body_composition(uuid, jsonb),
  public.delete_body_composition(uuid),
  public.get_body_compositions(uuid, date, date),
  public.get_body_composition_history(uuid),
  public.staff_dashboard()
to authenticated;
-- 画像の削除キューは service_role(Edge Function)だけ
revoke all on function public.claim_image_purge(integer), public.report_image_purge(jsonb) from public, anon, authenticated;
grant execute on function public.claim_image_purge(integer), public.report_image_purge(jsonb) to service_role;
revoke all on all functions in schema private from public, anon, authenticated;
