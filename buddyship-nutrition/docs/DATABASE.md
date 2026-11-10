# DATABASE — DB・RLS 設計

- 文書版: **v2.0 ドラフト(承認待ち)**
- DB: Supabase PostgreSQL。すべての変更は `supabase/migrations/` の SQL マイグレーションで管理(ダッシュボードでの手作業変更は禁止)。
- 下の SQL は設計意図を示すもの。実装時にマイグレーションとして書き起こし、pgTAP で検証する。
- **Sprint 1 実装済み**:§3.1〜§3.3、§3.8、§4(判定関数・RLS・Sprint 1 分の RPC)、§5 の一部。実体は `supabase/migrations/2026111000*_*.sql`。設計からの差分は §9。

## 1. スキーマ方針

| スキーマ | API 公開 | 内容 |
|---|---|---|
| `public` | 公開 | テーブル・RPC |
| `authz` | 非公開 | 認可判定関数 |
| `audit` | 非公開 | 監査ログ |
| `private` | 非公開 | 利用量カウンタ・設定 |

- 全テーブルで RLS を有効化。`anon` には利用者データの権限を与えない。
- SECURITY DEFINER 関数は `set search_path = ''`、全オブジェクトをスキーマ修飾、`EXECUTE` は `PUBLIC` から取り消して必要なロールに付与。
- ビューは `security_invoker = true` 必須(既定では所有者権限で実行され RLS を回避し得るため)。
- RLS 内の `auth.uid()` は `(select auth.uid())` と書く。

## 2. ER 概要

```
organizations 1─* facilities 1─* profiles(= auth.users 1:1)
profiles 1─* user_roles
profiles(staff) *─* profiles(member)       via staff_assignments
profiles(member) 1─* staff_access_consents *─1 profiles(staff)
consent_documents 1─* user_agreements / staff_access_consents
profiles(member) 1─* meal_slot_status          (日 × 区分の記録状況)
profiles(member) 1─* meals 1─* meal_items *─1 foods 1─* food_aliases / food_portions
meal_analyses 1─* meals
profiles(member) 1─* body_compositions
audit.logs / private.ai_usage_* / private.settings
```

## 3. テーブル

### 3.1 列挙型

```sql
create type public.app_role       as enum ('member', 'staff', 'admin');
create type public.consent_scope  as enum ('meals:read', 'meals:write', 'body:read', 'body:write');
create type public.meal_slot      as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type public.meal_location  as enum ('home');            -- 将来 'studio' 等を追加
create type public.slot_status    as enum ('recorded', 'skipped', 'dayservice');
create type public.entry_source   as enum ('self', 'staff');
create type public.info_source    as enum ('photo', 'interview', 'manual'); -- 写真/聞き取り/本人の手入力
create type public.time_precision as enum ('exact', 'approximate', 'slot_only');
```

### 3.2 組織・利用者・ロール

