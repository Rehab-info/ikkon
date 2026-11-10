/**
 * 体組成の画面用の計算(グラフの点、機種の変更、期間、入力の増減)。
 * 値の良し悪しは判定しない(低栄養・サルコペニアなどの自動判定はしない。SAFE / D-15)。
 */
import { BODY_LABELS, toTenths, type BodyMetric, type BodyRecord } from '@buddyship/shared';

/** グラフにする指標。単位の違う指標は同じ軸に載せない(1 指標 = 1 グラフ) */
export const CHART_METRICS = [
  'weight_kg',
  'skeletal_muscle_kg',
  'body_fat_pct',
] as const satisfies readonly BodyMetric[];
export type ChartMetric = (typeof CHART_METRICS)[number];

export const PERIODS = [
  { months: 1, label: '1か月' },
  { months: 3, label: '3か月' },
  { months: 6, label: '6か月' },
  { months: 12, label: '1年' },
] as const;

export interface ChartPoint {
  /** 測定時刻(ミリ秒)。横軸は時間の比率どおり */
  t: number;
  value: number;
  device: string;
  /** 前の測定と機種が違う */
  deviceChanged: boolean;
}

/** 測定日時の古い順に並べ、機種の変わり目に印を付ける */
export function chartPoints(records: readonly BodyRecord[], metric: ChartMetric): ChartPoint[] {
  const sorted = [...records].sort((a, b) => Date.parse(a.measured_at) - Date.parse(b.measured_at));
  return sorted.map((r, i) => ({
    t: Date.parse(r.measured_at),
    value: r[metric],
    device: r.device_model,
    deviceChanged: i > 0 && sorted[i - 1]?.device_model !== r.device_model,
  }));
}

/** 機種が 2 種類以上あるか(グラフの注記を出す) */
export function hasDeviceChange(records: readonly BodyRecord[]): boolean {
  return new Set(records.map((r) => r.device_model)).size > 1;
}

/** 測定の条件(食事の前・後)が混ざっているか */
export function hasMixedConditions(records: readonly BodyRecord[]): boolean {
  return new Set(records.map((r) => r.condition).filter((c) => c !== 'unknown')).size > 1;
}

/** 前回との差(数値のみ。評価語・色は付けない)。0.1 単位で計算し、符号付きの文字列 */
export function diffText(current: number, previous: number | undefined, metric: BodyMetric): string {
  if (previous === undefined) return '—';
  const d = toTenths(current) - toTenths(previous);
  const abs = (Math.abs(d) / 10).toFixed(1);
  const unit = BODY_LABELS[metric].unit;
  return d === 0 ? `±0.0 ${unit}` : `${d > 0 ? '+' : '−'}${abs} ${unit}`;
}

/** 入力の「−」「+」(0.1 単位、範囲の中に収める) */
export function stepValue(value: number, deltaTenths: number, min: number, max: number): number {
  const t = Math.min(toTenths(max), Math.max(toTenths(min), toTenths(value) + deltaTenths));
  return t / 10;
}

/** 文字入力を数に(全角数字・全角ピリオド・読点も受け付ける)。読めなければ null */
export function parseNumberInput(text: string): number | null {
  const s = text
    .trim()
    .replace(/[\uFF10-\uFF19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[.\uFF0E\u3002\u3001,\uFF0C]/g, '.');
  if (!/^\d{1,3}(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

const dtf = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const df = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' });
export const formatDateTime = (iso: string | number) => dtf.format(new Date(iso));
export const formatShortDate = (t: number) => df.format(new Date(t));

/** datetime-local の値(Asia/Tokyo)⇔ ISO 文字列 */
export function toLocalInput(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  return d.toISOString().slice(0, 16);
}
export function fromLocalInput(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const t = Date.parse(`${local}:00+09:00`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
