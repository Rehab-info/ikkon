# YOKU デザインシステム

キーワード:Premium / Minimal / Warm / Intimate / Calm / Trustworthy

性的な機能を刺激的・露骨に見せない。4領域を同じ丁寧さで扱い、色とアイコンで静かに区別する。

## 色

トークンは `src/index.css` の CSS 変数で定義し、`.dark` で差し替える。Tailwind からは `bg-primary` `text-ink` などで使う。

| トークン | ライト | ダーク | 用途 |
|---|---|---|---|
| primary | #486A64 | #8FB8AE | 主要ボタン、選択状態、グラフ |
| primary-soft | #E3ECE9 | #23332F | 選択中の背景、Wellness |
| bg | #FAF9F6 | #121816 | 画面の背景 |
| surface | #FFFFFF | #1B2321 | カード |
| ink(text) | #273330 | #E8ECE9 | 本文 |
| muted | #5C6763 | #A6B1AD | 補足文 |
| accent | #C88F91 | #E0A9AB | Intimacy の装飾(アイコン・ハート) |
| accent-text | #87494C | #EBBBBD | accent 系の**文字**(#C88F91 は文字には使わない) |
| food / thanks | #B98A4E / #8A7A52 | #E0B67C / #D6C58F | 領域アイコン |
| danger | #A8443F | #F09A94 | 削除 |

### コントラスト(WCAG 2.2 AA:通常文字 4.5:1 以上)

| 組み合わせ | 比 |
|---|---|
| 本文 #273330 / 背景 #FAF9F6 | 12.45:1 |
| 補足 #5C6763 / 背景 #FAF9F6 | 5.58:1 |
| primary #486A64 / 背景 #FAF9F6 | 5.66:1 |
| 白 / primary #486A64(ボタン) | 5.96:1 |
| accent-text #87494C / accent-soft #F6E9E9 | 5.75:1 |
| accent #C88F91 / 白 | 2.69:1 → **装飾専用**(文字に使わない) |
| [ダーク] 本文 / 背景 | 15.07:1 |
| [ダーク] 補足 / カード | 7.27:1 |
| [ダーク] ボタン文字 #10201C / primary | 7.74:1 |

当初の accent-text #9A5C5F は axe で 4.36:1 と検出されたため #87494C に修正した(TEST_REPORT.md)。

## 文字

- 本文:ヒラギノ角ゴ / Noto Sans JP / 游ゴシック UI(端末の書体。Web フォントは読みこまない=外部通信なし)
- ブランド・あいさつ:ヒラギノ明朝 / Noto Serif JP / 游明朝(`font-brand` は字間 0.18em)
- 本文 16px 相当、行間 1.7、`palt` で約物を詰める
- 入力欄は 16px 以上(iOS の自動ズームを防ぐ)

## 形・余白

- カード:角丸 20px(`--radius-card`)、1px の線、ごく弱い影
- ボタン:丸型(pill)。高さ 48px(小 40px)
- タップ領域:最小 44×44px(0〜10 の選択肢は 1 マス約 30×40px で、WCAG 2.2 の 24×24px を満たす)
- 画面の左右余白 16px、最大幅 576px(スマートフォン優先、PC では中央寄せ)

## アイコン

Lucide React(線幅 1.7〜2.2)。領域ごとに固定:

| 領域 | アイコン | 色 |
|---|---|---|
| Wellness(からだと心) | Leaf | primary |
| Intimacy(親密さと好み) | Heart | accent |
| Food(おいしい記憶) | Utensils | food |
| Thanks(ありがとう) | HandHeart | thanks |
| Together(ふたりへ) | Users | primary |

ロゴは重なる2つの円(自分と相手)。

## 部品(`src/components/ui.tsx`)

| 部品 | 要点 |
|---|---|
| Page | 見出し(画面遷移時にフォーカス)、戻る、右上のアクション |
| Card / Section | セクションは見出しと `aria-labelledby` で結ぶ |
| Button / IconButton | IconButton は必ず `aria-label` |
| TextField / TextArea / Select | ラベル・任意表示・ヒント・エラー(`aria-invalid`・`aria-describedby`・`role="alert"`) |
| ChoiceGroup | ラジオを丸いチップに。fieldset + legend |
| ScoreInput | 0〜10 の 11 択。未選択=未回答、「クリア」で未回答に戻す |
| Toggle | `role="switch"` + `aria-checked` |
| Tabs | WAI-ARIA タブ(矢印・Home・End キー) |
| Dialog | `aria-modal`、フォーカストラップ、Esc で閉じる、閉じたら元の場所へフォーカスを戻す |
| SensitiveText | ぼかし中は内容を `aria-hidden` にし、「内容を表示」ボタンだけを読み上げる |
| Toast | `role="status"` + `aria-live="polite"` |

## アクセシビリティ

- WCAG 2.2 A/AA を目標に、axe-core で主要13画面をライト・ダーク両方で自動検査(違反0)
- キーボード操作:本文へ移動リンク、見えるフォーカス枠(3px)、タブの矢印操作、ダイアログのフォーカストラップ
- スクリーンリーダー:グラフは `role="img"` と要約文、「表で見る」で数値表を表示
- `prefers-reduced-motion` で動きを止める
- 色だけに頼らない(ステータスは必ず文字で表示)

## 文言の原則

- 性欲・Intimacy の入力欄は、何を書けばよいか分かるようにぼかさない:Wellness の「性欲」は「ムラムラ度」を 0〜10 の目安つきで聞き、Intimacy の名前欄には「正常位」「前戯を長めに」のような具体例を出す(利用者のフィードバックで変更)。画面の見た目(色・画像・演出)は引き続き落ち着いたものにする

- 採点しない:「スコア」「点数」「達成」「連続○日」を使わない
- 責めない:未送信の感謝を「未送信」と呼ばず、「伝えたいこと」と呼ぶ
- 断定しない:記録の変化は「関連」「目安」
- 同意:Intimacy では「今の気持ち」「いつでも変えてよい」「その場で断ってよい」を繰り返し伝える
