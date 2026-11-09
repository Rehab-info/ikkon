# SECURITY — セキュリティ要件

- 文書状態: **ドラフト(承認待ち)**
- 原則:**既定で拒否、サーバー(DB)で判定、最小権限、最小収集、記録は残すが中身は残さない。**

## 1. 脅威モデル(主要)

| # | 脅威 | 対策 | 検証 |
|---|---|---|---|
| T1 | 利用者が他人のデータを読む・書く | 全テーブル RLS、本人条件。ID を推測されても行が返らない | pgTAP / 統合テスト |
| T2 | 担当外スタッフが利用者データを見る | スタッフはRPC経由のみ、`authz.staff_can` で担当+同意+組織を確認 | pgTAP |
| T3 | 同意撤回後もスタッフが見続ける | 判定は毎回DB。JWT・キャッシュに権限を持たせない。スタッフ画面は永続キャッシュしない | pgTAP / E2E |
| T4 | 利用者が自分を staff/admin に昇格 | ロールは `user_roles`(管理者RPCのみ書込)。`user_metadata` を権限判断に使わない | pgTAP |
| T5 | クライアントが栄養値を改ざんして保存 | 栄養値はサーバーで計算。テーブル直接書込を禁止 | 統合テスト |
| T6 | APIキー漏えい | AIキー・Service Role キーは Edge Function Secrets のみ。ビルド成果物を CI で検査 | CI |
| T7 | 画像の公開・推測URL | private バケット、パス先頭= uid、署名URLは短期(60秒、仮) | 統合テスト |
| T8 | 悪性ファイル(偽装拡張子・巨大画像・デコンプレッション爆弾) | クライアント再エンコード+サーバーでマジックバイト・サイズ・寸法検証、バケットの MIME/サイズ制限 | 単体テスト |
| T9 | AI 費用の暴走・DoS | 分/日/月の上限を原子的に加算、全体の月次上限、AI 呼び出しのタイムアウト | 統合テスト |
| T10 | プロンプトインジェクション(画像内文字) | 固定指示、スキーマ強制出力、Zod `.strict()`、出力は候補表示のみで権限ある操作に使わない | 単体テスト |
| T11 | ログからの個人情報漏えい | PII マスク済みロガーのみ使用、値・画像・AI応答をログに出さない | コードレビュー / lint |
| T12 | XSS | React のエスケープ、`dangerouslySetInnerHTML` 禁止(lint)、CSP | lint / E2E |
| T13 | セッション乗っ取り | Supabase Auth 既定、スタッフ・管理者は MFA(aal2)、短いアクセストークン有効期限 | 手動確認 |
| T14 | 共有端末・紛失端末 | ログアウト時にクエリキャッシュ・Service Worker キャッシュを消去、データはオフライン保存しない | E2E |
| T15 | 管理者の濫用 | 管理者は既定で利用者データを見られない、管理操作はすべて監査 | pgTAP |
| T16 | 依存パッケージの侵害 | lockfile 固定、`npm ci`、Dependabot/`npm audit`、新規依存はレビュー | CI |

## 2. 認証・認可

- Supabase Auth。ログイン方式は **[未決 D-04]**。
- スタッフ・管理者は TOTP MFA 必須(仮)。DB 判定関数で `aal2` を確認するため、MFA 未完了のトークンではスタッフ操作ができない。
- 認可はすべて DB(RLS・SECURITY DEFINER 関数)または Edge Function 内で JWT を検証してから行う。クライアントの画面制御は利便性のためだけ。
- Edge Function は `verify_jwt` を有効にしたうえで、関数内でも `auth.getUser()` で再確認する。

## 3. Service Role キー

- 使用を許可する関数は [ARCHITECTURE.md §4.3](./ARCHITECTURE.md) の3つのみ。
- 該当関数ではService Role クライアントの生成を1か所に限定し、操作対象(user_id・パス)を関数冒頭で確定してから使う。
- CI で `SERVICE_ROLE` の参照を grep し、許可リスト外のファイルにあれば失敗させる。
- フロントエンドの環境変数は `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY`(公開前提のキー)のみ。ビルド成果物に `service_role` や AI キーの形式の文字列がないことを CI で検査。

## 4. 画像

