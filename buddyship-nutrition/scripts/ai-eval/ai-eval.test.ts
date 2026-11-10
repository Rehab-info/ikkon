import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MOCK_RESULT } from '../../supabase/functions/_shared/ai/mock.ts';
import { AiMealResult } from '../../supabase/functions/_shared/ai/schema.ts';
import { BudgetGuard, PriceConfig, estimateCallJpy, planRun } from './budget.ts';
import { EvalDataset } from './dataset.ts';
import { scoreMeal, suggestedCode, summarize } from './metrics.ts';
import { flatten, loadFoods } from './run.ts';

const root = new URL('../../', import.meta.url).pathname;
const foods = loadFoods(readFileSync(`${root}supabase/seeds/foods.sql`, 'utf8'));
const aliases = { ごはん: ['01088'], 豚肉: ['11123', '11129'], 牛乳: ['13003'] };

describe('AI 比較の指標(mock のみ。外部には送らない)', () => {
  it('成分表の取込結果を DB と同じ解釈で読む(2,538 食品)', () => {
    expect(foods.size).toBe(2538);
    expect(foods.get('01088')?.energy_kcal.value).toBe(156);
    expect(foods.get('09059')?.protein_g).toMatchObject({ value: null, raw: '-' }); // 未測定は 0 にしない
  });

  it('先頭の候補は本番と同じ規則(1 つだけ完全一致・確からしさが低くない)', () => {
    const line = (label: string, confidence: 'low' | 'medium' | 'high') =>
      ({ label, served_g: 100, role: 'food', confidence, dish: null }) as const;
    expect(suggestedCode(line('ごはん', 'high'), aliases)).toBe('01088');
    expect(suggestedCode(line('ごはん', 'low'), aliases)).toBeNull();
    expect(suggestedCode(line('豚肉', 'high'), aliases)).toBeNull();
    expect(suggestedCode(line('辞書にない', 'high'), aliases)).toBeNull();
  });

  it('1 食の採点:食品の一致・重さの誤差・要確認・栄養の差', () => {
    const meal = EvalDataset.shape.meals.element.parse({
      id: 'm1',
      image: 'x.jpg',
      slot: 'dinner',
      items: [
        { label: 'ごはん', food_code: '01088', weighed_g: 200, role: 'food' },
        { label: '牛乳', food_code: '13003', weighed_g: 200, role: 'food' },
      ],
    });
    const s = scoreMeal(
      meal,
      [
        { label: 'ごはん', served_g: 150, role: 'food', confidence: 'high', dish: null },
        { label: '豚肉', served_g: 50, role: 'food', confidence: 'high', dish: null },
      ],
      aliases,
      foods,
    );
    expect(s).toMatchObject({ matched: 1, needsChoice: 1, weightAbsErrors: [50], weightRelErrors: [0.25] });
    expect(s.nutrientTruth.energy_kcal).toBe(312_00 + 122_00); // ごはん 156×2 + 牛乳 61×2
    expect(s.nutrientPred.energy_kcal).toBe(234_00); // 選ばれていない豚肉は数えない
    const sum = summarize([s], [10, 30]);
    expect(sum).toMatchObject({ precision: 0.5, recall: 0.5, f1: 0.5, needsChoiceRate: 0.5, latencyP50Ms: 10 });
  });

  it('mock の結果を平らにする(料理の材料も 1 行ずつ)', () => {
    const lines = flatten(AiMealResult.parse(MOCK_RESULT));
    expect(lines).toHaveLength(11);
    expect(lines.filter((l) => l.dish === '肉じゃが')).toHaveLength(7);
  });

  it('サンプルのデータセットは形式に合い、利用者のデータを含まない', () => {
    const d = EvalDataset.parse(JSON.parse(readFileSync(`${root}scripts/ai-eval/sample-dataset.json`, 'utf8')));
    expect(d.contains_member_data).toBe(false);
    for (const m of d.meals) for (const i of m.items) expect(foods.has(i.food_code)).toBe(true);
  });
});

describe('API 費用の上限(初期案 5,000 円)', () => {
  const price = PriceConfig.parse({
    provider: 'p',
    model: 'm',
    usd_per_million_input_tokens: 1,
    usd_per_million_output_tokens: 4,
    input_tokens_per_image: 1000,
    text_input_tokens_per_call: 500,
    output_tokens_per_call: 500,
    jpy_per_usd: 200,
    checked_on: '2026-11-10',
    source_url: 'https://example.com/pricing',
  });

  it('見積もり:(1500×1 + 500×4) / 1e6 × 200 = 0.7 円', () => {
    expect(estimateCallJpy(price)).toBeCloseTo(0.7, 10);
  });

  it('見積もりの 1.5 倍が上限を超える計画は実行しない', () => {
    expect(planRun([price], 50, 3).withinBudget).toBe(true); // 105 円
    expect(planRun([price], 50, 3, 150).withinBudget).toBe(false); // 157.5 > 150
  });

  it('実行中は上限に達したら止める', () => {
    const g = new BudgetGuard(1);
    expect(g.canSpend(0.7)).toBe(true);
    g.record(0.7);
    expect(g.canSpend(0.7)).toBe(false);
  });

  it('料金の設定には確認日と出典が必要(単価をコードに書かない)', () => {
    expect(PriceConfig.safeParse({ ...price, source_url: undefined }).success).toBe(false);
    expect(PriceConfig.safeParse({ ...price, checked_on: 'yesterday' }).success).toBe(false);
  });
});
