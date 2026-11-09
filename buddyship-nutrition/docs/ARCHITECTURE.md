# ARCHITECTURE — システム構成

- 文書状態: **ドラフト(承認待ち)**

## 1. 全体図

```
┌──────────── 利用者端末(iPhone / Android / PC) ────────────┐
│ PWA (React + TypeScript + Vite)                              │
│  - 画像の縮小・再エンコード(EXIF/GPS除去)                  │
│  - supabase-js(anon key + 利用者JWT のみ)                  │
│  - Service Worker:アプリ殻のみキャッシュ、APIはキャッシュしない│
└───────────────┬──────────────────────────────────────────────┘
                │ HTTPS(利用者JWT)
┌───────────────▼──────────── Supabase(東京リージョン 仮)────┐
│ Auth ── JWT発行、MFA(TOTP)                                  │
│ PostgREST ── テーブル/RPC(すべて RLS 有効)                  │
│ Storage ── private bucket `meal-images`(Storage RLS)        │
│ Edge Functions(Deno)                                         │
│   analyze-meal   … 利用者JWTで画像取得 → 検証 → AI → 照合     │
│   export-my-data … 利用者JWTで自分のデータを収集              │
│   delete-account … 本人確認後、限定的に service role 使用     │
│   admin-invite-staff … 管理者のみ、service role(Auth Admin) │
│   purge-expired-images … 定期実行、service role(Storage削除)│
│ PostgreSQL                                                     │
│   - RLS + SECURITY DEFINER の認可関数(authz スキーマ)        │
│   - 監査ログ(追記専用)                                       │
│   - 利用量カウンタ(レート制限・上限)                         │
│   - pg_cron(画像の期限切れ削除の起動)                       │
└───────────────┬───────────────────────────────────────────────┘
                │ HTTPS(AIプロバイダのAPIキー:Edge Function の Secrets のみ)
        ┌───────▼────────┐
        │ 画像解析AI API  │  ※ プロバイダは [未決 D-01]
        └────────────────┘
```

静的ホスティング(PWA配信):**[未決 D-03]**。CSP などのレスポンスヘッダを設定できるホスティングが必要なため、ヘッダを設定できない **GitHub Pages は候補から外すことを推奨**。

## 2. 技術スタックと版

`npm view` で 2026-11-09 時点の最新安定版と peerDependencies を確認した結果。**Sprint 1 開始時に再確認し、`package-lock.json` で固定、`package.json` も `^` なしの完全一致指定にする。**

| 用途 | パッケージ | 候補版 | 互換性メモ |
|---|---|---|---|
| UI | react / react-dom | 19.3.1 | |
| ビルド | vite | 8.3.7 | |
| | @vitejs/plugin-react | 6.3.0 | peer: vite ^8 |
| 型 | typescript | **6.0.3** | 最新は 7.0.2 だが typescript-eslint 8.72.2 の peer が `>=4.8.4 <6.1.0` のため 6.0 系を採用(案)|
| Lint | eslint / typescript-eslint | 10.14.0 / 8.72.2 | |
| CSS | tailwindcss / @tailwindcss/vite | 4.3.5 | |
| UI部品 | shadcn (CLI) | 4.23.0 | 生成コードをリポジトリに取り込む方式。生成物はレビュー対象 |
| ルーティング | react-router | 8.5.1 | ※ 要件外の追加。採否は Sprint 1 で確認 |
| サーバ状態 | @tanstack/react-query | 5.107.1 | ※ 要件外の追加。採否は Sprint 1 で確認 |
| フォーム | react-hook-form / @hookform/resolvers | 7.91.0 / 7.0.5 | ※ zod 4 対応を Sprint 1 で検証 |
| 検証 | zod | 4.6.7 | クライアント・Edge Function で同じスキーマを共有 |
| グラフ | recharts | 3.10.1 | peer: react ^19 可 |
| Supabase | @supabase/supabase-js | 2.119.0 | |
| | supabase (CLI) | 3.1.0 | ローカルは Docker で起動 |
| PWA | vite-plugin-pwa | 2.0.0 | peer: vite ^8 可 |
| テスト | vitest | 5.1.0 | peer: vite ^8 可 |
| | @playwright/test | 1.65.0 | |
| DBテスト | pgTAP(Supabase CLI `supabase test db`) | CLI同梱 | |
| ランタイム | Node.js | 22 LTS(22.23.x) | `.nvmrc` / `engines` で固定 |
| Edge | Deno(Supabase Edge Runtime) | CLI同梱版 | `deno.lock` で依存固定 |

AI SDK はプロバイダ決定後に追加する([未決 D-01])。

## 3. ディレクトリ構成(案)

このリポジトリは一献(静的サイト)と Sub-Cut が同居しているため、`buddyship-nutrition/` 配下に閉じる。**別リポジトリへの分離を推奨** **[未決 D-00]**。

