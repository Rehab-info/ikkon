# YOKU ベータ版

> 自分を知る。ふたりをもっと知る。

YOKU は、食欲・睡眠・性的な関心といった欲求を「採点」するのではなく、自分を理解し、パートナーに気持ちや好みを伝え、うれしかったことと感謝を残すためのウェルビーイング・アプリです(成人向け)。

- **Wellness**:三大欲求と心身の状態を 0〜10 の主観で記録し、項目ごとに 7日・30日の推移を見る
- **Intimacy**:好み・良かった体験・境界線を、自分のために整理する(初期設定で非公開)。「もう一度お願いしたい ♡」で、伝えにくい希望をやさしい文章にして、自分で確認してから送れる
- **Food**:美味しかった料理と写真、また食べたいものを残す
- **Thanks**:感謝とうれしかった出来事を残す
- **Together**:上の4つから、本人が選んで確認した文章だけを共有する

すべての記録は端末内(IndexedDB)だけに保存されます。サーバー・アカウント・同期・外部 AI・広告・解析 SDK はありません。

このフォルダは一献のサイトとは独立したアプリです(`yoku/` の中だけで完結)。

## 起動方法

Node.js 20 以上(開発は 22 で確認)。

```bash
cd yoku
npm install
npm run dev        # 開発サーバー http://localhost:5173/
```

本番ビルドを手元で確かめる(Service Worker・オフライン・CSP が有効になるのは本番ビルドだけ):

```bash
npm run build
npm run preview    # http://localhost:4173/
```

### スマートフォンで試す

同じ Wi-Fi のスマートフォンから見る場合は `npm run preview -- --host` で表示される `http://<PCのIP>:4173/` を開きます。
ただし Service Worker(オフライン・ホーム画面に追加)と `crypto.randomUUID` は **HTTPS か localhost** でしか動きません。LAN の http では、オフライン機能なしで動きます(ID は代わりの方法で作ります)。
ホーム画面に追加して本格的に使う場合は、HTTPS の静的ホスティングに `dist/` を置いてください(公開は未実施。下記)。

### 初回起動

1. 「私は18歳以上です」にチェック
2. 「はじめる」(実データ)または「デモデータで試してみる」(架空データ。実データとは別のデータベース)

## テスト

```bash
npm run typecheck  # TypeScript strict
npm test           # Vitest + React Testing Library(83件)
npm run build
npm run e2e        # Playwright(スマートフォン画面・15件。本番ビルドを vite preview で起動して実行)
npm run check      # 上の4つをまとめて
```

結果の詳細は [TEST_REPORT.md](./TEST_REPORT.md)。

## ドキュメント

| ファイル | 内容 |
|---|---|
| [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md) | 要件・画面構成・科学的根拠と製品仮説の区別 |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | 色・文字・部品・アクセシビリティ |
| [DATA_MODEL.md](./DATA_MODEL.md) | データ構造・欠測値・日時・データ移行 |
| [PRIVACY_AND_SECURITY.md](./PRIVACY_AND_SECURITY.md) | プライバシー・セキュリティ・悪用への配慮 |
| [TEST_REPORT.md](./TEST_REPORT.md) | テストの範囲と結果 |
| [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) | 既知の制限と残存リスク |
| [ROADMAP.md](./ROADMAP.md) | 今後の検討事項 |

## ファイル構成

```
yoku/
  index.html               エントリー(本番ビルドで CSP を自動挿入)
  vite.config.ts           Vite・PWA・CSP・Vitest の設定
  playwright.config.ts     E2E(Pixel 7 相当の画面)
  public/                  アイコン
  src/
    App.tsx                画面の骨組み・ルーティング・テーマ・アプリ切替時の目隠し
    state/AppContext.tsx   実データ/デモの切り替え、設定、全削除
    db/                    型(types.ts)・Dexie(db.ts)・保存処理と検証(repo.ts)・デモデータ(demo.ts)
    lib/                   日付・入力検証・共有文の作成・画像の縮小・書き出し・ルーター
    components/            共通 UI(ボタン・フォーム・ダイアログ・タブ等)
    features/              home / wellness / intimacy / food / thanks / together / share / settings / onboarding
    test/                  テストの準備、外部通信の静的監査
  e2e/                     Playwright のテスト
```

## 公開について

### 仮公開(プレビュー)

claude.ai の非公開ページとして仮公開している(所有者と、共有された人だけが開ける)。

```bash
npm run build:preview   # dist-preview/ に出力(VITE_PREVIEW=1)
```

プレビュー版は表示先の枠の制限に合わせ、Service Worker(オフライン)・CSP の meta・共有シート・JSON の書き出しを止め、画面上部に「仮公開のプレビュー版です」と表示する。共有はコピーで行う。記録は開いたブラウザーの中だけに保存される。公開時は `dist-preview/index.html` を `<title>` からはじまる断片(doctype・head・body なし)に書き換えて載せる。

### GitHub Pages

GitHub Pages への公開は**していません**(公開デプロイは事前承認事項のため)。
現在のリポジトリの Pages ワークフローはリポジトリをそのまま公開するため、`main` に入ると `yoku/` の**ソース**が `/ikkon/yoku/` に置かれますが、ビルドしていないので画面は表示されません。公開する場合は、ワークフローに `cd yoku && npm ci && npm run build` を足し、`yoku/dist` を公開物に含める変更が必要です(KNOWN_LIMITATIONS.md)。