```sql
create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now());
create table public.facilities    (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), name text not null);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  facility_id uuid references public.facilities(id),
  display_name text not null check (char_length(display_name) between 1 and 50),
  timezone text not null default 'Asia/Tokyo',
  font_scale smallint not null default 0 check (font_scale between 0 and 2),
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

- ロールを `auth.users` の user_metadata に置かない(利用者が書き換え可能なため)。
- 氏名・生年月日・介護度・病名は持たない **[未決 D-28]**。

### 3.3 担当割当・同意

```sql
create table public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  staff_id uuid not null references public.profiles(user_id) on delete cascade,
  member_id uuid not null references public.profiles(user_id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references public.profiles(user_id) on delete set null,
  check (staff_id <> member_id),
  check (created_by is null or created_by <> staff_id)   -- 管理者が自分を担当に割り当てられない(案、DECISIONS §3-9)
);
create unique index staff_assignments_active_uq on public.staff_assignments(staff_id, member_id) where ended_at is null;

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
  granted_via text not null check (granted_via in ('member_app')),  -- 紙同意の取込を認めるかは D-26
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(user_id) on delete set null,
  revoke_reason text check (revoke_reason in ('member','assignment_ended','account_deleted','admin_emergency')),
  check (revoked_at is null or revoked_at >= granted_at)
);
create unique index staff_access_consents_active_uq on public.staff_access_consents(member_id, staff_id, scope) where revoked_at is null;
```

- 同意は「利用者 × スタッフ × スコープ」。撤回は `revoked_at` を立てるだけで行は残す。
- **スタッフが自分自身に同意を付与する経路は作らない**(付与 RPC は `auth.uid() = member_id` の場合のみ)。

### 3.4 食品成分マスター

```sql
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  source text not null,               -- 例: 日本食品標準成分表 の識別子
  source_version text not null,
  source_food_code text,
  name text not null,                 -- 成分表の正式名
  display_name text not null,         -- 利用者向けのやさしい名前
  category text not null,
  -- 可食部 100 g あたり。成分表の標準的な成分値(D-18 ②):ENERC_KCAL / PROT- / FAT- / CHOCDF-
  -- 値が null = 成分表で未測定(-)。0 とはみなさない
  energy_kcal numeric(7,2) not null check (energy_kcal >= 0),       -- 成分表の公表値(P/F/C から再計算しない)
  protein_g numeric(7,2) check (protein_g >= 0),
  fat_g numeric(7,2) check (fat_g >= 0),
  carbohydrate_g numeric(7,2) check (carbohydrate_g >= 0),
  -- 成分表の表記の種類(measured / estimated / trace / estimated_trace / not_determined)と元の表記
  energy_kind text not null, protein_kind text not null, fat_kind text not null, carbohydrate_kind text not null,
  raw_values jsonb not null,                                       -- 例 {"PROT-": "(9.7)", "FAT-": "Tr"}
  check ((protein_g is null) = (protein_kind = 'not_determined')),
  check ((fat_g is null) = (fat_kind = 'not_determined')),
  check ((carbohydrate_g is null) = (carbohydrate_kind = 'not_determined')),
  is_active boolean not null default true,
  unique (source, source_version, source_food_code)
);
create table public.food_aliases  (food_id uuid not null references public.foods(id) on delete cascade, alias text not null, primary key (food_id, alias));
create table public.food_portions (                                  -- 目安単位(お茶わん1杯 等)D-19
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods(id) on delete cascade,
  label text not null, grams numeric(7,1) not null check (grams > 0),
  source_note text not null                                       -- 目安量の出典(成分表の備考など)。出典のない値は入れない
);
```

- 読み取りは authenticated 全員、書き込みはマイグレーション/取込スクリプトのみ。
- 版:**取込時点の最新版**(D-18 ①)。2026-11-10 時点では「日本食品標準成分表(八訂)増補2023年」に正誤表(2026-03-27 公表)を反映したもの。
- 列と値の解釈:**D-18 ② 決定(2026-11-10)**。管理栄養士が常勤しない前提で、成分表の標準的な成分値を使う。対応と解釈の規則は `packages/nutrition`(§3.4.2)が唯一の定義で、取込スクリプトもそれに従う。

#### 3.4.2 公式 Excel との対応(実ファイルで確認・テスト済み)

確認したファイル:第2章(データ)`20260327-mxt_kagsei-mext-000029402_02.xlsx`、シート「表全体」、11 行目=単位、12 行目=成分識別子、13 行目からデータ(2,538 食品)。

| アプリの項目 | 成分識別子 | 列 | 列名(見出し) | 単位 | 備考 |
|---|---|---|---|---|---|
| エネルギー | `ENERC_KCAL` | G | エネルギー | kcal | 公表値をそのまま使う。全食品に値があり、すべて整数。`ENERC`(F 列)は kJ なので使わない |
| たんぱく質 | `PROT-` | J | たんぱく質 | g | `PROTCAA`(アミノ酸組成によるたんぱく質、I 列)は使わない |
| 脂質 | `FAT-` | M | 脂質 | g | `FATNLEA`(トリアシルグリセロール当量、K 列)は使わない |
| 炭水化物 | `CHOCDF-` | U | 炭水化物 | g | 識別子は末尾にハイフン。`CHOAVL`・`CHOAVLM`・`CHOAVLDF-`(利用可能炭水化物)は使わない |

注:指示の「ENERC(kcal)」「CHOCDF」は、公式 Excel ではそれぞれ `ENERC_KCAL`、`CHOCDF-` という識別子になっている。

値の表記と扱い(実データの件数):

| 表記 | 意味(成分表) | 計算での扱い | たんぱく質 | 脂質 | 炭水化物 |
|---|---|---|---|---|---|
| 数値(`12.7`。数値型の場合と `"6.0"` のような文字列の場合がある) | 成分値 | その値 | 2,231 | 2,177 | 2,179 |
| `(数値)`(`(0)` を含む) | 推定値 | その値 | 284 | 283 | 279 |
| `Tr` | 微量 | 0 | 17 | 76 | 80 |
| `(Tr)` | 推定で微量 | 0 | 5 | 1 | 0 |
| `-` | 未測定 | **値なし(null)。0 とみなさず、合計に「一部の値なし」と表示** | 1 | 1 | 0 |

- `-` は「09059 わかめ カットわかめ 水煮の汁」のたんぱく質・脂質だけ。
- 上記以外の表記が見つかったら取込を止める(黙って 0 にしない)。
- 2026-03-27 正誤表の値の訂正が反映済みであることを照合済み(トマトケチャップ 116 kcal など)。
- テスト:`packages/nutrition/src/sfct8-columns.test.ts`(公式ファイルから `scripts/sfct/extract_sfct8.py` が SHA-256 照合のうえ取り出したデータを使う)。

#### 3.4.1 版の管理と更新(最新データを保つための仕組み)

| 項目 | 方針 |
|---|---|
| `source` | `mext_sfct8`(日本食品標準成分表 八訂系) |
| `source_version` | 本体と反映済みの正誤表を表す。例:`2023-supplement+errata-2026-03-27` |
| 取込元 | 公式ページ https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html の「第2章(データ)」Excel:`https://www.mext.go.jp/content/20260327-mxt_kagsei-mext-000029402_02.xlsx`(2026-11-10 取得、SHA-256 `0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c`、2,538 食品、シート「表全体」、12 行目に成分識別子)。**このファイルには 2026-03-27 の正誤表が反映済み**(正誤表の値の変更 6 件を照合して確認)。正誤表 Excel(`..._16.xlsx`)は取込後の照合にだけ使う。ファイルの SHA-256・取得日・取得元 URL を取込記録(`private.food_imports`、Sprint 2 で追加)に残す |
| 取込スクリプト | 何度でも実行できる(冪等)。同じ食品番号の行は新しい版で置き換えず**新しい行として追加**し、古い版の行は `is_active = false` にする |
| 過去の記録 | 食事明細は計算時の成分値と `food_source_version` をスナップショットで持つため、成分表を更新しても過去の記録の値は変わらない |
| 差分の確認 | 取込前に旧版との差分(追加・削除・値の変わった食品・表記の変わった値)を一覧にし、外部管理栄養士のスポット監修(D-33)の確認と運営責任者の承認を経てから有効化する |
| 更新の確認 | 文部科学省の新着(増補・正誤表)を四半期ごとに確認する運用とし、運用手順書(S4-08)に記載する。確認先:公式ページと「公表履歴、今後の収載予定」https://www.mext.go.jp/a_menu/syokuhinseibun/mext_02092.html (2026-11-10 時点で「更新予定の収載値(案)等のデータはありません」)|
| 出典表示 | アプリ内に版名と出典を表示する(D-23)。表記は文部科学省の案内どおり「日本食品標準成分表(八訂)増補2023年から引用(又は出典)」(公式ページで確認済み。食品成分データは自由に利用できる、アプリ等の二次利用時はこの表記で出典を明らかにする、と案内されている)|
- **独自の料理マスターは作らない(D-19 決定)**。複合料理は構成食材ごとに `meal_items` の行として記録し、成分表の食品コードに対応付ける(§3.5.1)。`food_portions`(目安単位)は成分表の備考など出典のある値だけを入れ、出典を列に残す。嚥下調整食(きざみ・ミキサー等)の扱いは **[未決 D-32]**。

