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

/**
 * 合計の見出し。どの場合も「1 日の総摂取量」「1 日の合計」とは書かない。
 * 推定値であり誤差があることも必ず添える(安全要件 6)。
 */
export function dayTotalHeading(day: DayStatus): { heading: string; note: string } {
  const ESTIMATE = '写真や入力をもとにした推定で、実際とは差があります。';
  switch (dayLabelKind(day)) {
    case 'home_complete':
      return { heading: '記録したご自宅の食事の合計(推定)', note: ESTIMATE };
    case 'home_complete_except_dayservice':
      return { heading: '記録したご自宅の食事の合計(推定)', note: `デイサービスで食べた食事は含みません。${ESTIMATE}` };
    case 'partial':
      return { heading: '記録した食事だけの合計(推定)', note: `まだ記録していない食事は含みません。${ESTIMATE}` };
  }
}

/** 平均などの集計に使ってよい日か(未記録の食事がない日だけ) */
export function isCountableDay(day: DayStatus): boolean {
  return dayLabelKind(day) !== 'partial';
}
