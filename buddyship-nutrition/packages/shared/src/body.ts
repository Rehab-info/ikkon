/**
 * InBody(体組成)の型と入力の検証(Sprint 3。docs/API.md §体組成、DATABASE §3.7)。
 * サーバー(SQL の private.check_body_payload / private.body_warnings)と同じ規則。範囲は仮値 [D-12]。
 * 値の良し悪しの判定(低栄養・サルコペニアなど)はしない。警告は入力の整合性の確認だけ。
 */
import { z } from 'zod';

export const BODY_METRICS = ['weight_kg', 'skeletal_muscle_kg', 'body_fat_kg', 'body_fat_pct'] as const;
export type BodyMetric = (typeof BODY_METRICS)[number];

/** 入力できる範囲(両端を含む)。DATABASE §3.7 の CHECK と同じ */
export const BODY_LIMITS: Record<BodyMetric, { min: number; max: number }> = {
  weight_kg: { min: 20, max: 300 },
  skeletal_muscle_kg: { min: 5, max: 100 },
  body_fat_kg: { min: 0.5, max: 200 },
  body_fat_pct: { min: 1, max: 75 },
};

export const BODY_LABELS: Record<BodyMetric, { label: string; unit: string }> = {
  weight_kg: { label: '体重', unit: 'kg' },
  skeletal_muscle_kg: { label: '骨格筋量', unit: 'kg' },
  body_fat_kg: { label: '体脂肪量', unit: 'kg' },
  body_fat_pct: { label: '体脂肪率', unit: '%' },
};

export const BodyCondition = z.enum(['before_meal', 'after_meal', 'unknown']);
export type BodyCondition = z.infer<typeof BodyCondition>;
export const BODY_CONDITION_LABELS: Record<BodyCondition, string> = {
  before_meal: '食事の前',
  after_meal: '食事の後',
  unknown: 'わからない・記録しない',
};

/** 小数第 1 位までの数(0.1 単位の整数に直せる) */
export const toTenths = (v: number): number => Math.round(v * 10);
const oneDecimal = (v: number) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9;

export const BodyPayload = z.object({
  measured_at: z.iso.datetime({ offset: true }),
  weight_kg: z.number().refine(oneDecimal),
  skeletal_muscle_kg: z.number().refine(oneDecimal),
  body_fat_kg: z.number().refine(oneDecimal),
  body_fat_pct: z.number().refine(oneDecimal),
  device_model: z.string().trim().min(1).max(50),
  condition: BodyCondition,
});
export type BodyPayload = z.infer<typeof BodyPayload>;

export type BodyFieldError = 'required' | 'decimal' | 'out_of_range';
export type BodyWarning = 'fat_pct_mismatch';
export const BODY_WARNING_TEXT: Record<BodyWarning, string> = {
  fat_pct_mismatch:
    '体脂肪率が、体脂肪量と体重から計算した値と離れています。結果用紙の数字をもう一度確かめてください(このまま保存もできます)。',
};

/** 1 項目の検証(画面の 1 問ごと) */
export function checkBodyField(metric: BodyMetric, value: number | null | undefined): BodyFieldError | null {
  if (value === null || value === undefined || Number.isNaN(value)) return 'required';
  if (!oneDecimal(value)) return 'decimal';
  const { min, max } = BODY_LIMITS[metric];
  return value < min || value > max ? 'out_of_range' : null;
}

/** 骨格筋量・体脂肪量は体重の一部(合計も体重未満)。満たさなければ保存できない */
export function bodyConsistent(v: Pick<BodyPayload, 'weight_kg' | 'skeletal_muscle_kg' | 'body_fat_kg'>): boolean {
  const w = toTenths(v.weight_kg);
  const m = toTenths(v.skeletal_muscle_kg);
  const f = toTenths(v.body_fat_kg);
  return m < w && f < w && m + f < w;
}

/**
 * 体脂肪量 ÷ 体重 × 100(小数第 1 位で四捨五入)と、入力された体脂肪率の差が 1.5 ポイントを超えたら警告。
 * 浮動小数点の誤差を避けるため 0.1 単位の整数で計算する(SQL の private.body_warnings と同じ結果)
 */
export function bodyWarnings(v: Pick<BodyPayload, 'weight_kg' | 'body_fat_kg' | 'body_fat_pct'>): BodyWarning[] {
  const w = toTenths(v.weight_kg);
  const f = toTenths(v.body_fat_kg);
  const p = toTenths(v.body_fat_pct);
  if (w <= 0) return [];
  const computed = Math.floor((2 * f * 1000 + w) / (2 * w)); // round(f / w × 1000)
  return Math.abs(computed - p) > 15 ? ['fat_pct_mismatch'] : [];
}

const Num = z.coerce.number();
export const BodyRecord = z.object({
  id: z.uuid(),
  member_id: z.uuid(),
  measured_at: z.string(),
  recorded_at: z.string(),
  updated_at: z.string(),
  weight_kg: Num,
  skeletal_muscle_kg: Num,
  body_fat_kg: Num,
  body_fat_pct: Num,
  device_model: z.string(),
  condition: BodyCondition,
  entry_source: z.enum(['self', 'staff']),
  entered_by_me: z.boolean().nullable(),
  entered_by_name: z.string().nullable(),
  edited: z.boolean(),
  warnings: z.array(z.enum(['fat_pct_mismatch'])),
});
export type BodyRecord = z.infer<typeof BodyRecord>;
export const BodyRecords = z.array(BodyRecord);

export const BodySaved = z.object({ id: z.uuid(), warnings: z.array(z.enum(['fat_pct_mismatch'])) });

export const BodyHistory = z.array(
  z.object({
    op: z.enum(['insert', 'update', 'delete']),
    changed_at: z.string(),
    changed_by_name: z.string().nullable(),
    changed_by_me: z.boolean().nullable(),
    snapshot: z.object({
      measured_at: z.string(),
      weight_kg: Num,
      skeletal_muscle_kg: Num,
      body_fat_kg: Num,
      body_fat_pct: Num,
      device_model: z.string(),
      condition: BodyCondition,
      entry_source: z.enum(['self', 'staff']),
    }),
  }),
);
export type BodyHistory = z.infer<typeof BodyHistory>;
