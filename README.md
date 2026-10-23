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
