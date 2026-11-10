import { assertEquals, assertNotEquals } from '@std/assert';
import { ALLOWED_LOG_KEYS, hashUserId, sanitizeLogFields } from './log.ts';

Deno.test('sanitizeLogFields drops keys outside the allow-list', () => {
  const out = sanitizeLogFields({
    fn: 'x',
    status: 200,
    email: 'a@example.com',
    display_name: '山田',
    weight_kg: 60,
    food: 'ごはん',
    authorization: 'Bearer abc',
    body: { nested: true },
  });
  assertEquals(out, { fn: 'x', status: 200 });
});

Deno.test('sanitizeLogFields drops non-primitive values and truncates strings', () => {
  const out = sanitizeLogFields({ event: { a: 1 }, error_code: 'e'.repeat(500), request_id: ['a'] });
  assertEquals(out.event, undefined);
  assertEquals(out.request_id, undefined);
  assertEquals(out.error_code?.toString().length, 100);
});

Deno.test('allow-list contains no personal or health field names', () => {
  for (const key of ALLOWED_LOG_KEYS) {
    for (const banned of [
      'email',
      'name',
      'phone',
      'weight',
      'food',
      'image',
      'jwt',
      'secret',
      'password',
      'authorization',
      'body',
    ]) {
      assertEquals(key.includes(banned), false, `${key} contains ${banned}`);
    }
  }
});

Deno.test('hashUserId is stable, salted and does not contain the id', async () => {
  const id = '6f1c2b3a-0000-4000-8000-000000000001';
  const a = await hashUserId(id, 'salt1');
  assertEquals(a, await hashUserId(id, 'salt1'));
  assertNotEquals(a, await hashUserId(id, 'salt2'));
  assertEquals(a.length, 16);
  assertEquals(a.includes('6f1c'), false);
});
