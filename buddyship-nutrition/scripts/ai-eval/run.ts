/**
 * AI プロバイダ比較の実行(docs/AI_EVALUATION.md §5)。
 *   node scripts/ai-eval/run.ts [--dataset <path>] [--provider mock] [--repeats 1] [--prices <path>]
 *
 * 現時点で実行できるのは mock(開発用の仮の解析。外部に送信しない・費用なし)だけ。
 * 実際の AI(有料 API)は、プロバイダの選定(D-01)・予算(初期案 5,000 円)・データセットの承認の後に追加する。
 * 追加しても、実行前の見積もりが上限を超える場合と、--approved が無い場合は呼ばない。
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { parseSfctValue, type Per100g } from '../../packages/nutrition/src/index.ts';
import { MOCK_RESULT } from '../../supabase/functions/_shared/ai/mock.ts';
import { AiMealResult } from '../../supabase/functions/_shared/ai/schema.ts';
import { BudgetGuard, DEFAULT_BUDGET_JPY, PriceConfig, actualCallJpy, estimateCallJpy, planRun } from './budget.ts';
import { EvalDataset, type PredLine } from './dataset.ts';
import { scoreMeal, summarize, type AliasDict, type FoodTable, type MealScore } from './metrics.ts';

const root = new URL('../../', import.meta.url).pathname;

/** 成分表の取込結果(supabase/seeds/foods.sql)の元の表記から 100 g あたりの値を作る(DB と同じ解釈) */
export function loadFoods(sqlText: string): FoodTable {
  const foods: FoodTable = new Map();
  const re = /^\('mext_sfct8', '[^']*', '(\d{5})',.*'(\{[^']*\})'::jsonb\)/gm;
  for (const [, code, json] of sqlText.matchAll(re)) {
    if (!code || !json) continue;
    const raw = JSON.parse(json) as Record<string, string>;
    foods.set(code, {
      energy_kcal: parseSfctValue(raw['ENERC_KCAL']),
      protein_g: parseSfctValue(raw['PROT-']),
      fat_g: parseSfctValue(raw['FAT-']),
      carbohydrate_g: parseSfctValue(raw['CHOCDF-']),
    } as Per100g);
  }
  return foods;
}

/** analyze-meal と同じ形の結果を、評価用の明細に平らにする */
export function flatten(result: AiMealResult): PredLine[] {
  return result.items.flatMap((it): PredLine[] =>
    it.kind === 'food'
      ? [{ label: it.label, served_g: it.served_g, role: 'food' as const, confidence: it.confidence, dish: null }]
      : it.components.map((c) => ({
          label: c.label,
          served_g: c.served_g,
          role: c.role,
          confidence: c.confidence,
          dish: it.label,
        })),
  );
}

interface Provider {
  name: string;
  /** 外部に画像を送るか(送るものは --approved が必要) */
  external: boolean;
  analyze(imagePath: string): Promise<{ lines: PredLine[]; inputTokens: number; outputTokens: number }>;
}

const PROVIDERS: Record<string, Provider> = {
  mock: {
    name: 'mock',
    external: false,
    analyze: () =>
      Promise.resolve({
        lines: flatten(AiMealResult.parse(MOCK_RESULT)),
        inputTokens: 0,
        outputTokens: 0,
      }),
  },
  // 実際のプロバイダ(OpenAI・Google Gemini・Anthropic など)は承認後にここへ追加する。
};

async function main() {
  const { values } = parseArgs({
    options: {
      dataset: { type: 'string', default: `${root}scripts/ai-eval/sample-dataset.json` },
      provider: { type: 'string', multiple: true, default: ['mock'] },
      repeats: { type: 'string', default: '1' },
      prices: { type: 'string' },
      budget: { type: 'string', default: String(DEFAULT_BUDGET_JPY) },
      approved: { type: 'boolean', default: false },
    },
  });
  const dataset = EvalDataset.parse(JSON.parse(readFileSync(values.dataset, 'utf8')));
  const repeats = Math.max(1, Math.min(5, Number(values.repeats)));
  const budgetJpy = Number(values.budget);
  const providers = values.provider.map((n) => {
    const p = PROVIDERS[n];
    if (!p) throw new Error(`未対応のプロバイダ: ${n}(実際の AI は承認後に追加します)`);
    return p;
  });
  const external = providers.filter((p) => p.external);
  let prices: PriceConfig[] = [];
  if (external.length > 0) {
    if (!values.approved) throw new Error('外部の AI を呼ぶには、予算とデータセットの承認(--approved)が必要です');
    if (!values.prices) throw new Error('外部の AI を呼ぶには料金の設定(--prices)が必要です');
    prices = PriceConfig.array().parse((JSON.parse(readFileSync(values.prices, 'utf8')) as { prices: unknown }).prices);
    const plan = planRun(
      prices.filter((p) => external.some((e) => e.name === p.provider)),
      dataset.meals.length,
      repeats,
      budgetJpy,
    );
    if (!plan.withinBudget)
      throw new Error(`見積もり ${Math.ceil(plan.estimatedJpy)} 円 × 1.5 が上限 ${budgetJpy} 円を超えます`);
  }

  const aliases = (
    JSON.parse(readFileSync(`${root}supabase/seed-data/food-aliases.json`, 'utf8')) as { aliases: AliasDict }
  ).aliases;
  const foods = loadFoods(readFileSync(`${root}supabase/seeds/foods.sql`, 'utf8'));
  const guard = new BudgetGuard(budgetJpy);
  const report: Record<string, unknown> = {
    dataset: dataset.version,
    meals: dataset.meals.length,
    repeats,
    note: 'mock は写真を見ずに決まった結果を返すため、指標は計算の確認用で、AI の性能ではありません',
  };
  for (const p of providers) {
    const price = prices.find((x) => x.provider === p.name);
    if (p.external && !price) throw new Error(`料金の設定がありません: ${p.name}`);
    const scores: MealScore[] = [];
    const latencies: number[] = [];
    for (let r = 0; r < repeats; r++) {
      for (const meal of dataset.meals) {
        // 次の 1 回の見積もりを足すと上限を超えるなら、そこで止める
        if (price && !guard.canSpend(estimateCallJpy(price))) break;
        const t0 = performance.now();
        const out = await p.analyze(meal.image);
        latencies.push(Math.round(performance.now() - t0));
        if (price) guard.record(actualCallJpy(price, out.inputTokens, out.outputTokens));
        scores.push(scoreMeal(meal, out.lines, aliases, foods));
      }
    }
    report[p.name] = { summary: summarize(scores, latencies), spentJpy: guard.spentJpy };
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });
}
