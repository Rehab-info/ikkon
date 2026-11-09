# TASKS — 開発タスク

- 文書状態: **ドラフト(承認待ち)**
- 各 Sprint の終了条件:該当テストがすべて成功し、結果を報告書(`docs/reports/sprint-N.md`)にまとめる。
- 本番環境の構築・実データ投入は、各段階で別途承認を得るまで行わない。

## Sprint 0(本書)— 設計
- [x] 既存リポジトリの確認
- [x] 設計文書 9 種の作成
- [ ] **未決事項のうち Sprint 1 の前提となるもの(D-00, D-02, D-04, D-05, D-06, D-07, D-08)の承認**

## Sprint 1 — 基盤・認証・DB・RLS・同意管理

詳細計画は [DECISIONS.md §4](./DECISIONS.md)。

| ID | タスク | 成果物 | テスト |
|---|---|---|---|
| S1-01 | プロジェクト雛形(Vite + React + TS strict + Tailwind 4 + shadcn 初期化)、版の再確認と完全固定 | `app/`、`package-lock.json` | `npm ci && npm run build` |
| S1-02 | ESLint(typescript-eslint)・Prettier・`tsc --noEmit`、禁止ルール(`dangerouslySetInnerHTML`、`console.*` 直書き)| 設定 | lint |
| S1-03 | `packages/shared`(Zod スキーマの置き場、Vitest)| | 単体 |
| S1-04 | Supabase CLI 初期化、`config.toml`(ローカル)、`.env.example` | `supabase/` | `supabase start` |
| S1-05 | マイグレーション:組織・profiles・user_roles・staff_assignments・consent_documents・user_agreements・staff_access_consents・audit・private | SQL | pgTAP |
| S1-06 | `authz` 関数(has_role / is_aal2 / staff_can)| SQL | pgTAP |
| S1-07 | RLS ポリシー(上記テーブル)と列権限、`anon` からの全取消 | SQL | pgTAP |
| S1-08 | 監査トリガーと `audit.log` 関数、追記専用の権限 | SQL | pgTAP |
| S1-09 | 管理者 RPC(ロール・担当割当)、利用者 RPC(同意付与・撤回、規約同意)| SQL | pgTAP |
| S1-10 | スタッフ RPC の雛形(`staff_list_members`、判定+監査の共通パターン)| SQL | pgTAP |
| S1-11 | 合成データの `seed.sql`(組織1、管理者1、スタッフ2、利用者3、割当・同意の各パターン)| SQL | — |
| S1-12 | 認証画面(ログイン、MFA 登録・確認、初回同意)| UI | Playwright(ローカル)|
| S1-13 | 同意管理画面(M-10)、スタッフ担当一覧(T-01)、管理者のスタッフ・割当画面(A-01, A-02)| UI | Playwright |
| S1-14 | Edge Function 共通部品(JWT 検証、PII マスクロガー、エラー形式)| `_shared/` | Deno テスト |
| S1-15 | GitHub Actions:lint・型・単体・`supabase start`+pgTAP・ビルド成果物の秘密検査・Service Role 参照検査 | `.github/workflows/buddyship-ci.yml`(`buddyship-nutrition/**` の変更時のみ)| CI |
| S1-16 | Sprint 1 報告 | `docs/reports/sprint-1.md` | — |

## Sprint 2 — 食事AI・食品成分表・食事修正・履歴

| ID | タスク |
|---|---|
| S2-01 | 食品成分表の取込スクリプト(出典・版・列の選択は D-18 に従う)、`foods`・`food_aliases` マイグレーション、取込結果の件数・抜取り検証 |
| S2-02 | 別名辞書・料理マスター(D-19 で決定した範囲)|
| S2-03 | `match_foods` / `search_foods`(pg_trgm)|
| S2-04 | 栄養計算(TS 純粋関数 + SQL)と一致テスト、丸め規則 |
| S2-05 | `save_meal` / `update_meal` RPC、meals/meal_items/meal_analyses の RLS |
| S2-06 | Storage バケット・ポリシー、端末側の画像縮小・再エンコード |
| S2-07 | 画像検証ライブラリの技術検証(R-03)と実装 |
| S2-08 | AI アダプタ(D-01 決定後)、構造化出力、Zod 検証、タイムアウト・再試行 |
| S2-09 | `consume_ai_quota` と上限設定 |
| S2-10 | `analyze-meal` Edge Function |
| S2-11 | 画面 M-02〜M-07 |
| S2-12 | `purge-expired-images` と pg_cron |
| S2-13 | AI モック(テスト用固定応答)を使った統合テスト・E2E |
| S2-14 | Sprint 2 報告 |

## Sprint 3 — InBody・身体組成グラフ・ダッシュボード

| ID | タスク |
|---|---|
| S3-01 | `body_compositions` マイグレーション・RLS・監査トリガー |
| S3-02 | `insert_body_composition`、スタッフの `staff_*_body_composition` |
| S3-03 | 入力画面 M-08 / T-03(範囲検証・整合性警告)|
| S3-04 | 履歴・グラフ M-09(Recharts、表の併記)|
| S3-05 | `get_daily_totals`(タイムゾーン境界)|
| S3-06 | ダッシュボード M-01、スタッフのサマリー T-02 |
| S3-07 | エクスポート・アカウント削除(Edge Function + M-11)|
| S3-08 | Sprint 3 報告 |

## Sprint 4 — セキュリティテスト・E2E・精度検証・PWA

| ID | タスク |
|---|---|
| S4-01 | 権限マトリクスの全組合せテスト(TEST_PLAN §3)の網羅確認 |
| S4-02 | E2E 主要シナリオ(TEST_PLAN §5)、iOS/Android 実機確認 |
| S4-03 | PWA(manifest、アイコン、Service Worker のキャッシュ方針、更新通知)|
| S4-04 | セキュリティヘッダ・CSP(ホスティング決定後)|
| S4-05 | AI 精度検証(合成テスト画像セット、D-14)|
| S4-06 | 依存関係の監査、秘密スキャン、`/security-review` 相当のレビュー |
| S4-07 | 運用手順書(上限変更、緊急停止、インシデント対応、バックアップ)|
| S4-08 | Sprint 4 報告・試験開始判定資料 |
