/**
 * AI プロバイダの比較指標(docs/AI_EVALUATION.md §4)。
 * 栄養の計算は packages/nutrition をそのまま使う(計算規則を二重に持たない)。
 * 食品番号への対応付けは、本番と同じ規則(別名辞書で 1 つだけ完全一致 + 確からしさが低くない → 先頭の候補)。
 * ただし本番では候補は確定しない(利用者・スタッフが確かめる)。ここでは「確かめずに先頭の候補を採ったら」の精度を測る。
 */
import {
  NUTRIENTS,
  consumedHundredthsG,
  itemNutrients,
  suggestionOf,
  type Nutrient,
  type Per100g,
} from '../../packages/nutrition/src/index.ts';
import type { EvalMeal, PredLine } from './dataset.ts';

export type AliasDict = Record<string, string[]>;
export type FoodTable = Map<string, Per100g>;

/** AI のラベル → 先頭の候補の食品番号(候補が 1 つに決まらなければ null = 要確認で選んでもらう) */
export function suggestedCode(line: PredLine, aliases: AliasDict): string | null {
  const codes = aliases[line.label.trim()] ?? [];
  const cands = codes.map((c) => ({ foodCode: c, exactMatch: true }));
  return suggestionOf(cands, line.confidence).suggested?.foodCode ?? null;
}

export interface MealScore {
  id: string;
  truthCount: number;
  predCount: number;
  /** 食品番号が正解と一致した数(1 つの正解には 1 つの予測だけを対応させる) */
  matched: number;
  /** 先頭の候補が決まらなかった(利用者が選ぶ必要がある)明細の数 */
  needsChoice: number;
  /** 一致した明細の重さの誤差(g、絶対値)と相対誤差 */
  weightAbsErrors: number[];
  weightRelErrors: number[];
  /** 正解と予測(一致したものだけを数える)のエネルギー・PFC の差(0.01 単位) */
  nutrientTruth: Record<Nutrient, number>;
  nutrientPred: Record<Nutrient, number>;
}

const zero = (): Record<Nutrient, number> => ({ energy_kcal: 0, protein_g: 0, fat_g: 0, carbohydrate_g: 0 });

function addNutrients(acc: Record<Nutrient, number>, per100: Per100g | undefined, grams: number) {
  if (!per100) return;
  const n = itemNutrients(per100, consumedHundredthsG(grams, 100));
  for (const k of NUTRIENTS) acc[k] += n[k].hundredths ?? 0;
}

/**
 * 1 食の採点。予測の栄養は「先頭の候補をそのまま採った場合」の値で、候補が決まらない明細は 0 として数える
 * (本番では利用者が選ぶまで計算に入らないのと同じ)。正解の栄養は秤量値 × 成分表。
 */
export function scoreMeal(meal: EvalMeal, pred: readonly PredLine[], aliases: AliasDict, foods: FoodTable): MealScore {
  const s: MealScore = {
    id: meal.id,
    truthCount: meal.items.length,
    predCount: pred.length,
    matched: 0,
    needsChoice: 0,
    weightAbsErrors: [],
    weightRelErrors: [],
    nutrientTruth: zero(),
    nutrientPred: zero(),
  };
  for (const t of meal.items) addNutrients(s.nutrientTruth, foods.get(t.food_code), t.weighed_g);
  const unused = [...meal.items];
  for (const p of pred) {
    const code = suggestedCode(p, aliases);
    if (code === null) {
      s.needsChoice += 1;
      continue;
    }
    addNutrients(s.nutrientPred, foods.get(code), p.served_g);
    const i = unused.findIndex((t) => t.food_code === code);
    if (i < 0) continue;
    const [t] = unused.splice(i, 1);
    if (!t) continue;
    s.matched += 1;
    s.weightAbsErrors.push(Math.abs(p.served_g - t.weighed_g));
    s.weightRelErrors.push(Math.abs(p.served_g - t.weighed_g) / t.weighed_g);
  }
  return s;
}

const sorted = (xs: readonly number[]) => [...xs].sort((a, b) => a - b);
const median = (xs: readonly number[]): number | null => {
  const s = sorted(xs);
  const m = Math.floor(s.length / 2);
  const hi = s[m];
  if (hi === undefined) return null;
  return s.length % 2 ? hi : ((s[m - 1] ?? hi) + hi) / 2;
};
const percentile = (xs: readonly number[], p: number): number | null => {
  const s = sorted(xs);
  return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)] ?? null;
};
const round = (v: number | null, d = 3) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);

export interface Summary {
  meals: number;
  /** 食品の識別:適合率・再現率・F1(食品番号の一致) */
  precision: number | null;
  recall: number | null;
  f1: number | null;
  /** 重さ:一致した明細の絶対誤差の中央値(g)、相対誤差の中央値・平均 */
  weightMedianAbsG: number | null;
  weightMedianRel: number | null;
  weightMeanRel: number | null;
  /** 要確認(先頭の候補が決まらず、選んでもらう必要がある)明細の割合 */
  needsChoiceRate: number | null;
  /** 1 食あたりの栄養の誤差(予測 − 正解)の絶対値の中央値と、正解に対する相対値の中央値 */
  nutrientMedianAbs: Record<Nutrient, number | null>;
  nutrientMedianRel: Record<Nutrient, number | null>;
  /** 処理時間(ミリ秒) */
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
}

export function summarize(scores: readonly MealScore[], latenciesMs: readonly number[]): Summary {
  const sum = (f: (s: MealScore) => number) => scores.reduce((a, s) => a + f(s), 0);
  const matched = sum((s) => s.matched);
  const predicted = sum((s) => s.predCount);
  const truth = sum((s) => s.truthCount);
  const precision = predicted ? matched / predicted : null;
  const recall = truth ? matched / truth : null;
  const f1 =
    precision !== null && recall !== null && precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : null;
  const abs = scores.flatMap((s) => s.weightAbsErrors);
  const rel = scores.flatMap((s) => s.weightRelErrors);
  const nAbs = {} as Record<Nutrient, number | null>;
  const nRel = {} as Record<Nutrient, number | null>;
  for (const n of NUTRIENTS) {
    nAbs[n] = round(median(scores.map((s) => Math.abs(s.nutrientPred[n] - s.nutrientTruth[n]) / 100)), 1);
    nRel[n] = round(
      median(
        scores
          .filter((s) => s.nutrientTruth[n] > 0)
          .map((s) => Math.abs(s.nutrientPred[n] - s.nutrientTruth[n]) / s.nutrientTruth[n]),
      ),
    );
  }
  return {
    meals: scores.length,
    precision: round(precision),
    recall: round(recall),
    f1: round(f1),
    weightMedianAbsG: round(median(abs), 1),
    weightMedianRel: round(median(rel)),
    weightMeanRel: round(rel.length ? rel.reduce((a, b) => a + b, 0) / rel.length : null),
    needsChoiceRate: round(predicted ? sum((s) => s.needsChoice) / predicted : null),
    nutrientMedianAbs: nAbs,
    nutrientMedianRel: nRel,
    latencyP50Ms: percentile(latenciesMs, 0.5),
    latencyP95Ms: percentile(latenciesMs, 0.95),
  };
}
