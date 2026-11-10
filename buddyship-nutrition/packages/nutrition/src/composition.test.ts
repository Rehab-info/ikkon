import { describe, expect, it } from 'vitest';
import { itemNutrients, displayValue, displayTotal, type Per100g } from './calc.ts';
import {
  APPROXIMATE_REASON_TEXT,
  initialMatchStatus,
  mealTotalHeading,
  summarizeMeal,
  type MealLine,
} from './composition.ts';
import { parseSfctValue } from './value.ts';

const per100 = (e: number, pr: number, f: number, c: number): Per100g => ({
  energy_kcal: parseSfctValue(e),
  protein_g: parseSfctValue(pr),
  fat_g: parseSfctValue(f),
  carbohydrate_g: parseSfctValue(c),
});
const line = (over: Partial<MealLine> & { g?: number }): MealLine => ({
  role: 'food',
  matchStatus: 'confirmed',
  nutrients: itemNutrients(per100(100, 10, 10, 10), (over.g ?? 100) * 100),
  ...over,
});

describe('食品コードの対応付け(D-19:確実でなければ「要確認」)', () => {
  it('候補が 1 つで名前が完全一致し、確からしさが低くないときだけ確定', () => {
    expect(initialMatchStatus([{ foodCode: '01088', exactMatch: true }], 'high')).toBe('confirmed');
    expect(initialMatchStatus([{ foodCode: '01088', exactMatch: true }], 'medium')).toBe('confirmed');
  });

  it.each([
    ['候補なし', [], 'high'],
    [
      '候補が複数',
      [
        { foodCode: '01088', exactMatch: true },
        { foodCode: '01083', exactMatch: true },
      ],
      'high',
    ],
    ['あいまい一致', [{ foodCode: '01088', exactMatch: false }], 'high'],
    [
      '完全一致と別の候補',
      [
        { foodCode: '01088', exactMatch: true },
        { foodCode: '01083', exactMatch: false },
      ],
      'high',
    ],
    ['AI の確からしさが低い', [{ foodCode: '01088', exactMatch: true }], 'low'],
  ] as const)('%s → 要確認', (_label, cands, conf) => {
    expect(initialMatchStatus(cands, conf)).toBe('needs_review');
  });
});

describe('食事の集計(D-19・追加要件 4)', () => {
  it('すべて確定・構成がわかっていれば通常の精度で「推定摂取量」', () => {
    const s = summarizeMeal([line({}), line({ role: 'cooking_oil', g: 5 })]);
    expect(s.precision).toBe('normal');
    expect(s.scope).toBe('all_confirmed');
    expect(s.reasons).toEqual([]);
    expect(s.totals.energy_kcal.hundredths).toBe(105_00);
  });

  it('要確認の明細は合計に入れず、「確認済み食品のみの小計」とする', () => {
    const s = summarizeMeal([line({}), line({ matchStatus: 'needs_review', nutrients: null })]);
    expect(s.needsReviewCount).toBe(1);
    expect(s.totals.energy_kcal.hundredths).toBe(100_00);
    expect(s.scope).toBe('confirmed_only_subtotal');
    expect(s.reasons).toEqual(['needs_review']);
    expect(APPROXIMATE_REASON_TEXT.needs_review).toContain('小計に入っていません');
  });

  it('要確認なのに成分値が渡されても合計に入れない', () => {
    const s = summarizeMeal([line({ matchStatus: 'needs_review' })]);
    expect(s.totals.energy_kcal.hundredths).toBe(0);
  });

  it('料理の構成食材が不明なら、精密な値として表示しない', () => {
    const dish = { groupId: 'd1', label: '肉じゃが', compositionKnown: false };
    const s = summarizeMeal([line({ role: 'ingredient', dish, g: 123.4 }), line({ role: 'seasoning', dish, g: 7 })]);
    expect(s.precision).toBe('approximate');
    expect(s.reasons).toEqual(['unknown_composition']);
    const kcal = displayValue('energy_kcal', s.totals.energy_kcal.hundredths, s.precision);
    expect(kcal).toMatch(/^約\d+0$/);
    expect(displayTotal('protein_g', s.totals.protein_g, s.precision)).toMatch(/^約\d+$/); // 小数を出さない
  });

  it('構成がわかっている料理(食材・調理油・調味料を確認済み)は通常の精度', () => {
    const dish = { groupId: 'd1', label: '野菜いため', compositionKnown: true };
    const s = summarizeMeal([
      line({ role: 'ingredient', dish }),
      line({ role: 'cooking_oil', dish, g: 4 }),
      line({ role: 'seasoning', dish, g: 1 }),
    ]);
    expect(s.precision).toBe('normal');
  });
});

describe('食事の見出し(Sprint 2 表示ルール:要確認があれば小計)', () => {
  it('要確認があると「確認済み食品のみの小計」と「未確認の食品は含まれていません」', () => {
    const s = summarizeMeal([
      line({}),
      line({ matchStatus: 'needs_review', nutrients: null }),
      line({ matchStatus: 'needs_review', nutrients: null }),
    ]);
    const h = mealTotalHeading(s);
    expect(h.heading).toBe('確認済み食品のみの小計');
    expect(h.heading).not.toContain('推定摂取量');
    expect(h.notes[0]).toBe('未確認の食品は含まれていません。(未確認 2 品)');
  });

  it('すべて確認済みなら「推定摂取量」で、未確認の注記は出ない', () => {
    const h = mealTotalHeading(summarizeMeal([line({}), line({ role: 'seasoning', g: 2 })]));
    expect(h.heading).toBe('推定摂取量');
    expect(h.notes.join('')).not.toContain('未確認');
    expect(h.notes.join('')).toContain('実際とは差があります');
  });

  it('小計とすべて確認済みの推定摂取量は、同じ数値でも見出しが必ず違う', () => {
    const subtotal = mealTotalHeading(
      summarizeMeal([line({}), line({ matchStatus: 'needs_review', nutrients: null })]),
    );
    const total = mealTotalHeading(summarizeMeal([line({})]));
    expect(subtotal.heading).not.toBe(total.heading);
  });

  it('構成不明の料理はおおよその表示の注記も付く', () => {
    const dish = { groupId: 'd', label: '煮物', compositionKnown: false };
    const h = mealTotalHeading(summarizeMeal([line({ role: 'ingredient', dish })]));
    expect(h.notes.some((n) => n.includes('おおよその値'))).toBe(true);
  });
});
