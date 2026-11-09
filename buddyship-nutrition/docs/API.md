# API — API 仕様

- 文書状態: **ドラフト(承認待ち)**
- 経路は3種類:
  1. **PostgREST(テーブル)** — 本人データの読み取り・削除。RLS で制御。
  2. **PostgREST RPC(`/rest/v1/rpc/<name>`)** — 計算・判定・監査が必要な書き込みとスタッフ/管理者操作。
  3. **Edge Functions(`/functions/v1/<name>`)** — 外部AI呼び出し、エクスポート、Auth Admin API が必要な処理。
- すべて `Authorization: Bearer <利用者JWT>` 必須(`apikey` は anon key)。匿名アクセスは不可。
- 入出力スキーマは `packages/shared` の Zod で定義し、クライアント・Edge Function・テストで共有する。

## 1. 共通

### エラー形式(Edge Functions)

```json
{ "error": { "code": "quota_exceeded", "message": "本日のAI解析の上限に達しました", "request_id": "..." } }
```

| HTTP | code | 意味 |
|---|---|---|
| 400 | `invalid_request` | スキーマ不一致 |
| 401 | `unauthenticated` | JWT なし・無効 |
| 403 | `forbidden` | 権限・同意なし |
| 413 | `payload_too_large` | 画像サイズ超過 |
| 415 | `unsupported_media_type` | 画像形式不正 |
| 422 | `image_rejected` | 画像内容の検証失敗(食事でない等の判定は [未決 D-14])|
| 429 | `rate_limited` / `quota_exceeded` | 分単位制限 / 日次・月次上限 |
| 502 | `ai_unavailable` | AI 側の失敗(手入力へ誘導)|
| 500 | `internal` | その他(詳細はログのみ)|

`message` に内部情報(SQL・スタック・他人の存在有無)を含めない。スタッフ RPC で「担当外」と「同意なし」は同じ `forbidden` を返す(存在の推測を防ぐ)。

## 2. Edge Functions

### POST `/functions/v1/analyze-meal`

食事画像をAIで解析し、食品成分マスターの候補付きで返す。**保存はしない。**

Request
```json
{ "image_path": "<uid>/2026/7b1c....webp" }
```

処理
1. JWT 検証(`supabase.auth.getUser(jwt)`)→ `user_id`。
2. `image_path` の先頭が `user_id` であることを確認(Storage RLS でも二重に拒否)。
3. `consume_ai_quota()` RPC(分・日・月の上限を原子的に加算)。超過で 429。
4. 利用者JWTのクライアントで画像をダウンロード。
5. 検証:サイズ ≤ 5MB、マジックバイトが JPEG/WebP、寸法 ≤ 2048px、デコード可能。
6. AI 呼び出し(タイムアウト 30 秒、再試行 1 回)。出力形式はスキーマ強制(構造化出力)。
7. Zod 検証。不正なら 502 として記録。
8. `match_foods(labels[])` RPC で候補を取得。
9. `meal_analyses` に結果を記録(食品名ラベルと重量のみ)。

Response 200
```json
{
  "analysis_id": "uuid",
  "is_estimate": true,
  "items": [
    {
      "ai_label": "ごはん",
      "ai_grams": 150,
      "confidence": "high",
      "candidates": [
        { "food_id": "uuid", "name": "こめ［水稲めし］精白米 うるち米",
          "per100": { "energy_kcal": 156, "protein_g": 2.5, "fat_g": 0.3, "carbohydrate_g": 37.1 },
          "source_version": "..." }
      ]
    }
  ]
}
```
※ 数値例は説明用の仮値であり、成分表の値ではない。

AI 出力スキーマ(Zod、プロバイダ非依存)
```ts
const AiMealItem = z.object({
  label: z.string().min(1).max(100),          // 食品名(日本語)
  grams: z.number().positive().max(2000),     // 推定重量
  confidence: z.enum(['low', 'medium', 'high']),
  kind: z.enum(['dish', 'ingredient']),
}).strict();
const AiMealResult = z.object({
  is_food_image: z.boolean(),
  items: z.array(AiMealItem).max(20),
}).strict();
```
栄養値フィールドはスキーマに存在しない(`.strict()` で余分なキーは拒否 → 再試行/失敗扱い)。

### POST `/functions/v1/export-my-data`

本人データを JSON で返す(利用者JWTのクライアントで RLS 下に取得)。Response:`application/json` 添付(`Content-Disposition: attachment`)。1日あたり回数上限(仮:5回)。

### POST `/functions/v1/delete-account`

