# Sprint 2 報告 — 食事記録

- 実施日: 2026-11-10
- 範囲: **開発と架空データによる検証のみ**。本番公開・実利用者データの投入・有料 API の呼び出しはしていない。管理栄養士の監修完了を前提にした表示もしていない(監修前であることは D-33 で管理)。
- AI は**開発用の仮解析(mock)だけ**。実際の AI プロバイダは D-01 の決定と承認の後に追加する。

## 1. 実装前の確認(既存の構成)

| 区分 | Sprint 1 までに実装済み(再利用したもの) | 未実装だったもの(今回作ったもの) |
|---|---|---|
| DB | 組織・ロール・担当割当・同意(4 スコープ)、認可関数(`authz.staff_can`・`can_access`)、監査ログ(`audit.log`・変更トリガー)、AI 利用量の上限(`consume_ai_quota`)、RPC の返り値の形(`private.ok/err/deny`) | 食品マスター、食事・明細・記録状況・解析記録、食事の RPC、画像の Storage |
| Edge Functions | 共通部品(JWT 確認・許可キー方式のログ・HTTP)、`admin-invite-user` | `analyze-meal`、`meal-image`、画像の検証、AI アダプタ |
| 共有モジュール | `packages/nutrition`(成分表の対応・表記・計算・1 日の表示・出典)、`packages/shared`(エラー・RPC の検証) | 食事 API の型、小計の見出しの規則 |
| 画面 | ログイン・MFA・同意・設定・担当一覧・管理画面、`WizardStep`・`useLoader`・UI 部品 | 食事の記録・確認修正・詳細・一覧、ホームの記録状況 |
| テスト | pgTAP(権限マトリクス・カタログ検査)、結合、E2E の仕組み | 食事の各テスト |

重複を避けるため:栄養計算・見出しは `packages/nutrition` だけで定義し、画面・SQL の結果をそれと照合するテストを置いた。Edge Functions では `scripts/sync-nutrition.mjs` で写したものを使い、CI で写しが最新か確かめる。成分表の値の解釈も、シード生成スクリプトが同じ `parseSfctValue` を使う。

## 2. テスト結果

| 種類 | 件数 | 結果 | 主な内容 |
|---|---|---|---|
| lint(ESLint・Deno lint) | — | エラーなし | |
| 書式(Prettier) | — | 問題なし | |
| 型チェック(TypeScript strict・deno check) | — | エラーなし | packages・app・結合テスト・Edge Functions 3 本 |
| 単体:栄養計算モジュール | 103 | 成功 | 小計の見出しの規則を追加(+6) |
| 単体:共有モジュール | 15 | 成功 | |
| 単体:画面 | 31 | 成功 | 食事の確認・修正の状態(+8)、日付(+2)、文言の安全確認(新しい画面も対象) |
| 単体:Edge Functions(Deno) | 17 | 成功 | 画像の中身の判定、AI 出力スキーマ(栄養値・診断・助言を拒否)(+8) |
| DB・権限(pgTAP) | 233 | 成功 | 食事の権限・検証・計算・要確認・記録状況・Storage・監査(+79) |
| 結合(本物の JWT・MFA・Storage・Edge Function) | 27 | 成功 | 食事(+13)。計算の一致は無作為 300 件 |
| E2E(Playwright) | 14 | 成功(3 回続けて実行し、3 回とも成功) | 食事(+6) |
| 生成物が最新か | — | 一致 | 成分表のシード、Edge Functions 用の計算モジュールの写し |
| 秘密情報の検査 | — | 問題なし | |

**テストが壊れを検出できることの確認**:SQL の成分量の丸めを四捨五入から切り捨てに変えると、結合テストの計算一致が 3 件失敗した(元に戻すと成功)。

### 2.1 完了条件との対応

