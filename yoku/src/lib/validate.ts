import { isISODate } from "./date";
import type {
  BoundaryStatus,
  FoodGenre,
  IntimacyCategory,
  IntimacyPreferenceStatus,
  WellnessScoreKey
} from "../db/types";
import { WELLNESS_SCORE_KEYS } from "../db/types";

export const LIMITS = {
  title: 80,
  short: 60,
  text: 2000,
  tag: 20,
  tags: 10
} as const;

export type FieldErrors = Record<string, string>;

/** 文字列を整える。空なら undefined(=未入力)。制御文字を除き、長さを制限する */
export function cleanText(value: unknown, max: number = LIMITS.text): string | undefined {
  if (typeof value !== "string") return undefined;
  // 改行とタブ以外の制御文字を除く
  // eslint-disable-next-line no-control-regex
  const stripped = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (stripped === "") return undefined;
  return stripped.slice(0, max);
}

export function requireText(
  errors: FieldErrors,
  field: string,
  value: unknown,
  label: string,
  max: number = LIMITS.title
): string {
  const v = cleanText(value, max);
  if (!v) errors[field] = `${label}を入力してください`;
  return v ?? "";
}

/** 0〜10 の整数。空・範囲外・数値でないものは undefined(未回答) */
export function cleanScore(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  const r = Math.round(n);
  if (r < 0 || r > 10) return undefined;
  return r;
}

/** 睡眠時間 0〜24 時間、0.25 刻みに丸める */
export function cleanSleepHours(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 24) return undefined;
  return Math.round(n * 4) / 4;
}

export function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const raw of value) {
    const t = cleanText(raw, LIMITS.tag)?.replace(/\s+/g, " ");
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= LIMITS.tags) break;
  }
  return out;
}

export function cleanDate(value: unknown): string | undefined {
  return isISODate(value) ? value : undefined;
}

const PREF_STATUS: readonly IntimacyPreferenceStatus[] = ["like", "curious", "discuss", "not_now", "avoid"];
const BOUNDARY_STATUS: readonly BoundaryStatus[] = ["yes", "discuss", "no", "undecided"];
const CATEGORIES: readonly IntimacyCategory[] = ["position", "play", "interest", "again", "dislike", "avoid", "memo"];
const GENRES: readonly FoodGenre[] = [
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

export const isPrefStatus = (v: unknown): v is IntimacyPreferenceStatus =>
  typeof v === "string" && (PREF_STATUS as readonly string[]).includes(v);
export const isBoundaryStatus = (v: unknown): v is BoundaryStatus =>
  typeof v === "string" && (BOUNDARY_STATUS as readonly string[]).includes(v);
export const isCategory = (v: unknown): v is IntimacyCategory =>
  typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
export const isGenre = (v: unknown): v is FoodGenre =>
  typeof v === "string" && (GENRES as readonly string[]).includes(v);

export function cleanWellnessScores(input: Partial<Record<WellnessScoreKey, unknown>>) {
  const out: Partial<Record<WellnessScoreKey, number>> = {};
  for (const k of WELLNESS_SCORE_KEYS) {
    const v = cleanScore(input[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** undefined のキーを取り除く(IndexedDB に「未回答」をキーの不在として保存するため) */
export function compact<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as T;
}
