import type {
  BoundaryStatus,
  FoodGenre,
  IntimacyCategory,
  IntimacyPreferenceStatus,
  WellnessScoreKey
} from "../db/types";

export interface ScoreMeta {
  key: WellnessScoreKey;
  label: string;
  low: string;
  high: string;
  /** 三大欲求か、心身の状態か(表示のまとまりだけに使う。合算はしない) */
  group: "desire" | "state";
  /** 何を答えればよいかの説明 */
  hint?: string;
  /** 数値の目安 */
  guide?: readonly { score: number; text: string }[];
}

export const SCORE_META: readonly ScoreMeta[] = [
  { key: "appetite", label: "食欲", low: "まったくない", high: "とても強い", group: "desire" },
  { key: "sleepiness", label: "眠気", low: "まったくない", high: "とても眠い", group: "desire" },
  {
    key: "sexualDesire",
    label: "性欲",
    low: "まったくムラムラしない",
    high: "したくてたまらない",
    group: "desire",
    hint: "今日、セックスやひとりエッチ(オナニー)をどれくらいしたい気分か。相手がいるかどうかは関係なく、自分の体と気持ちのムラムラ度で答えてください。",
    guide: [
      { score: 0, text: "まったくしたくない。誘われても気が乗らない" },
      { score: 3, text: "少しだけ。誘われたら考えるかも" },
      { score: 5, text: "チャンスがあればしたい" },
      { score: 7, text: "けっこうムラムラしている。自分から誘いたい" },
      { score: 10, text: "したくてたまらない。頭から離れない" }
    ]
  },
  { key: "stress", label: "ストレス", low: "まったくない", high: "とても強い", group: "state" },
  { key: "mood", label: "気分", low: "とても落ちこんでいる", high: "とても良い", group: "state" },
  { key: "fatigue", label: "疲労", low: "まったくない", high: "とても疲れている", group: "state" },
  { key: "sleepRestfulness", label: "睡眠の休息感", low: "まったく休めていない", high: "とてもよく休めた", group: "state" }
];

export const PREF_STATUS_LABEL: Record<IntimacyPreferenceStatus, string> = {
  like: "好き",
  curious: "興味がある",
  discuss: "相談してみたい",
  not_now: "今は希望しない",
  avoid: "苦手・避けたい"
};

export const PREF_STATUS_ORDER: readonly IntimacyPreferenceStatus[] = ["like", "curious", "discuss", "not_now", "avoid"];

export const BOUNDARY_STATUS_LABEL: Record<BoundaryStatus, string> = {
  yes: "これは好き",
  discuss: "これは相談したい",
  no: "これは希望しない",
  undecided: "今は決めていない"
};

export const BOUNDARY_STATUS_ORDER: readonly BoundaryStatus[] = ["yes", "discuss", "no", "undecided"];

export const CATEGORY_LABEL: Record<IntimacyCategory, string> = {
  position: "好きな体位",
  play: "好きなプレイ",
  interest: "興味があること",
  again: "また体験したいこと",
  dislike: "苦手なこと",
  avoid: "避けたいこと",
  memo: "自由記述メモ"
};

export const CATEGORY_ORDER: readonly IntimacyCategory[] = [
  "position",
  "play",
  "interest",
  "again",
  "dislike",
  "avoid",
  "memo"
];

/** 「名前」欄の入力例。何を書けばよいかが分かるよう、ぼかさずに書く */
export const CATEGORY_EXAMPLE: Record<IntimacyCategory, string> = {
  position: "例:正常位、騎乗位、バック、対面座位、寝バック",
  play: "例:キスをたくさん、前戯を長めに、乳首を責められる、クンニ・フェラ、言葉責め",
  interest: "例:おもちゃを使う、目隠し、軽く縛る、ラブホテル、一緒にお風呂でする",
  again: "例:旅行先のホテルでしたこと、朝起きてすぐする、何回も続けてする",
  dislike: "例:痛いくらい強くされる、急に挿れられる、終わってすぐ寝られる",
  avoid: "例:ゴムなしでする、写真や動画を撮る、アナル",
  memo: "例:生理前はしたくなりやすい、疲れていると濡れにくい/勃ちにくい"
};

/** カテゴリを選んだときに最初に入れておくステータス(いつでも変えられる) */
export const CATEGORY_DEFAULT_STATUS: Record<IntimacyCategory, IntimacyPreferenceStatus> = {
  position: "like",
  play: "like",
  interest: "curious",
  again: "like",
  dislike: "avoid",
  avoid: "avoid",
  memo: "discuss"
};

export const GENRE_LABEL: Record<FoodGenre, string> = {
  japanese: "和食",
  western: "洋食",
  italian: "イタリアン",
  chinese: "中華",
  asian: "アジア・エスニック",
  sweets: "スイーツ",
  cafe: "カフェ",
  homemade: "手料理",
  other: "その他"
};

export const GENRE_ORDER: readonly FoodGenre[] = [
  "japanese",
  "western",
  "italian",
  "chinese",
  "asian",
  "sweets",
  "cafe",
  "homemade",
  "other"
];

export const THANKS_TEMPLATES: readonly string[] = [
  "今日もありがとう",
  "話を聞いてくれてありがとう",
  "一緒に過ごしてくれてありがとう",
  "家事をしてくれてありがとう",
  "支えてくれてありがとう",
  "いつも気にかけてくれてありがとう"
];

/** 「今日伝えたい気持ち」。生の数値ではなく、粗い言葉で伝える(監査報告 8 の安全設計) */
export const FEELING_OPTIONS: readonly string[] = [
  "今日は元気です",
  "少し疲れています",
  "ゆっくり休みたい気分です",
  "今日は話したい気分です",
  "一緒に過ごしたい気分です",
  "今日はそっとしておいてほしいです",
  "甘えたい気分です",
  "ひとりの時間がほしいです"
];

export interface Topic {
  id: string;
  text: string;
  intimacy?: boolean;
}

export const TOPICS: readonly Topic[] = [
  { id: "t1", text: "最近うれしかったことは何？" },
  { id: "t2", text: "次の休みに、ふたりでしてみたいことは？" },
  { id: "t3", text: "最近おいしかったもの、また食べたいものは？" },
  { id: "t4", text: "疲れているとき、どうしてもらえるとうれしい？" },
  { id: "t5", text: "これからも続けたい、ふたりの習慣は？" },
  { id: "t6", text: "最近、ありがとうと思ったことは？" },
  { id: "t7", text: "いつか一緒に行ってみたい場所は？" },
  { id: "t8", text: "心地よいと感じることを、少しずつ話してみない？", intimacy: true },
  { id: "t9", text: "気が乗らない日の伝え方を、ふたりで決めておかない？", intimacy: true }
];
