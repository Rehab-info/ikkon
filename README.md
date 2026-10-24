# 一献 — 日本酒案内

全国の名酒を、味わい・料理・飲み方・価格帯から探せる静的サイトです。GitHub Pages でそのまま公開できます。

## ファイル構成

```
index.html        銘柄を探す(味わいマップ・絞り込み・詳細)
guide.html        飲み方ガイド(4タイプ・温度帯・料理・買い方)
data/sakes.json   銘柄データ(ここを編集して銘柄を追加)
assets/style.css  デザイン
assets/app.js     絞り込みとマップの処理
kura.html         宮城の蔵(data/kura.json から自動生成)
miyagi.html       宮城で飲める・買える店
data/kura.json    宮城の蔵元24蔵のデータ
tools/build_kura.py  kura.html を作り直すスクリプト
data/columns.json コラム「呑助のこの一杯！」(連載と記事)のデータ
column/           コラムのページ(data/columns.json から自動生成)
tools/build_columns.py  コラムのページを作り直すスクリプト
data/reviews.json 掲載するレビューとフォームの設定
tools/import_reviews.py  フォームの回答からレビューを取り込むスクリプト
images/           銘柄の写真(自分で撮影したもの・許可を得たもの)
.nojekyll         GitHub Pages の Jekyll 処理を無効化
```

## GitHub Pages で公開する

1. GitHub で新しいリポジトリを作成(例:`ikkon`)
2. このフォルダの中身をすべてアップロード(「Add file → Upload files」でドラッグ&ドロップ可)
3. リポジトリの Settings → Pages → Source を「Deploy from a branch」、Branch を `main` / `(root)` にして Save
4. 数分後に `https://<ユーザー名>.github.io/ikkon/` で公開されます

## 銘柄を追加する

`data/sakes.json` に1件追加するだけで、マップ・一覧・絞り込みに自動で反映されます。

```json
{
  "id": "urakasumi",            // 英数字の一意なID(URLの #id にも使われます)
  "name": "浦霞 禅 純米吟醸",
  "kana": "うらかすみ",
  "spec": "純米吟醸",
  "brewery": "佐浦",
  "pref": "宮城",
  "region": "東北",             // 東北 / 関東 / 新潟・北陸 / 東海 / 近畿 / 中国・四国 / 九州(ほかを足す場合は app.js の order にも追加)
  "type": "kun",                // kun=薫酒 sou=爽酒 jun=醇酒 juku=熟酒
  "sweet": 0.4,                 // -2(甘口)〜 +2(辛口)
  "body": -0.3,                 // -2(淡麗)〜 +2(濃醇)
  "price": "mid",               // low=〜2,000円 mid=2,000〜4,000円 high=4,000円〜(四合瓶・2026年の目安)
  "buy": "shop",                // wide=スーパーでも shop=酒販店・通販 tokuyaku=特約店のみ
  "temps": ["花冷え", "涼冷え", "常温"],  // 雪冷え 花冷え 涼冷え 常温 ぬる燗 上燗 熱燗
  "best": "涼冷え",             // temps の中で一番のおすすめ
  "pairing": ["牡蠣", "白身の刺身", "茶碗蒸し"],
  "note": "味わいの紹介文",
  "buyNote": "買い方のメモ",
  "photo": "images/urakasumi.jpg",  // 任意。ない場合は瓶のイラストを表示
  "oneliner": "10秒で読める一言紹介",
  "story": "蔵の物語(1〜2文)",
  "rice": "山田錦",                // 任意。確認できたときだけ
  "url": "https://..."           // 任意。蔵元の公式サイト
}
```

※ JSON にはコメントを書けないので、実際に追加するときは `//` 以降を消してください。

## 手元で確認する

`fetch` でデータを読み込むため、ファイルを直接ダブルクリックするとデータが表示されません。フォルダ内で次を実行してブラウザで開いてください。

```
python3 -m http.server 8000
# → http://localhost:8000
```

## 注意

- 甘辛・淡麗濃醇の位置づけや味わいの説明は、一般的な評判をもとにした目安です。ご自身で飲んだ感想に合わせて調整してください。
- 価格は定価ベースの目安です。年に一度くらい見直すと安心です。

## 宮城の蔵を更新する

`data/kura.json` を編集してから、次を実行すると `kura.html` が作り直されます。

```
python3 tools/build_kura.py
```

## デザインや動きを直したとき

