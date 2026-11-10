/**
 * 栄養値の見出し・注記の文言(安全要件 5・6、Sprint 2 の表示ルール)。画面はここの文言だけを使う。
 *
 *  - 要確認の食品が 1 つでもあるとき:確定済み食品の数値を「推定摂取量」として見せない。
 *    見出しは「確認済み食品のみの小計」とし、「未確認の食品は含まれていません」と必ず添える。
 *  - すべて確認済みのとき:「推定摂取量」(食事)/「記録済みの自宅食事の推定摂取量」(1 日)。
 */
export const ESTIMATE_NOTE = '写真や入力をもとにした推定で、実際とは差があります。';
export const MEAL_ESTIMATE_LABEL = '推定摂取量';
export const SUBTOTAL_LABEL = '確認済み食品のみの小計';
export const UNCONFIRMED_NOTE = '未確認の食品は含まれていません。';

/** 小計か、すべて確認済みの推定摂取量か */
export type TotalScope = 'all_confirmed' | 'confirmed_only_subtotal';

export function scopeOf(needsReviewCount: number): TotalScope {
  if (!Number.isInteger(needsReviewCount) || needsReviewCount < 0) throw new RangeError('needsReviewCount');
  return needsReviewCount > 0 ? 'confirmed_only_subtotal' : 'all_confirmed';
}
