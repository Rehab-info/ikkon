# DATABASE — DB・RLS 設計

- 文書状態: **ドラフト(承認待ち)**
- DB: Supabase PostgreSQL。変更はすべて `supabase/migrations/` の SQL マイグレーションで管理(ダッシュボードでの手作業変更は禁止)。
- 下記の SQL は設計意図を示す擬似コードを含む。実装時にマイグレーションとして書き起こし、pgTAP で検証する。

## 1. スキーマ方針

| スキーマ | API公開 | 内容 |
|---|---|---|
| `public` | PostgREST で公開 | 利用者が直接触るテーブル・RPC |
| `authz` | **非公開** | 認可判定関数(SECURITY DEFINER、`search_path` 固定)|
| `audit` | **非公開** | 監査ログテーブルと書き込み関数 |
| `private` | **非公開** | 利用量カウンタ、内部設定 |

- 全テーブルで `ENABLE ROW LEVEL SECURITY`(+ 所有者バイパスを防ぐため `FORCE ROW LEVEL SECURITY` を検討)。
- `anon` ロールには利用者データへの権限を一切与えない(`REVOKE ALL ... FROM anon`)。
- SECURITY DEFINER 関数は `SET search_path = ''` とし、全オブジェクトをスキーマ修飾する。`EXECUTE` は `PUBLIC` から取り消し、必要なロールにだけ付与する。
- RLS ポリシー内の `auth.uid()` は `(select auth.uid())` と書き、行ごとの再評価を避ける。

## 2. ER 概要

```
organizations 1─* facilities
organizations 1─* profiles(=auth.users 1:1)
profiles 1─* user_roles
profiles(staff) *─* profiles(member)  via staff_assignments
profiles(member) 1─* staff_access_consents *─1 profiles(staff)
consent_documents 1─* user_agreements / staff_access_consents
profiles(member) 1─* meals 1─* meal_items *─1 foods 1─* food_aliases
profiles(member) 1─* meal_analyses
profiles(member) 1─* body_compositions
audit.logs(参照制約なし・追記専用)
private.ai_usage_daily / private.ai_usage_monthly / private.settings
```

## 3. テーブル定義

### 3.1 組織・利用者

```sql
create type public.app_role as enum ('member', 'staff', 'admin');
create type public.consent_scope as enum ('meals:read', 'body:read', 'body:write');
create type public.meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type public.entry_source as enum ('self', 'staff');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  display_name text not null check (char_length(display_name) between 1 and 50),
  timezone text not null default 'Asia/Tokyo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  role public.app_role not null,
  granted_by uuid references public.profiles(user_id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index user_roles_active_uq on public.user_roles(user_id, role) where revoked_at is null;
```

- **ロールを `auth.users.raw_user_meta_data` に置かない**(利用者自身が `updateUser` で書き換えられるため)。
- `profiles` はサインアップ時のトリガーではなく、招待/登録 RPC で作成する(組織の紐付けを管理者が決めるため)**[未決 D-04]**。

### 3.2 担当割当と同意

```sql
create table public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  facility_id uuid references public.facilities(id),
  staff_id uuid not null references public.profiles(user_id) on delete cascade,
  member_id uuid not null references public.profiles(user_id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references public.profiles(user_id) on delete set null,
  check (staff_id <> member_id)
);
create unique index staff_assignments_active_uq
  on public.staff_assignments(staff_id, member_id) where ended_at is null;

create table public.consent_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('terms','privacy','ai_processing','staff_sharing')),
  version text not null,
  content_sha256 text not null,
  published_at timestamptz not null,
  unique (kind, version)
);

create table public.user_agreements (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  document_id uuid not null references public.consent_documents(id),
  agreed_at timestamptz not null default now(),
  primary key (user_id, document_id)
);

create table public.staff_access_consents (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(user_id) on delete cascade,
  staff_id uuid not null references public.profiles(user_id) on delete cascade,
  scope public.consent_scope not null,
  document_id uuid not null references public.consent_documents(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (revoked_at is null or revoked_at >= granted_at)
);
create unique index staff_access_consents_active_uq
  on public.staff_access_consents(member_id, staff_id, scope) where revoked_at is null;
```

- 同意は **利用者 × スタッフ × 範囲** 単位。撤回は `revoked_at` を立てるのみ(行は消さない)。
- 担当解除(`ended_at`)時に同意を自動撤回するかは **[未決 D-07]**。いずれにせよ判定関数は両方を要求するため、担当解除の時点でアクセスは止まる。

### 3.3 食品成分マスター

