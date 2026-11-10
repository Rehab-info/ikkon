# API — API 仕様

- 文書版: **v2.0 ドラフト(承認待ち)**
- 経路:
  1. **PostgREST テーブル** — 本人の参照・削除のみ(RLS)。
  2. **PostgREST RPC**(`/rest/v1/rpc/<name>`)— 書き込み全般、スタッフ・管理者の操作、集計。
  3. **Edge Functions**(`/functions/v1/<name>`)— AI 呼び出し、エクスポート、Auth Admin API が必要な処理。
- すべて `Authorization: Bearer <JWT>` 必須。匿名アクセスは不可。
- RPC の返り値は `{"ok": true, "data": ...}` または `{"ok": false, "error": "<code>"}`(Sprint 1 実装。DATABASE §9)。クライアントは `parseRpcResult`(`packages/shared/src/rpc.ts`)で検証する。
- 入出力スキーマは `packages/shared` の Zod で定義し、クライアント・Edge Function・テストで共有。DB 側でも CHECK 制約と RPC 内検証で二重に守る。

## 1. 共通

### エラー形式

```json
{ "error": { "code": "quota_exceeded", "message": "今日の写真の解析回数の上限に達しました。手で記録できます。", "request_id": "..." } }
```

| HTTP | code | 意味 |
|---|---|---|
| 400 | `invalid_request` | スキーマ不一致 |
| 401 | `unauthenticated` | JWT なし・無効・期限切れ |
| 403 | `forbidden` | 権限・同意・担当割当なし(**どれが欠けたかは返さない**) |
| 409 | `conflict` | 記録状況の矛盾(例:記録ありの区分を「食べなかった」に) |
| 413 / 415 | `payload_too_large` / `unsupported_media_type` | 画像 |
| 422 | `image_rejected` | 画像の検証失敗、食事が写っていない |
| 429 | `rate_limited` / `quota_exceeded` | 短時間の連続 / 日次・月次上限 |
| 502 | `ai_unavailable` | AI の失敗(手入力へ誘導) |
| 503 | `ai_disabled` | 管理者が AI を停止中 |
| 500 | `internal` | その他(詳細はログのみ) |

RPC のエラーは PostgreSQL のエラーコードを上記 `code` に対応付ける表を `packages/shared` に置く。

## 2. Edge Functions

### POST `/functions/v1/analyze-meal`

写真から食品と**提供量**を推定し、マスター候補を返す。**保存はしない。**

Request
```json
{ "member_id": "uuid", "image_path": "<member_id>/2026/7b1c....webp" }
```

処理
1. JWT 検証 → 呼出者 ID。
2. `image_path` の先頭が `member_id` であること。
3. `authorize_meal_write(member_id)` RPC(本人 or 担当+`meals:write`)。拒否は 403。
4. `consume_ai_quota(member_id)` RPC:呼出者の分単位・本人の日次・スタッフの日次・組織の月次を原子的に加算。超過は 429、停止中は 503。
5. 呼出者の JWT で画像をダウンロード → サイズ ≤ 5MB、マジックバイト(JPEG/WebP)、寸法 ≤ 2048px を検証。
6. AI 呼び出し(タイムアウト 30 秒、再試行 1 回)。構造化出力を強制。
7. Zod 検証(下記)。
8. `match_foods(labels)` RPC で候補(最大 5 件)と目安単位を取得。
9. `record_meal_analysis(...)` RPC で結果(食品名ラベルと提供量のみ)を保存。

Response 200
```json
{
  "analysis_id": "uuid",
  "is_estimate": true,
  "is_food_image": true,
  "items": [
    {
      "ai_label": "ごはん",
      "ai_estimated_served_g": 150,
      "confidence": "high",
      "candidates": [
        { "food_id": "uuid", "display_name": "ごはん(白米)",
          "per100": { "energy_kcal": 0, "protein_g": 0, "fat_g": 0, "carbohydrate_g": 0 },
          "portions": [ { "label": "お茶わん 1 杯", "grams": 150 } ],
          "source_version": "..." }
      ]
    }
  ]
}
```
(数値は形式説明用のダミー)