```
buddyship-nutrition/
  docs/                     設計文書(本書ほか)
  app/                      PWA(Vite プロジェクト)
    src/
      features/{auth,meals,body,dashboard,consent,admin,staff}/
      lib/supabase.ts       クライアント生成(anon key のみ)
      lib/image.ts          縮小・再エンコード
      components/ui/        shadcn 生成物
    public/                 manifest・アイコン
    tests/e2e/              Playwright
  packages/shared/          Zod スキーマ・栄養計算(純粋関数)・型
  supabase/
    config.toml
    migrations/             SQL マイグレーション(連番)
    functions/
      analyze-meal/ export-my-data/ delete-account/
      admin-invite-staff/ purge-expired-images/
      _shared/              認証ヘルパ・ロガー(PII マスク)・AI アダプタ
    tests/                  pgTAP(RLS・権限)
    seed.sql                合成データのみ
  .env.example
```

栄養計算は `packages/shared` の純粋関数として実装し、クライアント(修正時の即時表示)と Edge Function / DB(保存時の正)で同じ規則を使う。**保存値の正はサーバー側**(DB関数で再計算して保存)。

## 4. 主要フロー

### 4.1 食事AI解析

```
PWA                         Storage            analyze-meal (Edge)            DB              AI
 │ 縮小・再エンコード          │                    │                           │               │
 │── upload (JWT) ──────────▶│ RLS: path先頭=uid    │                           │               │
 │── POST analyze-meal {draft_id, path} (JWT) ────▶│                           │               │
 │                            │                    │ getUser(JWT)で本人確認       │               │
 │                            │                    │── rpc consume_ai_quota ──▶│ 上限チェック  │
 │                            │◀─ download (JWT) ──│ 利用者権限で取得(RLS)      │               │
 │                            │                    │ マジックバイト/サイズ/寸法検証 │               │
 │                            │                    │── 画像+指示 ───────────────────────────────▶│
 │                            │                    │◀─ 構造化JSON(食品名・g) ───────────────────│
 │                            │                    │ Zod検証・栄養値の破棄           │               │
 │                            │                    │── rpc match_foods (JWT) ──▶│ 成分マスター照合 │
 │◀── 候補(食品ID・g・成分/100g・推定ラベル) ───────│                           │               │
 │ 利用者が修正(クライアントで即時再計算)          │                           │               │
 │── rpc save_meal (JWT) ───────────────────────────────────────────────────────▶│ 再計算して保存 │
```

- Edge Function は **利用者のJWTを付けた Supabase クライアント** で Storage・DB にアクセスする。Service Role は使わない。
- AI解析結果(下書き)は DB の `meal_analyses` に保存し、`save_meal` は analysis_id を参照できる(精度評価用)。
- AIに送るのは画像と固定の指示文のみ。氏名・ID 等は送らない。

### 4.2 スタッフの閲覧・代理入力

スタッフは `staff_*` RPC(SECURITY DEFINER)経由でのみ利用者データにアクセスする。関数内で `authz.staff_can(member_id, scope)` を評価し、同じトランザクションで監査ログを書き込む。テーブルへの直接 SELECT ではスタッフに行が返らない(RLS)。詳細は [DATABASE.md §4](./DATABASE.md)。

### 4.3 Service Role の使用箇所(限定列挙)

| 関数 | 理由 | 対象 |
|---|---|---|
| delete-account | `auth.admin.deleteUser` に必要 | 本人のみ(JWT で本人確認後) |
| admin-invite-staff | Auth の招待 API に必要 | 管理者のみ(DB で admin 判定後) |
| purge-expired-images | 期限切れ画像の一括削除 | 保持期限を過ぎた Storage オブジェクトのみ |

これ以外のコードで Service Role キーを読むことを禁止し、CI で `SUPABASE_SERVICE_ROLE_KEY` の参照箇所を検査する。

## 5. 環境

| 環境 | 用途 | データ |
|---|---|---|
| local | 開発(Supabase CLI + Docker) | `seed.sql` の合成データ |
| CI | GitHub Actions 上でローカルSupabaseを起動しテスト | 合成データ |
| staging | 試験前の確認 **[未決 D-02]** | 合成データ |
| production | 限定試験 | 実データ(**承認後に構築**) |

## 6. 観測性

- Edge Function のログは構造化JSON:`request_id`、関数名、結果コード、所要時間、AI トークン数。**ユーザーID はハッシュ化**、画像・食品名・身体値・AI応答本文は出力しない。
- エラー追跡サービス(Sentry 等)の採否は **[未決 D-17]**。導入する場合も PII 送信を無効化。

## 7. 技術的リスク

[DECISIONS.md §2](./DECISIONS.md) にまとめる。
