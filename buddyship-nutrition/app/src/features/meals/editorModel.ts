/**
 * 食事の確認・修正画面の状態(画面から切り離した純粋な関数。単体テストの対象)。
 * 栄養値の計算・合計・見出しは @buddyship/nutrition だけを使う(規則を画面に持たない)。
 * 保存する値はサーバーが計算し直す。ここでの計算は表示用。
 */
import {
  consumedHundredthsG,
  itemNutrients,
  mealTotalHeading,
  summarizeMeal,
  type ItemNutrients,
  type MealLine,
  type MealSummary,
  type Per100g,
} from '@buddyship/nutrition';
import type { AnalyzeResponse, ComponentRole, FoodRef, Per100, SaveMealItem, SavedMeal } from '@buddyship/shared';

export interface EditorDish {
  key: string;
  label: string;
  compositionKnown: boolean;
}

export interface EditorLine {
  key: string;
  role: ComponentRole;
  dishKey: string | null;
  label: string;
  aiLabel: string | null;
  aiEstimatedServedG: number | null;
  servedG: number;
  intakePercent: number;
  status: 'confirmed' | 'needs_review';
  food: FoodRef | null;
  candidates: FoodRef[];
  origin: 'ai' | 'ai_corrected' | 'manual';
}

export interface EditorState {
  dishes: EditorDish[];
  lines: EditorLine[];
}

