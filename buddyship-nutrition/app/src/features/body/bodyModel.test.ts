import { describe, expect, it } from 'vitest';
import type { BodyRecord } from '@buddyship/shared';
import {
  chartPoints,
  diffText,
  fromLocalInput,
  hasDeviceChange,
  hasMixedConditions,
  parseNumberInput,
  stepValue,
  toLocalInput,
} from './bodyModel.ts';

const rec = (
  at: string,
  w: number,
  device = '機種A',
  condition: BodyRecord['condition'] = 'before_meal',
): BodyRecord => ({
  id: crypto.randomUUID(),
  member_id: crypto.randomUUID(),
  measured_at: at,
  recorded_at: at,
  updated_at: at,
  weight_kg: w,
  skeletal_muscle_kg: 20,
  body_fat_kg: 15,
  body_fat_pct: 28,
  device_model: device,
  condition,
  entry_source: 'self',
  entered_by_me: true,
  entered_by_name: null,
  edited: false,
  warnings: [],
});

describe('体組成の画面の計算', () => {
  it('グラフの点は測定日時の古い順。機種の変わり目に印', () => {
    const pts = chartPoints(
      [rec('2026-10-20T00:00:00Z', 51, '機種B'), rec('2026-10-01T00:00:00Z', 50), rec('2026-10-10T00:00:00Z', 50.5)],
      'weight_kg',
    );
    expect(pts.map((p) => [p.value, p.deviceChanged])).toEqual([
      [50, false],
      [50.5, false],
      [51, true],
    ]);
  });

  it('機種・測定条件が混ざっているか', () => {
    expect(hasDeviceChange([rec('2026-10-01T00:00:00Z', 50), rec('2026-10-02T00:00:00Z', 50)])).toBe(false);
    expect(hasDeviceChange([rec('2026-10-01T00:00:00Z', 50), rec('2026-10-02T00:00:00Z', 50, '機種B')])).toBe(true);
    expect(
      hasMixedConditions([
        rec('2026-10-01T00:00:00Z', 50, 'A', 'before_meal'),
        rec('2026-10-02T00:00:00Z', 50, 'A', 'unknown'),
      ]),
    ).toBe(false);
    expect(
      hasMixedConditions([
        rec('2026-10-01T00:00:00Z', 50, 'A', 'before_meal'),
        rec('2026-10-02T00:00:00Z', 50, 'A', 'after_meal'),
      ]),
    ).toBe(true);
  });

  it('前回差は数値のみ(浮動小数点の誤差なし)', () => {
    expect(diffText(50.3, 50.1, 'weight_kg')).toBe('+0.2 kg');
    expect(diffText(50.1, 50.3, 'weight_kg')).toBe('−0.2 kg');
    expect(diffText(28, 28, 'body_fat_pct')).toBe('±0.0 %');
    expect(diffText(28, undefined, 'body_fat_pct')).toBe('—');
  });

  it('−/+ は 0.1 単位で範囲内', () => {
    expect(stepValue(50.1, 1, 20, 300)).toBe(50.2);
    expect(stepValue(20.0, -1, 20, 300)).toBe(20);
    expect(stepValue(0.1 + 0.2, 1, 0, 10)).toBe(0.4);
  });

  it('文字入力(全角・読点も)', () => {
    expect(parseNumberInput('52.4')).toBe(52.4);
    expect(parseNumberInput('52。4')).toBe(52.4);
    expect(parseNumberInput(' 52 ')).toBe(52);
    expect(parseNumberInput('\uFF15\uFF12.\uFF14')).toBe(52.4); // 全角
    expect(parseNumberInput('abc')).toBeNull();
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput('-1')).toBeNull();
  });

  it('測定日時(日本時間)の入力の往復', () => {
    expect(toLocalInput('2026-11-10T00:30:00Z')).toBe('2026-11-10T09:30');
    expect(fromLocalInput('2026-11-10T09:30')).toBe('2026-11-10T00:30:00.000Z');
    expect(fromLocalInput('bad')).toBeNull();
  });
});
