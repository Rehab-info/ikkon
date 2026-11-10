/**
 * AI 比較用の評価データセットの形(docs/AI_EVALUATION.md §3)。
 * 30〜50 食の「秤量した自宅の食事」。利用者の実データは使わない(スタッフ・協力者が用意した食事を撮影・秤量)。
 * 画像には顔・郵便物・薬袋などを写さない。画像ファイルはリポジトリにコミットしない(パスだけを持つ)。
 */
import { z } from 'zod';

export const Role = z.enum(['food', 'ingredient', 'cooking_oil', 'seasoning']);

/** 正解の 1 品(秤量した提供量と、成分表の食品番号) */
export const TruthItem = z.object({
  label: z.string().min(1).max(40),
  food_code: z.string().regex(/^\d{5}$/),
  weighed_g: z.number().positive().max(2000),
  role: Role,
  /** 料理の構成要素なら料理名(肉じゃが など) */
  dish: z.string().max(40).nullable().default(null),
});

export const EvalMeal = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  /** 画像の場所(データセットのフォルダからの相対パス)。mock では読まない */
  image: z.string().max(200),
  slot: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  /** 撮影条件(照明・器・角度)。結果の偏りの確認用 */
  conditions: z.array(z.string().max(40)).max(10).default([]),
  items: z.array(TruthItem).min(1).max(40),
});
export type EvalMeal = z.infer<typeof EvalMeal>;

export const EvalDataset = z.object({
  /** データセットの版(結果の再現のため) */
  version: z.string().min(1),
  /** 架空・協力者のデータであることの確認(利用者データの流用をしない) */
  contains_member_data: z.literal(false),
  meals: z.array(EvalMeal).min(1).max(100),
});
export type EvalDataset = z.infer<typeof EvalDataset>;

/** AI の出力(analyze-meal の AiMealResult と同じ形の、評価に必要な部分) */
export const PredLine = z.object({
  label: z.string(),
  served_g: z.number(),
  role: Role,
  confidence: z.enum(['low', 'medium', 'high']),
  dish: z.string().nullable(),
});
export type PredLine = z.infer<typeof PredLine>;