| 完了条件 | 確認したテスト |
|---|---|
| lint・型チェック・単体テストが成功 | 上表 |
| 食事記録の E2E が成功 | `app/tests/e2e/meals.spec.ts`(写真から記録 → 要確認の小計 → 量・割合の修正 → 要確認のまま保存 → 要確認を直し材料を足す → 推定摂取量 → 再読込で一致 → 一覧 →「食べなかった」) |
| 本人と担当スタッフの権限 | pgTAP `05_meals_test.sql`(本人・代理入力スタッフ・閲覧スタッフ・同意なしスタッフ・MFA なし・管理者・他の利用者)、結合 `meals.test.ts`、E2E(代理入力・スタッフには写真を見せない) |
| 同意撤回後のアクセス遮断 | pgTAP(同じセッションのまま保存・閲覧・更新が拒否、拒否は監査に記録)、結合(解析・アップロード・保存・閲覧の拒否)、E2E(開いたままのスタッフの画面からの保存が拒否され、一覧も拒否、代理入力のボタンが消える) |
| 栄養計算の結果が保存・再表示で一致 | 結合(保存された明細・合計を `packages/nutrition` で計算し直して一致。300 件)、詳細画面は保存値と再計算値が一致しなければ数値を出さない、E2E(保存直後と再読込で表示が同じ) |
| 要確認食品の小計表示 | 単体(食事・1 日の見出し、64 通り)、画面の状態、結合(保存後の小計)、E2E(「確認済み食品のみの小計」「未確認の食品は含まれていません。(未確認 3 品)」、点線の枠、数値の前の「小計」、確認後は「推定摂取量」) |

## 3. 作ったもの

| 機能 | 内容 |
|---|---|
| 1. 写真の撮影・アップロード | 端末で長辺 1600px の JPEG に描き直し(位置情報などを除去)、非公開の Storage(本人のフォルダ)へ。撮影時に家族の顔・郵便物・薬袋を写さないよう案内 |
| 2. 料理・食材の候補抽出 | `analyze-meal`:権限・上限 → 画像の中身の検証 → AI(mock)→ スキーマ検証(栄養値・診断・助言は受け取らない)→ 解析記録(食品名と量だけ) |
| 3. 食品コードとの対応付け | `match_foods`(別名辞書の完全一致、なければあいまい一致)→ `initialMatchStatus` で確定/要確認(候補 1 つ・完全一致・確からしさが低くないときだけ確定) |
| 4. 要確認の修正画面 | 候補を大きなボタンで提示、「ほかの食品を探す」。選ぶまで計算に入らないことを明示 |
| 5. 食材・調理油・調味料の追加・削除 | 料理ごとに「材料/調理に使った油/調味料を足す」、確認ダイアログ付きの削除。「中身がはっきりわからない」で表示をおおよそに |
| 6. 重量・摂取割合の修正 | −/+(10%)と数値入力、「全部/ほとんど/半分/少し/食べなかった」を 1 品ずつ・全部まとめて |
| 7. 栄養計算モジュールとの連携 | 画面の表示は `packages/nutrition`、保存値は SQL(同じ規則)。明細に成分表の元の表記・版・計算規則の版を保存 |
| 8. 保存・履歴表示 | 保存・修正・削除(削除は本人のみ、写真も Storage から削除)。一覧(7 日分、記録状況、日の集計)、詳細、ホームの今日の記録状況 |
| 9. 代理入力 | 担当一覧から「食事を代わりに記録する」(`meals:write`)。「〇〇さんの記録として、あなたが代わりに入力します」と表示。保存は `entry_source = staff`、本人の画面に「スタッフ入力」 |
| 10. 画像のアクセス制御と監査 | Storage のポリシー(本人・代理撮影スタッフ、パス形式、上書き不可、削除は本人)、閲覧は `meal-image` 関数(本人のみ・許可/拒否を監査・キャッシュさせない)、解析・保存・閲覧・拒否を監査ログに記録 |
| 表示ルール | 要確認があれば「確認済み食品のみの小計」+「未確認の食品は含まれていません」(点線の枠・「小計」の表記)、すべて確認済みなら「推定摂取量」。1 日も同様 |

## 4. 変更したファイル

### 追加
- `supabase/migrations/20261110000500_foods_meals.sql` — 食品マスター・食事・明細・記録状況・解析記録・Storage・RPC
- `supabase/seeds/foods.sql`(生成物)、`supabase/seed-data/food-aliases.json`(開発用の別名辞書 61 件)
- `supabase/tests/05_meals_test.sql`
- `supabase/functions/analyze-meal/`、`supabase/functions/meal-image/`
- `supabase/functions/_shared/ai/`(スキーマ・mock・選択)、`_shared/image.ts`、`_shared/nutrition/`(生成物)と各テスト
- `packages/nutrition/src/labels.ts`
- `packages/shared/src/meals.ts`
- `app/src/features/meals/`(`RecordMealPage`・`MealDetailPage`・`MealHistoryPage`・`MealEditor`・`FoodSearch`・`NutritionPanel`・`editorModel`(+テスト)・`useMemberTarget`)
- `app/src/lib/date.ts`(+テスト)、`app/src/lib/image.ts`
- `app/tests/e2e/meals.spec.ts`
- `tests/integration/meals.test.ts`
- `scripts/sfct/build-foods-seed.ts`、`scripts/sync-nutrition.mjs`
- `docs/reports/sprint-2.md`

