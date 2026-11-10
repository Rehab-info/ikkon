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

/** 食事記録の集計名(追加要件 3)。どの日もこの名前だけを使い、「1 日の総摂取量」などとは書かない */
export const AGGREGATE_LABEL = '記録済みの自宅食事の推定摂取量';

/**
 * 集計の見出しと注記。推定値であり誤差があることも必ず添える(安全要件 6)。
 */
export function dayTotalHeading(day: DayStatus): { heading: string; note: string } {
  const ESTIMATE = '写真や入力をもとにした推定で、実際とは差があります。';
  switch (dayLabelKind(day)) {
    case 'home_complete':
      return { heading: AGGREGATE_LABEL, note: ESTIMATE };
    case 'home_complete_except_dayservice':
      return { heading: AGGREGATE_LABEL, note: `デイサービスで食べた食事は含みません。${ESTIMATE}` };
    case 'partial':
      return { heading: AGGREGATE_LABEL, note: `まだ記録していない食事は含みません。${ESTIMATE}` };
  }
}

/** 平均などの集計に使ってよい日か(未記録の食事がない日だけ) */
export function isCountableDay(day: DayStatus): boolean {
  return dayLabelKind(day) !== 'partial';
}
