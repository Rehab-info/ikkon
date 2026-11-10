-- Sprint 2 / 05: 食品マスター・食事記録・記録状況・AI 解析記録・食事画像(Storage)
-- 設計: docs/DATABASE.md §3.4〜§3.6, §4.4, §6 / docs/API.md §3
-- 栄養計算の規則は packages/nutrition が定義。ここの SQL は同じ規則の実装(結合テストで一致を確認する)

create extension if not exists pg_trgm with schema extensions;

-- ===========================================================================
-- 列挙型
-- ===========================================================================
create type public.meal_slot as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type public.meal_location as enum ('home');            -- 将来 'studio' 等を追加
create type public.slot_status as enum ('recorded', 'skipped', 'dayservice');
create type public.entry_source as enum ('self', 'staff');
create type public.info_source as enum ('photo', 'interview', 'manual');
create type public.time_precision as enum ('exact', 'approximate', 'slot_only');

-- ===========================================================================
-- 食品マスター(日本食品標準成分表。値の解釈は packages/nutrition の parseSfctValue)
-- ===========================================================================
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_version text not null,
  source_food_code text not null check (source_food_code ~ '^\d{5}$'),
  food_group text not null,
  name text not null,
  display_name text not null,
  -- 可食部 100 g あたり。ENERC_KCAL / PROT- / FAT- / CHOCDF-(D-18 ②)。null = 成分表で未測定
  energy_kcal numeric(7,2) not null check (energy_kcal >= 0),
  protein_g numeric(7,2) check (protein_g >= 0),
  fat_g numeric(7,2) check (fat_g >= 0),
  carbohydrate_g numeric(7,2) check (carbohydrate_g >= 0),
  energy_kind text not null,
  protein_kind text not null,
  fat_kind text not null,
  carbohydrate_kind text not null,
  raw_values jsonb not null,                          -- 成分表の元の表記 {"PROT-": "(9.7)", ...}
  is_active boolean not null default true,
  unique (source, source_version, source_food_code),
  check (energy_kind in ('measured','estimated','trace','estimated_trace')),
  check (protein_kind in ('measured','estimated','trace','estimated_trace','not_determined')),
  check (fat_kind in ('measured','estimated','trace','estimated_trace','not_determined')),
  check (carbohydrate_kind in ('measured','estimated','trace','estimated_trace','not_determined')),
  check ((protein_g is null) = (protein_kind = 'not_determined')),
  check ((fat_g is null) = (fat_kind = 'not_determined')),
  check ((carbohydrate_g is null) = (carbohydrate_kind = 'not_determined'))
);
create index foods_name_trgm on public.foods using gin (display_name extensions.gin_trgm_ops);

create table public.food_aliases (
  food_id uuid not null references public.foods(id) on delete cascade,
  alias text not null check (char_length(alias) between 1 and 50),
  primary key (food_id, alias)
);
create index food_aliases_alias_idx on public.food_aliases(alias);
create index food_aliases_trgm on public.food_aliases using gin (alias extensions.gin_trgm_ops);

-- 目安単位(D-19:出典のある値だけ。Sprint 2 では空)
create table public.food_portions (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods(id) on delete cascade,
  label text not null,
  grams numeric(7,1) not null check (grams > 0),
  source_note text not null
);

alter table public.foods enable row level security;
alter table public.food_aliases enable row level security;
alter table public.food_portions enable row level security;
create policy foods_select on public.foods for select to authenticated using (true);
create policy food_aliases_select on public.food_aliases for select to authenticated using (true);
create policy food_portions_select on public.food_portions for select to authenticated using (true);
grant select on public.foods, public.food_aliases, public.food_portions to authenticated;

-- 食品の 1 件を画面・計算用の JSON に(成分表の元の表記と種類を含む)
create function private.food_json(f public.foods) returns jsonb
language sql immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'food_id', f.id, 'food_code', f.source_food_code, 'name', f.name, 'display_name', f.display_name,
    'source_version', f.source_version,
    'per100', jsonb_build_object(
      'energy_kcal', jsonb_build_object('value', f.energy_kcal, 'kind', f.energy_kind, 'raw', f.raw_values ->> 'ENERC_KCAL'),
      'protein_g', jsonb_build_object('value', f.protein_g, 'kind', f.protein_kind, 'raw', f.raw_values ->> 'PROT-'),
      'fat_g', jsonb_build_object('value', f.fat_g, 'kind', f.fat_kind, 'raw', f.raw_values ->> 'FAT-'),
      'carbohydrate_g', jsonb_build_object('value', f.carbohydrate_g, 'kind', f.carbohydrate_kind, 'raw', f.raw_values ->> 'CHOCDF-')
    )
  );
$$;

