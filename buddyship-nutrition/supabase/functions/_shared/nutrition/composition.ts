// 自動生成(scripts/sync-nutrition.mjs)。packages/nutrition/src から写したもの。ここを直接編集しない
/**
 * 料理の構成食材と食品コードの対応付け(D-19)。
 *
 * Phase 1 では独自の料理マスターを作らない。複合料理は AI が構成食材の候補を出し、
 * 日本食品標準成分表の食品コードに対応付ける。食材の種類・重量・調理油・調味料は利用者またはスタッフが確認・修正する。
 * 食品コードを確実に対応付けられないときは、無理に確定せず「要確認」にする。
 */
import { sumNutrients, type DisplayPrecision, type ItemNutrients, type Totals } from './calc.ts';
import {
  ESTIMATE_NOTE,
  MEAL_ESTIMATE_LABEL,
  SUBTOTAL_LABEL,
  UNCONFIRMED_NOTE,
  scopeOf,
  type TotalScope,
} from './labels.ts';

/** 明細の役割:単品の食品 / 料理の構成食材 / 調理油 / 調味料 */
export type ComponentRole = 'food' | 'ingredient' | 'cooking_oil' | 'seasoning';

/** 食品コードの対応付けの状態 */
export type MatchStatus = 'confirmed' | 'needs_review';

/** 成分表の食品候補(照合結果) */
export interface FoodCandidate {
  foodCode: string;
  /** AI のラベルが、成分表の食品名またはアプリの別名辞書と完全に一致したか */
  exactMatch: boolean;
}

/**
 * AI の候補から、最初の対応付けの状態を決める(Sprint 3 で変更)。
 * **AI が生成した食品候補は自動的に確定しない**。AI 由来の明細は必ず「要確認」から始まり、
 * 利用者またはスタッフが画面で選んだ(または「これで合っている」を押した)ときにだけ確定する。
 */
export function initialMatchStatus(): MatchStatus {
  return 'needs_review';
}

/** 候補を見せる強さ。suggested は画面で先頭に「AI の候補」として示す(確定はしない) */
export type SuggestionStrength = 'suggested' | 'ambiguous' | 'none';

/**
 * 画面で先頭に示す候補(確定はしない)。
 * 候補がちょうど 1 つで名前が完全一致し、AI の確からしさが低くないときだけ「AI の候補」として示す。
 * それ以外(候補なし・複数・あいまい一致・確からしさ低)は、候補を並べて選んでもらう。
 */
export function suggestionOf<T extends FoodCandidate>(
  candidates: readonly T[],
  aiConfidence: 'low' | 'medium' | 'high',
): { strength: SuggestionStrength; suggested: T | null } {
  if (candidates.length === 0) return { strength: 'none', suggested: null };
  const exact = candidates.filter((c) => c.exactMatch);
  if (aiConfidence !== 'low' && candidates.length === 1 && exact.length === 1) {
    return { strength: 'suggested', suggested: exact[0] ?? null };
  }
  return { strength: 'ambiguous', suggested: null };
}

export interface MealLine {
  role: ComponentRole;
  matchStatus: MatchStatus;
  /** 確定した食品の成分量。要確認の明細は null(合計に入れない) */
  nutrients: ItemNutrients | null;
  /** 料理の構成食材の場合、その料理(同じ料理の明細で共通) */
  dish?: {
    groupId: string;
    label: string;
    /** 構成食材がわかっているか(利用者が「中身はわからない」と答えた、AI が分解できなかった等は false) */
    compositionKnown: boolean;
  };
}

export type ApproximateReason = 'needs_review' | 'unknown_composition';

export interface MealSummary {
  /** 確定した明細だけの合計 */
  totals: Totals;
  /** すべて確認済みの推定摂取量か、確認済み食品のみの小計か */
  scope: TotalScope;
  /** 精密な値として見せてよいか */
  precision: DisplayPrecision;
  reasons: ApproximateReason[];
  /** 要確認の明細の数(合計に入っていない) */
  needsReviewCount: number;
}

export const APPROXIMATE_REASON_TEXT: Record<ApproximateReason, string> = {
  needs_review: '確認が済んでいない食品があり、その分は小計に入っていません。',
  unknown_composition: '料理の中身(材料や量)がはっきりしないため、おおよその値です。',
};

/**
 * 食事の集計。
 *  - 要確認の明細は合計に入れない。要確認が 1 つでもあれば scope = confirmed_only_subtotal(「確認済み食品のみの小計」)
 *  - 構成食材が不明な料理を含めば、表示を「おおよそ」(approximate)にする(追加要件 4)
 */
export function summarizeMeal(lines: readonly MealLine[]): MealSummary {
  const confirmed = lines.filter((l) => l.matchStatus === 'confirmed' && l.nutrients !== null);
  const needsReviewCount = lines.filter((l) => l.matchStatus === 'needs_review').length;
  const reasons: ApproximateReason[] = [];
  if (needsReviewCount > 0) reasons.push('needs_review');
  if (lines.some((l) => l.dish && !l.dish.compositionKnown)) reasons.push('unknown_composition');
  return {
    totals: sumNutrients(confirmed.map((l) => l.nutrients as ItemNutrients)),
    scope: scopeOf(needsReviewCount),
    precision: reasons.includes('unknown_composition') ? 'approximate' : 'normal',
    reasons,
    needsReviewCount,
  };
}

/**
 * 食事 1 回分の見出しと注記。要確認の食品があれば、確定済み食品の数値を食事全体の推定摂取量として見せない。
 */
export function mealTotalHeading(summary: Pick<MealSummary, 'scope' | 'needsReviewCount' | 'reasons'>): {
  heading: string;
  notes: string[];
} {
  const notes: string[] = [];
  if (summary.scope === 'confirmed_only_subtotal')
    notes.push(`${UNCONFIRMED_NOTE}(未確認 ${summary.needsReviewCount} 品)`);
  if (summary.reasons.includes('unknown_composition')) notes.push(APPROXIMATE_REASON_TEXT.unknown_composition);
  notes.push(ESTIMATE_NOTE);
  return { heading: summary.scope === 'confirmed_only_subtotal' ? SUBTOTAL_LABEL : MEAL_ESTIMATE_LABEL, notes };
}
