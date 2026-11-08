# YOKU データモデル

型の定義:`src/db/types.ts` / データベース:`src/db/db.ts` / 保存と検証:`src/db/repo.ts`

## データベース

IndexedDB(Dexie 4)。**実データとデモデータは別のデータベース**に置く。

| モード | データベース名 | 備考 |
|---|---|---|
| 実データ | `yoku` | 端末のブラウザーの中だけ |
| デモ | `yoku-demo` | デモ開始のたびに作り直し、デモ終了で削除 |

現在のモードは `localStorage` の `yoku.mode`(値は `demo` のときだけ存在)。個人の記録は localStorage に置かない。

## テーブル(Dexie スキーマ version 1)

| テーブル | 主キー・索引 | 内容 |
|---|---|---|
| wellness | `id, &date` | 1日1件(date が一意) |
| intimacyPreferences | `id, category, status, updatedAt` | 好み |
| intimacyMemories | `id, date, createdAt` | 良かった体験 |
| intimacyBoundaries | `id, status, updatedAt` | 希望・境界線 |
| foods | `id, date, genre` | 食事の記録 |
| photos | `id` | 料理の写真(Blob) |
| gratitude | `id, date` | 感謝 |
| settings | `key` | `{ key: "settings", value: Settings }` |
| meta | `key` | `schemaVersion`、デモの印 `isDemo` |

4領域は互いを参照しない(Food → photos だけ参照あり)。

## 型(要約)

```ts
type ISODate = string;     // "YYYY-MM-DD"(端末のローカル日付)
type ISODateTime = string; // ISO 8601(UTC, toISOString)

interface WellnessEntry {
  id; date: ISODate;
  appetite?; sleepiness?; sexualDesire?; stress?; mood?; fatigue?; sleepRestfulness?; // 0〜10 の整数
  sleepHours?;  // 0〜24、0.25 刻み
  createdAt; updatedAt;
}

type IntimacyPreferenceStatus = "like" | "curious" | "discuss" | "not_now" | "avoid";
type IntimacyCategory = "position" | "play" | "interest" | "again" | "dislike" | "avoid" | "memo";
interface IntimacyPreference { id; title; category; status; tags: string[]; notes?; createdAt; updatedAt }
interface IntimacyMemory { id; date?; title; positiveExperience?; feelings?; wouldLikeAgain?; notes?; createdAt; updatedAt }
type BoundaryStatus = "yes" | "discuss" | "no" | "undecided";
interface IntimacyBoundary { id; title; status; notes?; createdAt; updatedAt }

type FoodGenre = "japanese" | "western" | "italian" | "chinese" | "asian" | "sweets" | "cafe" | "homemade" | "other";
interface FoodMemory {
  id; date; dishName; genre; restaurantName?; location?; photoId?; highlights?;
  wantAgain?: true; favorite?: true; companion?; notes?; createdAt; updatedAt;
}
interface StoredPhoto { id; blob: Blob; type; size; width; height; createdAt }

interface GratitudeEntry { id; date; recipient?; reason; feeling?; message?; shared?: true; createdAt; updatedAt }
```

指示書の例からの変更:

- `IntimacyPreference` に `tags`(指示書 5-3 A「タグを追加できる」)
- `IntimacyMemory`・`GratitudeEntry` に `createdAt / updatedAt`、`GratitudeEntry` に `feeling`(そのときの気持ち)
- `FoodMemory` に `genre`(ジャンル別フィルター)・`favorite`・`companion`(誰と食べたか)
- `IntimacyBoundary` を独立したテーブルに(境界線は好みとは別の4段階)
- 体験・相手を評価する数値の項目は**どの型にもない**

## 一時的な型(保存しない)

「もう一度お願いしたい」の下書き(`src/lib/request.ts`)。画面の状態としてだけ持ち、IndexedDB には書かない。

```ts
type RequestTone = "gentle" | "shy" | "discuss" | "simple";
interface IntimacyRequestDraft {
  preferenceId?: string;  // どちらか一方
  memoryId?: string;
  playTitle: string;      // 〇〇 に入る呼び方(本人が編集可・80字まで・1行)
  tone: RequestTone;
  message: string;        // 送る文章(本人が編集可)
}
```

スキーマの変更はない(version 1 のまま)。

## 欠測値