-- ===========================================================================
-- AI 解析記録・食事・明細・記録状況
-- ===========================================================================
create table public.meal_analyses (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(user_id) on delete cascade,
  requested_by uuid references public.profiles(user_id) on delete set null,
  image_path text not null,
  status text not null check (status in ('succeeded', 'failed', 'rejected')),
  provider text not null check (char_length(provider) <= 40),
  model text not null check (char_length(model) <= 80),
  items jsonb,                                       -- 食品名・提供量の候補のみ。栄養値は保存しない
  error_code text check (char_length(error_code) <= 40),
  created_at timestamptz not null default now()
);
create index meal_analyses_member_idx on public.meal_analyses(member_id, created_at desc);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(user_id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  slot public.meal_slot not null,
  location public.meal_location not null default 'home' check (location = 'home'),  -- Phase 1:自宅のみ
  eaten_on date not null,
  eaten_at timestamptz,
  eaten_at_precision public.time_precision not null,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  entry_source public.entry_source not null,
  entered_by uuid references public.profiles(user_id) on delete set null,
  info_source public.info_source not null,
  analysis_id uuid references public.meal_analyses(id) on delete set null,
  image_path text,
  image_expires_at timestamptz,
  -- 合計は確定した明細だけ。要確認の明細は含めない(D-19)
  total_energy_kcal numeric(9,2) not null,
  total_protein_g numeric(9,2) not null,
  total_fat_g numeric(9,2) not null,
  total_carbohydrate_g numeric(9,2) not null,
  total_flags jsonb not null default '{}'::jsonb,
  display_precision text not null default 'normal' check (display_precision in ('normal', 'approximate')),
  needs_review_count smallint not null default 0 check (needs_review_count >= 0),
  nutrition_rules_version text not null,
  check ((eaten_at_precision = 'slot_only') = (eaten_at is null)),
  check ((image_path is null) = (image_expires_at is null))
);
create index meals_member_eaten_idx on public.meals(member_id, eaten_on desc);
create trigger meals_touch before update on public.meals for each row execute function private.touch_updated_at();

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  member_id uuid not null references public.profiles(user_id) on delete cascade,
  position smallint not null check (position >= 0),
  role text not null check (role in ('food', 'ingredient', 'cooking_oil', 'seasoning')),
  dish_group_id uuid,
  dish_label text check (char_length(dish_label) between 1 and 100),
  dish_composition_known boolean,
  match_status text not null check (match_status in ('confirmed', 'needs_review')),
  food_id uuid references public.foods(id),
  candidate_food_ids uuid[] not null default '{}' check (cardinality(candidate_food_ids) <= 10),
  origin text not null check (origin in ('ai', 'ai_corrected', 'manual')),
  ai_label text check (char_length(ai_label) between 1 and 100),
  ai_estimated_served_g numeric(7,1) check (ai_estimated_served_g > 0 and ai_estimated_served_g <= 2000),
  served_g numeric(7,1) not null check (served_g > 0 and served_g <= 2000),
  intake_percent smallint not null check (intake_percent between 0 and 100),
  consumed_g numeric(8,2) not null,
  per100_energy_kcal numeric(7,2),
  per100_protein_g numeric(7,2),
  per100_fat_g numeric(7,2),
  per100_carbohydrate_g numeric(7,2),
  per100_notation jsonb,                              -- 成分表の元の表記と種類のスナップショット
  food_source_version text,
  nutrition_rules_version text not null,
  energy_kcal numeric(9,2),
  protein_g numeric(9,2),
  fat_g numeric(9,2),
  carbohydrate_g numeric(9,2),
  label text not null check (char_length(label) between 1 and 100),  -- 画面に出す名前(確定なら食品名)
  unique (meal_id, position),
  check (origin = 'manual' or ai_estimated_served_g is not null),
  check ((match_status = 'confirmed') = (food_id is not null and energy_kcal is not null
         and per100_notation is not null and food_source_version is not null)),
  check ((role = 'food') = (dish_group_id is null)),
  check (dish_group_id is null or (dish_label is not null and dish_composition_known is not null))
);
create index meal_items_meal_idx on public.meal_items(meal_id);

create table public.meal_slot_status (
  member_id uuid not null references public.profiles(user_id) on delete cascade,
  eaten_on date not null,
  slot public.meal_slot not null check (slot in ('breakfast', 'lunch', 'dinner')),
  status public.slot_status not null,
  set_by uuid references public.profiles(user_id) on delete set null,
  set_at timestamptz not null default now(),
  primary key (member_id, eaten_on, slot)
);

-- 直接のアクセスは誰にも許さない(すべて RPC 経由。RLS は有効にしてポリシーなし)
alter table public.meal_analyses enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.meal_slot_status enable row level security;
revoke all on public.meal_analyses, public.meals, public.meal_items, public.meal_slot_status from anon, authenticated;

create trigger audit_meals after insert or update or delete on public.meals
  for each row execute function audit.on_change('member_id', 'id');
create trigger audit_meal_slot_status after insert or update or delete on public.meal_slot_status
  for each row execute function audit.on_change('member_id', 'member_id');

-- ===========================================================================
-- 栄養計算(packages/nutrition の calc.ts と同じ規則)
--   摂取量 = 提供量 × 食べた割合 / 100(0.01 g 単位で四捨五入)
--   成分量 = 100 g あたりの値 × 摂取量 / 100(0.01 単位で四捨五入)。エネルギーは成分表の公表値から(再計算しない)
-- numeric の round は 0.5 を切り上げ(正の値)。浮動小数点は使わない
-- ===========================================================================
create function private.consumed_g(p_served numeric, p_percent integer) returns numeric
language sql immutable
set search_path = ''
as $$ select round(p_served * p_percent / 100.0, 2); $$;

create function private.nutrient_amount(p_per100 numeric, p_consumed numeric) returns numeric
language sql immutable
set search_path = ''
as $$ select case when p_per100 is null then null else round(p_per100 * p_consumed / 100.0, 2) end; $$;