### 3.5 食事

```sql
create table public.meal_analyses (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(user_id) on delete cascade,
  requested_by uuid references public.profiles(user_id) on delete set null,
  image_path text not null,
  status text not null check (status in ('succeeded','failed','rejected')),
  provider text not null, model text not null,
  items jsonb,                        -- [{label, served_g, confidence, kind}] のみ。栄養値は保存しない
  error_code text,
  created_at timestamptz not null default now()
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(user_id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  slot public.meal_slot not null,
  location public.meal_location not null default 'home'
    check (location = 'home'),                                   -- Phase 1:自宅のみ
  eaten_on date not null,                                        -- 利用者のタイムゾーンでの摂取日
  eaten_at timestamptz,                                          -- 実際の摂取日時(わかる範囲で)
  eaten_at_precision public.time_precision not null,
  recorded_at timestamptz not null default now(),                -- 登録日時(サーバー時刻、クライアント値は使わない)
  updated_at timestamptz not null default now(),
  entry_source public.entry_source not null,
  entered_by uuid references public.profiles(user_id) on delete set null,
  info_source public.info_source not null,
  analysis_id uuid references public.meal_analyses(id) on delete set null,
  image_path text,
  image_expires_at timestamptz,
  -- 合計は「確定」した明細だけ。要確認の明細は含めない(§3.5.1)
  total_energy_kcal numeric(9,2) not null,
  total_protein_g numeric(9,2) not null,
  total_fat_g numeric(9,2) not null,
  total_carbohydrate_g numeric(9,2) not null,
  -- 合計の注記(packages/nutrition の sumNutrients / summarizeMeal の結果)。例 {"protein_g":{"incomplete":true,"includesTrace":false,...}}
  total_flags jsonb not null default '{}'::jsonb,
  display_precision text not null default 'normal' check (display_precision in ('normal','approximate')),
  needs_review_count smallint not null default 0 check (needs_review_count >= 0),
  nutrition_rules_version text not null,
  check ((eaten_at_precision = 'slot_only') = (eaten_at is null)),
  check (eaten_on <= (recorded_at at time zone 'Asia/Tokyo')::date + 1)  -- 未来日の拒否(タイムゾーンは profiles を参照する関数で実装)
);
create index meals_member_eaten_idx on public.meals(member_id, eaten_on desc);

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  member_id uuid not null references public.profiles(user_id) on delete cascade,
  position smallint not null,
  -- D-19:料理は構成食材ごとの行にする。同じ料理の行は dish_group_id が同じ
  role text not null check (role in ('food','ingredient','cooking_oil','seasoning')),
  dish_group_id uuid,
  dish_label text check (char_length(dish_label) <= 100),        -- 料理名(例:肉じゃが)。表示用
  dish_composition_known boolean,                                -- 構成食材がわかっているか(false なら表示をおおよそにする)
  -- 食品コードの対応付け。確実でなければ needs_review のまま確定しない(要確認の間は food_id は null、候補は candidate_food_ids)
  match_status text not null check (match_status in ('confirmed','needs_review')),
  food_id uuid references public.foods(id),
  candidate_food_ids uuid[] not null default '{}',               -- 要確認のときに画面で選んでもらう候補
  origin text not null check (origin in ('ai','ai_corrected','manual')),
  ai_label text check (char_length(ai_label) <= 100),
  ai_estimated_served_g numeric(7,1),                            -- 写真からの AI 推定提供量(上書きしない)
  served_g numeric(7,1) not null check (served_g > 0 and served_g <= 2000),   -- 確認・修正後の提供量
  intake_percent smallint not null check (intake_percent between 0 and 100),   -- 食べた割合(%、整数)
  consumed_g numeric(8,2) generated always as (served_g * intake_percent / 100.0) stored, -- 摂取量
  per100_energy_kcal numeric(7,2) not null,                      -- 計算時点の成分値スナップショット
  per100_protein_g numeric(7,2),
  per100_fat_g numeric(7,2),
  per100_carbohydrate_g numeric(7,2),
  -- 成分表の元の表記と種類のスナップショット(追加要件 1・2)。例 {"PROT-":{"raw":"Tr","kind":"trace","traceAsZero":true}}
  per100_notation jsonb,
  food_source_version text,
  nutrition_rules_version text not null,                         -- 計算規則の版(packages/nutrition の NUTRITION_RULES_VERSION)
  energy_kcal numeric(9,2),
  protein_g numeric(9,2),                                        -- null = 成分表で未測定(合計では「一部の値なし」)
  fat_g numeric(9,2),
  carbohydrate_g numeric(9,2),
  check (origin = 'manual' or ai_estimated_served_g is not null),
  -- 確定した行だけが成分値を持つ。要確認の行は成分値・スナップショットを持たない(合計に入らない)
  check ((match_status = 'confirmed') = (food_id is not null and energy_kcal is not null and per100_notation is not null and food_source_version is not null)),
  check ((role = 'food') = (dish_group_id is null)),
  check (dish_group_id is null or (dish_label is not null and dish_composition_known is not null))
);
```

