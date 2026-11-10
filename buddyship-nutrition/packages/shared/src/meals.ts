/**
 * 食事記録の API の型(RPC・Edge Function の入出力。docs/API.md)。
 * 栄養値はサーバーが計算して返す。クライアントから栄養値は送らない(SaveMealItem にない)。
 */
import { z } from 'zod';

export const MealSlot = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export type MealSlot = z.infer<typeof MealSlot>;
export const MainSlot = z.enum(['breakfast', 'lunch', 'dinner']);
export const SlotStatus = z.enum(['recorded', 'skipped', 'dayservice']);
export type SlotStatus = z.infer<typeof SlotStatus>;
export const ComponentRole = z.enum(['food', 'ingredient', 'cooking_oil', 'seasoning']);
export type ComponentRole = z.infer<typeof ComponentRole>;
export const MatchStatus = z.enum(['confirmed', 'needs_review']);
export const ValueKind = z.enum(['measured', 'estimated', 'trace', 'estimated_trace', 'not_determined']);

export const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: '朝ごはん',
  lunch: '昼ごはん',
  dinner: '夕ごはん',
  snack: '間食',
};
export const ROLE_LABELS: Record<ComponentRole, string> = {
  food: '食べもの',
  ingredient: '材料',
  cooking_oil: '調理に使った油',
  seasoning: '調味料',
};

const Per100Value = z.object({ value: z.coerce.number().nullable(), kind: ValueKind, raw: z.string() });
export const Per100 = z.object({
  energy_kcal: Per100Value,
  protein_g: Per100Value,
  fat_g: Per100Value,
  carbohydrate_g: Per100Value,
});
export type Per100 = z.infer<typeof Per100>;

export const FoodRef = z.object({
  food_id: z.uuid(),
  food_code: z.string(),
  display_name: z.string(),
  per100: Per100,
  exact_match: z.boolean().optional(),
});
export type FoodRef = z.infer<typeof FoodRef>;
export const FoodList = z.array(FoodRef);

const num = z.coerce.number();

export const SaveMealItem = z
  .object({
    role: ComponentRole,
    dish_group_id: z.uuid().nullable(),
    dish_label: z.string().min(1).max(100).nullable(),
    dish_composition_known: z.boolean().nullable(),
    match_status: MatchStatus,
    food_id: z.uuid().nullable(),
    candidate_food_ids: z.array(z.uuid()).max(10),
    origin: z.enum(['ai', 'ai_corrected', 'manual']),
    ai_label: z.string().min(1).max(100).nullable(),
    ai_estimated_served_g: z.number().positive().max(2000).nullable(),
    served_g: z.number().positive().max(2000),
    intake_percent: z.int().min(0).max(100),
    label: z.string().min(1).max(100),
  })
  .strict();
export type SaveMealItem = z.infer<typeof SaveMealItem>;

export const SaveMealPayload = z
  .object({
    slot: MealSlot,
    location: z.literal('home'),
    eaten_on: z.iso.date(),
    eaten_at: z.iso.datetime({ offset: true }).nullable(),
    eaten_at_precision: z.enum(['exact', 'approximate', 'slot_only']),
    info_source: z.enum(['photo', 'interview', 'manual']),
    analysis_id: z.uuid().nullable(),
    image_path: z.string().max(200).nullable(),
    items: z.array(SaveMealItem).min(1).max(40),
  })
  .strict();
export type SaveMealPayload = z.infer<typeof SaveMealPayload>;

export const SavedMealItem = z.object({
  item_id: z.uuid(),
  position: z.number(),
  role: ComponentRole,
  label: z.string(),
  dish_group_id: z.uuid().nullable(),
  dish_label: z.string().nullable(),
  dish_composition_known: z.boolean().nullable(),
  match_status: MatchStatus,
  food_id: z.uuid().nullable(),
  food_code: z.string().nullable(),
  candidates: FoodList,
  origin: z.enum(['ai', 'ai_corrected', 'manual']),
  ai_label: z.string().nullable(),
  ai_estimated_served_g: num.nullable(),
  served_g: num,
  intake_percent: z.number(),
  consumed_g: num,
  per100: Per100.nullable(),
  food_source_version: z.string().nullable(),
  amounts: z.object({
    energy_kcal: num.nullable(),
    protein_g: num.nullable(),
    fat_g: num.nullable(),
    carbohydrate_g: num.nullable(),
  }),
});
export type SavedMealItem = z.infer<typeof SavedMealItem>;

export const SavedMeal = z.object({
  meal_id: z.uuid(),
  member_id: z.uuid(),
  slot: MealSlot,
  location: z.literal('home'),
  eaten_on: z.iso.date(),
  eaten_at: z.string().nullable(),
  eaten_at_precision: z.enum(['exact', 'approximate', 'slot_only']),
  recorded_at: z.string(),
  updated_at: z.string(),
  entry_source: z.enum(['self', 'staff']),
  entered_by_name: z.string().nullable(),
  entered_by_me: z.boolean(),
  info_source: z.enum(['photo', 'interview', 'manual']),
  has_image: z.boolean(),
  image_path: z.string().nullable(),
  totals: z.object({ energy_kcal: num, protein_g: num, fat_g: num, carbohydrate_g: num }),
  display_precision: z.enum(['normal', 'approximate']),
  needs_review_count: z.number(),
  nutrition_rules_version: z.string(),
  items: z.array(SavedMealItem),
});
export type SavedMeal = z.infer<typeof SavedMeal>;
export const SavedMeals = z.array(SavedMeal);

export const DailySummary = z.array(
  z.object({
    date: z.iso.date(),
    slots: z.object({ breakfast: SlotStatus.nullable(), lunch: SlotStatus.nullable(), dinner: SlotStatus.nullable() }),
    meal_count: z.number(),
    needs_review_count: z.coerce.number(),
    totals: z.object({ energy_kcal: num, protein_g: num, fat_g: num, carbohydrate_g: num }),
  }),
);
export type DailySummary = z.infer<typeof DailySummary>;

const AnalyzedLine = z.object({
  ai_label: z.string(),
  ai_estimated_served_g: z.number(),
  confidence: z.enum(['low', 'medium', 'high']),
  match_status: MatchStatus,
  food: FoodRef.nullable(),
  candidates: FoodList,
});
export const AnalyzeResponse = z.object({
  analysis_id: z.uuid(),
  provider: z.string(),
  is_estimate: z.literal(true),
  is_food_image: z.boolean(),
  items: z.array(
    z.discriminatedUnion('kind', [
      AnalyzedLine.extend({ kind: z.literal('food') }),
      z.object({
        kind: z.literal('dish'),
        dish_label: z.string(),
        composition_known: z.boolean(),
        components: z.array(AnalyzedLine.extend({ role: z.enum(['ingredient', 'cooking_oil', 'seasoning']) })),
      }),
    ]),
  ),
});
export type AnalyzeResponse = z.infer<typeof AnalyzeResponse>;
