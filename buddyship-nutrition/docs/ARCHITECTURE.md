# ARCHITECTURE — システム構成

- 文書版: **v2.0 ドラフト(承認待ち)**

## 1. 全体図

```
┌──── 利用者端末(スマホ・タブレット) / スタッフ端末(事業所のタブレット・PC) ────┐
│ PWA (React + TypeScript + Vite + Tailwind + shadcn/ui)                         │
│  - 画像の縮小・再エンコード(EXIF/GPS 除去)                                  │
│  - supabase-js(公開前提の anon key + ログイン中の JWT のみ)                  │
│  - Service Worker:アプリ殻のみキャッシュ。API・画像はキャッシュしない          │
└──────────────────────┬────────────────────────────────────────────────────────┘
                       │ HTTPS(JWT)
┌──────────────────────▼──────────── Supabase(国内リージョン 仮)──────────────┐
│ Auth        JWT 発行、MFA(TOTP)、セッション                                  │
│ PostgREST   テーブル/RPC(全テーブル RLS 有効)                                │
│ Storage     private bucket `meal-images`(Storage RLS)                        │
│ Edge Functions(Deno)                                                          │
│   analyze-meal         呼出者の JWT で画像取得 → 検証 → AI → マスター照合     │
│   export-my-data       本人 JWT で RLS 下に収集                                │
│   delete-account       本人確認後、この関数内のみ service role                 │
│   admin-invite-user    管理者確認後、この関数内のみ service role(Auth 招待)  │
│   purge-expired-images 定期実行、この関数内のみ service role(期限切れ削除)   │
│ PostgreSQL                                                                      │
│   authz(非公開): 認可判定関数   audit(非公開): 監査ログ                       │
│   private(非公開): 利用量・設定   pg_cron: 定期処理の起動                      │
└──────────────────────┬────────────────────────────────────────────────────────┘
                       │ HTTPS(AI の API キー:Edge Function Secrets のみ)
               ┌───────▼────────┐
               │ 画像解析 AI API │  プロバイダ・モデルは [未決 D-01]
               └────────────────┘
```

PWA の配信先は **[未決 D-03]**。CSP 等のレスポンスヘッダを設定できる必要があるため、GitHub Pages は不適。

## 2. 技術スタックと版

2026-11-09 に `npm view` で最新安定版と peerDependencies を確認した結果。**Sprint 1 開始時に再確認し、`package.json` は完全一致指定、`package-lock.json` をコミットして固定する。**

| 用途 | パッケージ | 候補版 | 互換性メモ |
|---|---|---|---|
| UI | react / react-dom | 19.3.1 | |
| ビルド | vite / @vitejs/plugin-react | 8.3.7 / 6.3.0 | plugin-react の peer は vite ^8 |
| 型 | typescript | **6.0.3** | 最新 7.0.2 は typescript-eslint 8.72.2 の peer(`>=4.8.4 <6.1.0`)外のため 6.0 系(案)|
| Lint | eslint / typescript-eslint | 10.14.0 / 8.72.2 | |
| CSS | tailwindcss / @tailwindcss/vite | 4.3.5 | |
| UI 部品 | shadcn(CLI) | 4.23.0 | 生成コードを取り込む方式。生成物もレビュー対象 |
| 検証 | zod | 4.6.7 | クライアント・Edge Function・テストで共有 |
| グラフ | recharts | 3.10.1 | peer: react ^19 可 |
| Supabase | @supabase/supabase-js / supabase(CLI) | 2.119.0 / 3.1.0 | ローカルは Docker |
| PWA | vite-plugin-pwa | 2.0.0 | peer: vite ^8 可 |
| テスト | vitest / @playwright/test | 5.1.0 / 1.65.0 | vitest の peer は vite ^8 可 |
| DB テスト | pgTAP(`supabase test db`) | CLI 同梱 | |
| ランタイム | Node.js 22 LTS / Deno(Edge Runtime 同梱版) | | `.nvmrc`、`deno.lock` |
| 補助(要否を Sprint 1 で判断) | react-router 8.5.1、@tanstack/react-query 5.107.1、react-hook-form 7.91.0 + @hookform/resolvers 7.0.5 | | 指示書外の追加のため、採用時は理由を記録 |

AI の SDK はプロバイダ決定後に追加(D-01)。

## 3. ディレクトリ構成(案)

置き場所は **[未決 D-00]**(このリポジトリの `buddyship-nutrition/` か、非公開の別リポジトリか)。