#### 3.5.1 複合料理と「要確認」(D-19)

| 項目 | 規則 |
|---|---|
| 料理マスター | 作らない。料理は構成食材(`role = ingredient`)・調理油(`cooking_oil`)・調味料(`seasoning`)の行に分けて記録する |
| 候補 | AI が料理の構成食材の候補(食材名・提供量)を出し、サーバーが成分表の食品コードと照合する |
| 確定の条件 | `packages/nutrition` の `initialMatchStatus`:候補がちょうど 1 つ、名前(成分表の食品名または別名辞書)が完全一致、AI の確からしさが低くない、のすべてを満たすときだけ `confirmed`。それ以外は `needs_review` |
| 確認・修正 | 食材の種類・重量・調理油・調味料は、利用者またはスタッフ(`meals:write`)が追加・削除・変更できる。要確認の行は候補から選ぶか、食品検索で選ぶと `confirmed` になる |
| 要確認の行の扱い | 合計に入れない(`needs_review_count` に数える)。保存はできるが、画面で「確認が済んでいない食品があります」と示す |
| おおよその表示 | 要確認の行がある、または構成食材が不明な料理(`dish_composition_known = false`)を含む食事は、`display_precision = approximate`(エネルギー 10 kcal 単位、P/F/C 1 g 単位、「約」付き) |