let counter = 0;
const newKey = () => globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${++counter}`;

export function fromAnalysis(a: AnalyzeResponse): EditorState {
  const dishes: EditorDish[] = [];
  const lines: EditorLine[] = [];
  const line = (
    l: AnalyzeResponse['items'][number] & { kind: 'food' },
    role: ComponentRole,
    dishKey: string | null,
  ): EditorLine => ({
    key: newKey(),
    role,
    dishKey,
    label: l.match_status === 'confirmed' && l.food ? l.food.display_name : l.ai_label,
    aiLabel: l.ai_label,
    aiEstimatedServedG: l.ai_estimated_served_g,
    servedG: l.ai_estimated_served_g,
    intakePercent: 100,
    status: l.match_status === 'confirmed' && l.food ? 'confirmed' : 'needs_review',
    food: l.match_status === 'confirmed' ? l.food : null,
    candidates: l.candidates,
    origin: 'ai',
  });
  for (const it of a.items) {
    if (it.kind === 'food') {
      lines.push(line(it, 'food', null));
    } else {
      const dish: EditorDish = { key: newKey(), label: it.dish_label, compositionKnown: it.composition_known };
      dishes.push(dish);
      for (const c of it.components) lines.push(line({ ...c, kind: 'food' }, c.role, dish.key));
    }
  }
  return { dishes, lines };
}

export function fromSavedMeal(m: SavedMeal): EditorState {
  const dishes = new Map<string, EditorDish>();
  const lines: EditorLine[] = m.items.map((i) => {
    if (i.dish_group_id && !dishes.has(i.dish_group_id)) {
      dishes.set(i.dish_group_id, {
        key: i.dish_group_id,
        label: i.dish_label ?? '料理',
        compositionKnown: i.dish_composition_known ?? true,
      });
    }
    const food: FoodRef | null =
      i.match_status === 'confirmed' && i.food_id && i.per100
        ? { food_id: i.food_id, food_code: i.food_code ?? '', display_name: i.label, per100: i.per100 }
        : null;
    return {
      key: newKey(),
      role: i.role,
      dishKey: i.dish_group_id,
      label: i.label,
      aiLabel: i.ai_label,
      aiEstimatedServedG: i.ai_estimated_served_g,
      servedG: i.served_g,
      intakePercent: i.intake_percent,
      status: i.match_status,
      food,
      candidates: i.candidates,
      origin: i.origin,
    };
  });
  return { dishes: [...dishes.values()], lines };
}

const touched = (l: EditorLine): EditorLine['origin'] => (l.origin === 'manual' ? 'manual' : 'ai_corrected');

/** 要確認の食品を候補・検索結果から選ぶ → 確定 */
export function chooseFood(s: EditorState, key: string, food: FoodRef): EditorState {
  return {
    ...s,
    lines: s.lines.map((l) =>
      l.key === key
        ? { ...l, food, status: 'confirmed', label: food.display_name, candidates: [], origin: touched(l) }
        : l,
    ),
  };
}

/** 提供量を変える(0.1 g 単位、1〜2000 g) */
export function setServed(s: EditorState, key: string, grams: number): EditorState {
  const g = Math.min(2000, Math.max(1, Math.round(grams * 10) / 10));
  return { ...s, lines: s.lines.map((l) => (l.key === key ? { ...l, servedG: g, origin: touched(l) } : l)) };
}

/** 食べた割合(0〜100 の整数)。key を省略すると全部に */
export function setIntake(s: EditorState, percent: number, key?: string): EditorState {
  const p = Math.min(100, Math.max(0, Math.round(percent)));
  return { ...s, lines: s.lines.map((l) => (key === undefined || l.key === key ? { ...l, intakePercent: p } : l)) };
}

export function removeLine(s: EditorState, key: string): EditorState {
  const lines = s.lines.filter((l) => l.key !== key);
  const usedDishes = new Set(lines.map((l) => l.dishKey));
  return { dishes: s.dishes.filter((d) => usedDishes.has(d.key)), lines };
}

/** 食品(単品)または料理の材料・調理油・調味料を追加する(手入力 = manual) */
export function addLine(
  s: EditorState,
  food: FoodRef,
  role: ComponentRole,
  dishKey: string | null,
  grams: number,
): EditorState {
  if ((role === 'food') !== (dishKey === null)) throw new Error('role/dish mismatch');
  return {
    ...s,
    lines: [
      ...s.lines,
      {
        key: newKey(),
        role,
        dishKey,
        label: food.display_name,
        aiLabel: null,
        aiEstimatedServedG: null,
        servedG: grams,
        intakePercent: 100,
        status: 'confirmed',
        food,
        candidates: [],
        origin: 'manual',
      },
    ],
  };
}

export function setDishCompositionKnown(s: EditorState, dishKey: string, known: boolean): EditorState {
  return { ...s, dishes: s.dishes.map((d) => (d.key === dishKey ? { ...d, compositionKnown: known } : d)) };
}

const toPer100g = (p: Per100): Per100g =>
  Object.fromEntries(
    (['energy_kcal', 'protein_g', 'fat_g', 'carbohydrate_g'] as const).map((n) => [
      n,
      {
        value: p[n].value,
        kind: p[n].kind,
        raw: p[n].raw,
        traceAsZero: p[n].kind === 'trace' || p[n].kind === 'estimated_trace',
      },
    ]),
  ) as Per100g;

export function lineNutrients(l: EditorLine): ItemNutrients | null {
  if (l.status !== 'confirmed' || !l.food) return null;
  return itemNutrients(toPer100g(l.food.per100), consumedHundredthsG(l.servedG, l.intakePercent));
}

/** 画面の合計と見出し(要確認があれば「確認済み食品のみの小計」) */
export function summarize(s: EditorState): { summary: MealSummary; heading: ReturnType<typeof mealTotalHeading> } {
  const dishByKey = new Map(s.dishes.map((d) => [d.key, d]));
  const lines: MealLine[] = s.lines.map((l) => {
    const dish = l.dishKey ? dishByKey.get(l.dishKey) : undefined;
    return {
      role: l.role,
      matchStatus: l.status,
      nutrients: lineNutrients(l),
      ...(dish ? { dish: { groupId: dish.key, label: dish.label, compositionKnown: dish.compositionKnown } } : {}),
    };
  });
  const summary = summarizeMeal(lines);
  return { summary, heading: mealTotalHeading(summary) };
}

/** 保存用の明細(栄養値は含めない。サーバーが計算する) */
export function toItems(s: EditorState): SaveMealItem[] {
  const dishByKey = new Map(s.dishes.map((d) => [d.key, d]));
  return s.lines.map((l) => {
    const dish = l.dishKey ? dishByKey.get(l.dishKey) : undefined;
    return {
      role: l.role,
      dish_group_id: dish ? (isUuid(dish.key) ? dish.key : null) : null,
      dish_label: dish ? dish.label : null,
      dish_composition_known: dish ? dish.compositionKnown : null,
      match_status: l.status,
      food_id: l.status === 'confirmed' ? (l.food?.food_id ?? null) : null,
      candidate_food_ids: l.status === 'confirmed' ? [] : l.candidates.map((c) => c.food_id).slice(0, 10),
      origin: l.origin,
      ai_label: l.aiLabel,
      ai_estimated_served_g: l.origin === 'manual' ? null : l.aiEstimatedServedG,
      served_g: l.servedG,
      intake_percent: l.intakePercent,
      label: l.label.slice(0, 100),
    };
  });
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
}

export const INTAKE_CHOICES = [
  { percent: 100, label: '全部' },
  { percent: 80, label: 'ほとんど' },
  { percent: 50, label: '半分' },
  { percent: 20, label: '少し' },
  { percent: 0, label: '食べなかった' },
] as const;
