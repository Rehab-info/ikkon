/**
 * AI の出力スキーマ(プロバイダ共通。docs/API.md §2)。
 * 食品名・提供量・料理の構成食材だけを受け取る。栄養値・診断・助言の項目はスキーマにないので受け取らない(.strict())。
 */
import { z } from 'zod';

const Confidence = z.enum(['low', 'medium', 'high']);
const Label = z.string().trim().min(1).max(100);
const Grams = z.number().positive().max(2000);

export const AiComponent = z
  .object({
    label: Label,
    served_g: Grams,
    role: z.enum(['ingredient', 'cooking_oil', 'seasoning']),
    confidence: Confidence,
  })
  .strict();

export const AiMealItem = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('food'), label: Label, served_g: Grams, confidence: Confidence }).strict(),
  z
    .object({
      kind: z.literal('dish'),
      label: Label,
      composition_known: z.boolean(),
      components: z.array(AiComponent).min(1).max(15),
    })
    .strict(),
]);

export const AiMealResult = z
  .object({
    is_food_image: z.boolean(),
    items: z.array(AiMealItem).max(20),
  })
  .strict();

export type AiMealResult = z.infer<typeof AiMealResult>;

export interface AiAdapter {
  provider: string;
  model: string;
  analyzeMealImage(image: Uint8Array, mime: 'image/jpeg' | 'image/webp'): Promise<unknown>;
}