`assets/style.css` や `assets/app.js` を直したら、次を実行してください。各ページの `?v=` の番号がまとめて上がり、閲覧者のブラウザに古いファイルが残らなくなります(`kura.html` も作り直されます)。

```
python3 tools/bump_version.py
```

## コラムを追加する

`data/columns.json` の連載(series)の `entries` に1件追加します。GitHub に上げると、公開のときに自動でページが作り直されます。

- `"draft": true` を付けると下書き扱いになり、公開ページには出ません。
- 手元で下書きも含めて確認するときは `python3 tools/build_columns.py --drafts`、公開用に戻すときは `python3 tools/build_columns.py` を実行します。
- 読者の投稿を受け付けるときは、投稿フォーム(Googleフォームなど)のURLを `submitUrl` に入れると「投稿する」ボタンが出ます。

## 銘柄のレビュー

各銘柄の詳細に「みんなのレビュー」が出ます。レビューは Google フォームで受け付け、スタッフが確認したものだけを載せます(荒らしや不適切な投稿は載りません)。フォームの設定とレビューが1件もないあいだは、この欄は表示されません。

### 1. フォームを作る(最初の1回だけ)

Google フォームで、次の質問をこの名前で作ります。

| 質問 | 種類 |
|---|---|
| 銘柄 | 記述式(必須) |
| 評価 | 均等目盛 1〜5(必須) |
| ニックネーム | 記述式(空なら「匿名」と表示) |
| レビュー | 段落(必須) |
| 20歳以上です | チェックボックス(必須) |

フォームの説明文に「いただいたレビューは、スタッフが確認してから掲載します」と書いておくと安心です。

### 2. フォームをサイトにつなぐ

フォームの「︙ → 事前入力したリンクを取得」で「銘柄」に適当な文字を入れて「リンクを取得」し、コピーしたリンクから次の2つを `data/reviews.json` の `form` に書きます。

- `url`: `https://docs.google.com/forms/d/e/.../viewform` の部分
- `sakeEntry`: 銘柄の欄の `entry.123456789` の部分

これで「レビューを書く」ボタンが出て、押すと銘柄名が入った状態でフォームが開きます。

### 3. レビューを載せる

1. 回答のスプレッドシートに「掲載」という列を足し、載せる行に ○ をつける
2. 「ファイル → ダウンロード → カンマ区切り形式(.csv)」で保存する
3. 次を実行する

```
python3 tools/import_reviews.py ダウンロードした.csv
```

毎回 CSV の内容で作り直すので、載せるのをやめるときは ○ を消して実行し直します。銘柄名や評価がおかしい行があると、何行目の何がおかしいかを表示して止まります。

## さかづき帳 by 一献(β版アプリ)

`sakazuki/` は、飲んだ日本酒を記録するアプリ「さかづき帳 by 一献」です。公開すると `https://rehab-info.github.io/ikkon/sakazuki/` で開けます。

- iPhone では Safari で開き、共有ボタン →「ホーム画面に追加」でアプリとして使えます(電波がなくても開けます)。
- 記録はその端末の中に保存されます。機種変更のときは「制覇マップ」の下の「書き出す」でファイルに残し、新しい端末で「読み込む」を使います。
- `sakazuki/index.html` を直したら、`sakazuki/sw.js` の `VERSION` の番号を上げてください(古い版が残らなくなります)。

## 楽天アフィリエイト(いまは止めています)

銘柄の詳細に「楽天市場で探す」ボタンと、楽天市場の商品写真・価格を出す仕組みがあります。いまは表示も、楽天からの取得も止めています。

再開するときは、次の3つを行います。

1. `assets/app.js` の `RAKUTEN_ON` を `true` にする
2. `.github/workflows/pages.yml` の「Fetch Rakuten items」の行の先頭の `# ` を外す(週1回取り直すなら `schedule` も足す)
3. 各ページのフッターに「当サイトは楽天アフィリエイトなどの広告を利用しています。」の表示を戻す(ステマ規制への対応。`index.html`・`guide.html`・`miyagi.html`・`tools/build_kura.py`・`tools/build_columns.py`)

- アフィリエイトIDは `assets/app.js` の `RAKUTEN_AFF` に、楽天のアプリIDとアクセスキーはリポジトリの Settings → Secrets(`RAKUTEN_APP_ID`・`RAKUTEN_ACCESS_KEY`)に残してあります。
- 銘柄名で検索すると関係のない商品が多く出る場合は、`data/sakes.json` の銘柄に `"rakutenQuery": "浦霞 禅"` のように検索の言葉を足します。