- **未回答はキーを持たない**(`undefined` を保存しない。`compact()` で取り除く)。`0` は有効な回答として保存する。
- Wellness の全項目が未回答の状態で保存すると、その日の記録自体を削除する(空の記録を残さない)。
- グラフは未回答の日を `null` とし、線をつながない(`connectNulls={false}`)。回答日数・未回答日数を併記。
- 平均は回答があった日だけで計算し、回答がなければ表示しない。
- 合算・総合スコアは作らない。

## 入力値の検証(`src/lib/validate.ts`)

| 項目 | 規則 |
|---|---|
| スコア | 0〜10 の整数に丸める。範囲外・数値以外は未回答 |
| 睡眠時間 | 0〜24、0.25 刻み |
| 日付 | 実在する `YYYY-MM-DD` のみ(2/30 などは拒否)。Wellness は未来日を拒否 |
| 文字列 | 前後の空白と制御文字(改行・タブ以外)を除去。名前 80字、短文 60字、自由記述 2000字。空文字は未入力 |
| タグ | 20字以内・重複除去・最大10個 |
| 列挙値 | 分類・ステータス・ジャンルは定義済みの値だけ(不明なジャンルは `other`) |

検証に失敗すると `ValidationError`(項目ごとのメッセージ)を投げ、画面は該当欄にエラーを表示する。

## 自由記述の安全性

HTML やスクリプトを入力しても**文字列としてそのまま保存**し、表示は React のテキストとして描画するため実行されない。`dangerouslySetInnerHTML`・`innerHTML`・`eval` はコードに存在しない(静的テストで確認)。

## 日時の扱い

- 記録の「日付」は端末のローカルタイムゾーンでの `YYYY-MM-DD`。`new Date("YYYY-MM-DD")`(UTC 解釈)は使わず、`parseISODate()` でローカル日付として扱う。
- 作成・更新日時は UTC の ISO 8601。
- タイムゾーンをまたいで移動すると「今日」が端末の時刻に従って変わる(KNOWN_LIMITATIONS.md)。

## 写真

- 取りこみ時に canvas で描き直して JPEG(品質 0.82)にする。長辺 1600px まで縮小。1.5MB を超える場合はさらに縮小・品質を下げて最大5回試す。
- 再エンコードにより EXIF(GPS・機種・撮影日時など)は保存されない(E2E で確認)。向きは `imageOrientation: "from-image"` で見た目に反映してから捨てる。
- 上限:元画像 25MB、1枚 1.5MB、合計 150MB。
- 記録の削除・写真の差し替え・写真を外すと、写真も削除。どの記録からも参照されない写真は Food 画面を開いたときに掃除する。

## データ移行

- Dexie のスキーマ版は `version(1)`。`meta.schemaVersion` に 1 を保存。
- 変更するときは `this.version(2).stores({...}).upgrade(tx => ...)` を**追記**する(version(1) は消さない)。古いデータは開いたときに自動で移行される。
- 任意項目の追加は、キーが無い=未回答の扱いなので移行不要。
- 列挙値を変えるときは upgrade で古い値を新しい値に置き換える。
- 書き出しファイルは `formatVersion: 1` と `schemaVersion` を持つ(将来の読みこみ機能のため)。

## 書き出し形式

```json
{
  "app": "YOKU",
  "formatVersion": 1,
  "schemaVersion": 1,
  "exportedAt": "2026-11-08T00:00:00.000Z",
  "notice": "…暗号化されていません…",
  "settings": { … },
  "data": {
    "wellness": [ … ], "intimacyPreferences": [ … ], "intimacyMemories": [ … ],
    "intimacyBoundaries": [ … ], "foods": [ … ], "gratitude": [ … ],
    "photos": [ { "id": "…", "type": "image/jpeg", "size": 123, "width": 1600, "height": 1200, "createdAt": "…", "dataUrl": "data:image/jpeg;base64,…" } ]
  }
}
```

読みこみ(インポート)はベータでは未実装。

## 削除

| 操作 | 範囲 |
|---|---|
| 記録ごとの削除 | その記録(Food は写真も) |
| Intimacy を非表示 | 表示だけ。**データは消さない** |
| すべての記録を削除 | `yoku` と `yoku-demo` のデータベースを削除、localStorage / sessionStorage を消去。Service Worker のアプリ本体のキャッシュ(個人データを含まない)は残す |