-- ===========================================================================
-- 認可の補助
-- ===========================================================================
-- 食事の書き込み:本人(member)または meals:write の担当スタッフ
create function private.can_write_meals(p_member uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$ select authz.can_access(p_member, 'meals:write'); $$;

-- 食事の閲覧:本人、meals:read のスタッフ(全件)、meals:write だけのスタッフ(自分が入力した記録だけ。D-07 ①)
create function private.meal_visible(p_member uuid, p_entered_by uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select authz.can_access(p_member, 'meals:read')
      or (authz.staff_can(p_member, 'meals:write') and p_entered_by = auth.uid());
$$;

-- 文字列を uuid に(不正なら null。Storage のパス判定で例外を出さないため)
create function authz.try_uuid(p text) returns uuid
language plpgsql immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;
grant execute on function authz.try_uuid(text) to authenticated;

-- 摂取日の許容範囲:未来不可、さかのぼりは 7 日まで(D-30)。日付は Asia/Tokyo
create function private.eaten_on_ok(p_date date) returns boolean
language sql stable
set search_path = ''
as $$ select p_date <= (now() at time zone 'Asia/Tokyo')::date and p_date >= (now() at time zone 'Asia/Tokyo')::date - 7; $$;

-- ===========================================================================
-- 食品の検索・照合
-- ===========================================================================
create function public.search_foods(p_query text, p_limit integer default 20) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_q text := btrim(coalesce(p_query, ''));
begin
  if auth.uid() is null then return private.err('unauthenticated'); end if;
  if char_length(v_q) not between 1 and 50 or p_limit not between 1 and 50 then return private.err('invalid_request'); end if;
  return private.ok(coalesce((
    select jsonb_agg(private.food_json(s.f) order by s.score desc, (s.f).source_food_code)
    from (
      select f, greatest(
               case when exists (select 1 from public.food_aliases a where a.food_id = f.id and a.alias = v_q) then 2 else 0 end,
               case when f.display_name like '%' || v_q || '%' then 1 else 0 end,
               extensions.similarity(f.display_name, v_q),
               coalesce((select max(extensions.similarity(a.alias, v_q)) from public.food_aliases a where a.food_id = f.id), 0)
             ) as score
      from public.foods f
      where f.is_active
        and (f.display_name like '%' || v_q || '%'
             or exists (select 1 from public.food_aliases a where a.food_id = f.id and (a.alias like '%' || v_q || '%' or extensions.similarity(a.alias, v_q) > 0.3))
             or extensions.similarity(f.display_name, v_q) > 0.3)
      order by score desc, f.source_food_code
      limit p_limit
    ) s(f, score)
  ), '[]'::jsonb));
end;
$$;

-- AI のラベル → 成分表の候補。exact_match は「別名辞書と完全一致」。確定/要確認の判断は packages/nutrition の initialMatchStatus
create function public.match_foods(p_labels text[], p_limit integer default 5) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return private.err('unauthenticated'); end if;
  if p_labels is null or cardinality(p_labels) not between 1 and 60 or p_limit not between 1 and 10 then
    return private.err('invalid_request');
  end if;
  return private.ok((
    select jsonb_agg(jsonb_build_object('label', l.label, 'candidates', coalesce(c.candidates, '[]'::jsonb)) order by l.ord)
    from unnest(p_labels) with ordinality as l(label, ord)
    left join lateral (
      select jsonb_agg(private.food_json(x.f) || jsonb_build_object('exact_match', x.exact) order by x.exact desc, x.score desc) as candidates
      from (
        -- 別名辞書の完全一致があればそれだけ。なければあいまい一致の上位
        select f, true as exact, 1.0::real as score
        from public.foods f join public.food_aliases a on a.food_id = f.id
        where a.alias = btrim(l.label) and f.is_active
        union all
        select * from (
          select f, false, extensions.similarity(f.display_name, btrim(l.label))
          from public.foods f
          where f.is_active
            and not exists (select 1 from public.food_aliases a where a.alias = btrim(l.label))
            and (extensions.similarity(f.display_name, btrim(l.label)) > 0.2 or f.display_name like '%' || btrim(l.label) || '%')
          order by 3 desc, f.source_food_code
          limit p_limit
        ) fuzzy
      ) x(f, exact, score)
    ) c on true
  ));
end;
$$;

-- ===========================================================================
-- AI 解析の記録(analyze-meal が呼出者の JWT で呼ぶ)
-- ===========================================================================
create function public.authorize_meal_write(p_member_id uuid) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return private.err('unauthenticated'); end if;
  if p_member_id is null or not private.can_write_meals(p_member_id) then
    return private.deny('meal.write', p_member_id, 'forbidden');
  end if;
  return private.ok();
end;
$$;

create function public.record_meal_analysis(p_member_id uuid, p_image_path text, p_status text, p_provider text,
                                            p_model text, p_items jsonb, p_error_code text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then return private.err('unauthenticated'); end if;
  if p_member_id is null or not private.can_write_meals(p_member_id) then
    return private.deny('meal.analysis', p_member_id, 'forbidden');
  end if;
  if p_image_path is null or split_part(p_image_path, '/', 1) <> p_member_id::text
     or p_status not in ('succeeded', 'failed', 'rejected') then
    return private.err('invalid_request');
  end if;
  insert into public.meal_analyses(member_id, requested_by, image_path, status, provider, model, items, error_code)
  values (p_member_id, auth.uid(), p_image_path, p_status, p_provider, p_model, p_items, p_error_code)
  returning id into v_id;
  perform audit.log('meal.analysis', 'allowed', p_member_id, 'meal_analyses', v_id,
                    jsonb_build_object('status', p_status, 'op', case when auth.uid() = p_member_id then 'self' else 'proxy' end));
  return private.ok(jsonb_build_object('analysis_id', v_id));
end;
$$;

-- ===========================================================================
-- 食事の保存(新規・更新で共通の検証と計算)
-- ===========================================================================
-- payload を検証して明細を書く。エラーはコード文字列を返し、成功は null
create function private.write_meal_items(p_meal public.meals, p_items jsonb, p_analysis_items jsonb) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_pos integer := 0;
  v_food public.foods;
  v_status text;
  v_served numeric;
  v_pct integer;
  v_consumed numeric;
  v_role text;
  v_origin text;
  v_label text;
  v_candidates uuid[];
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 40 then return 'invalid_request'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    -- 許可したキーだけ(栄養値・入力者などはクライアントから受け取らない)
    if exists (select 1 from jsonb_object_keys(v_item) k where k not in
      ('role', 'dish_group_id', 'dish_label', 'dish_composition_known', 'match_status', 'food_id',
       'candidate_food_ids', 'origin', 'ai_label', 'ai_estimated_served_g', 'served_g', 'intake_percent', 'label')) then
      return 'invalid_request';
    end if;
    v_role := v_item ->> 'role';
    v_status := v_item ->> 'match_status';
    v_origin := v_item ->> 'origin';
    if coalesce(v_role, '') not in ('food', 'ingredient', 'cooking_oil', 'seasoning')
       or coalesce(v_status, '') not in ('confirmed', 'needs_review')
       or coalesce(v_origin, '') not in ('ai', 'ai_corrected', 'manual') then
      return 'invalid_request';
    end if;
    if coalesce(jsonb_typeof(v_item -> 'served_g'), '') <> 'number' or coalesce(jsonb_typeof(v_item -> 'intake_percent'), '') <> 'number' then
      return 'invalid_request';
    end if;
    v_served := (v_item ->> 'served_g')::numeric;
    v_pct := (v_item ->> 'intake_percent')::numeric;
    if v_served <= 0 or v_served > 2000 or v_served <> round(v_served, 1)
       or (v_item ->> 'intake_percent')::numeric <> v_pct or v_pct not between 0 and 100 then
      return 'invalid_request';
    end if;
    -- AI 由来の明細は、この食事の解析結果に同じ提供量があること(AI 推定値の改ざん防止)
    if v_origin <> 'manual' then
      if p_analysis_items is null or coalesce(jsonb_typeof(v_item -> 'ai_estimated_served_g'), '') <> 'number' or not exists (
        select 1 from jsonb_path_query(p_analysis_items, 'lax $.**.served_g') x(v)
        where (x.v #>> '{}')::numeric = (v_item ->> 'ai_estimated_served_g')::numeric
      ) then
        return 'invalid_request';
      end if;
    elsif v_item ? 'ai_estimated_served_g' and v_item -> 'ai_estimated_served_g' <> 'null'::jsonb then
      return 'invalid_request';
    end if;
    -- 候補(要確認のとき画面で選ぶ)
    begin
      v_candidates := coalesce(array(select jsonb_array_elements_text(coalesce(v_item -> 'candidate_food_ids', '[]'::jsonb))::uuid), '{}');
    exception when others then
      return 'invalid_request';
    end;
    if cardinality(v_candidates) > 10
       or (select count(*) from public.foods f where f.id = any (v_candidates)) <> cardinality(v_candidates) then
      return 'invalid_request';
    end if;
    -- 料理のまとまり
    if (v_role = 'food') <> (v_item -> 'dish_group_id' is null or v_item -> 'dish_group_id' = 'null'::jsonb) then
      return 'invalid_request';
    end if;
    v_consumed := private.consumed_g(v_served, v_pct);
    if v_status = 'confirmed' then
      begin
        select * into v_food from public.foods where id = (v_item ->> 'food_id')::uuid and is_active;
      exception when others then
        return 'invalid_request';
      end;
      if not found then return 'invalid_request'; end if;
      v_label := v_food.display_name;
    else
      if v_item -> 'food_id' is not null and v_item -> 'food_id' <> 'null'::jsonb then return 'invalid_request'; end if;
      v_food := null;
      v_label := btrim(coalesce(v_item ->> 'label', v_item ->> 'ai_label', ''));
      if char_length(v_label) not between 1 and 100 then return 'invalid_request'; end if;
    end if;

    begin
      insert into public.meal_items(
        meal_id, member_id, position, role, dish_group_id, dish_label, dish_composition_known,
        match_status, food_id, candidate_food_ids, origin, ai_label, ai_estimated_served_g,
        served_g, intake_percent, consumed_g,
        per100_energy_kcal, per100_protein_g, per100_fat_g, per100_carbohydrate_g, per100_notation,
        food_source_version, nutrition_rules_version,
        energy_kcal, protein_g, fat_g, carbohydrate_g, label)
      values (
        p_meal.id, p_meal.member_id, v_pos, v_role,
        nullif(v_item ->> 'dish_group_id', '')::uuid, nullif(btrim(v_item ->> 'dish_label'), ''),
        case when v_item ? 'dish_composition_known' and v_item -> 'dish_composition_known' <> 'null'::jsonb
             then (v_item ->> 'dish_composition_known')::boolean end,
        v_status, v_food.id, v_candidates, v_origin, nullif(btrim(v_item ->> 'ai_label'), ''),
        (v_item ->> 'ai_estimated_served_g')::numeric,
        v_served, v_pct, v_consumed,
        v_food.energy_kcal, v_food.protein_g, v_food.fat_g, v_food.carbohydrate_g,
        case when v_food.id is null then null else jsonb_build_object(
          'energy_kcal', jsonb_build_object('raw', v_food.raw_values ->> 'ENERC_KCAL', 'kind', v_food.energy_kind),
          'protein_g', jsonb_build_object('raw', v_food.raw_values ->> 'PROT-', 'kind', v_food.protein_kind),
          'fat_g', jsonb_build_object('raw', v_food.raw_values ->> 'FAT-', 'kind', v_food.fat_kind),
          'carbohydrate_g', jsonb_build_object('raw', v_food.raw_values ->> 'CHOCDF-', 'kind', v_food.carbohydrate_kind)) end,
        v_food.source_version, p_meal.nutrition_rules_version,
        private.nutrient_amount(v_food.energy_kcal, v_consumed), private.nutrient_amount(v_food.protein_g, v_consumed),
        private.nutrient_amount(v_food.fat_g, v_consumed), private.nutrient_amount(v_food.carbohydrate_g, v_consumed),
        v_label);
    exception when check_violation or invalid_text_representation or not_null_violation then
      return 'invalid_request';
    end;
    v_pos := v_pos + 1;
  end loop;

  -- 合計(確定した明細だけ)と注記
  update public.meals m set
    total_energy_kcal = s.e, total_protein_g = s.p, total_fat_g = s.f, total_carbohydrate_g = s.c,
    needs_review_count = s.nr,
    display_precision = case when s.unknown_dish then 'approximate' else 'normal' end,
    total_flags = jsonb_build_object(
      'protein_g', jsonb_build_object('incomplete', s.p_null), 'fat_g', jsonb_build_object('incomplete', s.f_null),
      'carbohydrate_g', jsonb_build_object('incomplete', s.c_null), 'energy_kcal', jsonb_build_object('incomplete', false))
  from (
    select coalesce(sum(energy_kcal) filter (where match_status = 'confirmed'), 0) e,
           coalesce(sum(protein_g) filter (where match_status = 'confirmed'), 0) p,
           coalesce(sum(fat_g) filter (where match_status = 'confirmed'), 0) f,
           coalesce(sum(carbohydrate_g) filter (where match_status = 'confirmed'), 0) c,
           count(*) filter (where match_status = 'needs_review') nr,
           bool_or(dish_composition_known = false) is true unknown_dish,
           bool_or(match_status = 'confirmed' and protein_g is null) is true p_null,
           bool_or(match_status = 'confirmed' and fat_g is null) is true f_null,
           bool_or(match_status = 'confirmed' and carbohydrate_g is null) is true c_null
    from public.meal_items where meal_id = p_meal.id
  ) s
  where m.id = p_meal.id;
  return null;
end;
$$;

-- 記録状況:主食事 3 区分に食事があれば recorded、なくなれば行を消す
create function private.refresh_slot_status(p_member uuid, p_date date, p_slot public.meal_slot) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_slot = 'snack' then return; end if;
  if exists (select 1 from public.meals where member_id = p_member and eaten_on = p_date and slot = p_slot) then
    insert into public.meal_slot_status(member_id, eaten_on, slot, status, set_by)
    values (p_member, p_date, p_slot, 'recorded', auth.uid())
    on conflict (member_id, eaten_on, slot) do update set status = 'recorded', set_by = auth.uid(), set_at = now()
      where public.meal_slot_status.status <> 'recorded';
  else
    delete from public.meal_slot_status where member_id = p_member and eaten_on = p_date and slot = p_slot and status = 'recorded';
  end if;
end;
$$;

-- 食事本体の項目の検証(新規・更新共通)。エラーコードまたは null
create function private.check_meal_header(p_member uuid, p jsonb, p_analysis public.meal_analyses) returns text
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(p) <> 'object' then return 'invalid_request'; end if;
  if exists (select 1 from jsonb_object_keys(p) k where k not in
    ('slot', 'location', 'eaten_on', 'eaten_at', 'eaten_at_precision', 'info_source', 'analysis_id', 'image_path', 'items')) then
    return 'invalid_request';
  end if;
  if p ->> 'location' is distinct from 'home' then return 'invalid_request'; end if;   -- 自宅のみ
  if coalesce(p ->> 'slot', '') not in ('breakfast', 'lunch', 'dinner', 'snack')
     or coalesce(p ->> 'eaten_at_precision', '') not in ('exact', 'approximate', 'slot_only')
     or coalesce(p ->> 'info_source', '') not in ('photo', 'interview', 'manual')
     or coalesce(jsonb_typeof(p -> 'items'), '') <> 'array' then
    return 'invalid_request';
  end if;
  if ((p ->> 'eaten_at_precision') = 'slot_only') <> (p -> 'eaten_at' is null or p -> 'eaten_at' = 'null'::jsonb) then
    return 'invalid_request';
  end if;
  -- 画像は本人のフォルダのもので、解析記録と一致すること
  if p ->> 'image_path' is not null then
    if split_part(p ->> 'image_path', '/', 1) <> p_member::text then return 'invalid_request'; end if;
    if p_analysis.id is not null and p_analysis.image_path <> p ->> 'image_path' then return 'invalid_request'; end if;
  end if;
  return null;
end;
$$;

create function public.save_meal(p_member_id uuid, p_payload jsonb) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_analysis public.meal_analyses;
  v_meal public.meals;
  v_err text;
  v_date date;
begin
  if v_uid is null then return private.err('unauthenticated'); end if;
  if p_member_id is null or not private.can_write_meals(p_member_id) then
    return private.deny('meal.create', p_member_id, 'forbidden');
  end if;
  if p_payload ? 'analysis_id' and p_payload -> 'analysis_id' <> 'null'::jsonb then
    begin
      select * into v_analysis from public.meal_analyses
       where id = (p_payload ->> 'analysis_id')::uuid and member_id = p_member_id and status = 'succeeded';
    exception when others then return private.err('invalid_request');
    end;
    if not found then return private.err('invalid_request'); end if;
  end if;
  v_err := private.check_meal_header(p_member_id, p_payload, v_analysis);
  if v_err is not null then return private.err(v_err); end if;
  begin
    v_date := (p_payload ->> 'eaten_on')::date;
  exception when others then return private.err('invalid_request');
  end;
  if v_date is null or not private.eaten_on_ok(v_date) then return private.err('invalid_request'); end if;

  begin
    insert into public.meals(member_id, organization_id, slot, eaten_on, eaten_at, eaten_at_precision,
                             entry_source, entered_by, info_source, analysis_id, image_path, image_expires_at,
                             total_energy_kcal, total_protein_g, total_fat_g, total_carbohydrate_g, nutrition_rules_version)
    values (p_member_id, (select organization_id from public.profiles where user_id = p_member_id),
            (p_payload ->> 'slot')::public.meal_slot, v_date, nullif(p_payload ->> 'eaten_at', '')::timestamptz,
            (p_payload ->> 'eaten_at_precision')::public.time_precision,
            case when v_uid = p_member_id then 'self' else 'staff' end::public.entry_source, v_uid,
            (p_payload ->> 'info_source')::public.info_source, v_analysis.id,
            p_payload ->> 'image_path', case when p_payload ->> 'image_path' is not null then now() + interval '30 days' end,
            0, 0, 0, 0, 'sfct8-standard-v2')
    returning * into v_meal;
  exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
    return private.err('invalid_request');
  end;
  -- 記録の時刻が未来でないこと
  if v_meal.eaten_at is not null and v_meal.eaten_at > now() + interval '10 minutes' then
    raise exception using errcode = 'P0001', message = 'invalid_request';
  end if;

  v_err := private.write_meal_items(v_meal, p_payload -> 'items', v_analysis.items);
  if v_err is not null then
    raise exception using errcode = 'P0001', message = v_err;  -- 食事本体も取り消す
  end if;
  -- 「食べなかった」「デイサービス」を上書きする場合は記録ありにする
  delete from public.meal_slot_status where member_id = p_member_id and eaten_on = v_date
     and slot = v_meal.slot and status in ('skipped', 'dayservice');
  perform private.refresh_slot_status(p_member_id, v_date, v_meal.slot);
  perform audit.log(case when v_uid = p_member_id then 'meal.save' else 'meal.save.proxy' end, 'allowed', p_member_id,
                    'meals', v_meal.id, jsonb_build_object('count', jsonb_array_length(p_payload -> 'items')));
  return private.ok(jsonb_build_object('meal_id', v_meal.id));
exception when sqlstate 'P0001' then
  return private.err(case when sqlerrm in ('invalid_request', 'conflict') then sqlerrm else 'invalid_request' end);
end;
$$;

-- 更新:本人は自分の全記録、スタッフは meals:write かつ自分の代理入力かつ 7 日以内(D-07 ③)
create function public.update_meal(p_meal_id uuid, p_payload jsonb) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_meal public.meals;
  v_analysis public.meal_analyses;
  v_err text;
  v_date date;
  v_old_date date;
  v_old_slot public.meal_slot;
begin
  if v_uid is null then return private.err('unauthenticated'); end if;
  select * into v_meal from public.meals where id = p_meal_id for update;
  if not found then return private.deny('meal.update', null, 'not_found'); end if;
  if not ((v_uid = v_meal.member_id and authz.has_role('member'))
          or (authz.staff_can(v_meal.member_id, 'meals:write') and v_meal.entered_by = v_uid
              and v_meal.recorded_at > now() - interval '7 days')) then
    return private.deny('meal.update', v_meal.member_id, 'forbidden');
  end if;
  if v_meal.analysis_id is not null then
    select * into v_analysis from public.meal_analyses where id = v_meal.analysis_id;
  end if;
  -- 解析記録・画像は付け替えない(クライアントの値は使わず、保存済みの値に置き換える。スタッフには画像のパスを返していない)
  p_payload := p_payload || jsonb_build_object('analysis_id', v_meal.analysis_id, 'image_path', v_meal.image_path);
  v_err := private.check_meal_header(v_meal.member_id, p_payload, v_analysis);
  if v_err is not null then return private.err(v_err); end if;
  begin
    v_date := (p_payload ->> 'eaten_on')::date;
  exception when others then return private.err('invalid_request');
  end;
  if v_date is null or not private.eaten_on_ok(v_date) then return private.err('invalid_request'); end if;
  v_old_date := v_meal.eaten_on;
  v_old_slot := v_meal.slot;

  begin
    update public.meals set slot = (p_payload ->> 'slot')::public.meal_slot, eaten_on = v_date,
           eaten_at = nullif(p_payload ->> 'eaten_at', '')::timestamptz,
           eaten_at_precision = (p_payload ->> 'eaten_at_precision')::public.time_precision,
           info_source = (p_payload ->> 'info_source')::public.info_source,
           nutrition_rules_version = 'sfct8-standard-v2'
     where id = p_meal_id
    returning * into v_meal;
  exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
    return private.err('invalid_request');
  end;
  delete from public.meal_items where meal_id = p_meal_id;
  v_err := private.write_meal_items(v_meal, p_payload -> 'items', v_analysis.items);
  if v_err is not null then
    raise exception using errcode = 'P0001', message = v_err;
  end if;
  delete from public.meal_slot_status where member_id = v_meal.member_id and eaten_on = v_date
     and slot = v_meal.slot and status in ('skipped', 'dayservice');
  perform private.refresh_slot_status(v_meal.member_id, v_old_date, v_old_slot);
  perform private.refresh_slot_status(v_meal.member_id, v_date, v_meal.slot);
  perform audit.log(case when v_uid = v_meal.member_id then 'meal.update' else 'meal.update.proxy' end, 'allowed',
                    v_meal.member_id, 'meals', v_meal.id, '{}'::jsonb);
  return private.ok(jsonb_build_object('meal_id', v_meal.id));
exception when sqlstate 'P0001' then
  return private.err(case when sqlerrm in ('invalid_request', 'conflict') then sqlerrm else 'invalid_request' end);
end;
$$;

-- 削除は本人だけ(D-07 ④)
create function public.delete_meal(p_meal_id uuid) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_meal public.meals;
begin
  if auth.uid() is null then return private.err('unauthenticated'); end if;
  select * into v_meal from public.meals where id = p_meal_id;
  if not found or v_meal.member_id <> auth.uid() or not authz.has_role('member') then
    return private.deny('meal.delete', v_meal.member_id, 'forbidden');
  end if;
  delete from public.meals where id = p_meal_id;
  perform private.refresh_slot_status(v_meal.member_id, v_meal.eaten_on, v_meal.slot);
  return private.ok(jsonb_build_object('image_path', v_meal.image_path));
end;
$$;

-- 「食べなかった」「デイサービスで食べた」の設定・解除(status = null で解除)
create function public.set_slot_status(p_member_id uuid, p_eaten_on date, p_slot public.meal_slot, p_status public.slot_status)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return private.err('unauthenticated'); end if;
  if p_member_id is null or not private.can_write_meals(p_member_id) then
    return private.deny('meal.slot_status', p_member_id, 'forbidden');
  end if;
  if p_slot is null or p_slot = 'snack' or p_eaten_on is null or not private.eaten_on_ok(p_eaten_on) or p_status = 'recorded' then
    return private.err('invalid_request');
  end if;
  if exists (select 1 from public.meals where member_id = p_member_id and eaten_on = p_eaten_on and slot = p_slot) then
    return private.err('conflict');   -- 記録がある区分は、先に食事を削除してから
  end if;
  if p_status is null then
    delete from public.meal_slot_status where member_id = p_member_id and eaten_on = p_eaten_on and slot = p_slot;
  else
    insert into public.meal_slot_status(member_id, eaten_on, slot, status, set_by)
    values (p_member_id, p_eaten_on, p_slot, p_status, auth.uid())
    on conflict (member_id, eaten_on, slot) do update set status = excluded.status, set_by = excluded.set_by, set_at = now();
  end if;
  return private.ok();
end;
$$;

-- ===========================================================================
-- 閲覧(スタッフの閲覧は監査に残す)
-- ===========================================================================
create function private.meal_json(m public.meals, p_with_image boolean) returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'meal_id', m.id, 'member_id', m.member_id, 'slot', m.slot, 'location', m.location,
    'eaten_on', m.eaten_on, 'eaten_at', m.eaten_at, 'eaten_at_precision', m.eaten_at_precision,
    'recorded_at', m.recorded_at, 'updated_at', m.updated_at,
    'entry_source', m.entry_source, 'entered_by_name', (select display_name from public.profiles where user_id = m.entered_by),
    'entered_by_me', m.entered_by = auth.uid(),
    'info_source', m.info_source, 'has_image', m.image_path is not null,
    'image_path', case when p_with_image then m.image_path end,
    'totals', jsonb_build_object('energy_kcal', m.total_energy_kcal, 'protein_g', m.total_protein_g,
                                 'fat_g', m.total_fat_g, 'carbohydrate_g', m.total_carbohydrate_g),
    'total_flags', m.total_flags, 'display_precision', m.display_precision, 'needs_review_count', m.needs_review_count,
    'nutrition_rules_version', m.nutrition_rules_version,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_id', i.id, 'position', i.position, 'role', i.role, 'label', i.label,
        'dish_group_id', i.dish_group_id, 'dish_label', i.dish_label, 'dish_composition_known', i.dish_composition_known,
        'match_status', i.match_status, 'food_id', i.food_id, 'food_code', f.source_food_code,
        'candidates', coalesce((select jsonb_agg(private.food_json(c) order by c.source_food_code)
                                from public.foods c where c.id = any (i.candidate_food_ids)), '[]'::jsonb),
        'origin', i.origin, 'ai_label', i.ai_label, 'ai_estimated_served_g', i.ai_estimated_served_g,
        'served_g', i.served_g, 'intake_percent', i.intake_percent, 'consumed_g', i.consumed_g,
        'per100', case when i.food_id is null then null else jsonb_build_object(
          'energy_kcal', jsonb_build_object('value', i.per100_energy_kcal) || (i.per100_notation -> 'energy_kcal'),
          'protein_g', jsonb_build_object('value', i.per100_protein_g) || (i.per100_notation -> 'protein_g'),
          'fat_g', jsonb_build_object('value', i.per100_fat_g) || (i.per100_notation -> 'fat_g'),
          'carbohydrate_g', jsonb_build_object('value', i.per100_carbohydrate_g) || (i.per100_notation -> 'carbohydrate_g')) end,
        'food_source_version', i.food_source_version,
        'amounts', jsonb_build_object('energy_kcal', i.energy_kcal, 'protein_g', i.protein_g,
                                      'fat_g', i.fat_g, 'carbohydrate_g', i.carbohydrate_g)
      ) order by i.position)
      from public.meal_items i left join public.foods f on f.id = i.food_id
      where i.meal_id = m.id
    ), '[]'::jsonb)
  );