Request `{ "confirm": "削除" }`。直近の再認証(JWT の `iat` が 5 分以内、仮)を要求。
処理:Storage の本人フォルダ削除 → 監査ログの仮名化 → `auth.admin.deleteUser`(Service Role、この関数内のみ)→ cascade 削除。

### POST `/functions/v1/admin-invite-staff`

管理者のみ(DB で `authz.has_role('admin')` かつ aal2 を確認)。Request `{ "email": "...", "display_name": "..." }`。Auth の招待を送り、`profiles`・`user_roles(staff)` を作成。

### `purge-expired-images`(定期実行、外部公開しない)

pg_cron から起動。呼び出し元の検証方法は **[Sprint 2 で確定]**(専用シークレットヘッダ、JWT 検証オフにしない)。

## 3. RPC(PostgREST)

### 利用者

| 関数 | 引数 | 戻り値 | 備考 |
|---|---|---|---|
| `register_member(display_name, agreements uuid[])` | | profile | 招待コード方式等は [未決 D-04] |
| `accept_documents(document_ids uuid[])` | | void | |
| `match_foods(labels text[], limit int)` | | 候補配列 | pg_trgm 類似度+別名辞書 |
| `search_foods(q text, limit int)` | | foods[] | 手入力用 |
| `save_meal(payload)` | 下記 | meal | 栄養値はサーバーで計算 |
| `update_meal(meal_id, payload)` | | meal | 本人のみ。全明細を置換して再計算 |
| `insert_body_composition(payload)` | | id | entry_source='self' 固定 |
| `grant_staff_consent(staff_id, scope, document_id)` | | id | 有効な担当割当がある staff のみ |
| `revoke_staff_consent(staff_id, scope)` | | void | 即時 |
| `get_daily_totals(from date, to date)` | | 日別合計 | 利用者のタイムゾーンで日付を区切る |

`save_meal` payload
```json
{
  "meal_type": "lunch",
  "eaten_at": "2026-11-09T12:30:00+09:00",
  "analysis_id": "uuid | null",
  "image_path": "string | null",
  "items": [ { "food_id": "uuid", "grams": 150, "origin": "ai_corrected", "ai_label": "ごはん", "ai_grams": 180 } ]
}
```
- 栄養値をリクエストに含めても無視(スキーマ上存在しない)。
- 制約:items 1〜30件、grams 0 超 2000 以下、eaten_at は過去 1 年〜未来 1 日以内(仮)。

### スタッフ

[DATABASE.md §4.3](./DATABASE.md) の `staff_*` 関数。

### 管理者

| 関数 | 内容 |
|---|---|
| `admin_set_role(user_id, role, active)` | ロール付与・剥奪 |
| `admin_assign_staff(staff_id, member_id)` / `admin_end_assignment(id)` | 担当割当 |
| `admin_list_audit_logs(filters)` | 監査ログ閲覧(閲覧自体も記録)|
| `admin_get_usage(month)` / `admin_set_limits(...)` | 利用量・上限 |

すべて `authz.has_role('admin') and authz.is_aal2()` を関数冒頭で確認。

## 4. テーブル直接アクセス(本人のみ)

| 操作 | エンドポイント例 |
|---|---|
| 食事一覧 | `GET /rest/v1/meals?select=*,meal_items(*)&eaten_at=gte.<from>&order=eaten_at.desc` |
| 食事削除 | `DELETE /rest/v1/meals?id=eq.<id>` |
| InBody 一覧 | `GET /rest/v1/body_compositions?order=measured_at.desc` |
| InBody 更新・削除 | `PATCH` / `DELETE /rest/v1/body_compositions?id=eq.<id>` |
| 同意一覧 | `GET /rest/v1/staff_access_consents` |

## 5. AI プロバイダ アダプタ

`supabase/functions/_shared/ai/` にプロバイダ別アダプタを置き、`analyzeMealImage(image: Uint8Array, mime): Promise<AiMealResult>` の共通インターフェースで切り替える。プロバイダ・モデルは **[未決 D-01]**。

アダプタ共通要件:
- 構造化出力(JSON スキーマ強制)機能を使い、さらに Zod で再検証。
- 拒否・安全フィルタによる応答停止・トークン上限での打ち切りを判別し、`ai_unavailable` として扱う。
- 指示文は固定。画像内の文字(メニュー表記など)を「指示」として扱わないよう明記し、出力はスキーマ以外受け付けない(プロンプトインジェクション対策)。
- 送信データ・保存期間・学習利用の有無をプロバイダの契約条件で確認([SECURITY.md §6](./SECURITY.md))。