- `meal_items.member_id` は RLS 簡素化のための非正規化。トリガーで `meals.member_id` との一致を強制。
- 栄養値・合計・`recorded_at`・`entered_by`・`entry_source` は**クライアントから受け取らない**。`save_meal` / `update_meal` RPC 内で決める。テーブルへの直接 INSERT/UPDATE は不可。

### 3.6 欠測管理(記録状況)

```sql
create table public.meal_slot_status (
  member_id uuid not null references public.profiles(user_id) on delete cascade,
  eaten_on date not null,
  slot public.meal_slot not null check (slot in ('breakfast','lunch','dinner')),
  status public.slot_status not null,
  set_by uuid references public.profiles(user_id) on delete set null,
  set_at timestamptz not null default now(),
  primary key (member_id, eaten_on, slot)
);
```

- 行がない = **未記録**。0 摂取とは扱わない。
- `recorded` は `save_meal` で自動設定。その区分の食事をすべて削除したら行を削除して未記録に戻す(トリガー)。
- `skipped`(食べなかった)と `dayservice`(デイサービスで食べた)は利用者/`meals:write` を持つスタッフが明示的に設定。`recorded` の区分を `skipped` に変える場合は、先に食事の削除を求める。
- 集計関数 `get_daily_summary(member, from, to)` は日ごとに `{slots: {breakfast, lunch, dinner}, complete: bool, recorded_totals}` を返す。`complete` = 3 区分すべてに行がある。平均は `complete` の日のみで計算し、対象日数を返す。

### 3.7 InBody

```sql
create table public.body_compositions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(user_id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  measured_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  weight_kg numeric(5,1) not null check (weight_kg between 20 and 300),
  skeletal_muscle_kg numeric(5,1) not null check (skeletal_muscle_kg between 5 and 100),
  body_fat_kg numeric(5,1) not null check (body_fat_kg between 0.5 and 200),
  body_fat_pct numeric(4,1) not null check (body_fat_pct between 1 and 75),
  device_model text not null check (char_length(device_model) between 1 and 50),
  entry_source public.entry_source not null,
  entered_by uuid references public.profiles(user_id) on delete set null,
  updated_at timestamptz not null default now(),
  check (skeletal_muscle_kg < weight_kg and body_fat_kg < weight_kg)
);
```
範囲は仮値。使用機種の測定範囲で見直す **[未決 D-12]**。

### 3.8 監査・利用量

```sql
create table audit.logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid, actor_role text,
  action text not null,               -- 'meal.create.proxy', 'body.read.staff', 'consent.revoke', 'access.denied' など
  subject_member_id uuid,
  resource_type text, resource_id uuid,
  result text not null check (result in ('allowed','denied','error')),
  request_id text,
  metadata jsonb not null default '{}'::jsonb   -- 変更列名・スコープ名のみ。値・食品名・画像パスは入れない
);
create table private.ai_usage (scope_kind text, scope_id uuid, period text, period_start timestamptz, count int not null default 0,
                               primary key (scope_kind, scope_id, period, period_start));
create table private.settings (key text primary key, value jsonb not null);
-- 例(仮): ai_per_minute_per_actor=3, ai_daily_per_member=10, ai_daily_per_staff=60, ai_monthly_per_org=3000, ai_enabled=true
```

## 4. 認可

### 4.1 判定関数(`authz`、SECURITY DEFINER、STABLE)

