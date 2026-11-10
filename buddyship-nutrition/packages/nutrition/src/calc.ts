/**
 * 栄養計算(決定論的)。管理栄養士が監修できるよう、規則をこのファイルに集める(安全要件 8)。
 *
 *   摂取量 g     = 提供量 g × 食べた割合(%) / 100
 *   成分量       = 100 g あたりの成分値 × 摂取量 g / 100
 *   エネルギー   = 成分表のエネルギー(ENERC_KCAL)× 摂取量 / 100(P/F/C から再計算しない)
 *   合計         = 丸める前の値を足し、最後に表示用に丸める
 *
 * 浮動小数点の誤差を避けるため、内部では整数(100 g あたり値は 0.1 単位、量は 0.01 g 単位、結果は 0.01 単位)で計算する。
 * 成分表の値が「未測定(-)」の成分は合計に入れず、incomplete として知らせる(0 とはみなさない)。
 */
import type { Nutrient } from './sfct8-columns.ts';
import type { ParsedValue } from './value.ts';

/** 規則を変えたら上げる。食事明細に保存し、どの規則で計算したかを後から追えるようにする */
export const NUTRITION_RULES_VERSION = 'sfct8-standard-v1';

export const NUTRIENTS: readonly Nutrient[] = ['energy_kcal', 'protein_g', 'fat_g', 'carbohydrate_g'];

export type Per100g = Record<Nutrient, ParsedValue>;

/** 0.01 単位の整数で持つ成分量。null は「値がない(未測定)」 */
export type Hundredths = Record<Nutrient, number | null>;

export interface NutrientTotal {
  /** 0.01 単位の整数(内部値) */
  hundredths: number;
  /** 未測定の成分を含む食品があり、合計が実際より少ない可能性がある */
  incomplete: boolean;
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

/** 1 品の成分量(0.01 単位)。未測定の成分は null */
export function itemNutrients(per100: Per100g, consumedHundredths: number): Hundredths {
  const out = {} as Hundredths;
  for (const n of NUTRIENTS) {
    const v = per100[n].value;
    if (v === null) {
      out[n] = null;
      continue;
    }
    const tenths = toScaledInt(v, 10); // 100 g あたりの値(0.1 単位)
    // tenths/10 × (consumed/100) / 100 → 0.01 単位 = tenths × consumed / 1000
    out[n] = divRoundHalfUp(tenths * consumedHundredths, 1000);
  }
  return out;
}

export function sumNutrients(items: readonly Hundredths[]): Totals {
  const totals = {} as Totals;
  for (const n of NUTRIENTS) {
    let sum = 0;
    let incomplete = false;
    for (const it of items) {
      const v = it[n];
      if (v === null) incomplete = true;
      else sum += v;
    }
    totals[n] = { hundredths: sum, incomplete };
  }
  return totals;
}

/** 表示用の丸め:エネルギーは整数 kcal、P/F/C は小数第 1 位(四捨五入) */
export function displayValue(n: Nutrient, hundredths: number): string {
  if (n === 'energy_kcal') return String(divRoundHalfUp(hundredths, 100));
  const tenths = divRoundHalfUp(hundredths, 10);
  return `${Math.floor(tenths / 10)}.${tenths % 10}`;
}
