/**
 * API 費用の見積もりと上限(docs/AI_EVALUATION.md §6)。初期の上限案は 5,000 円(承認待ち)。
 * 単価はコードに書かない:実行する人が、その時点の各社の公式の料金表を確認して設定ファイルに書く
 * (料金は変わるため。確認した日付と出典 URL も必須)。
 */
import { z } from 'zod';

export const DEFAULT_BUDGET_JPY = 5000;

export const PriceConfig = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  /** 100 万トークンあたりの米ドル(公式の料金表から転記) */
  usd_per_million_input_tokens: z.number().nonnegative(),
  usd_per_million_output_tokens: z.number().nonnegative(),
  /** 画像 1 枚あたりの入力トークンの見込み(各社の資料で確認) */
  input_tokens_per_image: z.number().int().positive(),
  /** 1 回あたりの文字の入力・出力トークンの見込み */
  text_input_tokens_per_call: z.number().int().nonnegative(),
  output_tokens_per_call: z.number().int().positive(),
  /** 円換算のレート(安全側に高めに) */
  jpy_per_usd: z.number().positive(),
  /** 確認した日付と出典 */
  checked_on: z.iso.date(),
  source_url: z.url(),
});
export type PriceConfig = z.infer<typeof PriceConfig>;

/** 1 回の呼び出しの見積もり(円) */
export function estimateCallJpy(p: PriceConfig, images = 1): number {
  const input = p.input_tokens_per_image * images + p.text_input_tokens_per_call;
  const usd =
    (input * p.usd_per_million_input_tokens + p.output_tokens_per_call * p.usd_per_million_output_tokens) / 1_000_000;
  return usd * p.jpy_per_usd;
}

/** 実際の使用量(応答のトークン数)からの費用(円) */
export function actualCallJpy(p: PriceConfig, inputTokens: number, outputTokens: number): number {
  return (
    ((inputTokens * p.usd_per_million_input_tokens + outputTokens * p.usd_per_million_output_tokens) / 1_000_000) *
    p.jpy_per_usd
  );
}

export interface Plan {
  calls: number;
  estimatedJpy: number;
  budgetJpy: number;
  withinBudget: boolean;
}

/**
 * 実行前の見積もり。安全のため、見積もりの 1.5 倍が上限に収まるときだけ実行してよい
 * (トークン数の見込み違い・再試行に備える)
 */
export function planRun(
  prices: readonly PriceConfig[],
  meals: number,
  repeats: number,
  budgetJpy = DEFAULT_BUDGET_JPY,
): Plan {
  const calls = prices.length * meals * repeats;
  const estimatedJpy = prices.reduce((a, p) => a + estimateCallJpy(p) * meals * repeats, 0);
  return { calls, estimatedJpy, budgetJpy, withinBudget: estimatedJpy * 1.5 <= budgetJpy };
}

/** 実行中の上限:使った額が上限に達したら、それ以上呼ばない */
export class BudgetGuard {
  private spent = 0;
  readonly budgetJpy: number;
  constructor(budgetJpy = DEFAULT_BUDGET_JPY) {
    this.budgetJpy = budgetJpy;
  }
  /** 次の呼び出しの見積もりを足しても上限内か */
  canSpend(nextJpy: number): boolean {
    return this.spent + nextJpy <= this.budgetJpy;
  }
  record(jpy: number): void {
    this.spent += jpy;
  }
  get spentJpy(): number {
    return this.spent;
  }
}
