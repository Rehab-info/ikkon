# TASKS — 開発タスク

- 文書版: **v2.0 ドラフト(承認待ち)**
- 各 Sprint の終了条件:該当テストがすべて成功し、`docs/reports/sprint-N.md` に結果を報告。
- **本番環境へのデプロイ、実利用者データの投入、有料 API の大量実行は、承認を得るまで行わない。**

## Step 1 — 設計文書
- [x] 既存リポジトリの確認
- [x] 設計文書 9 点(v2.0)
- [ ] Sprint 1 の前提となる未決事項の承認([DECISIONS.md §1.1](./DECISIONS.md))

## Sprint 1 — 認証・プロフィール・担当割当・同意管理・DB マイグレーション・RLS テスト

詳細計画は [DECISIONS.md §5](./DECISIONS.md)。

| ID | タスク | テスト |
|---|---|---|
| S1-01 | 版の再確認と雛形(Vite + React + TS strict + Tailwind 4 + shadcn)。完全一致指定+lockfile | build / typecheck |
| S1-02 | ESLint・Prettier・禁止ルール(`dangerouslySetInnerHTML`、`console.*`、service role 参照) | lint |
| S1-03 | `packages/shared`:Zod スキーマ、エラーコード対応表 | Vitest |
| S1-04 | Supabase CLI 初期化(ローカル)、`.env.example` | `supabase start` |
| S1-05 | マイグレーション:列挙型、組織・拠点・profiles・user_roles | pgTAP |
| S1-06 | マイグレーション:`authz` 判定関数 | pgTAP(真理値表)|
| S1-07 | マイグレーション:担当割当・同意文書・規約同意・スタッフ同意(4 スコープ) | pgTAP |
| S1-08 | マイグレーション:監査ログ(追記専用)、拒否も記録する方式の検証(R-07) | pgTAP |
| S1-09 | マイグレーション:利用量テーブルと `consume_ai_quota`(Sprint 2 で使用) | pgTAP |
| S1-10 | RPC:管理者(ロール・割当・利用者一覧・緊急停止)、利用者(同意付与・撤回・規約同意・プロフィール)、スタッフ(ダッシュボードの雛形) | pgTAP + 統合 |
| S1-11 | カタログ検査テスト(RLS 有効、definer 関数の search_path・EXECUTE、ビュー) | pgTAP |
| S1-12 | 合成データ `seed.sql` | `supabase db reset` |
| S1-13 | 画面:ログイン、MFA、はじめての同意、設定(文字サイズ)、担当スタッフへの共有設定(M-13)、管理者の登録・割当(A-01, A-02) | Playwright |
| S1-14 | 高齢者向け UI の基盤(文字サイズ 3 段階、大ボタン、ウィザード部品) | Vitest + Playwright |
| S1-15 | Edge Function 共通部品(JWT 検証、許可キー方式ロガー、エラー形式) | `deno test` |
| S1-16 | GitHub Actions(`buddyship-nutrition/**` 変更時のみ。既存 Pages ワークフローには触れない) | CI |
| S1-17 | Sprint 1 報告 | — |

## Sprint 2 — 食事撮影・AI 解析・食品マスター・栄養計算・食事修正・代理入力

| ID | タスク |
|---|---|
| S2-01 | 食品成分表の取込スクリプト(D-18 決定後)、件数・抜取り検証 |
| S2-02 | やさしい名前・別名・目安単位・料理マスター(D-19 の範囲) |
| S2-03 | `search_foods` / `match_foods` |
| S2-04 | 栄養計算(TS 純粋関数 + SQL)、提供量 × 食べた割合、一致テスト |
| S2-05 | `meals`・`meal_items`・`meal_slot_status`・`meal_analyses` と RPC(`save_meal`、`update_meal`、`set_slot_status`、`get_meals`、`get_daily_summary`) |
| S2-06 | 代理入力の認可(`meals:write`)、入力経路・情報源の記録 |
| S2-07 | Storage バケット・ポリシー(本人+代理入力スタッフ)、端末での縮小・再エンコード |
| S2-08 | 画像検証の技術検証と実装(R-03) |
| S2-09 | AI アダプタ(D-01 決定後)とモックアダプタ |
| S2-10 | `analyze-meal` |
| S2-11 | 画面 M-01〜M-10(ウィザード、食べた割合、記録状況カレンダー) |
| S2-12 | `purge-expired-images` と pg_cron |
| S2-13 | 統合・E2E(AI はモック) |
| S2-14 | Sprint 2 報告 |

## Sprint 3 — InBody・測定履歴・身体組成グラフ・担当利用者ダッシュボード

| ID | タスク |
|---|---|
| S3-01 | `body_compositions` と RPC、代理入力の認可(`body:write`) |
| S3-02 | 入力画面 M-11(項目ごとのウィザード、範囲・整合性) |
| S3-03 | 体の変化 M-12(Recharts、表の併記、表だけの表示) |
| S3-04 | 担当利用者ダッシュボード T-01 / T-02(列ごとのスコープ判定) |
| S3-05 | エクスポート・アカウント削除(M-14) |
| S3-06 | Sprint 3 報告 |

## Sprint 4 — セキュリティテスト・E2E・精度検証・PWA 最適化・限定試験の準備

| ID | タスク |
|---|---|
| S4-01 | 権限マトリクス全件の網羅確認、侵入的テスト(他人の ID・改ざん・期限切れ JWT) |
| S4-02 | E2E 全シナリオ、iOS/Android 実機 |
| S4-03 | 高齢者向けユーザビリティ確認(スタッフ・利用者数名、合成データの試験アカウント) |
| S4-04 | 栄養推定精度検証(D-14。**実 API の呼び出し件数・費用は事前承認**) |
| S4-05 | PWA(manifest、アイコン、キャッシュ方針、更新通知、ホーム画面追加の案内) |
| S4-06 | セキュリティヘッダ・CSP(配信先決定後) |
| S4-07 | バックアップ・復元訓練(staging。**staging 構築は承認後**) |
| S4-08 | 運用手順書(初期設定支援、同意取得、上限変更、緊急停止、インシデント、復元) |
| S4-09 | 依存監査、秘密スキャン、セキュリティレビュー |
| S4-10 | 試験開始判定資料(未決事項の残り、法務確認の結果) |
