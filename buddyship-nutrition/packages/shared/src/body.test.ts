import { describe, expect, it } from 'vitest';
import { BodyPayload, bodyConsistent, bodyWarnings, checkBodyField } from './body.ts';

describe('InBody の入力の検証(SQL と同じ規則)', () => {
  it('範囲(両端を含む)と小数 1 桁', () => {
    expect(checkBodyField('weight_kg', 20)).toBeNull();
    expect(checkBodyField('weight_kg', 300)).toBeNull();
    expect(checkBodyField('weight_kg', 19.9)).toBe('out_of_range');
    expect(checkBodyField('weight_kg', 300.1)).toBe('out_of_range');
    expect(checkBodyField('skeletal_muscle_kg', 4.9)).toBe('out_of_range');
    expect(checkBodyField('body_fat_kg', 0.4)).toBe('out_of_range');
    expect(checkBodyField('body_fat_pct', 75.1)).toBe('out_of_range');
    expect(checkBodyField('weight_kg', 55.05)).toBe('decimal');
    expect(checkBodyField('weight_kg', null)).toBe('required');
    expect(checkBodyField('weight_kg', 0.1 + 55.2)).toBeNull(); // 浮動小数点の誤差は許す
  });

  it('骨格筋量・体脂肪量は体重未満、合計も体重未満', () => {
    expect(bodyConsistent({ weight_kg: 55, skeletal_muscle_kg: 22, body_fat_kg: 15 })).toBe(true);
    expect(bodyConsistent({ weight_kg: 40, skeletal_muscle_kg: 25, body_fat_kg: 15 })).toBe(false);
    expect(bodyConsistent({ weight_kg: 40, skeletal_muscle_kg: 41, body_fat_kg: 1 })).toBe(false);
  });

  it('体脂肪率の整合性の警告(差が 1.5 ポイントを超えたら)', () => {
    expect(bodyWarnings({ weight_kg: 55, body_fat_kg: 15, body_fat_pct: 27.3 })).toEqual([]); // 27.27… → 27.3
    expect(bodyWarnings({ weight_kg: 55, body_fat_kg: 15, body_fat_pct: 28.8 })).toEqual([]); // 差 1.5 ちょうど
    expect(bodyWarnings({ weight_kg: 55, body_fat_kg: 15, body_fat_pct: 28.9 })).toEqual(['fat_pct_mismatch']);
    expect(bodyWarnings({ weight_kg: 55, body_fat_kg: 15, body_fat_pct: 32 })).toEqual(['fat_pct_mismatch']);
    // 四捨五入の境目:10.0 / 40.0 = 25.0、0.5 / 40.0 × 100 = 1.25 → 1.3
    expect(bodyWarnings({ weight_kg: 40, body_fat_kg: 0.5, body_fat_pct: 2.8 })).toEqual([]);
    expect(bodyWarnings({ weight_kg: 40, body_fat_kg: 0.5, body_fat_pct: 2.9 })).toEqual(['fat_pct_mismatch']);
  });

  it('保存の入力の形', () => {
    const ok = {
      measured_at: '2026-11-10T09:00:00+09:00',
      weight_kg: 55,
      skeletal_muscle_kg: 22,
      body_fat_kg: 15,
      body_fat_pct: 27.3,
      device_model: ' InBody(架空) ',
      condition: 'unknown',
    };
    expect(BodyPayload.parse(ok).device_model).toBe('InBody(架空)');
    expect(BodyPayload.safeParse({ ...ok, weight_kg: '55' }).success).toBe(false);
    expect(BodyPayload.safeParse({ ...ok, device_model: '' }).success).toBe(false);
    expect(BodyPayload.safeParse({ ...ok, condition: 'x' }).success).toBe(false);
  });
});
