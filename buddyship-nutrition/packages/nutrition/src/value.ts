/**
 * 食品成分表のセルの値の解釈(成分表の記号の意味は「日本食品標準成分表(八訂)増補2023年」第1章による)。
 *
 *   12.7    … 成分値                     → 12.7
 *   (9.7)   … 推定値                     → 9.7
 *   0       … 最小記載量の 1/10 未満等  → 0
 *   (0)     … 推定値が 0                 → 0
 *   Tr      … 微量(最小記載量未満)      → 0(計算では 0 として扱う)
 *   (Tr)    … 推定で微量                 → 0(同上)
 *   -       … 未測定                     → 値なし(null)。0 とはみなさない
 *
 * 公式 Excel では、数値が数値型のこともあれば "6.0" のように文字列のこともあるため、両方を受け付ける。
 * 想定外の書き方は例外にする(黙って 0 にしない)。
 */
export type ValueKind = 'measured' | 'estimated' | 'trace' | 'estimated_trace' | 'not_determined';

export interface ParsedValue {
  kind: ValueKind;
  /** 計算に使う値。未測定は null */
  value: number | null;
  /** 元の表記 */
  raw: string;
}

const NUMBER = /^\d+(?:\.\d+)?$/;

export class UnknownValueFormatError extends Error {
  constructor(raw: unknown) {
    super(`unknown food composition value format: ${JSON.stringify(raw)}`);
    this.name = 'UnknownValueFormatError';
  }
}

export function parseSfctValue(raw: unknown): ParsedValue {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0) throw new UnknownValueFormatError(raw);
    return { kind: 'measured', value: raw, raw: String(raw) };
  }
  if (typeof raw !== 'string') throw new UnknownValueFormatError(raw);
  const s = raw.trim();
  if (s === '-') return { kind: 'not_determined', value: null, raw: s };
  if (s === 'Tr') return { kind: 'trace', value: 0, raw: s };
  if (s === '(Tr)') return { kind: 'estimated_trace', value: 0, raw: s };
  if (NUMBER.test(s)) return { kind: 'measured', value: Number(s), raw: s };
  const est = /^\((\d+(?:\.\d+)?)\)$/.exec(s);
  if (est?.[1] !== undefined) return { kind: 'estimated', value: Number(est[1]), raw: s };
  throw new UnknownValueFormatError(raw);
}
