/**
 * 公式 Excel(文部科学省、2026-03-27 公開、正誤表反映済み)から取り出したデータで、列の対応・単位・値の書き方を検証する。
 * データは scripts/sfct/extract_sfct8.py が公式ファイル(SHA-256 照合)から作る。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FOOD_COMPOSITION_SOURCE } from './source.ts';
import { SFCT8_COLUMNS, SFCT8_LAYOUT, SFCT8_NOT_USED } from './sfct8-columns.ts';
import { parseSfctValue, type ValueKind } from './value.ts';
import { NUTRIENTS, itemNutrients, displayValue, type Per100g } from './calc.ts';

interface Header {
  identifier: string;
  column: string;
  labels: string[];
  group_label: string | null;
  unit_cell: string | null;
  unit: string;
}
interface Fixture {
  source: {
    sha256: string;
    file_url: string;
    sheet: string;
    unit_row: number;
    identifier_row: number;
    first_data_row: number;
  };
  headers: Header[];
  neighbors: Header[];
  food_count: number;
  foods: { code: string; name: string; values: Record<string, unknown> }[];
}

const fx = JSON.parse(readFileSync(new URL('./fixtures/sfct8-2023-pfc.json', import.meta.url), 'utf8')) as Fixture;
const byCode = new Map(fx.foods.map((f) => [f.code, f]));
const per100 = (code: string): Per100g => {
  const f = byCode.get(code);
  if (!f) throw new Error(code);
  return Object.fromEntries(SFCT8_COLUMNS.map((c) => [c.nutrient, parseSfctValue(f.values[c.identifier])])) as Per100g;
};

describe('公式 Excel の出所と形', () => {
  it('取り出し元は記録した公式ファイル(SHA-256 一致)', () => {
    expect(fx.source.sha256).toBe(FOOD_COMPOSITION_SOURCE.fileSha256);
    expect(fx.source.file_url).toBe(FOOD_COMPOSITION_SOURCE.fileUrl);
  });

  it('シート・行の位置と食品数が想定どおり', () => {
    expect(fx.source.sheet).toBe(SFCT8_LAYOUT.sheet);
    expect(fx.source.unit_row).toBe(SFCT8_LAYOUT.unitRow);
    expect(fx.source.identifier_row).toBe(SFCT8_LAYOUT.identifierRow);
    expect(fx.source.first_data_row).toBe(SFCT8_LAYOUT.firstDataRow);
    expect(fx.food_count).toBe(SFCT8_LAYOUT.expectedFoodCount);
    expect(new Set(fx.foods.map((f) => f.code)).size).toBe(fx.food_count);
    for (const f of fx.foods) expect(f.code).toMatch(/^\d{5}$/);
  });
});

describe('列の対応(D-18 ②:成分表の標準的な成分値)', () => {
  it.each(SFCT8_COLUMNS)('$displayName は $identifier($column 列、$unit)', (spec) => {
    const h = fx.headers.find((x) => x.identifier === spec.identifier);
    expect(h, `${spec.identifier} not found in the official Excel`).toBeDefined();
    expect(h!.column).toBe(spec.column);
    expect(h!.group_label).toBe(spec.label);
    if (spec.unit === 'kcal') expect(h!.unit_cell).toBe('kcal');
    else expect(h!.unit).toMatch(/\sg\s/);
  });

  it('エネルギーは kcal の ENERC_KCAL で、kJ の ENERC ではない', () => {
    const kj = fx.neighbors.find((x) => x.identifier === 'ENERC')!;
    expect(kj.unit_cell).toBe('kJ');
    expect(SFCT8_COLUMNS.find((c) => c.nutrient === 'energy_kcal')!.identifier).toBe('ENERC_KCAL');
  });

  it('炭水化物の識別子は末尾にハイフンの付いた CHOCDF-', () => {
    expect(fx.headers.map((h) => h.identifier)).toContain('CHOCDF-');
  });

  it('近い別の列(アミノ酸組成によるたんぱく質・トリアシルグリセロール当量・利用可能炭水化物など)は選んでいない', () => {
    const used = new Set(SFCT8_COLUMNS.map((c) => c.identifier));
    const usedCols = new Set(SFCT8_COLUMNS.map((c) => c.column));
    for (const id of SFCT8_NOT_USED) {
      expect(used.has(id)).toBe(false);
      const n = fx.neighbors.find((x) => x.identifier === id)!;
      expect(usedCols.has(n.column)).toBe(false);
    }
  });
});

describe('値の書き方(全 2,538 食品)', () => {
  const count = (identifier: string) => {
    const c: Partial<Record<ValueKind, number>> = {};
    for (const f of fx.foods) {
      const k = parseSfctValue(f.values[identifier]).kind;
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  };

  it('すべての値が既知の書き方として解釈できる(想定外の表記がない)', () => {
    for (const f of fx.foods)
      for (const c of SFCT8_COLUMNS) expect(() => parseSfctValue(f.values[c.identifier])).not.toThrow();
  });

  it('エネルギーは全食品で公表値があり、整数 kcal', () => {
    expect(count('ENERC_KCAL')).toEqual({ measured: 2538 });
    for (const f of fx.foods) expect(Number.isInteger(parseSfctValue(f.values['ENERC_KCAL']).value)).toBe(true);
  });

  it('記号の内訳(公式 Excel の実データ)', () => {
    expect(count('PROT-')).toEqual({
      measured: 2231,
      estimated: 284,
      trace: 17,
      estimated_trace: 5,
      not_determined: 1,
    });
    expect(count('FAT-')).toEqual({ measured: 2177, estimated: 283, trace: 76, estimated_trace: 1, not_determined: 1 });
    expect(count('CHOCDF-')).toEqual({ measured: 2179, estimated: 279, trace: 80 });
  });

  it('未測定(-)は カットわかめ 水煮の汁 のたんぱく質・脂質だけで、0 ではなく値なしとして扱う', () => {
    const missing = fx.foods.flatMap((f) =>
      SFCT8_COLUMNS.filter((c) => parseSfctValue(f.values[c.identifier]).kind === 'not_determined').map(
        (c) => `${f.code}:${c.identifier}`,
      ),
    );
    expect(missing).toEqual(['09059:PROT-', '09059:FAT-']);
    expect(per100('09059').protein_g.value).toBeNull();
  });

  it('値は小数第 1 位まで(計算の内部表現で桁落ちしない)', () => {
    for (const f of fx.foods)
      for (const c of SFCT8_COLUMNS) {
        const v = parseSfctValue(f.values[c.identifier]).value;
        if (v !== null) expect(Math.round(v * 10) / 10).toBe(v);
      }
  });
});

describe('公表値との照合', () => {
  it('アマランサス 玄穀(01001)', () => {
    const p = per100('01001');
    expect([p.energy_kcal.value, p.protein_g.value, p.fat_g.value, p.carbohydrate_g.value]).toEqual([
      343, 12.7, 6.0, 64.9,
    ]);
  });

  it('2026-03-27 正誤表の訂正後の値になっている', () => {
    expect(per100('17036').energy_kcal.value).toBe(116); // トマトケチャップ 104 → 116
    expect(per100('11183').energy_kcal.value).toBe(241); // ばらベーコン 244 → 241
    expect(per100('11316').energy_kcal.value).toBe(254); // ばらベーコン 油いため 271 → 254
    expect(per100('06372').carbohydrate_g.value).toBe(4.3); // ほうれんそう 冷凍 ゆで 3.8 → 4.3
    expect(per100('10470').carbohydrate_g.value).toBe(12.2); // するめいか フライ 1.1 → 12.2
  });

  it('推定値・微量の例', () => {
    expect(per100('01176').protein_g).toMatchObject({ kind: 'estimated', value: 9.7 });
    expect(per100('02061').protein_g).toMatchObject({ kind: 'trace', value: 0 });
    expect(per100('15015').protein_g).toMatchObject({ kind: 'estimated_trace', value: 0 });
  });
});

describe('エネルギーは公表値を使い、P/F/C から再計算しない', () => {
  it('100 g なら公表値そのもの', () => {
    for (const code of ['01001', '17036', '11183']) {
      const n = itemNutrients(per100(code), 100_00);
      expect(displayValue('energy_kcal', n.energy_kcal!)).toBe(String(per100(code).energy_kcal.value));
    }
  });

  it('4・9・4 の係数による再計算値とは一致しない(アマランサス:公表 343 kcal、再計算 364.4 kcal)', () => {
    const p = per100('01001');
    const recomputed = p.protein_g.value! * 4 + p.fat_g.value! * 9 + p.carbohydrate_g.value! * 4;
    expect(recomputed).toBeCloseTo(364.4, 5);
    expect(itemNutrients(p, 100_00).energy_kcal).toBe(343_00);
  });

  it('計算に使う成分は 4 つだけ', () => {
    expect([...NUTRIENTS]).toEqual(['energy_kcal', 'protein_g', 'fat_g', 'carbohydrate_g']);
  });
});
