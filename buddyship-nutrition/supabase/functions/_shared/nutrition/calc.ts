// 自動生成(scripts/sync-nutrition.mjs)。packages/nutrition/src から写したもの。ここを直接編集しない
/**
 * 栄養計算(決定論的)。管理栄養士が監修できるよう、規則をこのファイルに集める(安全要件 8)。
 *
 *   摂取量 g     = 提供量 g × 食べた割合(%) / 100
 *   成分量       = 100 g あたりの成分値 × 摂取量 g / 100
 *   エネルギー   = 成分表のエネルギー(ENERC_KCAL)× 摂取量 / 100(P/F/C から再計算しない)
 *   合計         = 丸める前の値を足し、最後に表示用に丸める
 *
 * 浮動小数点の誤差を避けるため、内部では整数(100 g あたり値は 0.1 単位、量は 0.01 g 単位、結果は 0.01 単位)で計算する。
 * 成分表の値の元の表記(Tr・(Tr)・推定値・未測定)は計算結果にも残す:
 *   - Tr・(Tr) は計算上 0 として扱うが、測定上のゼロとは区別する(traceAsZero)
 *   - 未測定(-)の成分は合計に入れず、incomplete として知らせる(0 とはみなさない)
 */
import type { Nutrient } from './sfct8-columns.ts';
import type { ParsedValue, ValueKind } from './value.ts';

/** 規則を変えたら上げる。食事明細に保存し、どの規則で計算したかを後から追えるようにする */
export const NUTRITION_RULES_VERSION = 'sfct8-standard-v2';

export const NUTRIENTS: readonly Nutrient[] = ['energy_kcal', 'protein_g', 'fat_g', 'carbohydrate_g'];

export type Per100g = Record<Nutrient, ParsedValue>;

/** 1 品の 1 成分の量(0.01 単位の整数)と、その根拠になった成分表の表記 */
export interface NutrientAmount {
  /** 0.01 単位の整数。未測定は null */
  hundredths: number | null;
  /** 成分表の表記の種類 */
  kind: ValueKind;
  /** 成分表の元の表記 */
  raw: string;
  /** Tr・(Tr) を 0 として扱った結果か(測定上のゼロではない) */
  traceAsZero: boolean;
}

export type ItemNutrients = Record<Nutrient, NutrientAmount>;

export interface NutrientTotal {
  /** 0.01 単位の整数(内部値) */
  hundredths: number;
  /** 未測定の成分を含む食品があり、合計が実際より少ない可能性がある */
  incomplete: boolean;
  /** Tr・(Tr) を 0 として扱った食品を含む */
  includesTrace: boolean;
  /** 推定値((数値)・(Tr))を含む */
  includesEstimated: boolean;
  /** 合計が 0 で、その 0 がすべて Tr 由来(「0」ではなく「微量」と表示する) */
  traceOnly: boolean;
}

export type Totals = Record<Nutrient, NutrientTotal>;

function toScaledInt(value: number, scale: number): number {
  const scaled = Math.round(value * scale);
  if (Math.abs(scaled / scale - value) > 1e-9) throw new RangeError(`too many decimals: ${value}`);
  return scaled;
}

/** 四捨五入(0.5 は切り上げ)の整数除算。正の値のみ */
function divRoundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((numerator * 2 + denominator) / (denominator * 2));
}

/** 摂取量(0.01 g 単位の整数)= 提供量 × 食べた割合 */
export function consumedHundredthsG(servedG: number, intakePercent: number): number {
  if (!(servedG > 0 && servedG <= 2000)) throw new RangeError('servedG must be in (0, 2000]');
  if (!Number.isInteger(intakePercent) || intakePercent < 0 || intakePercent > 100) {
    throw new RangeError('intakePercent must be an integer 0-100');
  }
  const servedTenths = toScaledInt(servedG, 10); // 0.1 g 単位
  // servedTenths × percent / 1000 → 0.01 g 単位
  return divRoundHalfUp(servedTenths * intakePercent, 10);
}

/** 1 品の成分量。元の表記と、Tr を 0 として扱ったかを残す */
export function itemNutrients(per100: Per100g, consumedHundredths: number): ItemNutrients {
  const out = {} as ItemNutrients;
  for (const n of NUTRIENTS) {
    const p = per100[n];
    const base = { kind: p.kind, raw: p.raw, traceAsZero: p.traceAsZero };
    if (p.value === null) {
      out[n] = { hundredths: null, ...base };
      continue;
    }
    const tenths = toScaledInt(p.value, 10); // 100 g あたりの値(0.1 単位)
    // tenths/10 × (consumed/100) / 100 → 0.01 単位 = tenths × consumed / 1000
    out[n] = { hundredths: divRoundHalfUp(tenths * consumedHundredths, 1000), ...base };
  }
  return out;
}

export function sumNutrients(items: readonly ItemNutrients[]): Totals {
  const totals = {} as Totals;
  for (const n of NUTRIENTS) {
    let sum = 0;
    let incomplete = false;
    let includesTrace = false;
    let includesEstimated = false;
    let nonTraceContribution = false;
    for (const it of items) {
      const a = it[n];
      if (a.hundredths === null) {
        incomplete = true;
        continue;
      }
      sum += a.hundredths;
      if (a.traceAsZero) includesTrace = true;
      else nonTraceContribution = true;
      if (a.kind === 'estimated' || a.kind === 'estimated_trace') includesEstimated = true;
    }
    totals[n] = {
      hundredths: sum,
      incomplete,
      includesTrace,
      includesEstimated,
      traceOnly: sum === 0 && includesTrace && !nonTraceContribution,
    };
  }
  return totals;
}

/**
 * 表示の精度。
 *  - normal:エネルギーは整数 kcal、P/F/C は小数第 1 位
 *  - approximate:料理の構成食材が不明・要確認の食品があるなど、精密な値として見せないとき。
 *    エネルギーは 10 kcal 単位、P/F/C は 1 g 単位に丸め、「約」を付ける(追加要件 4)
 */
export type DisplayPrecision = 'normal' | 'approximate';

/** 表示用の丸め(四捨五入) */
export function displayValue(n: Nutrient, hundredths: number, precision: DisplayPrecision = 'normal'): string {
  if (precision === 'approximate') {
    if (n === 'energy_kcal') return `約${divRoundHalfUp(hundredths, 1000) * 10}`;
    return `約${divRoundHalfUp(hundredths, 100)}`;
  }
  if (n === 'energy_kcal') return String(divRoundHalfUp(hundredths, 100));
  const tenths = divRoundHalfUp(hundredths, 10);
  return `${Math.floor(tenths / 10)}.${tenths % 10}`;
}

/** 1 品の 1 成分の表示。Tr は「0」ではなく「微量」、未測定は「値なし」と出す(元の表記を併記) */
export function displayAmount(n: Nutrient, a: NutrientAmount, precision: DisplayPrecision = 'normal'): string {
  if (a.hundredths === null) return '値なし(成分表で未測定)';
  if (a.traceAsZero && a.hundredths === 0) return a.kind === 'estimated_trace' ? '微量(推定)' : '微量';
  const v = displayValue(n, a.hundredths, precision);
  return a.kind === 'estimated' ? `${v}(推定値)` : v;
}

/** 合計の表示。すべて Tr 由来の 0 は「微量」、未測定を含めば注記を付ける */
export function displayTotal(n: Nutrient, t: NutrientTotal, precision: DisplayPrecision = 'normal'): string {
  const v = t.traceOnly ? '微量' : displayValue(n, t.hundredths, precision);
  return t.incomplete ? `${v}(値のない食品を除く)` : v;
}