- 端末:`createImageBitmap` → canvas で長辺 1600px(仮)に縮小 → WebP/JPEG で再エンコード(EXIF・GPS を除去)。
- サーバー:サイズ・マジックバイト・寸法・デコード可否を検証。Deno で使える画像デコードライブラリの選定は Sprint 2 の技術検証項目([DECISIONS.md R-03](./DECISIONS.md))。
- バケット:private、`file_size_limit`、`allowed_mime_types` を設定。
- 保持:短期(仮 30 日)で自動削除。保存されなかった下書き画像は 24 時間(仮)で削除。
- 画像を AI プロバイダ以外の第三者に送らない。ログに画像やパスを出さない。

## 5. レート制限・利用量上限

| 対象 | 上限(仮) | 実装 |
|---|---|---|
| AI 解析 / 利用者 / 分 | 3 回 | `private.ai_usage_*` を RPC で原子的に加算(`insert ... on conflict do update ... returning`)|
| AI 解析 / 利用者 / 日 | 20 回 | 同上 |
| AI 解析 / 組織 / 月 | 3,000 回 | 同上。80% で管理者に通知(方法は [未決 D-17])|
| エクスポート / 利用者 / 日 | 5 回 | 同上 |
| Auth(ログイン・OTP) | Supabase Auth の既定レート制限 | 設定値を確認し記録 |
| AI プロバイダ側の支出上限 | プロバイダのコンソールで月額上限を設定 | 運用手順 |

## 6. 個人情報・法令(要専門家確認)

本章は技術者による整理であり、法的判断ではない。**試験開始前に専門家(弁護士等)の確認が必要。**

- 個人情報保護法:利用目的の特定・通知、第三者提供(スタッフへの共有は利用者の同意に基づく)、安全管理措置、開示・削除請求への対応。
- 身体組成・食事記録が「要配慮個人情報」に当たるかの確認(健康診断結果・病歴等は該当。将来の産業保健で扱う場合は確実に該当)**[未決 D-20]**。
- AI プロバイダが外国にある場合の外国第三者提供(本人同意と情報提供)、または委託として整理できるかの確認 **[未決 D-01 / D-20]**。プロバイダのデータ保持期間・学習利用の有無・データ処理契約を確認する。
- Supabase のリージョン(東京を仮置き)とサブプロセッサの確認 **[未決 D-02]**。
- 医療機器プログラム該当性:診断・治療・予防を目的とする表示をしない(PRD §1.1)。
- 未成年の利用可否 **[未決 D-21]**。

## 7. ログ

- 許可:request_id、関数名、ステータス、所要時間、ハッシュ化 user_id、AI のトークン数・モデル名、エラーコード。
- 禁止:メールアドレス、表示名、画像・画像パス、食品名、重量、身体値、AI 応答本文、JWT、APIキー。
- 共通ロガー(`_shared/log.ts`)に許可キーのホワイトリストを持たせ、それ以外のキーは出力しない。
- 監査ログは `audit.logs`(追記専用、UPDATE/DELETE 権限を誰にも与えない)。

## 8. フロントエンド / 配信

- CSP(例):`default-src 'self'; img-src 'self' blob: data: https://<project>.supabase.co; connect-src 'self' https://<project>.supabase.co; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`(`unsafe-inline` の要否は Tailwind 4 の出力で確認)。
- `Strict-Transport-Security`、`X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer`、`Permissions-Policy: camera=(self), geolocation=()`。
- → ヘッダを設定できるホスティングが必須 **[未決 D-03]**。
- Service Worker はアプリ殻(HTML/JS/CSS/アイコン)のみキャッシュ。`/rest/`・`/functions/`・`/storage/` はキャッシュしない(NetworkOnly)。

## 9. 表示上の安全

- 栄養値は「推定値」と常に表示。
- 不足・過剰・疾病に関する判定、推奨摂取量の自動提示をしない。
- 体重・体脂肪の変化に評価語・色の良否を付けない。

## 10. 秘密情報の管理

- `.env` 系は `.gitignore`。`.env.example` にはキー名と説明のみ。
- AI キー・Service Role キーは Supabase の Edge Function Secrets と GitHub Actions Secrets(デプロイ用)のみに置く。
- GitHub のシークレットスキャン・プッシュ保護を有効化(リポジトリ設定、要確認)。
- このリポジトリは公開されている可能性がある(GitHub Pages 公開用)。**設計文書・コードが公開される前提で、秘密・内部ホスト名・実データを含めない** **[未決 D-00]**。

## 11. インシデント対応(試験期間)

- 連絡窓口・判断者・利用者への通知手順を試験開始前に決める **[未決 D-22]**。
- 緊急停止:AI 解析は `private.settings` のフラグで即時停止できるようにする。スタッフアクセスは全担当割当の一括終了 RPC で即時停止。