```sql
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  source text not null,              -- 例: 'mext_sfct_8th_2023'
  source_version text not null,
  source_food_code text,             -- 成分表の食品番号
  name text not null,
  category text not null,
  -- 可食部100gあたり
  energy_kcal numeric(7,2) not null check (energy_kcal >= 0),
  protein_g numeric(7,2) not null check (protein_g >= 0),
  fat_g numeric(7,2) not null check (fat_g >= 0),
  carbohydrate_g numeric(7,2) not null check (carbohydrate_g >= 0),
  is_active boolean not null default true,
  unique (source, source_version, source_food_code)
);

create table public.food_aliases (
  food_id uuid not null references public.foods(id) on delete cascade,
  alias text not null,
  primary key (food_id, alias)
);
-- 照合用: pg_trgm の GIN インデックス(foods.name, food_aliases.alias)
```

- 読み取り:`authenticated` は全件 SELECT 可(個人データではない)。書き込み:マイグレーション/管理用スクリプトのみ。
- 成分表のどの列を P/F/C に使うか(例:たんぱく質=「アミノ酸組成によるたんぱく質」か「たんぱく質」か、炭水化物=「利用可能炭水化物(質量計)」か「差引き法」か)は **[未決 D-18]**。欠損値(`-`・`Tr`・`(0)`)の扱いも同じく決める。
- 料理(カレーライス等)は成分表に少ないため、**料理レシピマスター(食材構成)** の要否が **[未決 D-19]**。Phase 1 の仮案:よく出る料理 50〜100 品を、栄養担当者が監修した「料理→食材と重量の割合」の表として持つ。

### 3.4 食事

```sql
create table public.meal_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  image_path text not null,
  status text not null check (status in ('succeeded','failed','rejected')),
  provider text not null,
  model text not null,
  items jsonb,                       -- [{label, grams, confidence, kind}] のみ。栄養値は保存しない
  error_code text,
  created_at timestamptz not null default now()
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  meal_type public.meal_type not null,
  eaten_at timestamptz not null,
  analysis_id uuid references public.meal_analyses(id) on delete set null,
  image_path text,                   -- 期限切れ削除後は null
  image_expires_at timestamptz,
  total_energy_kcal numeric(9,2) not null,
  total_protein_g numeric(9,2) not null,
  total_fat_g numeric(9,2) not null,
  total_carbohydrate_g numeric(9,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meals_user_eaten_idx on public.meals(user_id, eaten_at desc);

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  position smallint not null,
  food_id uuid not null references public.foods(id),
  grams numeric(7,1) not null check (grams > 0 and grams <= 2000),
  origin text not null check (origin in ('ai','ai_corrected','manual')),
  ai_label text check (char_length(ai_label) <= 100),
  ai_grams numeric(7,1),
  -- 計算時点のスナップショット(マスター更新で過去記録が変わらないように)
  per100_energy_kcal numeric(7,2) not null,
  per100_protein_g numeric(7,2) not null,
  per100_fat_g numeric(7,2) not null,
  per100_carbohydrate_g numeric(7,2) not null,
  food_source_version text not null,
  energy_kcal numeric(9,2) not null,
  protein_g numeric(9,2) not null,
  fat_g numeric(9,2) not null,
  carbohydrate_g numeric(9,2) not null
);
```

- `meal_items.user_id` は RLS を単純化するための非正規化。トリガーで `meals.user_id` と一致を強制する。
- 栄養値・合計値は **クライアントから受け取らず**、`save_meal` / `update_meal` RPC 内で `foods` から計算して書き込む。テーブルへの直接 INSERT/UPDATE は不可にする(§4.2)。

### 3.5 InBody

```sql
create table public.body_compositions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(user_id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  measured_at timestamptz not null,
  weight_kg numeric(5,1) not null check (weight_kg between 20 and 300),
  skeletal_muscle_kg numeric(5,1) not null check (skeletal_muscle_kg between 5 and 100),
  body_fat_kg numeric(5,1) not null check (body_fat_kg between 0.5 and 200),
  body_fat_pct numeric(4,1) not null check (body_fat_pct between 1 and 75),
  device_model text not null check (char_length(device_model) between 1 and 50),
  entry_source public.entry_source not null,
  entered_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (skeletal_muscle_kg < weight_kg and body_fat_kg < weight_kg)
);
create index body_member_measured_idx on public.body_compositions(member_id, measured_at desc);
```

範囲は仮値。InBody 機種の測定範囲に合わせて見直す **[未決 D-12]**。

### 3.6 監査・利用量

