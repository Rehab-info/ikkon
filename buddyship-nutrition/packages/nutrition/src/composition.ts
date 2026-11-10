/**
 * 料理の構成食材と食品コードの対応付け(D-19)。
 *
 * Phase 1 では独自の料理マスターを作らない。複合料理は AI が構成食材の候補を出し、
 * 日本食品標準成分表の食品コードに対応付ける。食材の種類・重量・調理油・調味料は利用者またはスタッフが確認・修正する。
 * 食品コードを確実に対応付けられないときは、無理に確定せず「要確認」にする。
 */
import { sumNutrients, type DisplayPrecision, type ItemNutrients, type Totals } from './calc.ts';

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
 * AI の候補から、最初の対応付けの状態を決める。
 * 確定してよいのは「候補がちょうど 1 つで、名前が完全一致し、AI の確からしさが低くない」ときだけ。
 * それ以外(候補なし・複数・あいまい一致・確からしさ低)は要確認。
 * 確定した場合も、利用者・スタッフが画面で確認・修正できる。
 */
export function initialMatchStatus(
  candidates: readonly FoodCandidate[],
  aiConfidence: 'low' | 'medium' | 'high',
): MatchStatus {
  const exact = candidates.filter((c) => c.exactMatch);
  if (aiConfidence === 'low') return 'needs_review';
  if (candidates.length !== 1 || exact.length !== 1) return 'needs_review';
  return 'confirmed';
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
  totals: Totals;
  /** 精密な値として見せてよいか */
  precision: DisplayPrecision;
  reasons: ApproximateReason[];
  /** 要確認の明細の数(合計に入っていない) */
  needsReviewCount: number;
}

export const APPROXIMATE_REASON_TEXT: Record<ApproximateReason, string> = {
  needs_review: '確認が済んでいない食品があり、その分は合計に入っていません。',
  unknown_composition: '料理の中身(材料や量)がはっきりしないため、おおよその値です。',
};

/**
 * 食事の集計。要確認の明細は合計に入れず、構成食材が不明な料理や要確認の明細があれば
 * 表示を「おおよそ」(approximate)にする(追加要件 4)。
 */
export function summarizeMeal(lines: readonly MealLine[]): MealSummary {
  const confirmed = lines.filter((l) => l.matchStatus === 'confirmed' && l.nutrients !== null);
  const needsReviewCount = lines.filter((l) => l.matchStatus === 'needs_review').length;
  const reasons: ApproximateReason[] = [];
  if (needsReviewCount > 0) reasons.push('needs_review');
  if (lines.some((l) => l.dish && !l.dish.compositionKnown)) reasons.push('unknown_composition');
  return {
    totals: sumNutrients(confirmed.map((l) => l.nutrients as ItemNutrients)),
    precision: reasons.length > 0 ? 'approximate' : 'normal',
    reasons,
    needsReviewCount,
  };
}
