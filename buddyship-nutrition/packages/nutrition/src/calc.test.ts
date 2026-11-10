import { describe, expect, it } from 'vitest';
import {
  NUTRITION_RULES_VERSION,
  consumedHundredthsG,
  displayValue,
  itemNutrients,
  sumNutrients,
  type Per100g,
} from './calc.ts';
import { parseSfctValue } from './value.ts';

const p = (e: unknown, pr: unknown, f: unknown, c: unknown): Per100g => ({
  energy_kcal: parseSfctValue(e),
  protein_g: parseSfctValue(pr),
  fat_g: parseSfctValue(f),
  carbohydrate_g: parseSfctValue(c),
});

describe('摂取量 = 提供量 × 食べた割合', () => {
  it.each([
    [150, 100, 150_00],
    [150, 50, 75_00],
    [150, 0, 0],
    [80.5, 30, 24_15],
    [0.1, 1, 0], // 0.001 g → 0.00 g
    [2000, 100, 2000_00],
  ])('%s g × %s%% = %s (0.01 g 単位)', (g, pct, expected) => {
    expect(consumedHundredthsG(g, pct)).toBe(expected);
  });

  it.each([
    [0, 50],
    [2001, 50],
    [100, 101],
    [100, -1],
    [100, 50.5],
    [100.05, 50],
  ])('範囲外・桁の多い値 %s g, %s%% は拒否', (g, pct) => {
    expect(() => consumedHundredthsG(g, pct)).toThrow(RangeError);
  });
});

describe('1 品の計算', () => {
  it('成分値 × 摂取量 / 100(0.01 単位、四捨五入)', () => {
    // 156 kcal, 2.5 g, 0.3 g, 37.1 g / 100 g を 150 g
    const n = itemNutrients(p(156, 2.5, 0.3, 37.1), 150_00);
    expect(n).toEqual({ energy_kcal: 234_00, protein_g: 3_75, fat_g: 45, carbohydrate_g: 55_65 });
  });

  it('浮動小数点の誤差が出ない(0.1 g/100 g を 3 回足しても 0.3 相当)', () => {
    const one = itemNutrients(p(1, 0.1, 0.1, 0.1), 100_00);
    const t = sumNutrients([one, one, one]);
    expect(t.protein_g.hundredths).toBe(30);
    expect(displayValue('protein_g', t.protein_g.hundredths)).toBe('0.3');
  });

  it('Tr・(0) は 0 として計算する', () => {
    expect(itemNutrients(p(10, 'Tr', '(0)', '(Tr)'), 100_00)).toEqual({
      energy_kcal: 10_00,
      protein_g: 0,
      fat_g: 0,
      carbohydrate_g: 0,
    });
  });

  it('未測定(-)は 0 にせず、合計を「不完全」として知らせる', () => {
    const a = itemNutrients(p(2, '-', '-', 0.1), 200_00);
    const b = itemNutrients(p(100, 5, 5, 5), 100_00);
    expect(a.protein_g).toBeNull();
    const t = sumNutrients([a, b]);
    expect(t.protein_g).toEqual({ hundredths: 5_00, incomplete: true });
    expect(t.energy_kcal).toEqual({ hundredths: 104_00, incomplete: false });
  });
});

describe('表示の丸め', () => {
  it.each([
    ['energy_kcal', 234_49, '234'],
    ['energy_kcal', 234_50, '235'],
    ['protein_g', 3_74, '3.7'],
    ['protein_g', 3_75, '3.8'],
    ['fat_g', 4, '0.0'],
    ['fat_g', 5, '0.1'],
    ['carbohydrate_g', 12_345_67, '12345.7'],
  ] as const)('%s %s → %s', (n, h, s) => {
    expect(displayValue(n, h)).toBe(s);
  });

  it('合計は丸める前の値を足す', () => {
    // 0.04 g × 3 = 0.12 g → 0.1(先に丸めると 0.0)
    const t = sumNutrients([
      { energy_kcal: 0, protein_g: 4, fat_g: 0, carbohydrate_g: 0 },
      { energy_kcal: 0, protein_g: 4, fat_g: 0, carbohydrate_g: 0 },
      { energy_kcal: 0, protein_g: 4, fat_g: 0, carbohydrate_g: 0 },
    ]);
    expect(displayValue('protein_g', t.protein_g.hundredths)).toBe('0.1');
  });
});

it('規則の版が決まっている(食事明細に保存する)', () => {
  expect(NUTRITION_RULES_VERSION).toBe('sfct8-standard-v1');
});