AI 出力スキーマ(プロバイダ共通)
```ts
const AiComponent = z.object({
  label: z.string().min(1).max(100),           // 食材名(成分表の食品コードとの照合はサーバーが行う)
  served_g: z.number().positive().max(2000),   // 皿に盛られた提供量。食べた量ではない
  role: z.enum(['ingredient', 'cooking_oil', 'seasoning']),
  confidence: z.enum(['low', 'medium', 'high']),
}).strict();
const AiMealItem = z.discriminatedUnion('kind', [
  // 単品の食品(ごはん・バナナ など)
  z.object({
    kind: z.literal('food'),
    label: z.string().min(1).max(100),
    served_g: z.number().positive().max(2000),
    confidence: z.enum(['low', 'medium', 'high']),
  }).strict(),
  // 複合料理(D-19):独自の料理マスターは使わず、構成食材・調理油・調味料の候補を出す
  z.object({
    kind: z.literal('dish'),
    label: z.string().min(1).max(100),           // 料理名(表示用)
    composition_known: z.boolean(),              // 構成を推定できたか。false なら表示をおおよそにする
    components: z.array(AiComponent).max(15),
  }).strict(),
]);
const AiMealResult = z.object({
  is_food_image: z.boolean(),
  items: z.array(AiMealItem).max(20),
}).strict();
```
- サーバーは各食品・構成食材を成分表と照合する。**AI が生成した食品候補は自動的に確定しない(Sprint 3)**:応答の明細はすべて `match_status: "needs_review"` で、利用者・スタッフが画面で確かめたときだけ確定する(D-19)。
- 応答の各明細に `match_status`(常に `needs_review`)、`suggestion_strength`(`suggested`/`ambiguous`/`none`)、`suggested`(先頭に示す「AI の候補」。1 つだけ完全一致し、確からしさが低くないときだけ。確定ではない)、`candidates` を付ける。決め方は `packages/nutrition` の `suggestionOf`。
- 栄養値のキーはスキーマにない(`.strict()` で拒否)。
- 「食べ残し」の推定は AI に求めない。食べた割合は利用者/スタッフが入力する(写真が食後の場合の扱いは **[未決 D-27]**)。

### POST `/functions/v1/export-my-data`
本人のみ。本人 JWT で RLS 下に取得し JSON を返す。1 日 5 回まで(仮)。CSV は D-16。

### POST `/functions/v1/delete-account`
本人のみ。`{ "confirm": "削除します" }`、直近 5 分以内の再認証(仮)。Storage の本人フォルダ削除 → 監査ログの仮名化 → `auth.admin.deleteUser`(この関数内でのみ service role)。

### POST `/functions/v1/admin-invite-user`
管理者(aal2)のみ。`{ "email": "...", "display_name": "...", "role": "member" | "staff", "facility_id": "uuid" }`。ログイン方式(D-04)に合わせて招待を送り、`profiles`・`user_roles` を作成。

### GET `/functions/v1/meal-image?meal_id=...`(Sprint 2 で追加)
本人だけ(D-09)。呼出者の JWT で `authorize_meal_image` を呼び(許可・拒否を監査に残す)、Storage のポリシーの下で画像を取得してそのまま返す(`Cache-Control: no-store`)。署名付き URL は発行しない。スタッフ・他人は 403。

### Sprint 2 の実装メモ
- `analyze-meal` の AI は **開発用の仮解析(`AI_PROVIDER=mock`)だけ**。画像の中身は見ず、決まった家庭の食事(要確認になる例を含む)を返す。応答の `provider` が `mock` のとき、画面に「開発用の仮の解析です」と表示する。実際の AI は D-01 の決定と承認の後に追加する。
- 照合の結果(確定/要確認)は `packages/nutrition` の `initialMatchStatus` で決める。Edge Functions からは `scripts/sync-nutrition.mjs` で写したもの(`supabase/functions/_shared/nutrition`)を使い、CI で写しが最新か確かめる。
- 実装した RPC:`search_foods`・`match_foods`・`authorize_meal_write`・`record_meal_analysis`・`save_meal`・`update_meal`・`delete_meal`・`set_slot_status`・`get_meals`・`get_meal`・`get_daily_summary`・`authorize_meal_image`。`update_meal` は解析記録と画像をクライアントの値で付け替えない(保存済みの値を使う)。