```sql
authz.has_role(r app_role)  = 有効な user_roles 行があるか
authz.is_aal2()             = coalesce(auth.jwt()->>'aal','') = 'aal2'
authz.same_org(member uuid) = 呼出者と member の organization_id が一致

authz.staff_can(member uuid, s consent_scope) =
      authz.has_role('staff') and authz.is_aal2() and authz.same_org(member)
  and exists(有効な staff_assignments: staff_id = auth.uid(), member_id = member, ended_at is null)
  and exists(有効な staff_access_consents: staff_id = auth.uid(), member_id = member, scope = s, revoked_at is null)

authz.can_write_meals(member uuid) = auth.uid() = member or authz.staff_can(member, 'meals:write')
authz.can_write_body(member uuid)  = auth.uid() = member or authz.staff_can(member, 'body:write')
```

- 毎回 DB の現在値で判定する。JWT にロール・同意を埋め込まない → **撤回・担当解除・ロール剥奪は次のクエリから効く**。
- 管理者には健康データの判定関数で true を返す経路を作らない(`admin` は `staff_can` に含めない)。

### 4.2 RLS 一覧

| テーブル | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | 本人 / 管理者(同組織・表示名など最小列のみ)/ 担当スタッフ(表示名のみ、RPC) | 管理者 RPC | 本人(表示名・文字サイズのみ、列権限) | 不可(アカウント削除で cascade) |
| user_roles | 本人 / 管理者 | 管理者 RPC | 管理者 RPC | 不可 |
| staff_assignments | 当事者 / 管理者 | 管理者 RPC | 管理者 RPC(ended_at のみ) | 不可 |
| consent_documents | authenticated | 不可 | 不可 | 不可 |
| user_agreements | 本人 | 本人 | 不可 | 不可 |
| staff_access_consents | 当事者 | **本人のみ** RPC(有効な担当割当がある staff に限る) | 本人 RPC(撤回)、システム(担当解除時の自動撤回) | 不可 |
| foods / food_aliases / food_portions | authenticated | 不可 | 不可 | 不可 |
| meal_analyses | 本人 | Edge Function 経由 RPC | 不可 | 本人 |
| meals / meal_items | 本人 | RPC のみ | RPC のみ | 本人 |
| meal_slot_status | 本人 | RPC のみ | RPC のみ | RPC のみ |
| body_compositions | 本人 | RPC のみ | RPC のみ | 本人 |
| audit.logs | 管理者 RPC(健康データの値は含まれない) | 定義者関数のみ | **全員不可** | **全員不可** |
| private.* | 不可 | 定義者関数のみ | 定義者関数のみ | 不可 |

- **スタッフにはテーブル直接の権限を与えず、§4.3 の RPC 経由のみ**(案 A、**[未決 D-08]**)。
- **管理者の健康データ閲覧経路はない**(確定仕様)。監査ログにも健康データの値を入れない。

### 4.3 RPC(SECURITY DEFINER)と必要な認可

| 関数 | 本人 | スタッフ | 監査 |
|---|---|---|---|
| `save_meal(member_id, payload)` | ○ | `meals:write` | 代理は `meal.create.proxy` |
| `update_meal(meal_id, payload)` | ○(全記録) | `meals:write` かつ 自分が入力 かつ 期限内 **[D-07]** | ○ |
| `set_slot_status(member_id, date, slot, status)` | ○ | `meals:write` | ○ |
| `get_meals(member_id, from, to)` | ○ | `meals:read` | スタッフ閲覧を記録 |
| `get_daily_summary(member_id, from, to)` | ○ | `meals:read` | 同上 |
| `insert_body_composition(member_id, payload)` | ○ | `body:write` | 代理は `body.create.proxy` |
| `update_body_composition(id, payload)` | ○ | `body:write` かつ 自分が入力 かつ 期限内 | ○ |
| `get_body_compositions(member_id, from, to)` | ○ | `body:read` | スタッフ閲覧を記録 |
| `staff_dashboard()` | — | 担当割当(列ごとにスコープ判定) | ○ |
| `grant_staff_consent(staff_id, scope, document_id)` / `revoke_staff_consent(...)` | ○ | — | ○ |
| `admin_*`(ロール・割当・利用量・監査ログ閲覧) | — | — | admin かつ aal2、○ |

共通処理:①認可 → ②入力検証 → ③処理 → ④監査。**拒否時も監査ログを残す**。PostgreSQL では例外で同一トランザクションの INSERT も取り消されるため、拒否時は例外を投げず「記録してからエラー結果を返す」方式とする(Sprint 1 で検証、[DECISIONS R-07](./DECISIONS.md))。

### 4.4 Storage(`meal-images`)