```sql
create table audit.logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,                    -- 削除時は null または仮名化
  actor_role text,
  action text not null,             -- 例: 'meal.create','body.read.staff','consent.revoke','access.denied'
  subject_user_id uuid,             -- データの持ち主
  resource_type text,
  resource_id uuid,
  result text not null check (result in ('allowed','denied','error')),
  request_id text,
  metadata jsonb not null default '{}'::jsonb  -- PIIを入れない(値・食品名・画像パスは不可)
);

create table private.ai_usage_daily (
  user_id uuid not null, day date not null, count int not null default 0,
  primary key (user_id, day)
);
create table private.ai_usage_monthly (
  organization_id uuid not null, month date not null, count int not null default 0,
  primary key (organization_id, month)
);
create table private.settings (key text primary key, value jsonb not null);
-- 例: ai_daily_limit_per_user=20, ai_monthly_limit_per_org=3000, ai_per_minute_per_user=3(すべて仮)
```

## 4. 認可関数と RLS

### 4.1 認可関数(`authz` スキーマ、SECURITY DEFINER、STABLE)

```sql
-- 有効なロールを持つか
authz.has_role(p_role public.app_role) returns boolean
  = exists (select 1 from public.user_roles
            where user_id = auth.uid() and role = p_role and revoked_at is null)

-- スタッフ/管理者は MFA(aal2)必須(仮)
authz.is_aal2() returns boolean
  = coalesce(auth.jwt() ->> 'aal', '') = 'aal2'

-- スタッフが利用者の特定範囲にアクセスできるか(すべて満たす場合のみ true)
authz.staff_can(p_member uuid, p_scope public.consent_scope) returns boolean
  = authz.has_role('staff') and authz.is_aal2()
    and exists (select 1 from public.staff_assignments a
                where a.staff_id = auth.uid() and a.member_id = p_member
                  and a.ended_at is null and a.started_at <= now())
    and exists (select 1 from public.staff_access_consents c
                where c.staff_id = auth.uid() and c.member_id = p_member
                  and c.scope = p_scope and c.revoked_at is null)
    and (select organization_id from public.profiles where user_id = auth.uid())
      = (select organization_id from public.profiles where user_id = p_member)
```

- 毎リクエストで DB の現在値を評価するため、**同意撤回・担当解除・ロール剥奪は次のクエリから効く**(JWT にロール・同意を埋め込まない)。
- `authenticated` に `authz` スキーマの USAGE と各関数の EXECUTE を付与(RLS 内で使うため)。PostgREST の公開スキーマには含めない。

### 4.2 RLS ポリシー一覧

| テーブル | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | 本人 / 管理者(同組織、表示名など最小列のみをビュー経由)| RPC のみ | 本人(display_name, timezone のみ。列権限で制限) | 不可(アカウント削除で cascade) |
| user_roles | 本人 / 管理者 | 管理者 RPC | 管理者 RPC | 不可 |
| staff_assignments | 当事者(staff, member) / 管理者 | 管理者 RPC | 管理者 RPC(ended_at のみ) | 不可 |
| consent_documents | authenticated 全員 | 不可 | 不可 | 不可 |
| user_agreements | 本人 | 本人 | 不可 | 不可 |
| staff_access_consents | 当事者(member, staff) | 本人(member) RPC:**有効な担当割当がある staff のみ** | 本人(member) RPC:revoked_at のみ | 不可 |
| foods / food_aliases | authenticated 全員 | 不可 | 不可 | 不可 |
| meal_analyses | 本人 | Edge Function(利用者JWT)経由の RPC | 不可 | 本人 |
| meals | 本人 | 本人(`save_meal` RPC)| 本人(`update_meal` RPC)| 本人 |
| meal_items | 本人 | RPC のみ | RPC のみ | 本人(meals の cascade)|
| body_compositions | 本人 | 本人(entry_source='self', entered_by=本人)| 本人 | 本人 |
| audit.logs | 管理者(非公開スキーマのため RPC 経由)| 定義者関数のみ | **全員不可** | **全員不可** |
| private.* | 不可(RPC 経由)| 定義者関数のみ | 定義者関数のみ | 不可 |

- **スタッフにはテーブル直接の SELECT/INSERT ポリシーを付けない**。スタッフのアクセスは §4.3 の RPC 経由のみとし、RPC 内で `authz.staff_can` の判定と監査ログ記録を同じトランザクションで行う(案 A)。案 B(RLS ポリシーに `authz.staff_can` を書き、直接 SELECT を許可)との比較は **[未決 D-08]**。
- 管理者は既定で利用者の食事・身体データを見られない **[未決 D-05]**。
- 食事の修正は本人のみ:`meals`/`meal_items` の UPDATE ポリシーは `user_id = (select auth.uid())` のみ。スタッフ・管理者の更新経路は作らない。