$$;

create function public.get_meals(p_member_id uuid, p_from date, p_to date) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_self boolean;
  v_result jsonb;
begin
  if v_uid is null then return private.err('unauthenticated'); end if;
  if p_member_id is null or p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
    return private.err('invalid_request');
  end if;
  v_self := v_uid = p_member_id and authz.has_role('member');
  if not (v_self or authz.staff_can(p_member_id, 'meals:read') or authz.staff_can(p_member_id, 'meals:write')) then
    return private.deny('meal.read', p_member_id, 'forbidden');
  end if;
  select coalesce(jsonb_agg(private.meal_json(m, v_self) order by m.eaten_on desc, m.slot, m.recorded_at), '[]'::jsonb)
    into v_result
    from public.meals m
   where m.member_id = p_member_id and m.eaten_on between p_from and p_to
     and (v_self or private.meal_visible(m.member_id, m.entered_by));
  if not v_self then
    perform audit.log('meal.read.staff', 'allowed', p_member_id, null, null,
                      jsonb_build_object('count', jsonb_array_length(v_result)));
  end if;
  return private.ok(v_result);
end;
$$;

create function public.get_meal(p_meal_id uuid) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_meal public.meals;
  v_self boolean;
begin
  if auth.uid() is null then return private.err('unauthenticated'); end if;
  select * into v_meal from public.meals where id = p_meal_id;
  if not found then return private.deny('meal.read', null, 'not_found'); end if;
  v_self := v_meal.member_id = auth.uid() and authz.has_role('member');
  if not (v_self or private.meal_visible(v_meal.member_id, v_meal.entered_by)) then
    return private.deny('meal.read', v_meal.member_id, 'forbidden');
  end if;
  if not v_self then
    perform audit.log('meal.read.staff', 'allowed', v_meal.member_id, 'meals', v_meal.id, '{}'::jsonb);
  end if;
  return private.ok(private.meal_json(v_meal, v_self));
