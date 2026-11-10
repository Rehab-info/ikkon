import type { FontScale } from '@buddyship/shared';

export const FONT_SCALE_LABELS: Record<FontScale, string> = { 0: 'ふつう', 1: '大きく', 2: 'とても大きく' };

/** ルートの文字サイズを切り替える(index.css の html[data-font-scale]) */
export function applyFontScale(scale: FontScale): void {
  document.documentElement.dataset['fontScale'] = String(scale);
}
