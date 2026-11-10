import { describe, expect, it } from 'vitest';
import {
  AGGREGATE_LABEL,
  dayLabelKind,
  dayTotalHeading,
  isCountableDay,
  type DayStatus,
  type SlotStatus,
} from './daily.ts';
import { sourceNotice, FOOD_COMPOSITION_SOURCE } from './source.ts';

const STATES: SlotStatus[] = ['recorded', 'skipped', 'dayservice', null];
const ALL: DayStatus[] = STATES.flatMap((b) =>
  STATES.flatMap((l) => STATES.map((d) => ({ breakfast: b, lunch: l, dinner: d }))),
);

describe('1 日の表示(安全要件 5・6)', () => {
  it('64 通りすべてで「1 日の総摂取量」「1 日の合計」と書かず、推定と誤差を添える', () => {
    expect(ALL).toHaveLength(64);
    for (const day of ALL) {
      const { heading, note } = dayTotalHeading(day);
      expect(heading).not.toMatch(/1\s*日の(総摂取量|合計)|一日の(総摂取量|合計)/);
      expect(heading).toContain('推定');
      expect(note).toMatch(/推定/);
      expect(note).toMatch(/差があります/);
    }
  });

  it('未記録が 1 つでもあれば「記録した食事だけ」と明示し、集計(平均)に使わない', () => {
    for (const day of ALL) {
      const partial = [day.breakfast, day.lunch, day.dinner].includes(null);
      expect(dayLabelKind(day) === 'partial').toBe(partial);
      expect(isCountableDay(day)).toBe(!partial);
      if (partial) expect(dayTotalHeading(day).note).toContain('まだ記録していない食事は含みません');
    }
  });

  it('デイサービスの食事を含む日はそのことを明示する', () => {
    const d: DayStatus = { breakfast: 'recorded', lunch: 'dayservice', dinner: 'skipped' };
    expect(dayLabelKind(d)).toBe('home_complete_except_dayservice');
    expect(dayTotalHeading(d).note).toContain('デイサービスで食べた食事は含みません');
  });
});

describe('出典と版の表示(安全要件 7)', () => {
  it('出典表記・版・正誤表の反映を含む', () => {
    const s = sourceNotice();
    expect(s).toContain('日本食品標準成分表(八訂)増補2023年から引用');
    expect(s).toContain('2026年3月27日 正誤表 反映済み');
    expect(s).toContain('推定値');
    expect(FOOD_COMPOSITION_SOURCE.publisher).toBe('文部科学省');
  });
});

describe('集計名(追加要件 3)', () => {
  it('すべての記録状況で「記録済みの自宅食事の推定摂取量」', () => {
    for (const day of ALL) expect(dayTotalHeading(day).heading).toBe(AGGREGATE_LABEL);
    expect(AGGREGATE_LABEL).toBe('記録済みの自宅食事の推定摂取量');
  });
});