end;
$$;

-- 日別の記録状況と合計(要確認の数を含む)
create function public.get_daily_summary(p_member_id uuid, p_from date, p_to date) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_self boolean;
  v_result jsonb;
begin
  if v_uid is null then return private.err('unauthenticated'); end if;
  if p_member_id is null or p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
    return private.err('invalid_request');
  end if;
  v_self := v_uid = p_member_id and authz.has_role('member');
  if not (v_self or authz.staff_can(p_member_id, 'meals:read')) then
    return private.deny('meal.summary', p_member_id, 'forbidden');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'date', d.day,
      'slots', jsonb_build_object(
        'breakfast', (select status from public.meal_slot_status s where s.member_id = p_member_id and s.eaten_on = d.day and s.slot = 'breakfast'),
        'lunch', (select status from public.meal_slot_status s where s.member_id = p_member_id and s.eaten_on = d.day and s.slot = 'lunch'),
        'dinner', (select status from public.meal_slot_status s where s.member_id = p_member_id and s.eaten_on = d.day and s.slot = 'dinner')),
      'meal_count', (select count(*) from public.meals m where m.member_id = p_member_id and m.eaten_on = d.day),
      'needs_review_count', (select coalesce(sum(needs_review_count), 0) from public.meals m where m.member_id = p_member_id and m.eaten_on = d.day),
      'totals', (select jsonb_build_object('energy_kcal', coalesce(sum(total_energy_kcal), 0), 'protein_g', coalesce(sum(total_protein_g), 0),
                                           'fat_g', coalesce(sum(total_fat_g), 0), 'carbohydrate_g', coalesce(sum(total_carbohydrate_g), 0))
                 from public.meals m where m.member_id = p_member_id and m.eaten_on = d.day)
    ) order by d.day desc), '[]'::jsonb)
    into v_result
    from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as g(ts), lateral (select g.ts::date as day) d;
  if not v_self then
    perform audit.log('meal.summary.staff', 'allowed', p_member_id, null, null, '{}'::jsonb);
  end if;
  return private.ok(v_result);