- `public = false`、`file_size_limit` 5MB(仮)、`allowed_mime_types` = image/jpeg, image/webp。
- パス:`{member_id}/{yyyy}/{uuid}.webp`。
- ポリシー(`storage.objects`):
  - INSERT:`(storage.foldername(name))[1] = auth.uid()::text` または `authz.staff_can(((storage.foldername(name))[1])::uuid, 'meals:write')`
  - SELECT:本人のフォルダ、またはスタッフが自分でアップロードした(`owner_id = auth.uid()::text`)かつ `meals:write` が有効なもの
  - DELETE:本人のフォルダ
  - UPDATE:不可
- スタッフが `meals:read` だけで画像を見られるかは **[未決 D-09]**(仮:見られない。数値のみ)。

## 5. 監査対象

| 種別 | 方法 |
|---|---|
| 食事・記録状況・InBody・同意・割当・ロールの変更 | RPC 内 / AFTER トリガー |
| スタッフの閲覧・代理入力(許可/拒否) | RPC 内 |
| AI 解析(実行・上限超過・検証失敗) | analyze-meal → RPC |
| エクスポート・アカウント削除 | Edge Function → RPC |
| 管理者の監査ログ閲覧 | RPC 内 |

## 6. 計算規則(決定論的)

規則の定義は **`packages/nutrition`(独立モジュール)** にまとめる(安全要件 8:将来、管理栄養士が監修・変更できるように、画面・DB・AI から切り離す)。

| ファイル | 内容 |
|---|---|
| `source.ts` | 出典・版・正誤表・出典表記(画面に表示) |
| `sfct8-columns.ts` | 公式 Excel の列との対応(§3.4.2) |
| `value.ts` | 表記(`Tr`・`(数値)`・`-` 等)の解釈 |
| `calc.ts` | 摂取量・成分量・合計・丸め(通常/おおよそ)、元の表記と Tr の区別、規則の版 `NUTRITION_RULES_VERSION`(現在 `sfct8-standard-v2`) |
| `composition.ts` | 複合料理の構成食材・調理油・調味料、食品コードの対応付け(確定/要確認)、食事の集計と表示精度(D-19) |
| `daily.ts` | 集計名「記録済みの自宅食事の推定摂取量」と注記(不完全な日を 1 日の総摂取量として見せない) |

```
consumed_g           = served_g × intake_percent / 100
item.energy_kcal     = per100_energy_kcal(成分表の公表値)× consumed_g / 100   ※ P/F/C から再計算しない
item.protein_g 等     = per100 × consumed_g / 100(per100 が null なら null)
meal.total_*         = Σ 確定した item.*(丸め前の値で合計。null を含めば「一部の値なし」。要確認の行は含めない)
記録済みの自宅食事の推定摂取量 = Σ その日の meal.total_*   ※ 未記録の区分は含めず 0 ともみなさない
```
- 内部は整数(100 g あたり値は 0.1 単位、量は 0.01 g 単位)で計算し、保存は小数第 2 位。表示はエネルギー整数 kcal、P/F/C 小数第 1 位(四捨五入)。おおよその表示(§3.5.1)は 10 kcal 単位・1 g 単位で「約」を付ける。
- **元の表記の保持**:`foods.raw_values` と `meal_items.per100_notation` に成分表の表記(`Tr`・`(Tr)`・`(9.7)`・`-` など)と種類を残す。
- **Tr と測定上のゼロの区別**:`Tr`・`(Tr)` は計算上 0 として扱うが `traceAsZero = true` を残し、表示は「微量」。`0`・`(0)` は測定上・推定上のゼロとして「0.0」。合計が Tr だけでできた 0 なら「微量」と表示する。
- **集計名**:「記録済みの自宅食事の推定摂取量」(`packages/nutrition` の `AGGREGATE_LABEL`)。記録状況に応じた注記を必ず添える。
- 保存値の計算はサーバー側。SQL で実装する場合は、`packages/nutrition` の計算ケース表を SQL にも流して同じ結果になることをテストで保証する(Sprint 2)。規則を変えたら `NUTRITION_RULES_VERSION` を上げ、過去の明細は計算時の版のまま残す。

## 7. 保持・削除

| データ | 保持(仮) | 未決 |
|---|---|---|
| 食事画像 | 30 日で自動削除。保存されなかった下書き画像は 24 時間 | D-09 |
| meal_analyses | 90 日 | D-09 |
| 食事・InBody・記録状況 | 本人削除 / アカウント削除まで | D-20(介護記録としての扱い) |
| 監査ログ | 1 年(アカウント削除時は ID を仮名化) | D-10 |
| バックアップ | プランの保持期間に従う | D-31 |

