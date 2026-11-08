# YOKU テスト報告

実施日:2026-11-08 / 対象:0.1.0-beta / 環境:Linux、Node 22.23、Chromium(Playwright 1.63、Pixel 7 相当の画面 412×915・タッチ)

```
npm run check   # typecheck → vitest → build → playwright
```

## 結果

| 種類 | 件数 | 結果 |
|---|---|---|
| TypeScript(strict, noUncheckedIndexedAccess) | — | エラー 0 |
| Vitest + React Testing Library | 70 | **70 合格** |
| 本番ビルド(PWA・CSP) | — | 成功 |
| Playwright E2E(スマートフォン画面) | 13 | **13 合格** |

単体テストは 5 回連続で全合格(不安定なテストがないことを確認)。

## 必須項目との対応(指示書 9)

| 検証項目 | テスト |
|---|---|
| 4領域の記録・編集・削除 | `db/repo.test.ts`(各領域)、`e2e/flows.spec.ts`(画面操作で Wellness 記録→編集→削除、Intimacy 好み追加→ステータス変更・境界線・体験、Food 記録→検索・フィルター→削除、Thanks 記録) |
| IndexedDB への保存 | `repo.test.ts`、E2E で IndexedDB を直接数えて確認(`countIdb`) |
| ブラウザー再起動後のデータ保持 | `e2e/persistence-offline.spec.ts`(同じプロファイルでブラウザーを閉じて起動し直し、記録と設定が残る)、`repo.test.ts`(接続を閉じて開き直す) |
| 欠測値の処理 | `validate.test.ts`(0 と空の区別)、`repo.test.ts`(未回答はキーを持たない・全未回答で記録を消す)、`trend.test.ts`(未回答日は null、平均から除外)、`App.test.tsx`(画面で 0 を選ぶ/クリアで未回答) |
| Intimacy 領域の非表示 | `App.test.tsx`、`e2e/flows.spec.ts`(ホーム・Together・共有から消える/URL 直打ちでホームへ戻る/データは残る/再表示で戻る) |
| 共有プレビュー | `App.test.tsx`(編集した文章がそのままプレビュー・コピーされる)、E2E(クリップボードの中身を検査) |
| 共有文への意図しないデータ混入防止 | `share.test.ts`(全欄に秘密の文字列を入れて検査)、`App.test.tsx`(Intimacy・Food・Thanks・気持ち)、E2E(実際にコピーされた文字列にメモ・同行者・気持ち・境界線・体験が含まれない) |
| Food 写真の保存・削除 | `e2e/food-photo.spec.ts`(2400×1800・EXIF/GPS 付きの JPEG → 1600×1200 に縮小、1.5MB 未満、**EXIF と埋めこんだ機種名が保存データに残らない**、写真を外す/記録を削除で写真も削除、画像以外は拒否)、`repo.test.ts`(差し替え・容量上限・孤立した写真の掃除) |
| Thanks の記録と共有文作成 | `App.test.tsx`(テンプレート・必須項目・伝えたいメッセージの優先・「伝えた」は自動で付かない)、E2E |
| 全データ削除 | `repo.test.ts`、`App.test.tsx`(「削除」と入力するまで押せない)、E2E(実データ・デモ DB が消え、初回画面に戻る) |
| デモデータと実データの分離 | `repo.test.ts`(別 DB・デモでの追加が実データに入らない・デモ終了で削除)、`App.test.tsx`、`e2e/demo.spec.ts` |
| オフライン動作 | `e2e/persistence-offline.spec.ts`(Service Worker 制御後にオフラインで再読みこみ → 起動・記録・グラフ表示) |
| スマートフォン画面での操作 | E2E 全体を Pixel 7 相当のタッチ画面で実行。主要画面で横スクロールが出ないことを確認 |
| 外部通信の監査 | `test/network-audit.test.ts`(ソースに fetch / XHR / sendBeacon / WebSocket / EventSource / WebRTC / 通知 / 位置情報 / 外部 URL がない、本番依存の一覧を固定)、`e2e/network.spec.ts`(デモで全19画面と保存・共有を操作し、同一オリジン以外へのリクエスト 0・WebSocket 0)、CSP がブラウザーで外部への fetch を拒否することを確認 |
| 基本的なアクセシビリティ | `e2e/a11y.spec.ts`(axe-core、WCAG 2.0/2.1/2.2 A・AA、主要13画面 × ライト・ダーク、違反 0)、キーボードだけで記録・タブの矢印操作。RTL はロール・ラベルで要素を取得(アクセシブルな名前がないと失敗する) |
| XSS | `App.test.tsx`(`<img onerror>`・`<script>` が文字列として表示され、実行されない)、静的監査(innerHTML・eval 等なし) |

## テストで見つかり、修正した不具合

| 不具合 | 原因 | 修正 |
|---|---|---|
| 0〜10 の入力欄にアクセシブルな名前がなかった | `<legend>` が fieldset の最初の子ではなかった | legend を直下に置き、見た目のラベルは別に表示(`ScoreInput.tsx`) |
| ダイアログの入力欄に1文字しか入力できない(全削除の確認で「削除」が打てない) | フォーカス管理の effect が `onClose` の変化で毎回再実行され、フォーカスを奪っていた | `onClose` を ref に保持し、開閉時だけ実行(`ui.tsx` の Dialog) |
| 全削除が終わらない | 画面のライブクエリが DB 接続を保持したまま削除していた | 先に画面を外してから DB を削除(`AppContext.tsx`) |
| デモ開始直後に、準備中のデモ DB で画面が描画されることがある | 「準備完了」の状態がモード切替の直後に古いまま残っていた | 準備完了を DB インスタンスに結びつけた(`readyDb === db`) |
| accent の文字色のコントラスト不足(4.36:1) | #9A5C5F / #F6E9E9 | #87494C に変更(5.75:1) |
| Food のカードの余白が二重 | `p-4` と `p-0` のクラスの競合 | Card に `padded` を追加 |

## 確認していないこと

KNOWN_LIMITATIONS.md の「開発・テストの制限」を参照(iOS Safari・Firefox、実機の共有シート、スクリーンリーダー実機、ユーザビリティテスト)。