end;
$$;

-- 食事画像の閲覧の可否(本人だけ。D-09:スタッフは数値のみ)。meal-image 関数が呼び、許可・拒否を監査に残す
create function public.authorize_meal_image(p_meal_id uuid) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_meal public.meals;
begin
  if auth.uid() is null then return private.err('unauthenticated'); end if;
  select * into v_meal from public.meals where id = p_meal_id;
  if not found or v_meal.image_path is null then return private.err('not_found'); end if;
  if not (v_meal.member_id = auth.uid() and authz.has_role('member')) then
    return private.deny('meal.image.view', v_meal.member_id, 'forbidden');
  end if;
  if v_meal.image_expires_at < now() then return private.err('not_found'); end if;
  perform audit.log('meal.image.view', 'allowed', v_meal.member_id, 'meals', v_meal.id, '{}'::jsonb);
  return private.ok(jsonb_build_object('image_path', v_meal.image_path));
end;
$$;

-- ===========================================================================
-- 食事画像(Storage:非公開バケット)
-- パス:{member_id}/{yyyy}/{uuid}.{webp|jpg}
-- ===========================================================================
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('meal-images', 'meal-images', false, 5242880, array['image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create function authz.meal_image_path_ok(p_name text) returns boolean
language sql immutable
set search_path = ''
as $$
  select p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9]{4}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$';
$$;
grant execute on function authz.meal_image_path_ok(text) to authenticated;

-- 本人のフォルダ、または meals:write の担当スタッフ(代理で撮影)。パス形式も検査
create policy meal_images_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'meal-images' and authz.meal_image_path_ok(name)
    and (
      ((storage.foldername(name))[1] = (select auth.uid())::text and authz.has_role('member'))
      or authz.staff_can(authz.try_uuid((storage.foldername(name))[1]), 'meals:write')
    )
  );
