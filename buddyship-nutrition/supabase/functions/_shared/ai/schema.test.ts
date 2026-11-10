import { assert, assertEquals } from '@std/assert';
import { AiMealResult } from './schema.ts';
import { MOCK_RESULT } from './mock.ts';
import { selectAdapter } from './index.ts';

Deno.test('mock result satisfies the schema', () => {
  assert(AiMealResult.safeParse(MOCK_RESULT).success);
});

Deno.test('nutrient values, diagnoses and advice are rejected (SAFE-2〜4)', () => {
  const bad = [
    { ...MOCK_RESULT, items: [{ kind: 'food', label: 'ごはん', served_g: 150, confidence: 'high', energy_kcal: 234 }] },
    { ...MOCK_RESULT, diagnosis: '低栄養の疑い' },
    { ...MOCK_RESULT, advice: '塩分を控えましょう' },
    {
      ...MOCK_RESULT,
      items: [{ kind: 'dish', label: '肉じゃが', composition_known: true, components: [], protein_g: 3 }],
    },
  ];
  for (const b of bad) assertEquals(AiMealResult.safeParse(b).success, false);
});

Deno.test('ranges are enforced', () => {
  const tooHeavy = { is_food_image: true, items: [{ kind: 'food', label: 'x', served_g: 2001, confidence: 'high' }] };
  const tooMany = {
    is_food_image: true,
    items: Array.from({ length: 21 }, () => ({ kind: 'food', label: 'x', served_g: 1, confidence: 'high' })),
  };
  assertEquals(AiMealResult.safeParse(tooHeavy).success, false);
  assertEquals(AiMealResult.safeParse(tooMany).success, false);
});

Deno.test('only the mock provider exists until D-01 is decided', () => {
  assertEquals(selectAdapter('mock')?.provider, 'mock');
  assertEquals(selectAdapter('anthropic'), null);
  assertEquals(selectAdapter(undefined), null);
});
