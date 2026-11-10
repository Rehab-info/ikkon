# Buddyship AI Nutrition(Phase 1)

リハビリ特化型デイサービスの利用者が、自宅で食べた食事と InBody の測定を記録し、本人と同意済みの担当スタッフが経過を確認する PWA。
設計は [docs/](./docs/)(PRD・構成・画面・DB・API・セキュリティ・タスク・テスト計画・未決事項)、進捗は [docs/reports/](./docs/reports/)。

> **注意**:このフォルダは一献のリポジトリに仮置きしています(DECISIONS D-00:非公開の別リポジトリへ移す予定)。
> 一献の GitHub Pages はリポジトリ全体を公開するため、**このフォルダを `main` に取り込まないでください。**

## 構成

```
app/               PWA(React + TypeScript + Vite + Tailwind CSS + shadcn/ui 形式の部品)
packages/shared/   Zod スキーマ・エラーコード・同意スコープの表示(画面と共通)
supabase/
  migrations/      DB マイグレーション(RLS・認可関数・RPC・監査ログ)
  tests/           pgTAP(RLS・権限・カタログ検査・利用量上限)
  functions/       Edge Functions(Deno)
  seed.sql         合成データ(組織・拠点・同意文書のドラフト)
tests/integration/ 本物の JWT・MFA・RPC・Edge Function を通す結合テスト
scripts/           秘密情報の検査、開発用アカウントの作成
```

## 手元で動かす

必要なもの:Node.js 22、Docker、psql(PostgreSQL クライアント)

```sh
npm ci
cp supabase/.env.example supabase/.env      # Edge Functions 用(値はローカル専用)
npx supabase start                          # ローカルの Supabase(Docker)
npm run seed:dev-users                      # 架空の管理者・スタッフ・利用者(パスワード Dev-only-12345)
cp app/.env.example app/.env.local          # VITE_SUPABASE_ANON_KEY を `npx supabase status` の ANON_KEY に
npm run dev -w app                          # http://127.0.0.1:5173
```

スタッフ・管理者は初回ログイン時に認証アプリ(TOTP)の登録が必要です。招待メールはローカルでは Mailpit(http://127.0.0.1:54324)に届きます。

## テスト

| コマンド                                                      | 内容                                                  |
| ------------------------------------------------------------- | ----------------------------------------------------- |
| `npm run lint` / `npm run typecheck` / `npm run format:check` | 静的検査(TypeScript strict)                           |
| `npm test`                                                    | 単体テスト(Vitest)                                    |
| `npm run test:functions` / `npm run lint:functions`           | Edge Functions(Deno)                                  |
| `npm run test:db`                                             | pgTAP(RLS・権限・監査・上限)                          |
| `npm run test:integration`                                    | 結合テスト(ローカルの Supabase が必要)                |
| `npm run test:e2e`                                            | E2E(Playwright。ローカルの Supabase が必要)           |
| `npm run check:secrets`                                       | ビルド成果物の秘密情報・service role の使用箇所の検査 |

CI は `.github/workflows/buddyship-ci.yml`(このフォルダの変更時だけ動く)。テストはすべてローカルの Supabase と合成データで動き、ローカル以外には接続しません。

## 守ること(抜粋)

- 秘密情報(service role キー・AI のキー)をコミットしない。フロントエンドに渡すのは `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` だけ
- 実利用者のデータ・写真を開発やテストに使わない
- DB の変更は必ずマイグレーションで。新しい表は RLS を有効にし、`supabase/tests/01_catalog_test.sql` が通ること
- 管理者に健康データを見せる経路を作らない
