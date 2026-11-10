/**
 * 開発・テスト用の仮の解析(実際の AI は呼ばない。D-01 でプロバイダが決まるまで)。
 * 画像の内容は見ず、決まった家庭の食事を返す。画面では「開発用の仮の解析」と表示する。
 * 要確認になる例(別名が複数の食品に当たる「豚肉」「豆腐」「だし」、辞書にない食材)を含める。
 */
import type { AiAdapter } from './schema.ts';

export const MOCK_RESULT = {
  is_food_image: true,
  items: [
    { kind: 'food', label: 'ごはん', served_g: 150, confidence: 'high' },
    {
      kind: 'dish',
      label: '肉じゃが',
      composition_known: true,
      components: [
        { label: 'じゃがいも', served_g: 80, role: 'ingredient', confidence: 'high' },
        { label: 'たまねぎ', served_g: 40, role: 'ingredient', confidence: 'medium' },
        { label: 'にんじん', served_g: 20, role: 'ingredient', confidence: 'medium' },
        { label: '豚肉', served_g: 50, role: 'ingredient', confidence: 'medium' },
        { label: 'サラダ油', served_g: 3, role: 'cooking_oil', confidence: 'low' },
        { label: 'しょうゆ', served_g: 9, role: 'seasoning', confidence: 'medium' },
        { label: '砂糖', served_g: 4, role: 'seasoning', confidence: 'medium' },
      ],
    },
    {
      kind: 'dish',
      label: 'みそ汁',
      composition_known: false,
      components: [
        { label: '豆腐', served_g: 30, role: 'ingredient', confidence: 'medium' },
        { label: 'わかめ', served_g: 5, role: 'ingredient', confidence: 'medium' },
        { label: 'みそ', served_g: 12, role: 'seasoning', confidence: 'medium' },
      ],
    },
  ],
} as const;

export const mockAdapter: AiAdapter = {
  provider: 'mock',
  model: 'mock-fixed-meal-v1',
  analyzeMealImage() {
    return Promise.resolve(structuredClone(MOCK_RESULT));
  },
};