### POST `/functions/v1/purge-expired-images`(Sprint 3 で実装)
定期実行用の内部処理。利用者の画面からは呼ばない。
- 認可:`x-purge-secret` ヘッダ(環境変数 `PURGE_JOB_SECRET`、32 文字以上、定数時間で比較)。利用者の JWT では実行できない(Edge Function の JWT 検証は有効のまま。呼び出しには anon キーなどの JWT も必要)。
- 処理:`claim_image_purge` で対象(30 日を過ぎた食事の画像、食事に保存されずに 24 時間たった画像)を最大 50 件ずつ取り出し → service role で Storage から削除 → `report_image_purge` で結果を記録(成功は食事の画像の参照を外し、監査 `meal_image.purge`)。失敗は 1・2・4・8 分後に再試行し、5 回で `failed`(監査に `error`)。1 回の実行で最大 1,000 件。
- 応答:`{ "data": { "enqueued", "claimed", "done", "retry", "failed" } }`(件数だけ。画像のパスは返さない・ログに出さない)。
- **定期実行の設定(pg_cron + pg_net、または外部のスケジューラ)は staging 構築時に行う(承認後。Sprint 4)**。それまでは手動または CI のテストでのみ動かす。

## 3. RPC

### 利用者・スタッフ共通(認可は関数内で判定、[DATABASE.md §4.3](./DATABASE.md))

| 関数 | 説明 |
|---|---|
| `search_foods(q, limit)` | 手入力用の食品検索(やさしい名前・別名) |
| `match_foods(labels[], limit)` | AI ラベル → 候補 |
| `save_meal(member_id, payload)` | 食事の保存。栄養値・登録日時・入力者はサーバーで決定 |
| `update_meal(meal_id, payload)` | 明細を置換して再計算 |
| `delete_meal(meal_id)` | 本人のみ(スタッフ代理入力の削除可否は D-07) |
| `set_slot_status(member_id, eaten_on, slot, status)` | `skipped` / `dayservice` の設定・解除 |
| `get_meals(member_id, from, to)` | |
| `get_daily_summary(member_id, from, to)` | 日別の記録状況・記録された食事の合計・完全日フラグ・完全日のみの平均と日数 |
| `insert_body_composition(member_id, payload)` / `update_body_composition(id, payload)` | |
| `get_body_compositions(member_id, from, to)` | |

`save_meal` payload(Zod)
```ts
const SaveMeal = z.object({
  slot: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  location: z.literal('home'),                       // Phase 1 は home のみ
  eaten_on: z.iso.date(),
  eaten_at: z.iso.datetime({ offset: true }).nullable(),
  eaten_at_precision: z.enum(['exact', 'approximate', 'slot_only']),
  info_source: z.enum(['photo', 'interview', 'manual']),
  analysis_id: z.uuid().nullable(),
  image_path: z.string().max(200).nullable(),
  items: z.array(z.object({
    food_id: z.uuid(),
    origin: z.enum(['ai', 'ai_corrected', 'manual']),
    ai_label: z.string().max(100).nullable(),
    ai_estimated_served_g: z.number().positive().max(2000).nullable(),
    served_g: z.number().positive().max(2000),
    intake_percent: z.int().min(0).max(100),   // 食べた割合。浮動小数の誤差を避けるため整数の % で受ける
  }).strict()).min(1).max(30),
}).strict();
```
- 栄養値・`recorded_at`・`entered_by`・`entry_source` は受け付けない(サーバーで決定)。
- `eaten_on` は利用者のタイムゾーンで「今日 + 0 日」以下、遡及は D-30 の期間内。
- `ai_estimated_served_g` は `analysis_id` の解析結果と照合し、改ざんを防ぐ(一致しなければ拒否)。
- 全明細の `intake_percent` が 0 の場合は、`skipped` の利用を案内する(保存は可とするか D-29)。

### 利用者のみ

| 関数 | 説明 |
|---|---|
| `accept_documents(document_ids[])` | 規約等への同意 |
| `grant_staff_consent(staff_id, scope, document_id)` | 有効な担当割当がある staff のみ |
| `revoke_staff_consent(staff_id, scope)` | 即時 |
| `list_my_staff()` | 担当スタッフと付与中のスコープ |
| `update_my_profile(display_name, font_scale)` | |

### 体組成(InBody。Sprint 3)

指示の `inbody.read` / `inbody.write` は、同意スコープ `body:read` / `body:write` に対応する(D-35)。