## 8. マイグレーション規約

- `supabase/migrations/YYYYMMDDHHMMSS_<説明>.sql`。1 マイグレーション = 1 論理変更。適用済みファイルは編集しない。
- 破壊的変更は「追加 → 移行 → 削除」の 3 段階。
- CI:`supabase db reset` → pgTAP 全件 → 生成した型とコミット済みの型の差分チェック。
- カタログ検査テスト:`public` の全テーブルで RLS 有効、SECURITY DEFINER 関数の `search_path` 固定、`PUBLIC` に EXECUTE なし、ビューの `security_invoker`。

## 9. Sprint 1 実装での設計からの差分

| 項目 | 設計 | 実装 | 理由 |
|---|---|---|---|
| RPC の返り値 | 未定義 | すべて `{"ok": true, "data": ...}` / `{"ok": false, "error": "<code>"}` | 拒否を例外にすると同じトランザクションの監査ログも消えるため(R-07)。拒否は監査ログに記録してからエラー結果を返す |
| 利用量テーブル | `private.ai_usage` | `private.usage_counters(counter, subject_id, period_start)` | 1 分・日・月・エクスポートを 1 つの表で扱うため。区切りは Asia/Tokyo |
| 同意文書 | 版とハッシュ | 版・題名・本文・ハッシュ(本文とハッシュの一致をトリガーで強制、書き換え禁止) | 同意した文面を後から確認できるようにするため |
| `admin_check()` | なし | 追加 | `admin-invite-user` が service role を使う前に、呼出者の JWT で管理者(aal2)かを確認するため |
| 監査ログの metadata | 「値を入れない」 | 許可キー(op, columns, scope, reason など)以外は `audit.log` が拒否。文字列は 64 文字まで | 健康データ・氏名が入り込むのを機械的に防ぐため |
| 変更監査 | AFTER トリガー | profiles / user_roles / staff_assignments / staff_access_consents / user_agreements に設定。変わった列名だけ記録 | |
| 管理者による自分のロール変更 | 規定なし | 禁止(`admin_set_role` で自分を対象にできない) | 管理者が自分をスタッフにして担当になる抜け道を防ぐ(DECISIONS §3-9) |
| `profiles.timezone` | 既定 Asia/Tokyo | Asia/Tokyo のみ許可 | Phase 1 は国内のみ。将来の拡張時に制約を外す |
| API の既定公開 | — | `auto_expose_new_tables = false`、関数・表の既定権限を取り消し、明示的に GRANT したものだけ公開 | 付け忘れで公開されることを防ぐ |

## 10. Sprint 2 実装での設計からの差分・補足

| 項目 | 内容 |
|---|---|
| 食事のテーブル | `meals`・`meal_items`・`meal_slot_status`・`meal_analyses` は**誰にもテーブル権限を与えない**(本人も含めて RPC 経由のみ)。RLS は有効でポリシーなし |
| 食品マスター | `supabase/seeds/foods.sql`(2,538 食品)と別名辞書 61 件(`supabase/seed-data/food-aliases.json`、開発用)を `scripts/sfct/build-foods-seed.ts` が生成。値の解釈は `packages/nutrition` の `parseSfctValue`。CI で生成物が最新か確かめる。**本番への取込は別途承認** |
| 計算 | SQL(`private.consumed_g`・`private.nutrient_amount`)は `packages/nutrition` と同じ四捨五入。無作為の 300 件で一致を結合テストで確認 |
| 明細の名前 | `meal_items.label`(確定は成分表のやさしい名前、要確認は AI のラベル)を追加 |
| 画像 | Storage `meal-images`(非公開、5 MB、JPEG/WebP)。アップロード:本人または `meals:write` のスタッフ(パス形式を検査)。読み出し:本人、または自分がアップロードした画像で `meals:write` が有効なスタッフ(解析のため)。削除:本人のみ。上書き不可。閲覧画面は `meal-image` 関数(本人のみ・監査あり) |
| 期限 | `meals.image_expires_at` = 保存から 30 日(D-09)。期限後は閲覧不可。**自動削除の処理は未実装** |
| 代理入力の閲覧 | `meals:write` だけのスタッフは、自分が入力した記録だけ見える(D-07 ①)。日別の集計は `meals:read` が必要 |