```
buddyship-nutrition/
  docs/                  設計文書・Sprint 報告
  app/                   PWA
    src/features/{auth,profile,consent,meals,body,dashboard,staff,admin}/
    src/lib/{supabase.ts,image.ts}
    src/components/ui/   shadcn 生成物
    tests/e2e/           Playwright
  packages/shared/       Zod スキーマ、栄養計算・欠測判定(純粋関数)、型
  supabase/
    config.toml
    migrations/          SQL マイグレーション
    functions/{analyze-meal,export-my-data,delete-account,admin-invite-user,purge-expired-images,_shared}/
    tests/               pgTAP
    seed.sql             合成データのみ
  .env.example
```

## 4. 主要フロー

### 4.1 食事の写真解析と保存

```
端末(本人 or 担当スタッフ)      Storage           analyze-meal                 DB                   AI
 │ 縮小・再エンコード              │                   │                           │                    │
 │─ upload {member}/... (JWT) ─▶│ RLS:本人 or         │                           │                    │
 │                                │ staff_can(meals:write)                         │                    │
 │─ POST analyze-meal {member_id, image_path} ─────▶│                           │                    │
 │                                │                   │ JWT 検証 → 呼出者          │                    │
 │                                │                   │─ rpc authorize_meal_write ▶│ 本人 or 担当+同意  │
 │                                │                   │─ rpc consume_ai_quota ───▶│ 上限(原子的加算)  │
 │                                │◀ download(JWT)──│                           │                    │
 │                                │                   │ 形式・サイズ・寸法の検証    │                    │
 │                                │                   │─ 画像 + 固定指示 ─────────────────────────────▶│
 │                                │                   │◀ 構造化 JSON(食品名・提供量 g)──────────────│
 │                                │                   │ Zod 検証(栄養値は受け取らない)                │
 │                                │                   │─ rpc match_foods ────────▶│                    │
 │◀─ 候補(食品・提供量・100g あたり成分・推定ラベル)│                           │                    │
 │ 提供量・食べた割合を修正(画面上で即時再計算)      │                           │                    │
 │─ rpc save_meal(JWT)───────────────────────────────────────────────────────▶│ 認可・再計算・保存・監査 │
```

- Edge Function は**呼出者の JWT を付けた Supabase クライアント**で Storage・DB にアクセスする(service role 不使用)。
- AI には画像と固定の指示文のみを送る。利用者 ID・氏名は送らない。
- 栄養値の正はサーバー(`save_meal` 内で `foods` から計算)。クライアントの計算は表示用。

### 4.2 スタッフのアクセス

スタッフの閲覧・代理入力はすべて SECURITY DEFINER の RPC 経由(案 A、**[未決 D-08]**)。RPC 内で `authz.staff_can(member, scope)` を評価し、同一トランザクションで監査ログを書く。テーブルへの直接アクセスでは、スタッフに行は返らない。

### 4.3 service role の使用箇所(限定列挙)

| 関数 | 理由 |
|---|---|
| delete-account | `auth.admin.deleteUser` に必要。JWT で本人確認後のみ |
| admin-invite-user | Auth 招待 API に必要。DB で admin かつ aal2 を確認後のみ |
| purge-expired-images | 期限切れ画像の削除。対象は `image_expires_at < now()` のパスのみ |

これ以外での使用を禁止し、CI で参照箇所を検査する。

## 5. 環境

| 環境 | 用途 | データ | 構築時期 |
|---|---|---|---|
| local | 開発(Supabase CLI + Docker) | 合成データ | Sprint 1 |
| CI | GitHub Actions でローカル Supabase を起動しテスト | 合成データ | Sprint 1 |
| staging | 試験前の確認・復元訓練 | 合成データ | **承認後**(Sprint 4)|
| production | 限定試験 | 実データ | **承認後** |

## 6. バックアップ・復元(概要)

詳細は [SECURITY.md §11](./SECURITY.md)。

- DB:Supabase の日次バックアップ(プランにより保持期間が異なる)+ 必要に応じて PITR **[未決 D-02 / D-31]**。
- **Storage(画像)は DB バックアップに含まれない。** 画像は短期保持の補助データとして、バックアップ対象外とする案 **[未決 D-31]**。
- 論理ダンプ(`supabase db dump` / `pg_dump`)を暗号化して別の保管先に置くかは **[未決 D-31]**。
- 復元訓練:staging で「バックアップから復元 → pgTAP・整合性チェック」を Sprint 4 で実施。

## 7. 観測性

- Edge Function のログは構造化 JSON。許可キーのホワイトリスト方式(request_id、関数名、結果、所要時間、ハッシュ化した user_id、AI トークン数)。健康データ・画像・食品名・AI 応答は出さない。
- 外部のエラー追跡サービスは **[未決 D-17]**。