| 関数 | 誰が | 説明 |
|---|---|---|
| `save_body_composition(member_id, payload)` | 本人(member)、`body:write` の担当スタッフ(aal2) | 追加。`payload` = `measured_at`・`weight_kg`・`skeletal_muscle_kg`・`body_fat_kg`・`body_fat_pct`(JSON の数、小数 1 桁)・`device_model`・`condition`(`before_meal`/`after_meal`/`unknown`)。余分なキーは拒否。範囲外 `out_of_range`、骨格筋量 + 体脂肪量 ≥ 体重 `inconsistent`、未来・1 年より前の測定日時 `invalid_request`。応答 `{ id, warnings }`(`fat_pct_mismatch`:体脂肪量 ÷ 体重 × 100 と体脂肪率の差が 1.5 ポイント超。保存は行う) |
| `update_body_composition(id, payload)` | 本人は全件、スタッフは `body:write` かつ自分の代理入力かつ 7 日以内 | 修正。変更前後の値は履歴に残る |
| `delete_body_composition(id)` | 本人のみ | 削除。削除前の値は履歴に残る(本人だけが見られる) |
| `get_body_compositions(member_id, from, to)` | 本人、`body:read` のスタッフ(全件)、`body:write` だけのスタッフ(自分の入力だけ) | 期間(最大 400 日)の記録。入力者は表示名だけ(ID は返さない)。スタッフの閲覧は監査 |
| `get_body_composition_history(id)` | 記録が見える人。削除済みの記録は本人だけ | 変更の履歴(記録・修正・削除と値のスナップショット) |

### スタッフのみ

| 関数 | 説明 |
|---|---|
| `staff_dashboard()` | 担当利用者の一覧。`meals`:`meals:read` があれば `{ last_meal_on, last_7_days: [{date, breakfast, lunch, dinner}] }`、なければ `null`(同意なし。データを取得しない)。`body`:`body:read` があれば `{ last_measured_at }`、なければ `null`。日付が `null` なら未記録。体重などの値は返さない(D-15) |

### 定期処理(service_role のみ。Edge Function `purge-expired-images` から)

| 関数 | 説明 |
|---|---|
| `claim_image_purge(limit)` | 削除の対象を積み、処理する分を取り出す(次の試行時刻を先に進める)。条件を満たさなくなったもの(食事から参照された等)は取り消す。90 日を過ぎた解析記録の削除も行う |
| `report_image_purge(results)` | `[{name, ok, error?}]` を記録。成功は食事の画像の参照を外し監査、失敗は再試行または `failed` |

### 管理者のみ(admin かつ aal2)

| 関数 | 説明 |
|---|---|
| `admin_check()` | 管理者(aal2)かの確認。`admin-invite-user` が service role を使う前に呼ぶ |
| `admin_register_profile(user_id, display_name, role, facility_id)` | Auth に招待済みのユーザーにプロフィールとロールを付ける(role は member / staff のみ) |
| `admin_set_role(user_id, role, active)` | 自分自身は変更不可。スタッフ停止時は担当割当を終了し同意を撤回 |
| `admin_assign_staff(staff_id, member_id)` / `admin_end_assignment(id)` | 割当解除時に該当同意を自動撤回(D-07 決定後) |
| `admin_list_users(filters)` | 表示名・ロール・所属のみ |
| `admin_list_audit_logs(filters)` | 閲覧自体も記録 |
| `admin_get_usage(month)` / `admin_set_limits(...)` / `admin_set_ai_enabled(bool)` | |
| `admin_emergency_suspend_staff(staff_id)` | ロール停止+全割当終了(インシデント用) |

健康データを返す管理者 RPC は作らない。

## 4. テーブル直接アクセス(本人のみ)

| 操作 | 例 |
|---|---|
| 同意の履歴 | `GET /rest/v1/staff_access_consents?order=granted_at.desc` |
| 規約の版 | `GET /rest/v1/consent_documents` |
| 自分の食事の削除 | `DELETE /rest/v1/meals?id=eq.<id>`(本人のみ) |

食事・InBody の参照は、スタッフと同じ形にそろえるため RPC(`get_*`)を使う。

## 5. AI アダプタ

`supabase/functions/_shared/ai/` に共通インターフェース `analyzeMealImage(image, mime): Promise<AiMealResult>` を置き、プロバイダ別に実装(D-01)。

- 構造化出力(JSON スキーマ強制)を使い、Zod で再検証。
- 拒否・安全フィルタによる停止・出力上限での打ち切りを判別して `ai_unavailable` にする。
- 指示文は固定。画像内の文字を指示として扱わないよう明記(プロンプトインジェクション対策)。出力は候補表示にしか使わない。
- モデル ID は設定値で固定し、変更は記録する。
- テストではモックアダプタを使う。**実 API の呼び出しは精度検証のみで、件数・費用の上限について事前承認を得る。**
