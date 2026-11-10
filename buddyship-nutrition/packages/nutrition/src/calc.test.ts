import { describe, expect, it } from 'vitest';
import {
  NUTRITION_RULES_VERSION,
  consumedHundredthsG,
  displayAmount,
  displayTotal,
  displayValue,
  itemNutrients,
  sumNutrients,
  type ItemNutrients,
  type Per100g,
} from './calc.ts';
import { isRecordedZero, parseSfctValue } from './value.ts';

const p = (e: unknown, pr: unknown, f: unknown, c: unknown): Per100g => ({
  energy_kcal: parseSfctValue(e),
  protein_g: parseSfctValue(pr),
  fat_g: parseSfctValue(f),
  carbohydrate_g: parseSfctValue(c),
});
const h = (n: ItemNutrients) => ({
  energy_kcal: n.energy_kcal.hundredths,
  protein_g: n.protein_g.hundredths,
  fat_g: n.fat_g.hundredths,
  carbohydrate_g: n.carbohydrate_g.hundredths,
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
    const n = itemNutrients(p(156, 2.5, 0.3, 37.1), 150_00);
    expect(h(n)).toEqual({ energy_kcal: 234_00, protein_g: 3_75, fat_g: 45, carbohydrate_g: 55_65 });
  });

  it('浮動小数点の誤差が出ない(0.1 g/100 g を 3 回足しても 0.3 相当)', () => {
    const one = itemNutrients(p(1, 0.1, 0.1, 0.1), 100_00);
    const t = sumNutrients([one, one, one]);
    expect(t.protein_g.hundredths).toBe(30);
    expect(displayValue('protein_g', t.protein_g.hundredths)).toBe('0.3');
  });

  it('未測定(-)は 0 にせず、合計を「不完全」として知らせる', () => {
    const a = itemNutrients(p(2, '-', '-', 0.1), 200_00);
    const b = itemNutrients(p(100, 5, 5, 5), 100_00);
    expect(a.protein_g.hundredths).toBeNull();
    const t = sumNutrients([a, b]);
    expect(t.protein_g).toMatchObject({ hundredths: 5_00, incomplete: true });
    expect(t.energy_kcal).toMatchObject({ hundredths: 104_00, incomplete: false });
    expect(displayTotal('protein_g', t.protein_g)).toBe('5.0(値のない食品を除く)');
  });
});

describe('元の表記の保持(追加要件 1)', () => {
  it('計算結果に、成分表の元の表記と種類が残る', () => {
    const n = itemNutrients(p(10, 'Tr', '(Tr)', '(9.7)'), 100_00);
    expect(n.protein_g).toMatchObject({ raw: 'Tr', kind: 'trace' });
    expect(n.fat_g).toMatchObject({ raw: '(Tr)', kind: 'estimated_trace' });
    expect(n.carbohydrate_g).toMatchObject({ raw: '(9.7)', kind: 'estimated', hundredths: 9_70 });
    const nd = itemNutrients(p(10, '-', 0, 0), 100_00);
    expect(nd.protein_g).toMatchObject({ raw: '-', kind: 'not_determined', hundredths: null });
  });
});

describe('Tr と測定上のゼロの区別(追加要件 2)', () => {
  it('Tr・(Tr) は計算上 0 だが、測定上のゼロ(0・(0))とは区別される', () => {
    expect(isRecordedZero(parseSfctValue('0'))).toBe(true);
    expect(isRecordedZero(parseSfctValue('(0)'))).toBe(true);
    expect(isRecordedZero(parseSfctValue(0))).toBe(true);
    expect(isRecordedZero(parseSfctValue('Tr'))).toBe(false);
    expect(isRecordedZero(parseSfctValue('(Tr)'))).toBe(false);
    expect(parseSfctValue('Tr').value).toBe(0);
  });

  it('1 品の表示:Tr は「微量」、測定上のゼロは「0.0」', () => {
    const n = itemNutrients(p(10, 'Tr', '0', '(Tr)'), 100_00);
    expect(displayAmount('protein_g', n.protein_g)).toBe('微量');
    expect(displayAmount('fat_g', n.fat_g)).toBe('0.0');
    expect(displayAmount('carbohydrate_g', n.carbohydrate_g)).toBe('微量(推定)');
  });

  it('推定値・未測定の表示', () => {
    const n = itemNutrients(p(10, '(9.7)', '-', 1), 100_00);
    expect(displayAmount('protein_g', n.protein_g)).toBe('9.7(推定値)');
    expect(displayAmount('fat_g', n.fat_g)).toBe('値なし(成分表で未測定)');
  });

  it('合計:すべて Tr 由来の 0 は「微量」、測定上のゼロを含めば 0', () => {
    const tr = itemNutrients(p(10, 'Tr', 'Tr', 'Tr'), 100_00);
    const zero = itemNutrients(p(10, '0', '0', '0'), 100_00);
    const onlyTrace = sumNutrients([tr, tr]);
    expect(onlyTrace.protein_g).toMatchObject({ hundredths: 0, includesTrace: true, traceOnly: true });
    expect(displayTotal('protein_g', onlyTrace.protein_g)).toBe('微量');
    const mixed = sumNutrients([tr, zero]);
    expect(mixed.protein_g).toMatchObject({ hundredths: 0, includesTrace: true, traceOnly: false });
    expect(displayTotal('protein_g', mixed.protein_g)).toBe('0.0');
  });

  it('推定値を含む合計は includesEstimated', () => {
    const t = sumNutrients([itemNutrients(p(10, '(1.0)', 1, 1), 100_00), itemNutrients(p(10, 1, 1, 1), 100_00)]);
    expect(t.protein_g.includesEstimated).toBe(true);
    expect(t.fat_g.includesEstimated).toBe(false);
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
  ] as const)('%s %s → %s', (n, v, s) => {
    expect(displayValue(n, v)).toBe(s);
  });

  it.each([
    ['energy_kcal', 234_49, '約230'],
    ['energy_kcal', 235_00, '約240'],
    ['protein_g', 3_49, '約3'],
    ['protein_g', 3_50, '約4'],
    ['fat_g', 4, '約0'],
  ] as const)('おおよその表示(追加要件 4)%s %s → %s', (n, v, s) => {
    expect(displayValue(n, v, 'approximate')).toBe(s);
  });

  it('合計は丸める前の値を足す', () => {
    const tiny = itemNutrients(p(0, 0.4, 0, 0), 10_00); // 0.4 g/100 g × 10 g = 0.04 g
    const t = sumNutrients([tiny, tiny, tiny]);
    expect(displayValue('protein_g', t.protein_g.hundredths)).toBe('0.1');
  });
});

it('規則の版が決まっている(食事明細に保存する)', () => {
  expect(NUTRITION_RULES_VERSION).toBe('sfct8-standard-v2');
});