### 4.3 スタッフ用 RPC(public、SECURITY DEFINER)

| 関数 | 必要な範囲 | 返すもの |
|---|---|---|
| `staff_list_members()` | 担当割当 | 担当利用者の表示名と、自分に付与されている範囲 |
| `staff_get_meals(member, from, to)` | `meals:read` | 食事・明細(画像パスは返さない **[未決 D-09]**)|
| `staff_get_body_compositions(member, from, to)` | `body:read` | InBody 履歴 |
| `staff_insert_body_composition(member, payload)` | `body:write` | 作成した行の id |
| `staff_update_body_composition(id, payload)` | `body:write` + 自分が入力 + 24時間以内(仮)| — |

各関数の共通処理:
1. `authz.staff_can(member, scope)` が false → `audit.log(..., 'denied')` を記録し、`42501`(insufficient_privilege)を返す。※ 拒否ログを残すため、例外ではなく記録後に例外を投げる構成にする(例外でロールバックされないよう、拒否時は記録して空結果+エラーコードを返す方式を Sprint 1 で検証)。
2. 許可 → 必要列だけを返し、`audit.log(..., 'allowed')`。

### 4.4 Storage(`meal-images` バケット)

- `public = false`、`file_size_limit = 5MB`(仮)、`allowed_mime_types = {image/jpeg, image/webp}`(端末で再エンコード後の形式のみ)。
- オブジェクトパス:`{user_id}/{yyyy}/{uuid}.webp`(ファイル名に利用者が付けた名前を使わない)。
- `storage.objects` のポリシー:INSERT / SELECT / DELETE とも `bucket_id = 'meal-images' and (storage.foldername(name))[1] = (select auth.uid())::text`。UPDATE(上書き)は不可。
- スタッフ・管理者のポリシーは付けない(画像の閲覧は本人のみ、仮)。
- 期限切れ削除:`purge-expired-images` が `meals.image_expires_at < now()` の画像を削除し、`image_path` を null にする。下書きのまま保存されなかった画像も 24 時間後に削除(仮)。

## 5. 監査ログの記録対象

| 種別 | 記録方法 |
|---|---|
| 食事・InBody・同意・担当・ロールの作成/更新/削除 | AFTER トリガー(SECURITY DEFINER)|
| スタッフの閲覧・代理入力(許可/拒否) | スタッフ RPC 内 |
| AI 解析の実行・拒否(上限・検証失敗) | analyze-meal → `log_event` RPC |
| エクスポート・アカウント削除 | Edge Function → RPC |
| 管理者の監査ログ閲覧 | 閲覧 RPC 内 |
| ログイン・MFA | Supabase Auth の監査ログ(別保存)。DB 側への取込は **[未決 D-17]** |

`metadata` には変更された**列名**のみを入れ、値は入れない。

## 6. 栄養計算規則(決定論的)

```
item.energy_kcal       = per100_energy_kcal       * grams / 100
item.protein_g         = per100_protein_g         * grams / 100
item.fat_g             = per100_fat_g             * grams / 100
item.carbohydrate_g    = per100_carbohydrate_g    * grams / 100
meal.total_*           = Σ item.*  (丸め前の値の合計)
day.total_*            = Σ meal.total_*
```

- 保存は `numeric(9,2)`(小数第2位で四捨五入)。表示はエネルギー整数 kcal、PFC 小数第1位。
- 浮動小数点を使わない(DB は numeric、TS 側は整数演算または decimal ライブラリ **[Sprint 2 で選定]**)。
- 同じ入力に対し、TS 実装と SQL 実装が同じ結果を返すことをテストで保証。

## 7. 削除・保持

| データ | 保持 | 削除時 |
|---|---|---|
| 食事画像 | 30日(仮)**[未決 D-09]** | 自動削除 |
| meal_analyses | 90日(仮)**[未決 D-09]** | 自動削除(精度評価の集計値のみ残す)|
| 食事・InBody | 利用者が削除するまで | 本人削除 / アカウント削除で cascade |
| 同意履歴 | アカウント削除まで | cascade |
| 監査ログ | 1年(仮)**[未決 D-10]** | 期限で削除。アカウント削除時は actor/subject を仮名化 |

## 8. マイグレーション規約

- ファイル名:`supabase/migrations/YYYYMMDDHHMMSS_<説明>.sql`(Supabase CLI 既定)。
- 1マイグレーション=1論理変更。適用済みファイルは編集しない。
- 破壊的変更は「追加 → 移行 → 削除」の3段階。
- CI で `supabase db reset` → pgTAP 全件 → 型生成差分チェック(`supabase gen types` の結果がコミット済みと一致)。
