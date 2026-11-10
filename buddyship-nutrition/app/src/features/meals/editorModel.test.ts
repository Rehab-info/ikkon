import { describe, expect, it } from 'vitest';
import type { AnalyzeResponse, FoodRef } from '@buddyship/shared';
import { SaveMealItem } from '@buddyship/shared';
import {
  addLine,
  chooseFood,
  fromAnalysis,
  removeLine,
  setDishCompositionKnown,
  setIntake,
  setServed,
  summarize,
  toItems,
} from './editorModel.ts';

const per = (
  e: number,
  p: number | null,
  f: number,
  c: number,
  kind: 'measured' | 'trace' | 'not_determined' = 'measured',
) => ({
  energy_kcal: { value: e, kind: 'measured' as const, raw: String(e) },
  protein_g: {
    value: p,
    kind: p === null ? ('not_determined' as const) : kind,
    raw: p === null ? '-' : kind === 'trace' ? 'Tr' : String(p),
  },
  fat_g: { value: f, kind: 'measured' as const, raw: String(f) },
  carbohydrate_g: { value: c, kind: 'measured' as const, raw: String(c) },
});
const food = (id: string, name: string, e: number): FoodRef => ({
  food_id: `00000000-0000-4000-8000-${id.padStart(12, '0')}`,
  food_code: id.padStart(5, '0'),
  display_name: name,
  per100: per(e, 2.5, 0.3, 37.1),
});
const rice = food('1', 'ごはん', 156);
const pork1 = food('2', '豚ロース', 248);
const pork2 = food('3', '豚ばら', 366);

const analysis: AnalyzeResponse = {
  analysis_id: '00000000-0000-4000-8000-0000000000aa',
  provider: 'mock',
  is_estimate: true,
  is_food_image: true,
  items: [
    {
      kind: 'food',
      ai_label: 'ごはん',
      ai_estimated_served_g: 150,
      confidence: 'high',
      match_status: 'confirmed',
      food: rice,
      candidates: [rice],
    },
    {
      kind: 'dish',
      dish_label: '肉じゃが',
      composition_known: true,
      components: [
        {
          role: 'ingredient',
          ai_label: '豚肉',
          ai_estimated_served_g: 50,
          confidence: 'medium',
          match_status: 'needs_review',
          food: null,
          candidates: [pork1, pork2],
        },
      ],
    },
  ],
};

describe('食事の確認・修正の状態', () => {
  it('解析結果から:確定と要確認、料理のまとまり', () => {
    const s = fromAnalysis(analysis);
    expect(s.lines.map((l) => [l.label, l.status, l.role])).toEqual([
      ['ごはん', 'confirmed', 'food'],
      ['豚肉', 'needs_review', 'ingredient'],
    ]);
    expect(s.dishes).toHaveLength(1);
  });

  it('要確認が残っていると「確認済み食品のみの小計」で、要確認の食品は数値に入らない', () => {
    const { summary, heading } = summarize(fromAnalysis(analysis));
    expect(heading.heading).toBe('確認済み食品のみの小計');
    expect(heading.notes[0]).toContain('未確認の食品は含まれていません');
    expect(summary.totals.energy_kcal.hundredths).toBe(234_00); // ごはん 150 g だけ
  });

  it('要確認の食品を候補から選ぶと確定し、「推定摂取量」になる', () => {
    let s = fromAnalysis(analysis);
    s = chooseFood(s, s.lines[1]!.key, pork1);
    expect(s.lines[1]).toMatchObject({ status: 'confirmed', label: '豚ロース', origin: 'ai_corrected' });
    const { summary, heading } = summarize(s);
    expect(heading.heading).toBe('推定摂取量');
    expect(summary.totals.energy_kcal.hundredths).toBe(234_00 + 124_00); // 248 × 50 / 100
  });

  it('提供量・食べた割合を変えると再計算される(一括と個別)', () => {
    let s = fromAnalysis(analysis);
    s = setServed(s, s.lines[0]!.key, 100);
    expect(summarize(s).summary.totals.energy_kcal.hundredths).toBe(156_00);
    s = setIntake(s, 50);
    expect(summarize(s).summary.totals.energy_kcal.hundredths).toBe(78_00);
    s = setIntake(s, 0, s.lines[0]!.key);
    expect(summarize(s).summary.totals.energy_kcal.hundredths).toBe(0);
    expect(s.lines[0]!.origin).toBe('ai_corrected');
  });

  it('提供量の範囲(1〜2000 g、0.1 g 単位)', () => {
    let s = fromAnalysis(analysis);
    s = setServed(s, s.lines[0]!.key, 0);
    expect(s.lines[0]!.servedG).toBe(1);
    s = setServed(s, s.lines[0]!.key, 5000);
    expect(s.lines[0]!.servedG).toBe(2000);
    s = setServed(s, s.lines[0]!.key, 12.345);
    expect(s.lines[0]!.servedG).toBe(12.3);
  });

  it('材料・調理油・調味料の追加と削除。料理の材料がなくなれば料理も消える', () => {
    let s = fromAnalysis(analysis);
    const dishKey = s.dishes[0]!.key;
    s = addLine(s, food('4', 'サラダ油', 886), 'cooking_oil', dishKey, 3);
    s = addLine(s, food('5', 'しょうゆ', 77), 'seasoning', dishKey, 9);
    expect(s.lines.filter((l) => l.dishKey === dishKey).map((l) => l.role)).toEqual([
      'ingredient',
      'cooking_oil',
      'seasoning',
    ]);
    expect(() => addLine(s, rice, 'seasoning', null, 1)).toThrow();
    for (const l of s.lines.filter((x) => x.dishKey === dishKey)) s = removeLine(s, l.key);
    expect(s.dishes).toEqual([]);
  });

  it('構成食材が不明な料理は「約」付きのおおよその表示', () => {
    let s = fromAnalysis(analysis);
    s = chooseFood(s, s.lines[1]!.key, pork1);
    s = setDishCompositionKnown(s, s.dishes[0]!.key, false);
    expect(summarize(s).summary.precision).toBe('approximate');
  });

  it('保存用の明細はサーバーの型に合い、栄養値を含まない', () => {
    const items = toItems(fromAnalysis(analysis));
    for (const i of items) expect(SaveMealItem.safeParse(i).success).toBe(true);
    expect(JSON.stringify(items)).not.toMatch(/energy|protein|fat_g|carbohydrate/);
    expect(items[1]).toMatchObject({
      match_status: 'needs_review',
      food_id: null,
      candidate_food_ids: [pork1.food_id, pork2.food_id],
    });
  });
});
