/**
 * YOKU のデータモデル。4領域(Wellness / Intimacy / Food / Thanks)は互いに独立したテーブルに置く。
 * 任意項目は「キーが無い(undefined)」を未回答とし、0 と区別する。
 */

export type ISODate = string; // "YYYY-MM-DD"(端末のローカル日付)
export type ISODateTime = string; // new Date().toISOString()

/* ---------- Wellness ---------- */

export const WELLNESS_SCORE_KEYS = [
  "appetite",
  "sleepiness",
  "sexualDesire",
  "stress",
  "mood",
  "fatigue",
  "sleepRestfulness"
] as const;
export type WellnessScoreKey = (typeof WELLNESS_SCORE_KEYS)[number];

export interface WellnessEntry {
  id: string;
  date: ISODate;
  /** 0〜10 の主観評価。未回答はキー自体を持たない */
  appetite?: number;
  sleepiness?: number;
  sexualDesire?: number;
  stress?: number;
  mood?: number;
  fatigue?: number;
  sleepRestfulness?: number;
  /** 睡眠時間(時間)。0〜24 */
  sleepHours?: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/* ---------- Intimacy ---------- */

export type IntimacyPreferenceStatus = "like" | "curious" | "discuss" | "not_now" | "avoid";

export type IntimacyCategory =
  | "position"
  | "play"
  | "interest"
  | "again"
  | "dislike"
  | "avoid"
  | "memo";

export interface IntimacyPreference {
  id: string;
  title: string;
  category: IntimacyCategory;
  status: IntimacyPreferenceStatus;
  tags: string[];
  notes?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface IntimacyMemory {
  id: string;
  date?: ISODate;
  title: string;
  positiveExperience?: string;
  feelings?: string;
  wouldLikeAgain?: string;
  notes?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type BoundaryStatus = "yes" | "discuss" | "no" | "undecided";

export interface IntimacyBoundary {
  id: string;
  title: string;
  status: BoundaryStatus;
  notes?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/* ---------- Food ---------- */

export type FoodGenre =
  | "japanese"
  | "western"
  | "italian"
  | "chinese"
  | "asian"
  | "sweets"
  | "cafe"
  | "homemade"
  | "other";

export interface FoodMemory {
  id: string;
  date: ISODate;
  dishName: string;
  genre: FoodGenre;
  restaurantName?: string;
  location?: string;
  photoId?: string;
  highlights?: string;
  wantAgain?: boolean;
  favorite?: boolean;
  companion?: string;
  notes?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface StoredPhoto {
  id: string;
  /** 端末内で再エンコード済み(EXIF などのメタデータを含まない)の画像 */
  blob: Blob;
  type: string;
  size: number;
  width: number;
  height: number;
  createdAt: ISODateTime;
}

/* ---------- Thanks ---------- */

export interface GratitudeEntry {
  id: string;
  date: ISODate;
  recipient?: string;
  reason: string;
  feeling?: string;
  message?: string;
  /** 本人が任意で付ける「伝えた」印。アプリが自動で変えることはない */
  shared?: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/* ---------- Settings ---------- */

export type ThemePreference = "system" | "light" | "dark";

export interface Settings {
  adultConfirmed: boolean;
  showSexualDesire: boolean;
  showIntimacy: boolean;
  /** 一覧で Intimacy の内容をぼかし、タップで表示する */
  sensitiveBlur: boolean;
  /** アプリが背面に回ったとき画面を覆い、アプリ切替画面に内容を残さない */
  privacyScreen: boolean;
  theme: ThemePreference;
}

export const DEFAULT_SETTINGS: Settings = {
  adultConfirmed: false,
  showSexualDesire: true,
  showIntimacy: true,
  sensitiveBlur: true,
  privacyScreen: true,
  theme: "system"
};

export interface SettingRow {
  key: "settings";
  value: Settings;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export type DataMode = "real" | "demo";
