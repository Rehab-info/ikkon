// 自動生成(scripts/sync-nutrition.mjs)。packages/nutrition/src から写したもの。ここを直接編集しない
/**
 * 1 日の表示の規則(安全要件 5:食事記録が不完全な日は「1 日の総摂取量」として表示しない)。
 * 状態:recorded(記録あり)/ skipped(食べなかった)/ dayservice(デイサービスで食べた=対象外)/ null(未記録)
 */
export type SlotStatus = 'recorded' | 'skipped' | 'dayservice' | null;
export type MainSlot = 'breakfast' | 'lunch' | 'dinner';

export interface DayStatus {
  breakfast: SlotStatus;
  lunch: SlotStatus;
  dinner: SlotStatus;
}

export type DayLabelKind =
  /** 3 食とも記録または「食べなかった」。自宅で食べたものはすべて記録済み */
  | 'home_complete'
  /** 3 食とも埋まっているが、デイサービスの食事(記録対象外)を含む */
  | 'home_complete_except_dayservice'
  /** 未記録の食事がある */
  | 'partial';

export function dayLabelKind(day: DayStatus): DayLabelKind {
  const slots = [day.breakfast, day.lunch, day.dinner];
  if (slots.some((s) => s === null)) return 'partial';
  if (slots.some((s) => s === 'dayservice')) return 'home_complete_except_dayservice';
  return 'home_complete';
}

import { ESTIMATE_NOTE, SUBTOTAL_LABEL, UNCONFIRMED_NOTE } from './labels.ts';

/** 食事記録の集計名(追加要件 3)。どの日もこの名前だけを使い、「1 日の総摂取量」などとは書かない */
export const AGGREGATE_LABEL = '記録済みの自宅食事の推定摂取量';
/** その日に要確認の食品があるときの集計名(確定済み食品だけの小計であることを明示) */
export const AGGREGATE_SUBTOTAL_LABEL = `記録済みの自宅食事の${SUBTOTAL_LABEL}`;

/**
 * 集計の見出しと注記。推定値であり誤差があることも必ず添える(安全要件 6)。
 * unconfirmedCount:その日の要確認の食品の数。1 以上なら「確認済み食品のみの小計」として見せる。
 */
export function dayTotalHeading(day: DayStatus, unconfirmedCount = 0): { heading: string; note: string } {
  const unconfirmed = unconfirmedCount > 0 ? `${UNCONFIRMED_NOTE}(未確認 ${unconfirmedCount} 品)` : '';
  const heading = unconfirmedCount > 0 ? AGGREGATE_SUBTOTAL_LABEL : AGGREGATE_LABEL;
  switch (dayLabelKind(day)) {
    case 'home_complete':
      return { heading, note: `${unconfirmed}${ESTIMATE_NOTE}` };
    case 'home_complete_except_dayservice':
      return { heading, note: `${unconfirmed}デイサービスで食べた食事は含みません。${ESTIMATE_NOTE}` };
    case 'partial':
      return { heading, note: `${unconfirmed}まだ記録していない食事は含みません。${ESTIMATE_NOTE}` };
  }
}

/** 平均などの集計に使ってよい日か(未記録の食事がなく、要確認の食品もない日だけ) */
export function isCountableDay(day: DayStatus, unconfirmedCount = 0): boolean {
  return dayLabelKind(day) !== 'partial' && unconfirmedCount === 0;
}
