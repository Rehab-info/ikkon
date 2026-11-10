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
  /** 計算に使う値。未測定は null。Tr・(Tr) は 0 */
  value: number | null;
  /** 成分表の元の表記(Tr・(Tr)・(9.7)・- など。保存・表示のために必ず残す) */
  raw: string;
  /**
   * Tr・(Tr) を計算上 0 として扱ったか。測定上のゼロ(`0`・`(0)`)は false。
   * 「0 g」と「微量」を区別するために使う(追加要件 2)
   */
  traceAsZero: boolean;
}

/** 表記の種類の説明(画面・エクスポート用) */
export const VALUE_KIND_LABELS: Record<ValueKind, string> = {
  measured: '成分値',
  estimated: '推定値',
  trace: '微量(Tr)',
  estimated_trace: '推定で微量((Tr))',
  not_determined: '未測定(-)',
};

/** 測定上・推定上のゼロ(`0`・`(0)`)か。Tr は含まない */
export function isRecordedZero(v: ParsedValue): boolean {
  return v.value === 0 && !v.traceAsZero;
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
    return { kind: 'measured', value: raw, raw: String(raw), traceAsZero: false };
  }
  if (typeof raw !== 'string') throw new UnknownValueFormatError(raw);
  const s = raw.trim();
  if (s === '-') return { kind: 'not_determined', value: null, raw: s, traceAsZero: false };
  if (s === 'Tr') return { kind: 'trace', value: 0, raw: s, traceAsZero: true };
  if (s === '(Tr)') return { kind: 'estimated_trace', value: 0, raw: s, traceAsZero: true };
  if (NUMBER.test(s)) return { kind: 'measured', value: Number(s), raw: s, traceAsZero: false };
  const est = /^\((\d+(?:\.\d+)?)\)$/.exec(s);
  if (est?.[1] !== undefined) return { kind: 'estimated', value: Number(est[1]), raw: s, traceAsZero: false };
  throw new UnknownValueFormatError(raw);
}