### 変更
- `packages/nutrition/src/composition.ts`・`daily.ts`・`index.ts`(+テスト)— 小計の見出し
- `packages/shared/src/index.ts`
- `app/src/App.tsx`・`components/AppShell.tsx`・`features/member/HomePage.tsx`・`features/staff/StaffDashboardPage.tsx`・`lib/api.ts`・`lib/useLoader.ts`
- `app/tests/e2e/global-setup.ts`(食事テスト用の架空アカウント)
- `supabase/config.toml`(関数 2 本、`AI_PROVIDER`、シードの読み込み)、`supabase/.env.example`
- `package.json`(スクリプト)、`eslint.config.js`
- `.github/workflows/buddyship-ci.yml`(生成物の検査、関数の lint・テスト)
- `docs/`:PRD・SCREENS・DATABASE・API・SECURITY・TEST_PLAN・TASKS

## 5. 途中で見つけて直したこと

- 新しい補助関数 2 つが PUBLIC・anon から実行できる状態だった → カタログ検査テストが検出し、権限を取り消した。
- `search_foods` の並べ替えの書き方の誤り → pgTAP が検出。
- 記録の修正で、解析記録・画像のパスをクライアントから送らせていたため、画像のパスを受け取らないスタッフが修正できなかった → サーバーが保存済みの値を使うように変更(付け替えも不可)。
- 保存直後に、保存前の値が一瞬表示されることがあった → 読み直しの間は古い値を表示しないように変更。
- 一覧の「最新の状態にする」ボタンに読み直し関数を直接渡していたため、クリックの情報が別の意味の引数として渡っていた → 型チェックが検出し修正。
- 食事を消しても写真が Storage に残っていた → 本人が消すときに写真も消すように変更(権限の結合テストを追加)。

## 6. 残る課題

| 課題 | 内容 | 関係 |
|---|---|---|
| 実際の AI | mock のみ。実際の AI プロバイダの選定・契約・精度検証が必要(**有料 API の実行は事前承認**) | D-01・D-14 |
| 期限切れ画像の自動削除 | 保存 30 日後は閲覧できないが、Storage からの削除処理(`purge-expired-images`)は未実装。保存されなかった下書き写真の削除、解析記録の 90 日保持も同様 | S2-12・D-09 |
| 別名辞書 | 開発用の 61 件だけ。家庭料理の食材の言い回しを広げ、外部管理栄養士の監修(D-33)で確認が必要。辞書にない食材はあいまい一致で「要確認」になる | D-19・D-33 |
| 監修前の状態 | 食品成分の選定・計算規則・表示・誤差の説明は**外部監修が未完了**。実利用者への公開は別途承認が必要な状態のまま | D-33・PRD §10.1 |
| Storage を直接読む操作の監査 | 本人が自分の写真を、代理撮影したスタッフが自分のアップロードを Storage から直接読む操作は、ポリシーで制御しているが 1 件ずつの監査には残らない(画面からの閲覧は監査あり) | SECURITY §15 |
| 実機 | iPhone・Android でのカメラ・HEIC・PWA の確認は未実施。E2E は Chromium のスマホ表示のみ | Sprint 4 |
| 嚥下調整食 | きざみ・ミキサー食の扱いは未決 | D-32 |
| スタッフの一覧 | 担当利用者一覧の「直近 7 日の記録状況」「最新 InBody」の列は Sprint 3 | T-01 |
| 開発用の中継 | プレビューのための Supabase 中継(`VITE_SUPABASE_URL=same-origin`)は開発時のみ | — |

## 7. 確認していただきたいこと

1. **D-01**:実際の AI プロバイダの比較方法と、精度検証に使う件数・費用の上限(承認後に実行)。
2. **D-33**:外部管理栄養士への監修依頼の時期(別名辞書・成分の選定・表示の文言を一緒に見ていただくのが効率的です)。
3. Sprint 3(InBody・身体組成グラフ・担当利用者ダッシュボード)に進んでよいか。