-- 閲覧:本人のフォルダ、または自分がアップロードした画像で meals:write が有効なスタッフ(解析のため)
create policy meal_images_select on storage.objects for select to authenticated
  using (
    bucket_id = 'meal-images'
    and (
      ((storage.foldername(name))[1] = (select auth.uid())::text and authz.has_role('member'))
      or (owner_id = (select auth.uid())::text
          and authz.staff_can(authz.try_uuid((storage.foldername(name))[1]), 'meals:write'))
    )
  );
create policy meal_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'meal-images' and (storage.foldername(name))[1] = (select auth.uid())::text and authz.has_role('member'));
-- 上書き(UPDATE)のポリシーは作らない = 不可

-- ===========================================================================
-- 権限
-- ===========================================================================
revoke all on all functions in schema public from public, anon;
grant execute on function
  public.search_foods(text, integer),
  public.match_foods(text[], integer),
  public.authorize_meal_write(uuid),
  public.record_meal_analysis(uuid, text, text, text, text, jsonb, text),
  public.save_meal(uuid, jsonb),
  public.update_meal(uuid, jsonb),
  public.delete_meal(uuid),
  public.set_slot_status(uuid, date, public.meal_slot, public.slot_status),
  public.get_meals(uuid, date, date),
  public.get_meal(uuid),
  public.get_daily_summary(uuid, date, date),
  public.authorize_meal_image(uuid)
to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
-- authz の補助関数は RLS・Storage ポリシーからだけ使う(PUBLIC・anon には渡さない)
revoke all on function authz.try_uuid(text), authz.meal_image_path_ok(text) from public, anon;
grant execute on function authz.try_uuid(text), authz.meal_image_path_ok(text) to authenticated;
